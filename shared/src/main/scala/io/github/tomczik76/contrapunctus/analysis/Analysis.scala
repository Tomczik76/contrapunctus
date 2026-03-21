package io.github.tomczik76.contrapunctus.analysis

import cats.data.{NonEmptyList, NonEmptySet}
import io.github.tomczik76.contrapunctus.core.{
  Alteration,
  AlteredScaleDegree,
  Note,
  NoteType,
  Scale,
  ScaleDegree
}
import io.github.tomczik76.contrapunctus.harmony.{Chord, Inversion, Sevenths, Triads}
import io.github.tomczik76.contrapunctus.rhythm.{
  AlignedColumn,
  Pulse,
  PulseTransform,
  Rational,
  Sounding
}

case class AnalyzedChord(
    chord: Chord,
    tonic: NoteType,
    scale: Scale
):
  val alteredScaleDegrees: NonEmptySet[AlteredScaleDegree] =
    scale.alteredScaleDegree(tonic, chord.root)

  def romanNumerals: NonEmptyList[String] =
    val base = alteredScaleDegrees.toNonEmptyList.map: asd =>
      val numeral =
        if chord.chordType.isMinorQuality
        then asd.degree.romanNumeral.toLowerCase
        else asd.degree.romanNumeral
      val alteration =
        if asd.alteration == Alteration.Natural then ""
        else asd.alteration.toString
      s"$alteration$numeral${chord.chordType.qualitySymbol}${chord.chordType.figuredBass}"

    // Neapolitan chord: major triad on ♭II
    val neapolitan = chord.chordType match
      case Inversion(Triads.Major, idx, _, _) =>
        val isFlatTwo = alteredScaleDegrees.exists: asd =>
          asd.degree == ScaleDegree.Supertonic && asd.alteration == Alteration.Flat
        if isFlatTwo then
          val fb = chord.chordType.figuredBass
          Some(s"N$fb")
        else None
      case _ => None

    neapolitan match
      case Some(label) => NonEmptyList(label, base.toList)
      case None        => base

