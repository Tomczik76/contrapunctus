package io.github.tomczik76.contrapunctus.analysis

import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}

object SpeciesCounterpoint:

  /** Consonant interval classes (mod 12): unison, m3, M3, P5, m6, M6. */
  private val consonantClasses: Set[Int] = Set(0, 3, 4, 7, 8, 9)

  /** Perfect consonance interval classes: unison, P5. */
  private val perfectConsonanceClasses: Set[Int] = Set(0, 7)

  /** Check first species counterpoint rules.
    *
    * @param cantusFirmus the given melody (one note per beat)
    * @param counterpoint the student's melody (one note per beat)
    * @param tonic        the key's tonic
    * @param scale        the scale in use
    * @param cfIsLower    true if the cantus firmus is the lower voice
    * @return list of (beat index, offending note, error)
    */
  def check(
      cantusFirmus: List[Note],
      counterpoint: List[Note],
      tonic: NoteType,
      scale: Scale,
      cfIsLower: Boolean
  ): List[(Int, Note, NoteError)] =
    val len = Math.min(cantusFirmus.size, counterpoint.size)
    if len == 0 then return Nil

    val cf = cantusFirmus.take(len)
    val cp = counterpoint.take(len)

    checkConsonance(cf, cp) ++
      checkEndpointConsonance(cf, cp) ++
      checkCfTonic(cf, tonic) ++
      checkCpLastUnison(cf, cp) ++
      checkPenultimate(cf, cp, cfIsLower) ++
      checkUnisonEndpoints(cf, cp) ++
      checkMelodicIntervals(cp) ++
      checkPartWritingReuse(cf, cp, cfIsLower)

  /** Cantus firmus must begin and end on the tonic. */
  private def checkCfTonic(
      cf: List[Note],
      tonic: NoteType
  ): List[(Int, Note, NoteError)] =
    val endpoints = List(0, cf.size - 1).distinct
    endpoints.flatMap { beat =>
      if cf(beat).noteType.value == tonic.value then Nil
      else List((beat, cf(beat), NoteError.CfNotOnTonic))
    }

  /** Counterpoint last note must be unison or octave with CF (not fifth). */
  private def checkCpLastUnison(
      cf: List[Note],
      cp: List[Note]
  ): List[(Int, Note, NoteError)] =
    val lastBeat = cf.size - 1
    val ic = PartWriting.intervalClass(cf(lastBeat), cp(lastBeat))
    if ic == 0 then Nil // unison or octave
    else List((lastBeat, cp(lastBeat), NoteError.CpLastNotUnison))

  /** Every vertical interval must be consonant. */
  private def checkConsonance(
      cf: List[Note],
      cp: List[Note]
  ): List[(Int, Note, NoteError)] =
    cf.zip(cp).zipWithIndex.flatMap { case ((cfNote, cpNote), beat) =>
      val ic = PartWriting.intervalClass(cfNote, cpNote)
      if consonantClasses.contains(ic) then Nil
      else List((beat, cpNote, NoteError.DissonantInterval))
    }

  /** First and last beats must be perfect consonance (unison, P5, or P8). */
  private def checkEndpointConsonance(
      cf: List[Note],
      cp: List[Note]
  ): List[(Int, Note, NoteError)] =
    val endpoints = List(0, cf.size - 1).distinct
    endpoints.flatMap { beat =>
      val ic = PartWriting.intervalClass(cf(beat), cp(beat))
      if perfectConsonanceClasses.contains(ic) then Nil
      else List((beat, cp(beat), NoteError.ImperfectConsonanceRequired))
    }

  /** Penultimate beat approach: if CF is lower, CP should be M6 (ic=9)
    * resolving to P8. If CF is upper, CP should be m3 (ic=3) resolving to P1.
    */
  private def checkPenultimate(
      cf: List[Note],
      cp: List[Note],
      cfIsLower: Boolean
  ): List[(Int, Note, NoteError)] =
    if cf.size < 2 then Nil
    else
      val penBeat = cf.size - 2
      val ic = PartWriting.intervalClass(cf(penBeat), cp(penBeat))
      val expectedIc = if cfIsLower then 9 else 3 // M6 or m3
      if ic == expectedIc then Nil
      else List((penBeat, cp(penBeat), NoteError.BadPenultimate))

  /** Unison only allowed on first and last beats. */
  private def checkUnisonEndpoints(
      cf: List[Note],
      cp: List[Note]
  ): List[(Int, Note, NoteError)] =
    val lastBeat = cf.size - 1
    cf.zip(cp).zipWithIndex.flatMap { case ((cfNote, cpNote), beat) =>
      if cfNote.midi == cpNote.midi && beat != 0 && beat != lastBeat then
        List((beat, cpNote, NoteError.UnisonNotAtEndpoints))
      else Nil
    }

  /** Forbidden melodic intervals in counterpoint: tritone (6 semitones),
    * augmented 2nd (3 semitones with letter distance 1), or leaps > octave.
    */
  private def checkMelodicIntervals(
      cp: List[Note]
  ): List[(Int, Note, NoteError)] =
    cp.zip(cp.tail).zipWithIndex.flatMap { case ((prev, curr), i) =>
      val semitones = Math.abs(curr.midi - prev.midi)
      val letterDist = Math.abs(curr.noteType.letterIndex - prev.noteType.letterIndex)
      val isTritone = semitones == 6
      val isAug2 = semitones == 3 && (letterDist == 1 || letterDist == 6)
      val tooLarge = semitones > 12
      if isTritone || isAug2 || tooLarge then
        List((i + 1, curr, NoteError.ForbiddenMelodicInterval))
      else Nil
    }

  /** Reuse PartWriting checks for parallels, direct motion, and voice crossing.
    * Format the two voices as List[List[Option[Note]]] with the upper voice first.
    */
  private def checkPartWritingReuse(
      cf: List[Note],
      cp: List[Note],
      cfIsLower: Boolean
  ): List[(Int, Note, NoteError)] =
    val (upper, lower) =
      if cfIsLower then (cp.map(Some(_)), cf.map(Some(_)))
      else (cf.map(Some(_)), cp.map(Some(_)))
    val voices = List(upper, lower)
    PartWriting.checkParallels(voices) ++
      PartWriting.checkDirectMotion(voices) ++
      PartWriting.checkVoiceCrossing(voices)

end SpeciesCounterpoint
