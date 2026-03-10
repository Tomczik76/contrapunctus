package io.github.tomczik76.contrapunctus.analysis

import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
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
      voices: List[List[Note]],
      tonic: NoteType,
      scale: Scale
  ): List[Analysis] =
    val beats = columnNotes(columns)

    val noteErrs: List[(Int, Note, NoteError)] =
      checkParallels(voices) ++
        checkDirectMotion(voices) ++
        checkVoiceCrossing(voices) ++
        checkSpacing(beats) ++
        checkDoubledLeadingTone(beats, tonic, scale)

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
      initial.zipWithIndex.foreach: (n, i) =>
        voiceArrays(i) += n
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

  private def intervalClass(a: Note, b: Note): Int =
    Math.abs(a.midi - b.midi) % 12

  private def checkParallels(
      voices: List[List[Note]]
  ): List[(Int, Note, NoteError)] =
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

  private def checkDirectMotion(
      voices: List[List[Note]]
  ): List[(Int, Note, NoteError)] =
    if voices.size < 2 then Nil
    else
      val soprano  = 0
      val bass     = voices.size - 1
      val numBeats = voices.head.size
      for
        beat <- (1 until numBeats).toList
        sPrev   = voices(soprano)(beat - 1)
        sCurr   = voices(soprano)(beat)
        bPrev   = voices(bass)(beat - 1)
        bCurr   = voices(bass)(beat)
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

  private def checkVoiceCrossing(
      voices: List[List[Note]]
  ): List[(Int, Note, NoteError)] =
    val numVoices = voices.size
    val numBeats  = if voices.nonEmpty then voices.head.size else 0
    for
      beat <- (0 until numBeats).toList
      i    <- (0 until numVoices - 1).toList
      if voices(i)(beat).midi < voices(i + 1)(beat).midi
      err <- List(
        (beat, voices(i)(beat), NoteError.VoiceCrossing),
        (beat, voices(i + 1)(beat), NoteError.VoiceCrossing)
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

end PartWriting