case class Analysis(
    chords: Set[AnalyzedChord],
    notes: List[AnalyzedNote],
    errors: List[ChordError] = Nil
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
    * combined vertical sonorities and validates part-writing rules. Voices
    * should be ordered from highest (index 0) to lowest.
    *
    * Uses Pulse.align to correctly handle voices with different rhythmic
    * subdivisions.
    */
  def fromVoices(
      tonic: NoteType,
      scale: Scale,
      voices: List[NonEmptyList[Pulse[Note]]]
  ): NonEmptyList[Pulse[Analysis]] =
    val columns = PartWriting.alignVoices(voices)
    val combined: NonEmptyList[Pulse[Note]] =
      NonEmptyList.fromListUnsafe(
        columns.map: col =>
          val notes = NonEmptyList.fromListUnsafe(
            col.values.flatten.flatMap(_.toList).sortBy(_.midi).toList
          )
          Pulse.Atom(notes): Pulse[Note]
      )
    val harmonic = apply(tonic, scale, combined)
    val beatAnalyses =
      harmonic.toList.flatMap(Pulse.flatten).map(_.head)
    val voiceLists = PartWriting.extractVoiceLists(columns)
    val annotated =
      PartWriting.annotateAnalyses(
        beatAnalyses,
        columns,
        voiceLists,
        tonic,
        scale
      )
    remapAnalyses(harmonic, annotated)
  end fromVoices

  /** Analyze a sequence of pulses and run part-writing checks using inferred
    * voice leading. Works on any Pulse[Note] input — voices are inferred from
    * the vertical sonorities via nearest-note matching.
    */
  def analyzeWithPartWriting(
      tonic: NoteType,
      scale: Scale,
      measures: NonEmptyList[Pulse[Note]]
  ): NonEmptyList[Pulse[Analysis]] =
    val harmonic = apply(tonic, scale, measures)
    val beatAnalyses =
      harmonic.toList.flatMap(Pulse.flatten).map(_.head)
    val beats: List[NonEmptyList[Note]] =
      measures.toList.flatMap(Pulse.flatten)
    val columns = beats.zipWithIndex.map: (notes, _) =>
      AlignedColumn(
        Rational(0),
        notes.toList
          .sortBy(-_.midi)
          .map(n => Some(NonEmptyList.one(n)))
          .toIndexedSeq
      )
    val voices = PartWriting.inferVoices(columns)
    val annotated =
      PartWriting.annotateAnalyses(
        beatAnalyses,
        columns,
        voices,
        tonic,
        scale,
        checkCrossing = false
      )
    remapAnalyses(harmonic, annotated)
  end analyzeWithPartWriting

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
    val rawChords: List[Set[Chord]] =
      beats.map(identifyChords(_, tonic, scale))

    // Phase 2.5: Replace beats that have only sus/power chords (or no chords)
    // with the nearest neighbor's real chord. This handles incomplete voicings
    // and treats sus-forming notes as potential NCTs.
    def hasRealChord(chords: Set[Chord]): Boolean =
      chords.nonEmpty && chords.exists: c =>
        !c.chordType.qualitySymbol.contains("sus") &&
          (c.chordType match
            case Inversion(Triads.PowerChord, _, _, _) => false
            case _                                     => true)

    val chordsPerBeat: List[Set[Chord]] = rawChords.indices.toList.map: i =>
      if hasRealChord(rawChords(i)) then rawChords(i)
      else
        val maxDist = rawChords.size
        val neighbor = (1 to maxDist).view.flatMap: d =>
          val prev = Option.when(i - d >= 0)(rawChords(i - d)).filter(hasRealChord)
          val next = Option.when(i + d < rawChords.size)(rawChords(i + d)).filter(hasRealChord)
          prev.orElse(next)
        .headOption
        // Use neighbor's real chord if found, otherwise keep whatever we had
        neighbor.getOrElse(rawChords(i))

    // Phase 3: Classify each note as chord tone or NCT using melodic context.
    // Use propagated chords for NCT classification but display only the
    // directly identified chords as roman numerals.
    val classified: List[Analysis] = beats.indices.toList.map: i =>
      val analyzedNotes = classifyBeatNotes(i, beats, chordsPerBeat)
      val analyzedChords =
        rawChords(i).map(c => AnalyzedChord(c, tonic, scale))
      Analysis(analyzedChords, analyzedNotes)

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
      chord.chordType.intervals.toSortedSet.forall: i =>
        val pc =
          (chord.root.value + (i.normalizedValue - rootOffset + 12) % 12) % 12
        scalePitchClasses.contains(pc)

    def isPowerChord(c: Chord): Boolean = c.chordType match
      case Inversion(Triads.PowerChord, _, _, _) => true
      case _                                     => false

    def preferNonSus(chords: Set[Chord]): Set[Chord] =
      val nonSus =
        chords.filter(c => !c.chordType.qualitySymbol.contains("sus"))
      if nonSus.nonEmpty then nonSus else chords

    val fromAll         = Chord.fromNotes(notes.head, notes.tail*)
    val diatonicFromAll = fromAll.filter(isDiatonic)
    if diatonicFromAll.nonEmpty then
      val nonSus = preferNonSus(diatonicFromAll)
      // If only sus chords were found from all notes, try subsets for real
      // triads/sevenths so the NCT classifier can treat the sus note as an NCT
      val allSus = nonSus.forall(c => c.chordType.qualitySymbol.contains("sus"))
      if allSus then
        val notesList = notes.toList
        val subsetNonSus = (for
          i <- notesList.indices.toList
          subset = notesList.patch(i, Nil, 1)
          if subset.nonEmpty
          chords = Chord.fromNotes(subset.head, subset.tail*)
          chord <- chords
          if isDiatonic(chord)
          if !chord.chordType.qualitySymbol.contains("sus")
          if !isPowerChord(chord)
        yield chord).toSet
        if subsetNonSus.nonEmpty then subsetNonSus
        else nonSus
      else nonSus
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
      // Prefer non-diatonic full-chord identification (e.g. VMaj7)
      // over diatonic subset triads, but only when every input note
      // is a chord tone AND the chord root is diatonic to the scale.
      val pitchClasses = notes.toList.map(_.noteType).toSet
      val fullChordMatch = fromAll.filter: chord =>
        pitchClasses.forall(chord.isChordTone) &&
          scalePitchClasses.contains(chord.root.value)
      if fullChordMatch.nonEmpty then preferNonSus(fullChordMatch)
      else
        val preferred = preferNonSus(diatonicSubsets)
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
    // When the current beat has no identifiable chord (e.g. passing tones or
    // incomplete voicings), search outward for the nearest beat with a chord.
    val effectiveChord = primaryChord.orElse:
      // Search backwards then forwards, expanding distance
      val maxDist = chordsPerBeat.size
      (1 to maxDist).view.flatMap: d =>
        val prev = Option.when(beatIndex - d >= 0)(beatIndex - d)
          .flatMap(chordsPerBeat(_).headOption)
        val next = Option.when(beatIndex + d < chordsPerBeat.size)(beatIndex + d)
          .flatMap(chordsPerBeat(_).headOption)
        prev.orElse(next)
      .headOption

    effectiveChord match
      case None =>
        notes.toList.map(n => AnalyzedNote(n, None))
      case Some(chord) =>
        notes.toList.map: note =>
          if primaryChord.isDefined && chord.isChordTone(note.noteType) then
            AnalyzedNote(note, None)
          else
            // Search backwards for nearest beat with a chord
            val prevPair = (1 to beatIndex).view.flatMap: d =>
              val i = beatIndex - d
              chordsPerBeat(i).headOption.map: prevChord =>
                (findClosestNote(note, beats(i)), prevChord)
            .headOption

            // Search forwards for nearest beat with a chord
            val nextPair = (1 until (beats.size - beatIndex)).view.flatMap: d =>
              val i = beatIndex + d
              chordsPerBeat(i).headOption.map: nextChord =>
                (findClosestNote(note, beats(i)), nextChord)
            .headOption

            val nctType = NonChordToneAnalysis.classify(
              prevPair,
              (note, chord),
              nextPair,
              bass
            )
            AnalyzedNote(note, nctType)
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
          .minByOption((_, _, e, a) => Math.abs(e.note.midi - a.note.midi))
          .foreach: (ei, ai, esc, app) =>
            arr(i) = arr(i).copy(notes =
              arr(i).notes.updated(
                ei,
                esc.copy(nonChordToneType = Some(NonChordToneType.ChangingTone))
              )
            )
            arr(i + 1) = arr(i + 1).copy(notes =
              arr(i + 1).notes.updated(
                ai,
                app.copy(nonChordToneType = Some(NonChordToneType.ChangingTone))
              )
            )
      end for
      arr.toList
  end reclassifyChangingTones

  /** Compute secondary dominant labels for a chord given what follows it.
    * Only returns labels when the chord contains at least one chromatic note
    * and resolves to a diatonic target. Excludes V/I (that's just V).
    */
  def secondaryDominantLabels(
      notes: NonEmptyList[Note],
      currentChords: Set[Chord],
      nextChords: Set[Chord],
      tonic: NoteType,
      scale: Scale
  ): List[String] =
    val scalePCs =
      scale.intervals.toList.map(i => (tonic.value + i.value) % 12).toSet
    val notePCs = notes.toList.map(n => n.noteType.value % 12).toSet

    // Must have at least one chromatic note
    if notePCs.subsetOf(scalePCs) then return Nil

    val scaleIntervals = scale.intervals.toList.map(_.value)

    def targetRomanNumeral(targetRoot: NoteType): Option[String] =
      val targetPC = targetRoot.value % 12
      val rootPC   = tonic.value % 12
      val interval = (targetPC - rootPC + 12) % 12
      val degreeIdx = scaleIntervals.indexOf(interval)
      if degreeIdx < 0 then None // not diatonic
      else
        val degree = ScaleDegree.fromOrdinal(degreeIdx)
        // Don't show V/I — that's just the regular dominant
        if degree == ScaleDegree.Tonic then None
        else
          // Determine if diatonic triad on this degree is minor
          val thirdInterval = scaleIntervals((degreeIdx + 2) % 7)
          val third = (thirdInterval - scaleIntervals(degreeIdx) + 12) % 12
          val isMinor = third == 3
          val numeral =
            if isMinor then degree.romanNumeral.toLowerCase
            else degree.romanNumeral
          Some(numeral)

    val isSecDomType = (chord: Chord) => chord.chordType match
      case Inversion(Triads.Major, _, _, _)             => true
      case Inversion(Sevenths.DominantSeventh, _, _, _) => true
      case _                                            => false

    val results = for
      chord <- currentChords.toList
      if isSecDomType(chord)
      nextChord <- nextChords.toList
      // V of X: chord root is P5 above next chord root
      if chord.root.value % 12 == (nextChord.root.value + 7) % 12
      target <- targetRomanNumeral(nextChord.root).toList
    yield
      val fb = chord.chordType.figuredBass
      s"V$fb/$target"

    results.distinct
  end secondaryDominantLabels

  /** Detect augmented sixth chords by pitch class content relative to tonic.
    * Returns a label (It⁺⁶, Fr⁺⁶, Ger⁺⁶) if the notes match one of the
    * three augmented sixth chord types.
    *
    * Pitch classes relative to tonic:
    *   Italian:  {♭6, 1, ♯4}       — 3 notes
    *   French:   {♭6, 1, 2, ♯4}    — 4 notes
    *   German:   {♭6, 1, ♭3, ♯4}   — 4 notes
    */
  def augmentedSixthLabel(
      notes: NonEmptyList[Note],
      tonic: NoteType
  ): Option[String] =
    val tonicPC = tonic.value % 12
    val pcs = notes.toList.map(n => (n.noteType.value - tonicPC + 12) % 12).toSet
    val flat6 = 8 // minor 6th above tonic
    val sharp4 = 6 // augmented 4th / tritone
    if !pcs.contains(flat6) || !pcs.contains(sharp4) then None
    else if pcs == Set(flat6, 0, sharp4) then Some("It⁺⁶")
    else if pcs == Set(flat6, 0, 2, sharp4) then Some("Fr⁺⁶")
    else if pcs == Set(flat6, 0, 3, sharp4) then Some("Ger⁺⁶")
    else None
  end augmentedSixthLabel

  /** Replace flat analyses back into Pulse structure, preserving shape. */
  private def remapAnalyses(
      original: NonEmptyList[Pulse[Analysis]],
      annotated: List[Analysis]
  ): NonEmptyList[Pulse[Analysis]] =
    PulseTransform
      .mapWithStateList(original, annotated):
        case (_, head :: tail) =>
          (NonEmptyList.one(head), tail)
        case (_, Nil) =>
          throw AssertionError(
            "Mismatch between flattened beats and pulse structure"
          )
      ._1
end Analysis
