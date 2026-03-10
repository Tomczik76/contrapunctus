package io.github.tomczik76.contrapunctus

import cats.data.{NonEmptyList, NonEmptySet}

case class AnalyzedChord(
    chord: Chord,
    tonic: NoteType,
    scale: Scale
):
  val alteredScaleDegrees: NonEmptySet[AlteredScaleDegree] =
    scale.alteredScaleDegree(tonic, chord.root)

  def romanNumerals: NonEmptyList[String] =
    alteredScaleDegrees.toNonEmptyList.map { asd =>
      val numeral =
        if chord.chordType.isMinorQuality
        then asd.degree.romanNumeral.toLowerCase
        else asd.degree.romanNumeral
      val alteration =
        if asd.alteration == Alteration.Natural then ""
        else asd.alteration.toString
      s"$alteration$numeral${chord.chordType.qualitySymbol}${chord.chordType.figuredBass}"
    }

case class Analysis(chords: Set[AnalyzedChord], notes: List[AnalyzedNote])

case class VoiceAnalysis(
    harmonicAnalysis: NonEmptyList[Pulse[Analysis]],
    partWritingErrors: List[PartWritingError]
)

object Analysis:
  def apply(
      tonic: NoteType,
      scale: Scale,
      measures: Pulse[Note]*
  ): NonEmptyList[Pulse[Analysis]] =
    apply(
      tonic,
      scale,
      NonEmptyList(measures.head, measures.tail.toList)
    )

  /** Analyze multiple independent voices: runs harmonic analysis on the
    * combined vertical sonorities and validates part-writing rules.
    * Voices should be ordered from highest (index 0) to lowest.
    *
    * Uses Pulse.align to correctly handle voices with different
    * rhythmic subdivisions.
    */
  def fromVoices(
      tonic: NoteType,
      scale: Scale,
      voices: List[NonEmptyList[Pulse[Note]]]
  ): VoiceAnalysis =
    val columns = PartWriting.alignVoices(voices)
    val combined: NonEmptyList[Pulse[Note]] =
      NonEmptyList.fromListUnsafe(
        columns.map { col =>
          val notes = NonEmptyList.fromListUnsafe(
            col.values.flatten.flatMap(_.toList).sortBy(_.midi).toList
          )
          Pulse.Atom(notes): Pulse[Note]
        }
      )
    val harmonic = apply(tonic, scale, combined)
    val beatAnalyses =
      harmonic.toList.flatMap(Pulse.flatten).map(_.head)
    VoiceAnalysis(
      harmonicAnalysis = harmonic,
      partWritingErrors =
        PartWriting.check(voices, tonic, scale) ++
          PartWriting.checkDoublings(columns, beatAnalyses)
    )

  /** Analyze a sequence of pulses and run part-writing checks using
    * inferred voice leading. Works on any Pulse[Note] input — voices
    * are inferred from the vertical sonorities via nearest-note matching.
    */
  def analyzeWithPartWriting(
      tonic: NoteType,
      scale: Scale,
      measures: NonEmptyList[Pulse[Note]]
  ): VoiceAnalysis =
    val harmonic = apply(tonic, scale, measures)
    val beatAnalyses =
      harmonic.toList.flatMap(Pulse.flatten).map(_.head)
    val beats: List[NonEmptyList[Note]] =
      measures.toList.flatMap(Pulse.flatten)
    val columns = beats.zipWithIndex.map { (notes, _) =>
      AlignedColumn(
        Rational(0),
        notes.toList.sortBy(-_.midi).map(n => Some(NonEmptyList.one(n))).toIndexedSeq
      )
    }
    val voices = PartWriting.inferVoices(columns)
    VoiceAnalysis(
      harmonicAnalysis = harmonic,
      partWritingErrors =
        PartWriting.checkVertical(columns, tonic, scale) ++
          PartWriting.checkHorizontal(voices) ++
          PartWriting.checkDoublings(columns, beatAnalyses)
    )

  def fromSounding(
      tonic: NoteType,
      scale: Scale,
      measures: Pulse[Sounding]*
  ): NonEmptyList[Pulse[Analysis]] =
    apply(
      tonic,
      scale,
      NonEmptyList(measures.head, measures.tail.toList).map(_.map(_.note))
    )

  def apply(
      tonic: NoteType,
      scale: Scale,
      measures: NonEmptyList[Pulse[Note]]
  ): NonEmptyList[Pulse[Analysis]] =
    // Phase 1: Flatten to ordered beats
    val beats: List[NonEmptyList[Note]] =
      measures.toList.flatMap(Pulse.flatten)

    // Phase 2: Identify chords, trying subsets if all notes don't match
    val chordsPerBeat: List[Set[Chord]] =
      beats.map(identifyChords(_, tonic, scale))

    // Phase 3: Classify each note as chord tone or NCT using melodic context
    val classified: List[Analysis] = beats.indices.toList.map { i =>
      val analyzedNotes = classifyBeatNotes(i, beats, chordsPerBeat)
      val analyzedChords =
        chordsPerBeat(i).map(c => AnalyzedChord(c, tonic, scale))
      Analysis(analyzedChords, analyzedNotes)
    }

    // Phase 3.5: Reclassify escape tone + appoggiatura pairs as changing tones
    val analyses = reclassifyChangingTones(classified)

    // Phase 4: Map back into Pulse structure
    PulseTransform
      .mapWithStateList(measures, analyses):
        case (_, head :: tail) =>
          (NonEmptyList.one(head), tail)
        case (_, Nil) =>
          throw AssertionError(
            "Mismatch between flattened beats and pulse structure"
          )
      ._1
  end apply

  private def identifyChords(
      notes: NonEmptyList[Note],
      tonic: NoteType,
      scale: Scale
  ): Set[Chord] =
    val scalePitchClasses =
      scale.intervals.toList.map(i => (tonic.value + i.value) % 12).toSet

    def isDiatonic(chord: Chord): Boolean =
      val rootOffset = chord.chordType.rootInterval.normalizedValue
      chord.chordType.intervals.toSortedSet.forall { i =>
        val pc =
          (chord.root.value + (i.normalizedValue - rootOffset + 12) % 12) % 12
        scalePitchClasses.contains(pc)
      }

    def preferNonSus(chords: Set[Chord]): Set[Chord] =
      val nonSus =
        chords.filter(c => !c.chordType.qualitySymbol.contains("sus"))
      if nonSus.nonEmpty then nonSus else chords

    val fromAll         = Chord.fromNotes(notes.head, notes.tail*)
    val diatonicFromAll = fromAll.filter(isDiatonic)
    if diatonicFromAll.nonEmpty then preferNonSus(diatonicFromAll)
    else
      val notesList = notes.toList
      val fromSubsets = for
        i <- notesList.indices.toList
        subset = notesList.patch(i, Nil, 1)
        if subset.nonEmpty
        chords = Chord.fromNotes(subset.head, subset.tail*)
        if chords.nonEmpty
      yield chords
      val allSubsets      = fromSubsets.flatten.toSet
      val diatonicSubsets = allSubsets.filter(isDiatonic)
      val preferred       = preferNonSus(diatonicSubsets)
      if preferred.nonEmpty then preferred
      else if fromAll.nonEmpty then fromAll
      else allSubsets
  end identifyChords

  private def findClosestNote(
      target: Note,
      candidates: NonEmptyList[Note]
  ): Note = candidates.toList.minBy(n => Math.abs(n.midi - target.midi))

  private def classifyBeatNotes(
      beatIndex: Int,
      beats: List[NonEmptyList[Note]],
      chordsPerBeat: List[Set[Chord]]
  ): List[AnalyzedNote] =
    val notes        = beats(beatIndex)
    val primaryChord = chordsPerBeat(beatIndex).headOption
    val bass         = Some(notes.toList.minBy(_.midi))
    primaryChord match
      case None =>
        notes.toList.map(n => AnalyzedNote(n, None))
      case Some(chord) =>
        notes.toList.map { note =>
          if chord.isChordTone(note.noteType) then AnalyzedNote(note, None)
          else
            val prevPair = for
              i         <- Option.when(beatIndex > 0)(beatIndex - 1)
              prevChord <- chordsPerBeat(i).headOption
            yield (findClosestNote(note, beats(i)), prevChord)

            val nextPair = for
              i <- Option.when(beatIndex < beats.size - 1)(beatIndex + 1)
              nextChord <- chordsPerBeat(i).headOption
            yield (findClosestNote(note, beats(i)), nextChord)

            val nctType = NonChordToneAnalysis.classify(
              prevPair,
              (note, chord),
              nextPair,
              bass
            )
            AnalyzedNote(note, nctType)
        }
    end match
  end classifyBeatNotes

  private def reclassifyChangingTones(
      analyses: List[Analysis]
  ): List[Analysis] =
    if analyses.size < 2 then analyses
    else
      val arr = analyses.toArray
      for i <- 0 until arr.length - 1 do
        val pairs = for
          (esc, ei) <- arr(i).notes.zipWithIndex
          if esc.nonChordToneType.contains(NonChordToneType.EscapeTone)
          (app, ai) <- arr(i + 1).notes.zipWithIndex
          if app.nonChordToneType.contains(NonChordToneType.Appoggiatura)
          if Math.abs(esc.note.midi - app.note.midi) <= 5
        yield (ei, ai, esc, app)
        pairs
          .minByOption((_, _, e, a) =>
            Math.abs(e.note.midi - a.note.midi)
          )
          .foreach { (ei, ai, esc, app) =>
            arr(i) = arr(i).copy(notes =
              arr(i).notes.updated(
                ei,
                esc.copy(nonChordToneType =
                  Some(NonChordToneType.ChangingTone)
                )
              )
            )
            arr(i + 1) = arr(i + 1).copy(notes =
              arr(i + 1).notes.updated(
                ai,
                app.copy(nonChordToneType =
                  Some(NonChordToneType.ChangingTone)
                )
              )
            )
          }
      arr.toList
  end reclassifyChangingTones
end Analysis
