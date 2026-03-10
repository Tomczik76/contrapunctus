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
    */
  def check(
      voices: List[NonEmptyList[Pulse[Note]]],
      tonic: NoteType,
      scale: Scale
  ): List[PartWritingError] =
    val flatVoices: List[List[Note]] =
      voices.map(_.toList.flatMap(Pulse.flatten).map(_.head))
    checkParallels(flatVoices) ++
      checkDirectMotion(flatVoices) ++
      checkSpacing(flatVoices) ++
      checkVoiceCrossing(flatVoices) ++
      checkDoubledLeadingTone(flatVoices, tonic, scale)

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

  private def checkSpacing(
      voices: List[List[Note]]
  ): List[PartWritingError] =
    val numVoices = voices.size
    val numBeats  = if voices.nonEmpty then voices.head.size else 0
    for
      beat <- (0 until numBeats).toList
      i    <- (0 until numVoices - 1).toList
      gap    = Math.abs(voices(i)(beat).midi - voices(i + 1)(beat).midi)
      maxGap = if i == numVoices - 2 then 24 else 12
      if gap > maxGap
    yield PartWritingError.SpacingError(i, i + 1, beat, gap)

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

  private def checkDoubledLeadingTone(
      voices: List[List[Note]],
      tonic: NoteType,
      scale: Scale
  ): List[PartWritingError] =
    val hasLeadingTone = scale.intervals.toList.exists(_.value == 11)
    if !hasLeadingTone then Nil
    else
      val leadingTonePc = (tonic.value + 11) % 12
      val numBeats      = if voices.nonEmpty then voices.head.size else 0
      for
        beat <- (0 until numBeats).toList
        pitchClasses = voices.map(_(beat).noteType.value % 12)
        if pitchClasses.count(_ == leadingTonePc) > 1
      yield PartWritingError.DoubledLeadingTone(beat)

  def checkDoublings(
      flatVoices: List[List[Note]],
      analyses: List[Analysis]
  ): List[PartWritingError] =
    val numVoices = flatVoices.size
    if numVoices < 4 then Nil
    else
      val numBeats = if flatVoices.nonEmpty then flatVoices.head.size else 0
      for
        beat <- (0 until numBeats).toList
        chord <- analyses.lift(beat).flatMap(_.chords.headOption).toList
        bassNote = flatVoices.last(beat)
        bassIntervalFromRoot =
          chord.chord.root.intervalAbove(bassNote.noteType).normalizedValue
        pitchClasses = flatVoices.map(_(beat).noteType.value % 12)
        if pitchClasses.toSet.size < pitchClasses.size // something is doubled
        error <- bassIntervalFromRoot match
          case 0 => // root position — root should be doubled
            val rootPc = chord.chord.root.value % 12
            if pitchClasses.count(_ == rootPc) >= 2 then Nil
            else List(PartWritingError.RootNotDoubledInRootPosition(beat))
          case v if v >= 5 && v <= 8 => // second inversion — fifth (bass) should be doubled
            val bassPc = bassNote.noteType.value % 12
            if pitchClasses.count(_ == bassPc) >= 2 then Nil
            else List(PartWritingError.FifthNotDoubledInSecondInversion(beat))
          case _ => Nil
      yield error

end PartWriting
