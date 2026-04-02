package io.github.tomczik76.contrapunctus.analysis

import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
import io.github.tomczik76.contrapunctus.harmony.{
  Chord,
  Elevenths,
  Inversion,
  Ninths,
  Sevenths,
  Thirteenths
}
import io.github.tomczik76.contrapunctus.rhythm.{AlignedColumn, Pulse}

/** Note-level part-writing errors, embedded on individual AnalyzedNotes. */
enum NoteError:
  case ParallelFifths
  case ParallelOctaves
  case DirectFifths
  case DirectOctaves
  case VoiceCrossing
  case SpacingError(semitones: Int)
  case DoubledLeadingTone
  case UnresolvedLeadingTone
  case UnresolvedChordal7th
  case DissonantInterval
  case ImperfectConsonanceRequired
  case ForbiddenMelodicInterval
  case RepeatedPitch
  case UnisonNotAtEndpoints
  case BadPenultimate
  case CfNotOnTonic
  case CpLastNotUnison

/** Chord-level part-writing errors, embedded on Analysis (per-beat). */
enum ChordError:
  case RootNotDoubledInRootPosition
  case FifthNotDoubledInSecondInversion

object PartWriting:

  /** Annotate a list of Analysis objects with part-writing errors. Note-level
    * errors are embedded on the relevant AnalyzedNotes; chord-level errors are
    * embedded on the Analysis itself.
    */
  private[analysis] def annotateAnalyses(
      analyses: List[Analysis],
      columns: List[AlignedColumn[Note]],
      voices: List[List[Option[Note]]],
      tonic: NoteType,
      scale: Scale,
      checkCrossing: Boolean = true
  ): List[Analysis] =
    val beats = columnNotes(columns)

    val noteErrs: List[(Int, Note, NoteError)] =
      checkParallels(voices) ++
        checkDirectMotion(voices) ++
        (if checkCrossing then checkVoiceCrossing(voices) else Nil) ++
        checkSpacing(beats) ++
        checkDoubledLeadingTone(beats, tonic, scale) ++
        checkLeadingToneResolution(voices, analyses, tonic, scale) ++
        checkChordal7thResolution(voices, analyses)

    val chordErrs: List[(Int, ChordError)] =
      checkDoublings(beats, analyses)

    val noteErrsByBeat = noteErrs
      .groupBy(_._1)
      .view
      .mapValues(_.map { case (_, note, err) => (note, err) })
      .toMap
    val chordErrsByBeat = chordErrs
      .groupBy(_._1)
      .view
      .mapValues(_.map(_._2))
      .toMap

    analyses.zipWithIndex.map: (analysis, beat) =>
      val beatNoteErrs = noteErrsByBeat.getOrElse(beat, Nil)
      val updatedNotes = analysis.notes.map: an =>
        val errs = beatNoteErrs.collect:
          case (note, err) if note == an.note => err
        if errs.nonEmpty then an.copy(errors = an.errors ++ errs) else an
      analysis.copy(
        notes = updatedNotes,
        errors = analysis.errors ++ chordErrsByBeat.getOrElse(beat, Nil)
      )
  end annotateAnalyses

  /** Infer voice assignment from a sequence of aligned columns. Sorts notes by
    * pitch (high to low) and tracks voices across beats by nearest-note
    * matching to minimize MIDI distance.
    *
    * Returns `List[List[Option[Note]]]` where each inner list has one entry per
    * beat. `None` marks a beat where that voice is silent (the chord has fewer
    * notes than the maximum voice count).
    */
  def inferVoices(
      columns: List[AlignedColumn[Note]]
  ): List[List[Option[Note]]] =
    val beats = columnNotes(columns)
    if beats.isEmpty then Nil
    else
      val numVoices = beats.map(_.size).max
      val voiceArrays = Array.fill(numVoices)(List.newBuilder[Option[Note]])

      // Initialize from first beat
      val firstSorted = beats.head.sortBy(-_.midi)
      val initial = Array.ofDim[Option[Note]](numVoices)
      for i <- 0 until numVoices do
        initial(i) = firstSorted.lift(i)
        voiceArrays(i) += initial(i)

      // Track the last known note for each voice (for nearest-match)
      val lastKnown = Array.ofDim[Note](numVoices)
      firstSorted.zipWithIndex.foreach { (n, i) => lastKnown(i) = n }
      // For voices beyond the first beat's size, set a reasonable default
      if firstSorted.size < numVoices then
        for i <- firstSorted.size until numVoices do
          lastKnown(i) = firstSorted.last

      // Track which voices were active in the previous beat
      val prevActive = Array.fill(numVoices)(false)
      for i <- 0 until firstSorted.size do prevActive(i) = true

      for notes <- beats.tail do
        val sorted = notes.sortBy(-_.midi)
        val realCount = sorted.size
        val used = Array.fill(realCount)(false)
        val current = Array.fill[Option[Note]](numVoices)(None)

        // Match each voice to its nearest available note
        // Process voices that had notes most recently first for stability
        val voiceOrder = (0 until numVoices).sortBy(i => if initial.lift(i).flatten.isDefined then 0 else 1)
        for i <- 0 until numVoices do
          val candidates = sorted.zipWithIndex.filterNot { case (_, j) => used(j) }
          if candidates.nonEmpty then
            val (bestNote, bestIdx) = candidates.minBy { case (n, _) =>
              Math.abs(n.midi - lastKnown(i).midi)
            }
            current(i) = Some(bestNote)
            used(bestIdx) = true
            lastKnown(i) = bestNote

        // Fix crossings among continuing voices (active in both previous
        // and current beat). Without this, nearest-note matching can swap
        // voices (e.g., soprano grabs an alto note) and mask resolution errors.
        // New voices entering at a different register are left in place so
        // they don't displace existing voice assignments.
        var swapped = true
        while swapped do
          swapped = false
          for idx <- 0 until numVoices - 1 do
            (current(idx), current(idx + 1)) match
              case (Some(a), Some(b))
                  if prevActive(idx) && prevActive(idx + 1) && a.midi < b.midi =>
                current(idx) = Some(b)
                current(idx + 1) = Some(a)
                lastKnown(idx) = b
                lastKnown(idx + 1) = a
                swapped = true
              case _ => ()

        current.zipWithIndex.foreach { (n, i) =>
          voiceArrays(i) += n
          prevActive(i) = n.isDefined
        }
      end for

      voiceArrays.toList.map(_.result())
    end if
  end inferVoices

  // --- Internal helpers ---

  /** Align voices using Pulse.align for correct rhythmic alignment. */
  private[analysis] def alignVoices(
      voices: List[NonEmptyList[Pulse[Note]]]
  ): List[AlignedColumn[Note]] =
    if voices.isEmpty then Nil
    else
      val pulses = voices.map: nel =>
        if nel.tail.isEmpty then nel.head
        else
          nel.tail.foldLeft(nel.head): (acc, p) =>
            Pulse.Duplet(acc, p): Pulse[Note]
      Pulse.align(pulses.toIndexedSeq)

  /** Extract per-voice note lists from aligned columns. */
  private[analysis] def extractVoiceLists(
      columns: List[AlignedColumn[Note]]
  ): List[List[Note]] =
    if columns.isEmpty then Nil
    else
      val numVoices = columns.head.values.size
      (0 until numVoices).toList.map: i =>
        columns.flatMap(_.values(i).map(_.head))

  /** Extract sorted note lists per beat from aligned columns. */
  private def columnNotes(
      columns: List[AlignedColumn[Note]]
  ): List[List[Note]] =
    columns.map(_.values.flatten.flatMap(_.toList).sortBy(-_.midi).toList)

  private[analysis] def intervalClass(a: Note, b: Note): Int =
    Math.abs(a.midi - b.midi) % 12

  private[analysis] def checkParallels(
      voices: List[List[Option[Note]]]
  ): List[(Int, Note, NoteError)] =
    val numVoices = voices.size
    val numBeats  = if voices.nonEmpty then voices.head.size else 0
    for
      beat <- (1 until numBeats).toList
      i    <- (0 until numVoices).toList
      j    <- (i + 1 until numVoices).toList
      prev1 <- voices(i)(beat - 1).toList
      prev2 <- voices(j)(beat - 1).toList
      curr1 <- voices(i)(beat).toList
      curr2 <- voices(j)(beat).toList
      if prev1.midi != curr1.midi && prev2.midi != curr2.midi
      prevInterval = intervalClass(prev1, prev2)
      currInterval = intervalClass(curr1, curr2)
      if prevInterval == currInterval
      err <- prevInterval match
        case 7 =>
          List(
            (beat, curr1, NoteError.ParallelFifths),
            (beat, curr2, NoteError.ParallelFifths)
          )
        case 0 =>
          List(
            (beat, curr1, NoteError.ParallelOctaves),
            (beat, curr2, NoteError.ParallelOctaves)
          )
        case _ => Nil
    yield err
    end for
  end checkParallels

  private[analysis] def checkDirectMotion(
      voices: List[List[Option[Note]]]
  ): List[(Int, Note, NoteError)] =
    if voices.size < 2 then Nil
    else
      val soprano  = 0
      val bass     = voices.size - 1
      val numBeats = voices.head.size
      for
        beat <- (1 until numBeats).toList
        sPrev <- voices(soprano)(beat - 1).toList
        sCurr <- voices(soprano)(beat).toList
        bPrev <- voices(bass)(beat - 1).toList
        bCurr <- voices(bass)(beat).toList
        sMotion = sCurr.midi - sPrev.midi
        bMotion = bCurr.midi - bPrev.midi
        if sMotion != 0 && bMotion != 0
        if (sMotion > 0) == (bMotion > 0)
        if Math.abs(sMotion) > 2
        currInterval = intervalClass(sCurr, bCurr)
        err <- currInterval match
          case 7 =>
            List(
              (beat, sCurr, NoteError.DirectFifths),
              (beat, bCurr, NoteError.DirectFifths)
            )
          case 0 =>
            List(
              (beat, sCurr, NoteError.DirectOctaves),
              (beat, bCurr, NoteError.DirectOctaves)
            )
          case _ => Nil
      yield err
      end for

  private[analysis] def checkVoiceCrossing(
      voices: List[List[Option[Note]]]
  ): List[(Int, Note, NoteError)] =
    val numVoices = voices.size
    val numBeats  = if voices.nonEmpty then voices.head.size else 0
    for
      beat <- (0 until numBeats).toList
      i    <- (0 until numVoices - 1).toList
      a    <- voices(i)(beat).toList
      b    <- voices(i + 1)(beat).toList
      if a.midi < b.midi
      err <- List(
        (beat, a, NoteError.VoiceCrossing),
        (beat, b, NoteError.VoiceCrossing)
      )
    yield err

  private def checkSpacing(
      beats: List[List[Note]]
  ): List[(Int, Note, NoteError)] =
    for
      (notes, beat) <- beats.zipWithIndex
      numVoices = notes.size
      i <- (0 until numVoices - 1).toList
      gap    = Math.abs(notes(i).midi - notes(i + 1).midi)
      maxGap = if i == numVoices - 2 then 24 else 12
      if gap > maxGap
      err <- List(
        (beat, notes(i), NoteError.SpacingError(gap)),
        (beat, notes(i + 1), NoteError.SpacingError(gap))
      )
    yield err

  private def checkDoubledLeadingTone(
      beats: List[List[Note]],
      tonic: NoteType,
      scale: Scale
  ): List[(Int, Note, NoteError)] =
    val hasLeadingTone = scale.intervals.toList.exists(_.value == 11)
    if !hasLeadingTone then Nil
    else
      val leadingTonePc = (tonic.value + 11) % 12
      for
        (notes, beat) <- beats.zipWithIndex
        pitchClasses = notes.map(_.noteType.value % 12)
        if pitchClasses.count(_ == leadingTonePc) > 1
        note <- notes
        if note.noteType.value % 12 == leadingTonePc
      yield (beat, note, NoteError.DoubledLeadingTone)

  private def checkDoublings(
      beats: List[List[Note]],
      analyses: List[Analysis]
  ): List[(Int, ChordError)] =
    val numVoices = beats.headOption.map(_.size).getOrElse(0)
    if numVoices < 4 then Nil
    else
      for
        (notes, beat) <- beats.zipWithIndex
        chord         <- analyses.lift(beat).flatMap(_.chords.headOption).toList
        bassNote = notes.last
        bassIntervalFromRoot =
          chord.chord.root.intervalAbove(bassNote.noteType).normalizedValue
        pitchClasses = notes.map(_.noteType.value % 12)
        if pitchClasses.toSet.size < pitchClasses.size
        err <- bassIntervalFromRoot match
          case 0 =>
            val rootPc = chord.chord.root.value % 12
            if pitchClasses.count(_ == rootPc) >= 2 then Nil
            else List((beat, ChordError.RootNotDoubledInRootPosition))
          case v if v >= 5 && v <= 8 =>
            val bassPc = bassNote.noteType.value % 12
            if pitchClasses.count(_ == bassPc) >= 2 then Nil
            else List((beat, ChordError.FifthNotDoubledInSecondInversion))
          case _ => Nil
      yield err
    end if
  end checkDoublings

  /** True if the chord has a chordal 7th (dim7/min7/maj7) and the note is
    * that 7th. Excludes add6 chords (MajorSixth/MinorSixth) since those use
    * the same semitone count (9) but the 6th doesn't carry the same tendency.
    */
  private def isChordal7th(note: Note, chord: Chord): Boolean =
    val inv = chord.chordType.asInstanceOf[Inversion]
    val is7thChord = inv.base match
      case Sevenths.MajorSixth | Sevenths.MinorSixth              => false
      case _: Sevenths | _: Ninths | _: Elevenths | _: Thirteenths => true
      case _                                                        => false
    is7thChord &&
    (note.noteType.value - chord.root.value + 12) % 12 >= 9 &&
    chord.isChordTone(note.noteType)

  /** True when two consecutive beats represent the same chord root and quality,
    * so that a tendency tone being held does not need to resolve yet.
    */
  private def sameChord(a: AnalyzedChord, b: AnalyzedChord): Boolean =
    a.chord.root == b.chord.root &&
      a.chord.chordType.intervals == b.chord.chordType.intervals

  /** Flag leading tones in dominant-function chords (V, V7, vii°, vii°7) that
    * do not resolve up by a semitone to tonic when the chord changes.
    */
  private def checkLeadingToneResolution(
      voices: List[List[Option[Note]]],
      analyses: List[Analysis],
      tonic: NoteType,
      scale: Scale
  ): List[(Int, Note, NoteError)] =
    val hasLeadingTone = scale.intervals.toList.exists(_.value == 11)
    if !hasLeadingTone then Nil
    else
      val ltPc    = (tonic.value + 11) % 12
      val tonicPc = tonic.value % 12
      val domPc   = (tonic.value + 7) % 12
      val numBeats = if voices.nonEmpty then voices.head.size else 0
      for
        voice <- voices
        beat  <- (0 until numBeats - 1).toList
        note     <- voice(beat).toList
        if note.noteType.value % 12 == ltPc
        chord    <- analyses.lift(beat).flatMap(_.chords.headOption).toList
        chordRootPc = chord.chord.root.value % 12
        if chordRootPc == domPc || chordRootPc == ltPc
        nextNote <- voice(beat + 1).toList
        nextChord  = analyses.lift(beat + 1).flatMap(_.chords.headOption)
        if !nextChord.exists(sameChord(chord, _))
        if !(nextNote.midi - note.midi == 1 && nextNote.noteType.value % 12 == tonicPc)
      yield (beat, note, NoteError.UnresolvedLeadingTone)
  end checkLeadingToneResolution

  /** Flag chordal 7ths that do not resolve down by a diatonic step (1–2
    * semitones) when the chord changes.
    */
  private def checkChordal7thResolution(
      voices: List[List[Option[Note]]],
      analyses: List[Analysis]
  ): List[(Int, Note, NoteError)] =
    val numBeats = if voices.nonEmpty then voices.head.size else 0
    for
      voice <- voices
      beat  <- (0 until numBeats - 1).toList
      note     <- voice(beat).toList
      chord    <- analyses.lift(beat).flatMap(_.chords.headOption).toList
      if isChordal7th(note, chord.chord)
      nextNote <- voice(beat + 1).toList
      nextChord  = analyses.lift(beat + 1).flatMap(_.chords.headOption)
      if !nextChord.exists(sameChord(chord, _))
      diff = note.midi - nextNote.midi
      if diff != 1 && diff != 2
    yield (beat, note, NoteError.UnresolvedChordal7th)
  end checkChordal7thResolution

end PartWriting
