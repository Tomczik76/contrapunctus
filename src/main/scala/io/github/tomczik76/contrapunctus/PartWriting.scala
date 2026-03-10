package io.github.tomczik76.contrapunctus

import cats.data.NonEmptyList

enum PartWritingError:
  case ParallelFifths(voice1: Int, voice2: Int, beatIndex: Int)
  case ParallelOctaves(voice1: Int, voice2: Int, beatIndex: Int)
  case DirectFifths(voice1: Int, voice2: Int, beatIndex: Int)
  case DirectOctaves(voice1: Int, voice2: Int, beatIndex: Int)
  case VoiceCrossing(voice1: Int, voice2: Int, beatIndex: Int)
  case SpacingError(voice1: Int, voice2: Int, beatIndex: Int, semitones: Int)
  case DoubledLeadingTone(beatIndex: Int)
  case RootNotDoubledInRootPosition(beatIndex: Int)
  case FifthNotDoubledInSecondInversion(beatIndex: Int)

object PartWriting:

  /** Check part-writing rules for multi-voice music.
    * Voices should be ordered from highest (index 0) to lowest.
    * Each voice is one or more measures of Pulse[Note].
    *
    * Uses Pulse.align to correctly handle voices with different
    * rhythmic subdivisions (e.g., triplets against duplets).
    */
  def check(
      voices: List[NonEmptyList[Pulse[Note]]],
      tonic: NoteType,
      scale: Scale
  ): List[PartWritingError] =
    val columns = alignVoices(voices)
    val voiceLists = extractVoiceLists(columns)
    checkVertical(columns, tonic, scale) ++
      checkHorizontal(voiceLists)

  /** Vertical checks — operate on individual sonorities, no voice
    * tracking needed. Can be used on any sequence of aligned columns,
    * whether from explicit voices or from a single Pulse[Note] with
    * chords.
    */
  def checkVertical(
      columns: List[AlignedColumn[Note]],
      tonic: NoteType,
      scale: Scale
  ): List[PartWritingError] =
    val beats = columnNotes(columns)
    checkSpacing(beats) ++
      checkDoubledLeadingTone(beats, tonic, scale)

  /** Horizontal checks — operate on voice-tracked note sequences
    * across consecutive beats. Requires voice identity (explicit or
    * inferred via inferVoices).
    */
  def checkHorizontal(
      voices: List[List[Note]]
  ): List[PartWritingError] =
    checkParallels(voices) ++
      checkDirectMotion(voices) ++
      checkVoiceCrossing(voices)

  /** Doubling checks — need harmonic analysis results to determine
    * chord root and inversion. Only applies with 4+ voices.
    */
  def checkDoublings(
      columns: List[AlignedColumn[Note]],
      analyses: List[Analysis]
  ): List[PartWritingError] =
    val beats = columnNotes(columns)
    val numVoices = beats.headOption.map(_.size).getOrElse(0)
    if numVoices < 4 then Nil
    else
      for
        (notes, beat) <- beats.zipWithIndex
        chord <- analyses.lift(beat).flatMap(_.chords.headOption).toList
        bassNote = notes.last
        bassIntervalFromRoot =
          chord.chord.root.intervalAbove(bassNote.noteType).normalizedValue
        pitchClasses = notes.map(_.noteType.value % 12)
        if pitchClasses.toSet.size < pitchClasses.size
        error <- bassIntervalFromRoot match
          case 0 =>
            val rootPc = chord.chord.root.value % 12
            if pitchClasses.count(_ == rootPc) >= 2 then Nil
            else List(PartWritingError.RootNotDoubledInRootPosition(beat))
          case v if v >= 5 && v <= 8 =>
            val bassPc = bassNote.noteType.value % 12
            if pitchClasses.count(_ == bassPc) >= 2 then Nil
            else List(PartWritingError.FifthNotDoubledInSecondInversion(beat))
          case _ => Nil
      yield error

  /** Infer voice assignment from a sequence of aligned columns.
    * Sorts notes by pitch (high to low) and tracks voices across
    * beats by nearest-note matching to minimize MIDI distance.
    */
  def inferVoices(
      columns: List[AlignedColumn[Note]]
  ): List[List[Note]] =
    val beats = columnNotes(columns)
    if beats.isEmpty then Nil
    else
      val numVoices = beats.map(_.size).max
      val initial =
        beats.head.sortBy(-_.midi).padTo(numVoices, beats.head.last)
      val voiceArrays = Array.fill(numVoices)(List.newBuilder[Note])
      initial.zipWithIndex.foreach { (n, i) => voiceArrays(i) += n }
      var prev = initial
      for notes <- beats.tail do
        val sorted  = notes.sortBy(-_.midi).padTo(numVoices, notes.last)
        val used    = Array.fill(sorted.size)(false)
        val current = Array.ofDim[Note](numVoices)
        for i <- prev.indices do
          val (_, bestIdx) = sorted.zipWithIndex
            .filterNot { case (_, j) => used(j) }
            .minBy { case (n, _) => Math.abs(n.midi - prev(i).midi) }
          current(i) = sorted(bestIdx)
          used(bestIdx) = true
        current.zipWithIndex.foreach { (n, i) => voiceArrays(i) += n }
        prev = current.toList
      voiceArrays.toList.map(_.result())

  // --- Internal helpers ---

  /** Align voices using Pulse.align for correct rhythmic alignment. */
  private[contrapunctus] def alignVoices(
      voices: List[NonEmptyList[Pulse[Note]]]
  ): List[AlignedColumn[Note]] =
    if voices.isEmpty then Nil
    else
      val pulses = voices.map { nel =>
        if nel.tail.isEmpty then nel.head
        else
          nel.tail.foldLeft(nel.head) { (acc, p) =>
            Pulse.Duplet(acc, p): Pulse[Note]
          }
      }
      Pulse.align(pulses.toIndexedSeq)

  /** Extract per-voice note lists from aligned columns (for horizontal checks). */
  private def extractVoiceLists(
      columns: List[AlignedColumn[Note]]
  ): List[List[Note]] =
    if columns.isEmpty then Nil
    else
      val numVoices = columns.head.values.size
      (0 until numVoices).toList.map { i =>
        columns.flatMap(_.values(i).map(_.head))
      }

  /** Extract sorted note lists per beat from aligned columns (for vertical checks). */
  private def columnNotes(
      columns: List[AlignedColumn[Note]]
  ): List[List[Note]] =
    columns.map(_.values.flatten.flatMap(_.toList).sortBy(-_.midi).toList)

  private def intervalClass(a: Note, b: Note): Int =
    Math.abs(a.midi - b.midi) % 12

  private def checkParallels(
      voices: List[List[Note]]
  ): List[PartWritingError] =
    val numVoices = voices.size
    val numBeats  = if voices.nonEmpty then voices.head.size else 0
    for
      beat <- (1 until numBeats).toList
      i    <- (0 until numVoices).toList
      j    <- (i + 1 until numVoices).toList
      prev1 = voices(i)(beat - 1)
      prev2 = voices(j)(beat - 1)
      curr1 = voices(i)(beat)
      curr2 = voices(j)(beat)
      if prev1.midi != curr1.midi && prev2.midi != curr2.midi
      prevInterval = intervalClass(prev1, prev2)
      currInterval = intervalClass(curr1, curr2)
      if prevInterval == currInterval
      error <- prevInterval match
        case 7 => List(PartWritingError.ParallelFifths(i, j, beat))
        case 0 => List(PartWritingError.ParallelOctaves(i, j, beat))
        case _ => Nil
    yield error

  private def checkDirectMotion(
      voices: List[List[Note]]
  ): List[PartWritingError] =
    if voices.size < 2 then Nil
    else
      val soprano  = 0
      val bass     = voices.size - 1
      val numBeats = voices.head.size
      for
        beat <- (1 until numBeats).toList
        sPrev = voices(soprano)(beat - 1)
        sCurr = voices(soprano)(beat)
        bPrev = voices(bass)(beat - 1)
        bCurr = voices(bass)(beat)
        sMotion = sCurr.midi - sPrev.midi
        bMotion = bCurr.midi - bPrev.midi
        if sMotion != 0 && bMotion != 0
        if (sMotion > 0) == (bMotion > 0)
        if Math.abs(sMotion) > 2
        currInterval = intervalClass(sCurr, bCurr)
        error <- currInterval match
          case 7 => List(PartWritingError.DirectFifths(soprano, bass, beat))
          case 0 => List(PartWritingError.DirectOctaves(soprano, bass, beat))
          case _ => Nil
      yield error

  private def checkVoiceCrossing(
      voices: List[List[Note]]
  ): List[PartWritingError] =
    val numVoices = voices.size
    val numBeats  = if voices.nonEmpty then voices.head.size else 0
    for
      beat <- (0 until numBeats).toList
      i    <- (0 until numVoices - 1).toList
      if voices(i)(beat).midi < voices(i + 1)(beat).midi
    yield PartWritingError.VoiceCrossing(i, i + 1, beat)

  private def checkSpacing(
      beats: List[List[Note]]
  ): List[PartWritingError] =
    for
      (notes, beat) <- beats.zipWithIndex
      numVoices = notes.size
      i <- (0 until numVoices - 1).toList
      gap    = Math.abs(notes(i).midi - notes(i + 1).midi)
      maxGap = if i == numVoices - 2 then 24 else 12
      if gap > maxGap
    yield PartWritingError.SpacingError(i, i + 1, beat, gap)

  private def checkDoubledLeadingTone(
      beats: List[List[Note]],
      tonic: NoteType,
      scale: Scale
  ): List[PartWritingError] =
    val hasLeadingTone = scale.intervals.toList.exists(_.value == 11)
    if !hasLeadingTone then Nil
    else
      val leadingTonePc = (tonic.value + 11) % 12
      for
        (notes, beat) <- beats.zipWithIndex
        pitchClasses = notes.map(_.noteType.value % 12)
        if pitchClasses.count(_ == leadingTonePc) > 1
      yield PartWritingError.DoubledLeadingTone(beat)

end PartWriting
