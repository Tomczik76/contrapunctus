package io.github.tomczik76.contrapunctus.facade

import scala.scalajs.js
import scala.scalajs.js.annotation.*
import scala.scalajs.js.JSConverters.*
import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
import io.github.tomczik76.contrapunctus.analysis.{Analysis, AnalyzedNote, ChordError, NonChordToneType, NoteError}
import io.github.tomczik76.contrapunctus.analysis.AnalyzedChord
import io.github.tomczik76.contrapunctus.harmony.{AddElevenths, AddNinths, AlteredChords, Elevenths, Inversion, Ninths, Sevenths, Thirteenths, Triads}
import io.github.tomczik76.contrapunctus.rhythm.{Measure, Pulse, TimeSignature}

// ── JS-facing data types ─────────────────────────────────────────────

@js.native
trait JsNote extends js.Object:
  val letter: String     = js.native
  val accidental: String = js.native
  val octave: Int        = js.native

@js.native
trait JsBeat extends js.Object:
  val notes: js.Array[JsNote] = js.native

@js.native
trait JsMeasure extends js.Object:
  val timeSignature: JsTimeSignature = js.native
  val beats: js.Array[JsBeat]       = js.native

@js.native
trait JsTimeSignature extends js.Object:
  val top: Int    = js.native
  val bottom: Int = js.native

// ── JS-facing rendering output ──────────────────────────────────────

trait JsNoteRender extends js.Object:
  val letter: String
  val accidental: String
  val octave: Int
  val diatonicPosition: Int
  val midi: Int
  val staff: String
  val nct: String  // non-chord tone label, empty if chord tone
  val errors: js.Array[String]  // part-writing error labels

trait JsBeatRender extends js.Object:
  val notes: js.Array[JsNoteRender]
  val durationFraction: js.Array[Int]
  val isRest: Boolean
  val romanNumerals: js.Array[String]
  val chordNames: js.Array[String]
  val chordErrors: js.Array[String]  // chord-level part-writing errors

trait JsMeasureRender extends js.Object:
  val timeSignature: js.Dynamic
  val beats: js.Array[JsBeatRender]

trait JsStaff extends js.Object:
  val clef: String
  val lines: js.Array[Int]

trait JsRenderData extends js.Object:
  val staves: js.Array[JsStaff]
  val measures: js.Array[JsMeasureRender]

// ── Internal helpers ────────────────────────────────────────────────

