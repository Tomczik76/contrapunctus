package contrapunctus.backend.services

import cats.data.NonEmptyList
import io.circe.Json
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
import io.github.tomczik76.contrapunctus.analysis.{Analysis, SpeciesCounterpoint}
import io.github.tomczik76.contrapunctus.rhythm.Pulse
import contrapunctus.backend.domain.{CommunityExercise, ExerciseAttempt}

object ExerciseScoring:

  private val letters = Array("C", "D", "E", "F", "G", "A", "B")

  private val noteTypeLookup: Map[String, NoteType] =
    NoteType.values.map(nt => nt.toString -> nt).toMap

  private val tonicByIdx: Array[NoteType] = Array(
    NoteType.C, NoteType.`C#`, NoteType.Db, NoteType.D, NoteType.Eb, NoteType.E,
    NoteType.F, NoteType.`F#`, NoteType.`Gb`, NoteType.G, NoteType.Ab, NoteType.A,
    NoteType.Bb, NoteType.B
  )

  /** Get the pitch class (0-11) for a tonic index. */
  def tonicPitchClass(idx: Int): Int =
    if idx >= 0 && idx < tonicByIdx.length then tonicByIdx(idx).value else 0

  private val durationValues: Map[String, Double] = Map(
    "whole" -> 1.0, "half" -> 0.5, "quarter" -> 0.25, "eighth" -> 0.125, "sixteenth" -> 0.0625
  )

  private def parseScale(name: String): Scale = name match
    case "major"         => Scale.Major
    case "minor"         => Scale.NaturalMinor
    case "harmonicMinor" => Scale.HarmonicMinor
    case "dorian"        => Scale.Dorian
    case "phrygian"      => Scale.Phrygian
    case "lydian"        => Scale.Lydian
    case "mixolydian"    => Scale.Mixolydian
    case "locrian"       => Scale.Locrian
    case "none"          => Scale.Major  // no key signature; Scale value unused for species CP
    case _               => Scale.Major

  private def parseDpToNote(dp: Int, acc: String): Note =
    val letterIdx = ((dp % 7) + 7) % 7
    val octave = Math.floorDiv(dp, 7)
    val key = letters(letterIdx) + acc
    val noteType = noteTypeLookup.getOrElse(key, NoteType.C)
    Note(noteType, octave)

  /** Parse a JSON array of PlacedBeat objects into a list of Notes (one per beat, skipping rests). */
  def parseBeatsFlat(beatsJson: Json): List[Note] =
    beatsJson.asArray.toList.flatten.flatMap { beatJson =>
      val isRest = beatJson.hcursor.get[Boolean]("isRest").getOrElse(false)
      if isRest then None
      else
        val notes = beatJson.hcursor.downField("notes").focus.flatMap(_.asArray).getOrElse(Vector.empty)
        notes.headOption.flatMap { noteJson =>
          for
            dp  <- noteJson.hcursor.get[Int]("dp").toOption
            acc <- noteJson.hcursor.get[String]("accidental").toOption.orElse(Some(""))
          yield parseDpToNote(dp, acc)
        }
    }

  /** Parse a JSON array of PlacedBeat objects into time-offset/notes pairs. */
  private def parseBeatsWithTime(beatsJson: Json): List[(Double, List[Note])] =
    var offset = 0.0
    beatsJson.asArray.toList.flatten.map { beatJson =>
      val isRest = beatJson.hcursor.get[Boolean]("isRest").getOrElse(false)
      val dur = beatJson.hcursor.get[String]("duration").getOrElse("quarter")
      val dotted = beatJson.hcursor.get[Boolean]("dotted").getOrElse(false)
      val baseVal = durationValues.getOrElse(dur, 0.25)
      val timeVal = if dotted then baseVal * 1.5 else baseVal

      val notes: List[Note] = if isRest then Nil
      else
        val notesArr = beatJson.hcursor.downField("notes").focus.flatMap(_.asArray).getOrElse(Vector.empty)
        notesArr.toList.flatMap { noteJson =>
          for
            dp  <- noteJson.hcursor.get[Int]("dp").toOption
            acc <- noteJson.hcursor.get[String]("accidental").toOption.orElse(Some(""))
          yield parseDpToNote(dp, acc)
        }

      val result = (offset, notes)
      offset += timeVal
      result
    }

  /** Merge two staves' time-offset/notes pairs into a single sorted stream. */
  private def mergeStaves(
      treble: List[(Double, List[Note])],
      bass: List[(Double, List[Note])]
  ): List[(Double, List[Note])] =
    val allTimes = (treble.map(_._1) ++ bass.map(_._1)).distinct.sorted
    val trebleMap = treble.groupBy(_._1).view.mapValues(_.flatMap(_._2)).toMap
    val bassMap = bass.groupBy(_._1).view.mapValues(_.flatMap(_._2)).toMap
    allTimes.map { t =>
      val notes = trebleMap.getOrElse(t, Nil) ++ bassMap.getOrElse(t, Nil)
      (t, notes)
    }

  /** Group time-offset/notes into measures based on time signature. */
  private def groupIntoMeasures(
      merged: List[(Double, List[Note])],
      tsTop: Int, tsBottom: Int
  ): List[List[List[Note]]] =
    val measureCap = tsTop.toDouble / tsBottom.toDouble
    val measures = scala.collection.mutable.ListBuffer[List[List[Note]]]()
    var current = scala.collection.mutable.ListBuffer[List[Note]]()
    for (t, notes) <- merged do
      val mIdx = Math.floor(t / measureCap + 1e-9).toInt
      if mIdx >= measures.size + 1 && current.nonEmpty then
        measures += current.toList
        current = scala.collection.mutable.ListBuffer[List[Note]]()
      current += notes
    if current.nonEmpty then measures += current.toList
    measures.toList

  /** Build a Pulse tree from a flat list of note groups (one per beat in a measure).
    * Mirrors the JS facade's buildPulse logic.
    */
  private def buildPulse(beats: List[List[Note]]): Pulse[Note] =
    def toPulse(notes: List[Note]): Pulse[Note] =
      NonEmptyList.fromList(notes) match
        case Some(nel) => Pulse.Atom(nel)
        case None      => Pulse.Rest

    // Pad to nearest supported size (power of 2 or multiple of 3)
    val n = beats.size
    val padded =
      if n == 0 then List(Nil) // single rest
      else if n == 1 || n % 2 == 0 || n % 3 == 0 then beats
      else
        val nextPow2 = Integer.highestOneBit(n) << 1
        val nextMul3 = ((n / 3) + 1) * 3
        val target = Math.min(nextPow2, nextMul3)
        beats ++ List.fill(target - n)(Nil)

    def pair(lst: List[List[Note]]): Pulse[Note] = lst match
      case single :: Nil  => toPulse(single)
      case _ if lst.size % 2 == 0 =>
        val (left, right) = lst.splitAt(lst.size / 2)
        Pulse.Duplet(pair(left), pair(right))
      case _ if lst.size % 3 == 0 =>
        val third = lst.size / 3
        val (a, rest) = lst.splitAt(third)
        val (b, c) = rest.splitAt(third)
        Pulse.Triplet(pair(a), pair(b), pair(c))
      case _ =>
        // Should not happen after padding
        toPulse(lst.flatten)

    pair(padded)

  // ── Scoring methods ──

  /** Parse all notes (not just head) from each beat in a JSON PlacedBeat array. */
  private def parseBeatsAllNotes(beatsJson: Json): List[List[Note]] =
    beatsJson.asArray.toList.flatten.map { beatJson =>
      val isRest = beatJson.hcursor.get[Boolean]("isRest").getOrElse(false)
      if isRest then Nil
      else
        val notes = beatJson.hcursor.downField("notes").focus.flatMap(_.asArray).getOrElse(Vector.empty)
        notes.toList.flatMap { noteJson =>
          for
            dp  <- noteJson.hcursor.get[Int]("dp").toOption
            acc <- noteJson.hcursor.get[String]("accidental").toOption.orElse(Some(""))
          yield parseDpToNote(dp, acc)
        }
    }

  /** Extract one CP note per beat from both staves, filtering out known CF notes.
    * CP can be on the same staff as the CF, the opposite staff, or a mix.
    */
  private def extractCpNotes(
      cfNotes: List[Note],
      trebleAllNotes: List[List[Note]],
      bassAllNotes: List[List[Note]]
  ): List[Note] =
    val beatCount = Math.max(trebleAllNotes.size, bassAllNotes.size)
    (0 until beatCount).toList.flatMap { i =>
      val treble = if i < trebleAllNotes.size then trebleAllNotes(i) else Nil
      val bass = if i < bassAllNotes.size then bassAllNotes(i) else Nil
      val allNotes = treble ++ bass
      val cf = if i < cfNotes.size then Some(cfNotes(i)) else None
      // Remove the CF note (by matching midi value) and take the first remaining note as CP
      val candidates = cf match
        case Some(cfNote) => allNotes.filterNot(n => n.midi == cfNote.midi)
        case None         => allNotes
      candidates.headOption
    }

  /** Score a species counterpoint attempt. */
  def scoreSpecies(exercise: CommunityExercise, attempt: ExerciseAttempt): (BigDecimal, Boolean) =
    val tonic = if exercise.tonicIdx >= 0 && exercise.tonicIdx < tonicByIdx.length
                then tonicByIdx(exercise.tonicIdx) else NoteType.C
    val scale = parseScale(exercise.scaleName)

    val sopranoNotes = parseBeatsFlat(exercise.sopranoBeats)
    val bassNotes = exercise.bassBeats.map(parseBeatsFlat).getOrElse(Nil)
    val cfIsSoprano = sopranoNotes.nonEmpty && bassNotes.isEmpty

    val cfNotes = if cfIsSoprano then sopranoNotes else bassNotes
    val cfIsLower = !cfIsSoprano

    // CP can be on either staff or both — extract from all notes minus CF
    val trebleAll = parseBeatsAllNotes(attempt.trebleBeats)
    val bassAll = parseBeatsAllNotes(attempt.bassBeats)
    val cpNotes = extractCpNotes(cfNotes, trebleAll, bassAll)

    if cfNotes.isEmpty || cpNotes.isEmpty then
      (BigDecimal(0), false)
    else
      val errors = SpeciesCounterpoint.check(cfNotes, cpNotes, tonic, scale, cfIsLower)
      val uniqueErrors = errors.map { case (beat, _, err) => (beat, err) }.distinct.size
      computeScore(uniqueErrors)

  /** Score a harmonize_melody or rn_analysis attempt using harmonic analysis. */
  def scoreHarmony(exercise: CommunityExercise, attempt: ExerciseAttempt): (BigDecimal, Boolean) =
    val tonic = if exercise.tonicIdx >= 0 && exercise.tonicIdx < tonicByIdx.length
                then tonicByIdx(exercise.tonicIdx) else NoteType.C
    val scale = parseScale(exercise.scaleName)

    val trebleBeats = parseBeatsWithTime(attempt.trebleBeats)
    val bassBeats = parseBeatsWithTime(attempt.bassBeats)
    val merged = mergeStaves(trebleBeats, bassBeats)

    if merged.isEmpty || merged.forall(_._2.isEmpty) then
      return (BigDecimal(0), false)

    val measures = groupIntoMeasures(merged, exercise.tsTop, exercise.tsBottom)
    val pulses = measures.map(buildPulse)

    NonEmptyList.fromList(pulses) match
      case None => (BigDecimal(0), false)
      case Some(nel) =>
        try
          val analyses = Analysis.analyzeWithPartWriting(tonic, scale, nel)
          // Flatten to get per-beat analyses
          val flatBeats = analyses.toList.flatMap(Pulse.flatten)

          // Count unique errors per beat (matching frontend errorSummary deduplication)
          var errorCount = 0
          flatBeats.zipWithIndex.foreach { case (analysisNel, beatIdx) =>
            val analysis = analysisNel.head
            val seen = scala.collection.mutable.Set[String]()
            // Note-level errors
            for
              an <- analysis.notes
              err <- an.errors
            do
              val label = err.toString
              if seen.add(label) then errorCount += 1
            // Chord-level errors
            for err <- analysis.errors do
              val label = err.toString
              if seen.add(label) then errorCount += 1
          }
          computeScore(errorCount)
        catch
          case _: Exception => (BigDecimal(0), false)

  /** Normalize a roman numeral label for comparison.
    * Converts Unicode superscripts/subscripts to ASCII, strips whitespace,
    * and lowercases alteration symbols so student input matches engine output.
    */
  def normalizeRn(s: String): String =
    s.trim
      .replace("♭", "b").replace("♯", "#").replace("𝄫", "bb").replace("𝄪", "##")
      .replace("⁰", "0").replace("¹", "1").replace("²", "2").replace("³", "3")
      .replace("⁴", "4").replace("⁵", "5").replace("⁶", "6").replace("⁷", "7")
      .replace("⁸", "8").replace("⁹", "9")
      .replace("₀", "0").replace("₁", "1").replace("₂", "2").replace("₃", "3")
      .replace("₄", "4").replace("₅", "5").replace("₆", "6").replace("₇", "7")
      .replace("₈", "8").replace("₉", "9")
      .replace("⁺", "+")
      .replace("ø", "o/").replace("°", "o").replace("Δ", "M")

  /** Score a roman numeral analysis attempt by comparing student labels
    * against the analysis engine's computed labels for each beat.
    */
  def scoreRomanNumerals(exercise: CommunityExercise, attempt: ExerciseAttempt): (BigDecimal, Boolean) =
    val tonic = if exercise.tonicIdx >= 0 && exercise.tonicIdx < tonicByIdx.length
                then tonicByIdx(exercise.tonicIdx) else NoteType.C
    val scale = parseScale(exercise.scaleName)

    // Use the exercise's notes (not the attempt's, since they're locked/identical)
    val trebleBeats = parseBeatsWithTime(exercise.sopranoBeats)
    val bassBeats = exercise.bassBeats.map(parseBeatsWithTime).getOrElse(Nil)
    val merged = mergeStaves(trebleBeats, bassBeats)

    if merged.isEmpty || merged.forall(_._2.isEmpty) then
      return (BigDecimal(0), false)

    val measures = groupIntoMeasures(merged, exercise.tsTop, exercise.tsBottom)
    val pulses = measures.map(buildPulse)

    NonEmptyList.fromList(pulses) match
      case None => (BigDecimal(0), false)
      case Some(nel) =>
        try
          val analyses = Analysis.analyzeWithPartWriting(tonic, scale, nel)
          val flatBeats = analyses.toList.flatMap(Pulse.flatten)

          // Build accepted labels per beat (normalized)
          val acceptedPerBeat: List[Set[String]] = flatBeats.map { analysisNel =>
            val analysis = analysisNel.head
            analysis.chords.flatMap { ac =>
              ac.romanNumerals.toList.map(normalizeRn)
            }
          }

          // Parse student answers from JSON object {"0": "i", "1": "ii6", ...}
          val studentMap: Map[Int, String] = attempt.studentRomans.asObject match
            case Some(obj) =>
              obj.toMap.flatMap { case (k, v) =>
                for
                  idx <- scala.util.Try(k.toInt).toOption
                  str <- v.asString
                yield (idx, str)
              }
            case None => Map.empty

          val totalBeats = acceptedPerBeat.size
          if totalBeats == 0 then return (BigDecimal(0), false)

          var wrongCount = 0
          for i <- 0 until totalBeats do
            val accepted = acceptedPerBeat(i)
            val student = studentMap.get(i).map(normalizeRn).getOrElse("")
            if student.isEmpty then
              wrongCount += 1 // no answer given
            else if !accepted.contains(student) then
              wrongCount += 1

          val pct = BigDecimal(Math.round(((totalBeats - wrongCount).toDouble / totalBeats) * 100))
          (pct, pct >= 70)
        catch
          case _: Exception => (BigDecimal(0), false)

  /** Dispatch scoring to the appropriate method based on template. */
  def score(exercise: CommunityExercise, attempt: ExerciseAttempt): (BigDecimal, Boolean) =
    exercise.template match
      case "species_counterpoint" => scoreSpecies(exercise, attempt)
      case "rn_analysis" => scoreRomanNumerals(exercise, attempt)
      case "harmonize_melody" => scoreHarmony(exercise, attempt)
      case _ => (BigDecimal(0), false)

  private def computeScore(errorCount: Int): (BigDecimal, Boolean) =
    val s = BigDecimal(Math.max(0, 100 - errorCount * 5))
    (s, s >= 70)

end ExerciseScoring
