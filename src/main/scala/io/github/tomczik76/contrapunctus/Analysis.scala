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

  def apply(
      tonic: NoteType,
      scale: Scale,
      measures: NonEmptyList[Pulse[Note]]
  ): NonEmptyList[Pulse[Analysis]] =
    // Phase 1: Flatten to ordered beats
    val beats: List[NonEmptyList[Note]] =
      measures.toList.flatMap(flattenPulse)

    // Phase 2: Identify chords, trying subsets if all notes don't match
    val chordsPerBeat: List[Set[Chord]] =
      beats.map(identifyChords(_, tonic, scale))

    // Phase 3: Classify each note as chord tone or NCT using melodic context
    val analyses: List[Analysis] = beats.indices.toList.map { i =>
      val analyzedNotes = classifyBeatNotes(i, beats, chordsPerBeat)
      val analyzedChords =
        chordsPerBeat(i).map(c => AnalyzedChord(c, tonic, scale))
      Analysis(analyzedChords, analyzedNotes)
    }

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

  private def flattenPulse[A](pulse: Pulse[A]): List[NonEmptyList[A]] =
    pulse match
      case Pulse.Atom(v) => List(v)
      case Pulse.Tie(v)  => List(v)
      case Pulse.Rest    => Nil
      case Pulse.Duplet(a, b) =>
        flattenPulse(a) ++ flattenPulse(b)
      case Pulse.Triplet(a, b, c) =>
        flattenPulse(a) ++ flattenPulse(b) ++ flattenPulse(c)
      case Pulse.Quintuplet(a, b, c, d, e) =>
        flattenPulse(a) ++ flattenPulse(b) ++ flattenPulse(c) ++
          flattenPulse(d) ++ flattenPulse(e)
      case Pulse.Septuplet(a, b, c, d, e, f, g) =>
        flattenPulse(a) ++ flattenPulse(b) ++ flattenPulse(c) ++
          flattenPulse(d) ++ flattenPulse(e) ++ flattenPulse(f) ++
          flattenPulse(g)

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
end Analysis