private object Helpers:
  val letterIdx: Map[Char, Int] =
    Map('C' -> 0, 'D' -> 1, 'E' -> 2, 'F' -> 3, 'G' -> 4, 'A' -> 5, 'B' -> 6)

  val trebleLines = List(30, 32, 34, 36, 38)
  val bassLines   = List(18, 20, 22, 24, 26)
  val grandStaffThreshold = 28

  def diatonicPos(note: Note): Int =
    val letter = note.noteType.toString.head
    note.octave * 7 + letterIdx(letter)

  def letterOf(nt: NoteType): String = nt.toString.take(1)

  def accidentalOf(nt: NoteType): String =
    nt.toString.drop(1) match
      case "##" => "##"
      case "#"  => "#"
      case "bb" => "bb"
      case "b"  => "b"
      case _    => ""

  def staffFor(dp: Int, hasGrand: Boolean): String =
    if !hasGrand then
      if dp < grandStaffThreshold then "bass" else "treble"
    else if dp >= grandStaffThreshold then "treble"
    else "bass"

  val noteTypeLookup: Map[String, NoteType] =
    NoteType.values.map(nt => nt.toString -> nt).toMap

  def parseNote(jsNote: JsNote): Note =
    val key = jsNote.letter + jsNote.accidental
    val nt = noteTypeLookup.getOrElse(
      key,
      throw js.JavaScriptException(
        js.Error(s"Unknown note type: $key")
      )
    )
    Note(nt, jsNote.octave)

  def extractLeaves(pulse: Pulse[Note]): List[(Option[NonEmptyList[Note]], (Long, Long))] =
    Pulse.timed(pulse).map:
      case (start, end, value) =>
        val dur = end - start
        (value, (dur.num, dur.den))

  def nctLabel(nct: Option[NonChordToneType]): String = nct match
    case None                                => ""
    case Some(NonChordToneType.PassingTone)   => "PT"
    case Some(NonChordToneType.NeighborTone)  => "NT"
    case Some(NonChordToneType.Appoggiatura)  => "APP"
    case Some(NonChordToneType.EscapeTone)    => "ET"
    case Some(NonChordToneType.ChangingTone)  => "CT"
    case Some(NonChordToneType.Suspension(f, t)) => s"SUS $f-$t"
    case Some(NonChordToneType.Retardation)   => "RET"
    case Some(NonChordToneType.Anticipation)  => "ANT"
    case Some(NonChordToneType.PedalTone)     => "PED"

  def chordNameLabel(ac: AnalyzedChord): String =
    val root = letterOf(ac.chord.root) + accidentalOf(ac.chord.root)
    val inv = ac.chord.chordType.asInstanceOf[Inversion]
    val suffix = inv.base match
      case Triads.Major              => ""
      case Triads.Minor              => "m"
      case Triads.Diminished         => "dim"
      case Triads.Augmented          => "aug"
      case Triads.Sus2               => "sus2"
      case Triads.Sus4               => "sus4"
      case Triads.PowerChord         => "5"
      case Sevenths.MinorSeventh          => "m7"
      case Sevenths.DominantSeventh       => "7"
      case Sevenths.MajorSeventh          => "maj7"
      case Sevenths.MinorMajorSeventh     => "mMaj7"
      case Sevenths.DiminishedSeventh     => "dim7"
      case Sevenths.HalfDiminishedSeventh => "m7b5"
      case Sevenths.AugmentedSeventh      => "aug7"
      case Sevenths.AugmentedMajorSeventh => "augMaj7"
      case Sevenths.MajorSixth            => "6"
      case Sevenths.MinorSixth            => "m6"
      case Ninths.MinorNinth | Ninths.MinorNinthOmit5             => "m9"
      case Ninths.DominantNinth | Ninths.DominantNinthOmit5       => "9"
      case Ninths.MajorNinth | Ninths.MajorNinthOmit5             => "maj9"
      case Ninths.MinorMajorNinth | Ninths.MinorMajorNinthOmit5   => "mMaj9"
      case AddNinths.MajorAdd9       => "add9"
      case AddNinths.MinorAdd9       => "madd9"
      case AddElevenths.MajorAdd11   => "add11"
      case AddElevenths.MinorAdd11   => "madd11"
      case Elevenths.DominantEleventh => "11"
      case Elevenths.MajorEleventh    => "maj11"
      case Elevenths.MinorEleventh    => "m11"
      case Thirteenths.DominantThirteenth => "13"
      case Thirteenths.MajorThirteenth    => "maj13"
      case Thirteenths.MinorThirteenth    => "m13"
      case AlteredChords.SevenFlatNine           => "7b9"
      case AlteredChords.SevenSharpNine          => "7#9"
      case AlteredChords.SevenFlatFive           => "7b5"
      case AlteredChords.SevenFlatFiveFlatNine   => "7b5b9"
      case AlteredChords.SevenSharpFiveSharpNine => "aug7#9"
      case _ => ac.chord.chordType.qualitySymbol + ac.chord.chordType.figuredBass
    val slash = if inv.index > 0 then
      // Find the bass note for slash chord notation
      val bassInterval = inv.rootInterval
      val bassPc = (ac.chord.root.value + bassInterval.value) % 12
      NoteType.values.find(_.value == bassPc) match
        case Some(bassNote) => "/" + letterOf(bassNote) + accidentalOf(bassNote)
        case None => ""
    else ""
    root + suffix + slash

  def noteErrorLabel(err: NoteError): String = err match
    case NoteError.ParallelFifths         => "∥5"
    case NoteError.ParallelOctaves        => "∥8"
    case NoteError.DirectFifths           => "→5"
    case NoteError.DirectOctaves          => "→8"
    case NoteError.VoiceCrossing          => "VX"
    case NoteError.SpacingError(_)        => "Sp"
    case NoteError.DoubledLeadingTone     => "2LT"
    case NoteError.UnresolvedLeadingTone  => "LT↑"
    case NoteError.UnresolvedChordal7th   => "7↓"

  def chordErrorLabel(err: ChordError): String = err match
    case ChordError.RootNotDoubledInRootPosition       => "2R"
    case ChordError.FifthNotDoubledInSecondInversion    => "2×5"

