package io.github.tomczik76.contrapunctus.facade

import scala.scalajs.js
import scala.scalajs.js.annotation.*
import scala.scalajs.js.JSConverters.*
import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
import io.github.tomczik76.contrapunctus.analysis.Analysis
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

trait JsBeatRender extends js.Object:
  val notes: js.Array[JsNoteRender]
  val durationFraction: js.Array[Int]
  val isRest: Boolean
  val romanNumerals: js.Array[String]

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
    buildRenderData(measures, None)

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
      case other =>
        throw js.JavaScriptException(js.Error(s"Unknown scale: $other"))

    val pulses = measures.map(_.pulses)
    val analyses = Analysis.analyzeWithPartWriting(tonic, scale, pulses)
    val romanNumeralOptions = analyses.toList.flatMap: pulse =>
      Pulse.flatten(pulse).map: analysis =>
        val chords = analysis.head.chords
        chords.toList
          .flatMap(_.romanNumerals.toList)
          .distinct

    buildRenderData(measures, Some(romanNumeralOptions))

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
    beats match
      case Nil =>
        throw js.JavaScriptException(js.Error("Measure must have at least one beat"))
      case single :: Nil =>
        beatToPulse(single)
      case _ if beats.size % 2 == 0 =>
        val (left, right) = beats.splitAt(beats.size / 2)
        Pulse.Duplet(buildPulse(left), buildPulse(right))
      case _ if beats.size % 3 == 0 =>
        val third = beats.size / 3
        val (a, rest) = beats.splitAt(third)
        val (b, c) = rest.splitAt(third)
        Pulse.Triplet(buildPulse(a), buildPulse(b), buildPulse(c))
      case _ =>
        throw js.JavaScriptException(
          js.Error(s"Unsupported beat count: ${beats.size} (use powers of 2, 3, or 6)")
        )

  private def beatToPulse(jsBeat: JsBeat): Pulse[Note] =
    val noteArr = jsBeat.notes
    if noteArr.isEmpty then Pulse.Rest
    else
      val notes = noteArr.toList.map(parseNote)
      Pulse.Atom(NonEmptyList.fromListUnsafe(notes))

  private def buildRenderData(
      measures: NonEmptyList[Measure[Note]],
      romanNumerals: Option[List[List[String]]]
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
          rnIndex += 1
          val (noteRenders, isRest) = maybeNotes match
            case None => (js.Array[JsNoteRender](), true)
            case Some(notes) =>
              val rendered = notes.toList.map: n =>
                val dp = diatonicPos(n)
                js.Dynamic
                  .literal(
                    letter = letterOf(n.noteType),
                    accidental = accidentalOf(n.noteType),
                    octave = n.octave,
                    diatonicPosition = dp,
                    midi = n.midi,
                    staff = staffFor(dp, isGrand)
                  )
                  .asInstanceOf[JsNoteRender]
              (rendered.toJSArray, false)
          js.Dynamic
            .literal(
              notes = noteRenders,
              durationFraction = js.Array(durNum.toInt, durDen.toInt),
              isRest = isRest,
              romanNumerals = rns.toJSArray
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