end Helpers

// ── Exported API ────────────────────────────────────────────────────

@JSExportTopLevel("Contrapunctus")
object Contrapunctus:
  import Helpers.*

  @JSExport
  def note(letter: String, accidental: String, octave: Int): JsNote =
    js.Dynamic.literal(
      letter = letter,
      accidental = accidental,
      octave = octave
    ).asInstanceOf[JsNote]

  @JSExport
  def measure(top: Int, bottom: Int, beats: js.Array[JsBeat]): JsMeasure =
    js.Dynamic.literal(
      timeSignature = js.Dynamic.literal(top = top, bottom = bottom),
      beats = beats
    ).asInstanceOf[JsMeasure]

  @JSExport
  def beat(notes: js.Array[JsNote]): JsBeat =
    js.Dynamic.literal(notes = notes).asInstanceOf[JsBeat]

  @JSExport
  def rest(): JsBeat =
    js.Dynamic.literal(
      notes = js.Array[JsNote]()
    ).asInstanceOf[JsBeat]

  @JSExport
  def render(jsMeasures: js.Array[JsMeasure]): JsRenderData =
    if jsMeasures.isEmpty then
      throw js.JavaScriptException(js.Error("At least one measure required"))

    val measures: NonEmptyList[Measure[Note]] = parseMeasures(jsMeasures)
    buildRenderData(measures, None, None, None, None, None)

  @JSExport
  def renderWithAnalysis(
      jsMeasures: js.Array[JsMeasure],
      tonicLetter: String,
      tonicAccidental: String,
      scaleName: String
  ): JsRenderData =
    if jsMeasures.isEmpty then
      throw js.JavaScriptException(js.Error("At least one measure required"))

    val measures: NonEmptyList[Measure[Note]] = parseMeasures(jsMeasures)
    val tonicKey = tonicLetter + tonicAccidental
    val tonic = noteTypeLookup.getOrElse(
      tonicKey,
      throw js.JavaScriptException(js.Error(s"Unknown tonic: $tonicKey"))
    )
    val scale = scaleName match
      case "major"         => Scale.Major
      case "minor"         => Scale.NaturalMinor
      case "harmonicMinor" => Scale.HarmonicMinor
      case "dorian"        => Scale.Dorian
      case "phrygian"      => Scale.Phrygian
      case "lydian"        => Scale.Lydian
      case "mixolydian"    => Scale.Mixolydian
      case "locrian"       => Scale.Locrian
      case other =>
        throw js.JavaScriptException(js.Error(s"Unknown scale: $other"))

    val pulses = measures.map(_.pulses)
    val analyses = Analysis.analyzeWithPartWriting(tonic, scale, pulses)

    // Flatten all beats with their notes for secondary dominant analysis
    val flatBeats: List[(NonEmptyList[Note], Analysis)] =
      measures.toList.zip(analyses.toList).flatMap: (m, pulse) =>
        Pulse.flatten(m.pulses).zip(Pulse.flatten(pulse)).map:
          case (notes, analysis) => (notes, analysis.head)

    val romanNumeralOptions = flatBeats.zipWithIndex.map { case ((notes, analysis), i) =>
      // Skip roman numerals for beats that contain non-chord tones —
      // the real harmony is on the neighboring beat
      val hasNct = analysis.notes.exists(_.nonChordToneType.isDefined)
      if hasNct then List.empty[String]
      else
        val chords = analysis.chords
        // Sort so inversions come before add chords (MajorSixth/MinorSixth root position)
        val sorted = chords.toList.sortBy: ac =>
          ac.chord.chordType match
            case Inversion(base, 0, _, _) if base == Sevenths.MajorSixth || base == Sevenths.MinorSixth => 1
            case _ => 0
        val baseLabels = sorted
          .flatMap(_.romanNumerals.toList)
          .distinct

        // Add secondary dominant labels if applicable
        val secDomLabels =
          if i < flatBeats.size - 1 then
            val (_, nextAnalysis) = flatBeats(i + 1)
            Analysis.secondaryDominantLabels(
              notes,
              chords.map(_.chord),
              nextAnalysis.chords.map(_.chord),
              tonic,
              scale
            )
          else Nil

        // Add augmented sixth label if applicable
        val aug6Label = Analysis.augmentedSixthLabel(notes, tonic).toList

        (aug6Label ++ secDomLabels ++ baseLabels).distinct
    }

    // Chord name labels (e.g. "Am7", "C", "G7") — parallel to roman numerals
    val chordNameOptions = flatBeats.zipWithIndex.map { case ((notes, analysis), i) =>
      val hasNct = analysis.notes.exists(_.nonChordToneType.isDefined)
      if hasNct then List.empty[String]
      else
        val chords = analysis.chords
        val sorted = chords.toList.sortBy: ac =>
          ac.chord.chordType match
            case Inversion(base, 0, _, _) if base == Sevenths.MajorSixth || base == Sevenths.MinorSixth => 1
            case _ => 0
        sorted.map(chordNameLabel).distinct
    }

    // Collect NCT info per beat: Map from midi -> nct label
    val nctPerBeat: List[Map[Int, String]] = flatBeats.map: (_, analysis) =>
      analysis.notes
        .filter(_.nonChordToneType.isDefined)
        .map(an => an.note.midi -> nctLabel(an.nonChordToneType))
        .toMap

    // Collect part-writing errors per beat
    val noteErrorsPerBeat: List[Map[Int, List[String]]] = flatBeats.map: (_, analysis) =>
      analysis.notes
        .filter(_.errors.nonEmpty)
        .groupBy(_.note.midi)
        .view
        .mapValues(_.flatMap(_.errors).map(noteErrorLabel).distinct)
        .toMap

    val chordErrorsPerBeat: List[List[String]] = flatBeats.map: (_, analysis) =>
      analysis.errors.map(chordErrorLabel)

    buildRenderData(measures, Some(romanNumeralOptions), Some(chordNameOptions), Some(nctPerBeat), Some(noteErrorsPerBeat), Some(chordErrorsPerBeat))

  private def parseMeasures(
      jsMeasures: js.Array[JsMeasure]
  ): NonEmptyList[Measure[Note]] =
    val parsed = jsMeasures.toList.map: jm =>
      val ts = TimeSignature(jm.timeSignature.top, jm.timeSignature.bottom)
      val beats = jm.beats.toList
      val pulse = buildPulse(beats)
      Measure(ts, pulse)
    NonEmptyList.fromListUnsafe(parsed)

  private def buildPulse(beats: List[JsBeat]): Pulse[Note] =
    // Pad to the nearest supported size (power of 2 or multiple of 3)
    val padded =
      val n = beats.size
      if n == 0 then
        throw js.JavaScriptException(js.Error("Measure must have at least one beat"))
      else if n == 1 || n % 2 == 0 || n % 3 == 0 then beats
      else
        // Find next size that's a power of 2 or multiple of 3
        val nextPow2 = Integer.highestOneBit(n) << 1
        val nextMul3 = ((n / 3) + 1) * 3
        val target = Math.min(nextPow2, nextMul3)
        val restBeat = js.Dynamic.literal(
          notes = js.Array[JsNote]()
        ).asInstanceOf[JsBeat]
        beats ++ List.fill(target - n)(restBeat)

    padded match
      case single :: Nil =>
        beatToPulse(single)
      case _ if padded.size % 2 == 0 =>
        val (left, right) = padded.splitAt(padded.size / 2)
        Pulse.Duplet(buildPulse(left), buildPulse(right))
      case _ if padded.size % 3 == 0 =>
        val third = padded.size / 3
        val (a, rest) = padded.splitAt(third)
        val (b, c) = rest.splitAt(third)
        Pulse.Triplet(buildPulse(a), buildPulse(b), buildPulse(c))
      case _ =>
        // Should not happen after padding
        throw js.JavaScriptException(
          js.Error(s"Unsupported beat count: ${padded.size}")
        )

  private def beatToPulse(jsBeat: JsBeat): Pulse[Note] =
    val noteArr = jsBeat.notes
    if noteArr.isEmpty then Pulse.Rest
    else
      val notes = noteArr.toList.map(parseNote)
      Pulse.Atom(NonEmptyList.fromListUnsafe(notes))

  private def buildRenderData(
      measures: NonEmptyList[Measure[Note]],
      romanNumerals: Option[List[List[String]]],
      chordNames: Option[List[List[String]]],
      nctData: Option[List[Map[Int, String]]],
      noteErrorData: Option[List[Map[Int, List[String]]]],
      chordErrorData: Option[List[List[String]]]
  ): JsRenderData =
    val allNotes = measures.toList.flatMap: m =>
      Pulse.flatten(m.pulses).flatMap(_.toList)
    val allPositions = allNotes.map(diatonicPos)

    val hasTreble = allPositions.exists(_ >= trebleLines.head)
    val hasBass   = allPositions.exists(_ <= bassLines.last)
    val isGrand   = hasTreble && hasBass

    val staves: js.Array[JsStaff] =
      if isGrand then
        js.Array(
          js.Dynamic
            .literal(clef = "treble", lines = trebleLines.toJSArray)
            .asInstanceOf[JsStaff],
          js.Dynamic
            .literal(clef = "bass", lines = bassLines.toJSArray)
            .asInstanceOf[JsStaff]
        )
      else if allPositions.nonEmpty && allPositions.sorted
          .apply(allPositions.size / 2) < grandStaffThreshold
      then
        js.Array(
          js.Dynamic
            .literal(clef = "bass", lines = bassLines.toJSArray)
            .asInstanceOf[JsStaff]
        )
      else
        js.Array(
          js.Dynamic
            .literal(clef = "treble", lines = trebleLines.toJSArray)
            .asInstanceOf[JsStaff]
        )

    var rnIndex = 0
    val jsMeasures: js.Array[JsMeasureRender] = measures.toList.map: m =>
      val ts = m.timeSignature
      val leaves = extractLeaves(m.pulses)
      val jsBeats: js.Array[JsBeatRender] = leaves.map:
        case (maybeNotes, (durNum, durDen)) =>
          val rns = romanNumerals.flatMap(_.lift(rnIndex)).getOrElse(List.empty)
          val cns = chordNames.flatMap(_.lift(rnIndex)).getOrElse(List.empty)
          val beatNcts = nctData.flatMap(_.lift(rnIndex)).getOrElse(Map.empty)
          val beatNoteErrors = noteErrorData.flatMap(_.lift(rnIndex)).getOrElse(Map.empty)
          val beatChordErrors = chordErrorData.flatMap(_.lift(rnIndex)).getOrElse(List.empty)
          rnIndex += 1
          val (noteRenders, isRest) = maybeNotes match
            case None => (js.Array[JsNoteRender](), true)
            case Some(notes) =>
              val rendered = notes.toList.map: n =>
                val dp = diatonicPos(n)
                val nctStr = beatNcts.getOrElse(n.midi, "")
                val errLabels = beatNoteErrors.getOrElse(n.midi, Nil)
                js.Dynamic
                  .literal(
                    letter = letterOf(n.noteType),
                    accidental = accidentalOf(n.noteType),
                    octave = n.octave,
                    diatonicPosition = dp,
                    midi = n.midi,
                    staff = staffFor(dp, isGrand),
                    nct = nctStr,
                    errors = errLabels.toJSArray
                  )
                  .asInstanceOf[JsNoteRender]
              (rendered.toJSArray, false)
          js.Dynamic
            .literal(
              notes = noteRenders,
              durationFraction = js.Array(durNum.toInt, durDen.toInt),
              isRest = isRest,
              romanNumerals = rns.toJSArray,
              chordNames = cns.toJSArray,
              chordErrors = beatChordErrors.toJSArray
            )
            .asInstanceOf[JsBeatRender]
      .toJSArray

      js.Dynamic
        .literal(
          timeSignature = js.Dynamic.literal(top = ts.top, bottom = ts.bottom),
          beats = jsBeats
        )
        .asInstanceOf[JsMeasureRender]
    .toJSArray

    js.Dynamic
      .literal(staves = staves, measures = jsMeasures)
      .asInstanceOf[JsRenderData]
  end buildRenderData

end Contrapunctus
