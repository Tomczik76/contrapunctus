package io.github.tomczik76.contrapunctus.notation

import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.analysis.{
  Analysis,
  AnalyzedChord,
  ChordError,
  NonChordToneType,
  NoteError
}
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
import io.github.tomczik76.contrapunctus.rhythm.{Measure, Pulse, Rational}

object StaffPrinter:
  private val letterIdx =
    Map('C' -> 0, 'D' -> 1, 'E' -> 2, 'F' -> 3, 'G' -> 4, 'A' -> 5, 'B' -> 6)
  private val idxToLetter = "CDEFGAB"

  // Treble clef: E4, G4, B4, D5, F5
  private val trebleStaffLines = List(30, 32, 34, 36, 38)
  // Bass clef: G2, B2, D3, F3, A3
  private val bassStaffLines = List(18, 20, 22, 24, 26)

  // Grand staff is used when notes unambiguously span both clefs:
  // any note on/above treble bottom (E4=30) AND any note on/below bass top (A3=26).
  private val trebleBottom         = trebleStaffLines.head  // 30 = E4
  private val bassTop              = bassStaffLines.last    // 26 = A3
  // Notes at or above C4 (dp=28) are assigned to treble in a grand staff.
  private val grandStaffThreshold  = 28

  private val marginWidth = 3
  private val labelWidth  = 4
  private val gapRows     = 2 // blank rows between treble and bass staves

  private type Placements = Map[(Int, Int), Char]

  /** Captures the layout of one staff (treble or bass) within the combined grid.
    * sectionMax/Min define the pitch range (inclusive) for this section.
    * rowOffset is the first row in the combined grid belonging to this section.
    */
  private case class StaffSection(
      staffLines: List[Int],
      sectionMax: Int,
      sectionMin: Int,
      rowOffset: Int
  ):
    def rowFor(dp: Int): Int = rowOffset + (sectionMax - dp)
    def staffMin: Int        = staffLines.head
    def staffMax: Int        = staffLines.last
    def rows: Int            = sectionMax - sectionMin + 1

  /** Determine which staves to render based on all note diatonic positions.
    * Uses a grand staff (treble + bass) when notes unambiguously span both ranges.
    */
  private def determineSections(
      allPositions: List[Int]
  ): List[StaffSection] =
    if allPositions.isEmpty then
      val tMax = trebleStaffLines.last + 1
      val tMin = trebleStaffLines.head - 1
      return List(StaffSection(trebleStaffLines, tMax, tMin, 0))
    val hasTreble = allPositions.exists(_ >= trebleBottom)
    val hasBass   = allPositions.exists(_ <= bassTop)
    if hasTreble && hasBass then
      // Grand staff: notes split at grandStaffThreshold (C4)
      val trebleNotes = allPositions.filter(_ >= grandStaffThreshold)
      val tMax        =
        math.max(
          if trebleNotes.nonEmpty then trebleNotes.max + 1
          else trebleStaffLines.last + 1,
          trebleStaffLines.last + 1
        )
      val tMin        =
        math.min(
          if trebleNotes.nonEmpty then trebleNotes.min - 1
          else trebleStaffLines.head - 1,
          trebleStaffLines.head - 1
        )
      val treble      = StaffSection(trebleStaffLines, tMax, tMin, 0)
      val bassNotes   = allPositions.filter(_ < grandStaffThreshold)
      val bMax        =
        math.max(
          if bassNotes.nonEmpty then bassNotes.max + 1
          else bassStaffLines.last + 1,
          bassStaffLines.last + 1
        )
      val bMin        =
        math.min(
          if bassNotes.nonEmpty then bassNotes.min - 1
          else bassStaffLines.head - 1,
          bassStaffLines.head - 1
        )
      val bass        = StaffSection(bassStaffLines, bMax, bMin, treble.rows + gapRows)
      List(treble, bass)
    else
      // Single staff: choose treble or bass by median pitch
      val median     = allPositions.sorted.apply(allPositions.size / 2)
      val staffLines =
        if median < grandStaffThreshold then bassStaffLines else trebleStaffLines
      val sMax       = math.max(allPositions.max + 1, staffLines.last + 1)
      val sMin       = math.min(allPositions.min - 1, staffLines.head - 1)
      List(StaffSection(staffLines, sMax, sMin, 0))
  end determineSections

  /** Diatonic position: octave * 7 + letter index. Determines vertical
    * placement on the staff. C4 = 28, D4 = 29, E4 = 30, etc.
    */
  private def diatonicPos(note: Note): Int =
    val letter = note.noteType.toString.head
    note.octave * 7 + letterIdx(letter)

  private def posToName(dp: Int): String =
    val octave = dp / 7
    val letter = idxToLetter(dp % 7)
    s"$letter$octave"

  /** Extract accidental display string from NoteType name. */
  private def accidentalStr(nt: NoteType): String =
    nt.toString.drop(1) match
      case "##" => "♯♯"
      case "#"  => "♯"
      case "bb" => "♭♭"
      case "b"  => "♭"
      case _    => ""

  /** Extract leaf values from a Pulse tree, preserving rests as None. */
  private def extractLeaves[A](
      pulse: Pulse[A]
  ): List[Option[NonEmptyList[A]]] =
    pulse match
      case Pulse.Atom(v)      => List(Some(v))
      case Pulse.Rest         => List(None)
      case Pulse.Duplet(a, b) => extractLeaves(a) ++ extractLeaves(b)
      case Pulse.Triplet(a, b, c) =>
        extractLeaves(a) ++ extractLeaves(b) ++ extractLeaves(c)
      case Pulse.Quintuplet(a, b, c, d, e) =>
        extractLeaves(a) ++ extractLeaves(b) ++ extractLeaves(c) ++
          extractLeaves(d) ++ extractLeaves(e)
      case Pulse.Septuplet(a, b, c, d, e, f, g) =>
        extractLeaves(a) ++ extractLeaves(b) ++ extractLeaves(c) ++
          extractLeaves(d) ++ extractLeaves(e) ++ extractLeaves(f) ++
          extractLeaves(g)

  /** Compute the set of diatonic positions that need ledger lines drawn for a
    * note at the given diatonic position, relative to the given staff lines.
    */
  private def ledgerLinePositions(dp: Int, staffLines: List[Int]): Set[Int] =
    val staffMin = staffLines.head
    val staffMax = staffLines.last
    if dp < staffMin then
      val lowest = math.max(dp, staffMin - 8) // limit to ~4 ledger lines
      (lowest to staffMin - 2).filter(_ % 2 == 0).toSet
    else if dp > staffMax then
      val highest = math.min(dp, staffMax + 8)
      (staffMax + 2 to highest).filter(_ % 2 == 0).toSet
    else Set.empty

  /** Abbreviation for NonChordToneType labels. */
  private def nctAbbrev(nct: NonChordToneType): String =
    nct match
      case NonChordToneType.PassingTone      => "PT"
      case NonChordToneType.NeighborTone     => "NT"
      case NonChordToneType.Appoggiatura     => "App"
      case NonChordToneType.EscapeTone       => "ET"
      case NonChordToneType.ChangingTone     => "CT"
      case NonChordToneType.Suspension(f, t) => s"S$f-$t"
      case NonChordToneType.Retardation      => "Ret"
      case NonChordToneType.Anticipation     => "Ant"
      case NonChordToneType.PedalTone        => "Ped"

  /** Leaf data extracted from a Pulse tree with duration information. */
  private case class LeafInfo(
      duration: Rational,
      notes: Option[NonEmptyList[Note]],
      noteValueFrac: Rational
  )

  /** Internal model capturing the column layout of beats across measures. */
  private case class BeatColumn(
      colOffset: Int,
      colWidth: Int,
      notes: Option[NonEmptyList[Note]],
      noteValueFrac: Rational
  )

  /** Column width in characters based on note-value fraction (of a whole note).
    * Quarter note = 6 chars; other values scale proportionally.
    */
  private def columnWidthFor(nvf: Rational): Int =
    if nvf >= Rational(1) then 14         // whole note
    else if nvf >= Rational(3, 4) then 12 // dotted half
    else if nvf >= Rational(1, 2) then 10 // half note
    else if nvf >= Rational(3, 8) then 8  // dotted quarter
    else if nvf >= Rational(1, 4) then 6  // quarter note
    else if nvf >= Rational(3, 16) then 5 // dotted eighth
    else 4                                // eighth note and smaller

  /** Whether a note-value fraction represents a dotted duration. */
  private def isDotted(nvf: Rational): Boolean =
    nvf == Rational(3, 2) || nvf == Rational(3, 4) ||
      nvf == Rational(3, 8) || nvf == Rational(3, 16)

  /** Build a text line with strings placed at specific column offsets. */
  private def annotationLine(
      totalWidth: Int,
      items: List[(Int, String)]
  ): String =
    val charMap = items.flatMap: (offset, text) =>
      text.zipWithIndex.collect:
        case (ch, i) if offset + i >= 0 && offset + i < totalWidth =>
          (offset + i) -> ch
    .toMap
    (0 until totalWidth)
      .map(i => charMap.getOrElse(i, ' '))
      .mkString
      .stripTrailing()

  /** Generate character placements for a time signature number. */
  private def numberPlacements(
      row: Int,
      numRows: Int,
      number: Int
  ): Placements =
    if row >= 0 && row < numRows then
      number.toString.zipWithIndex.map((ch, i) => (row, i) -> ch).toMap
    else Map.empty

  /** Find the appropriate staff section for a diatonic position. */
  private def sectionFor(dp: Int, sections: List[StaffSection]): StaffSection =
    if sections.size == 1 then sections.head
    else if dp >= grandStaffThreshold then sections(0) // treble
    else sections(1)                                    // bass

  /** Generate character placements for a single beat column's notes. */
  private def beatPlacements(
      col: BeatColumn,
      nctNotes: Set[Note],
      sections: List[StaffSection],
      numRows: Int,
      musicEnd: Int
  ): Placements =
    col.notes match
      case None => Map.empty
      case Some(notes) =>
        val ledgerChars = notes.toList.flatMap: n =>
          val dp      = diatonicPos(n)
          val section = sectionFor(dp, sections)
          ledgerLinePositions(dp, section.staffLines).toList.flatMap: ldp =>
            val lrow = section.rowFor(ldp)
            if lrow >= 0 && lrow < numRows then
              (1 to 3).collect:
                case k if col.colOffset + k < musicEnd =>
                  (lrow, col.colOffset + k) -> '─'
            else Nil

        val noteChars = notes.toList.flatMap: note =>
          val dp      = diatonicPos(note)
          val section = sectionFor(dp, sections)
          val row     = section.rowFor(dp)
          if row < 0 || row >= numRows then Nil
          else
            val noteCol  = col.colOffset + 2
            val headChar =
              if nctNotes.contains(note) then '◇'
              else if col.noteValueFrac >= Rational(1, 2) then '○'
              else '●'
            val head     =
              if noteCol < musicEnd then List((row, noteCol) -> headChar)
              else Nil
            val dot      =
              if isDotted(col.noteValueFrac) && noteCol + 1 < musicEnd then
                List((row, noteCol + 1) -> '·')
              else Nil
            val acc      = accidentalStr(note.noteType)
            val accChars =
              if acc.nonEmpty then
                val start = 2 - acc.length
                acc.zipWithIndex.collect:
                  case (ch, i)
                      if col.colOffset + start + i >= 0 &&
                        col.colOffset + start + i < musicEnd =>
                    (row, col.colOffset + start + i) -> ch
                .toList
              else Nil
            head ++ dot ++ accChars
          end if

        // Ledger lines first, noteheads second so noteheads override
        (ledgerChars ++ noteChars).toMap

  /** Shared grid-building logic used by both render and renderAnalysis. When
    * nctNotesByBeat is provided, notes at each beat index are rendered with ◇.
    * The list must align with the flat sequence of leaves across all measures.
    * Automatically renders a grand staff when notes span both treble and bass ranges.
    */
  private def buildGrid(
      measures: NonEmptyList[Measure[Note]],
      nctNotesByBeat: List[Set[Note]] = Nil
  ): (String, List[List[BeatColumn]], Int) =
    // Extract leaves with durations from each measure
    val measLeaves: List[List[LeafInfo]] = measures.toList.map: m =>
      val ts = m.timeSignature
      Pulse.timed(m.pulses).map:
        case (start, end, value) =>
          val dur = end - start
          LeafInfo(dur, value, dur * Rational(ts.top.toLong, ts.bottom.toLong))

    val allNotes = measLeaves.flatten
      .flatMap(_.notes.toList.flatMap(_.toList))

    val allPositions = allNotes.map(diatonicPos)
    val sections     = determineSections(allPositions)
    val numRows      = sections.map(_.rows).sum + (sections.size - 1) * gapRows

    // Compute column widths proportional to note value
    val measColWidths: List[List[Int]] = measLeaves.map(
      _.map(leaf => columnWidthFor(leaf.noteValueFrac))
    )
    val numBarlines = measures.size - 1
    val musicWidth  = measColWidths.flatten.sum + numBarlines
    val totalWidth  = marginWidth + musicWidth + labelWidth
    val musicEnd    = marginWidth + musicWidth

    // Compute BeatColumn layout with offsets via fold
    val (beatColumns, _) = measLeaves
      .zip(measColWidths)
      .foldLeft(
        (List.empty[List[BeatColumn]], marginWidth)
      ):
        case ((acc, offset), (leaves, widths)) =>
          val (columns, nextOffset) = leaves
            .zip(widths)
            .foldLeft(
              (List.empty[BeatColumn], offset)
            ):
              case ((cols, off), (leaf, w)) =>
                (
                  cols :+ BeatColumn(off, w, leaf.notes, leaf.noteValueFrac),
                  off + w
                )
          (acc :+ columns, nextOffset + 1) // +1 for barline gap

    // Layer 1: Staff lines (all sections)
    val staffLineChars: Placements = sections.flatMap: section =>
      section.staffLines.flatMap: dp =>
        val row = section.rowFor(dp)
        if row >= 0 && row < numRows then
          (marginWidth until musicEnd).map(col => (row, col) -> '─')
        else Nil
    .toMap

    // Layer 2: Time signature (all sections)
    val ts      = measures.head.timeSignature
    val tsChars = sections.flatMap: section =>
      (numberPlacements(
        section.rowFor(section.staffLines(3) + 1),
        numRows,
        ts.top
      ) ++
        numberPlacements(
          section.rowFor(section.staffLines(1) - 1),
          numRows,
          ts.bottom
        )).toList
    .toMap

    // Layer 3: Barlines (all sections)
    val barlineChars: Placements = sections.flatMap: section =>
      beatColumns.init.flatMap: cols =>
        val barCol = cols.last.colOffset + cols.last.colWidth
        (section.staffMin to section.staffMax).flatMap: dp =>
          val row = section.rowFor(dp)
          if row >= 0 && row < numRows && barCol < musicEnd then
            List(
              (row, barCol) ->
                (if section.staffLines.contains(dp) then '┼' else '│')
            )
          else Nil
    .toMap

    // Layer 4: Notes (ledger lines, accidentals, noteheads, dots)
    val flatCols = beatColumns.flatten
    val allNoteChars: Placements =
      flatCols.zipWithIndex.foldLeft(Map.empty: Placements):
        case (acc, (col, beatIdx)) =>
          val nctNotes = nctNotesByBeat.lift(beatIdx).getOrElse(Set.empty)
          acc ++ beatPlacements(col, nctNotes, sections, numRows, musicEnd)

    // Layer 5: Right-margin labels (all sections)
    val labelChars: Placements = sections.flatMap: section =>
      section.staffLines.flatMap: dp =>
        val row = section.rowFor(dp)
        if row >= 0 && row < numRows then
          s" ${posToName(dp)}".zipWithIndex.collect:
            case (ch, i) if musicEnd + i < totalWidth =>
              (row, musicEnd + i) -> ch
        else Nil
    .toMap

    // Merge layers (later layers override earlier)
    val allChars =
      staffLineChars ++ tsChars ++ barlineChars ++ allNoteChars ++ labelChars

    val gridStr = (0 until numRows)
      .map: row =>
        (0 until totalWidth)
          .map(col => allChars.getOrElse((row, col), ' '))
          .mkString
          .stripTrailing()
      .mkString("\n")

    (gridStr, beatColumns, musicWidth)
  end buildGrid

  /** Render measures as a text-based staff. */
  def render(measures: NonEmptyList[Measure[Note]]): String =
    val allNotes = measures.toList
      .flatMap(m => extractLeaves(m.pulses))
      .flatMap(_.toList.flatMap(_.toList))
    if allNotes.isEmpty then return "(empty)"

    val (gridStr, _, _) = buildGrid(measures)
    gridStr

  /** Render measures with Roman numeral analysis, non-chord tone markers, and
    * error annotations below the staff.
    */
  def renderAnalysis(
      tonic: NoteType,
      scale: Scale,
      measures: NonEmptyList[Measure[Note]]
  ): String =
    val allNotes = measures.toList
      .flatMap(m => extractLeaves(m.pulses))
      .flatMap(_.toList.flatMap(_.toList))
    if allNotes.isEmpty then return "(empty)"

    // Run analysis on the pulse sequence extracted from measures
    val pulses         = measures.map(_.pulses)
    val analysisPulses = Analysis.analyzeWithPartWriting(tonic, scale, pulses)
    val analyses: List[Analysis] =
      analysisPulses.toList.flatMap(Pulse.flatten).map(_.head)

    // Collect NCT notes per beat for rendering with ◇
    val nctNotesByBeat: List[Set[Note]] = analyses.map: a =>
      a.notes.filter(_.nonChordToneType.isDefined).map(_.note).toSet

    val (gridStr, beatColumns, musicWidth) =
      buildGrid(measures, nctNotesByBeat)
    val totalWidth = marginWidth + musicWidth + labelWidth

    // Flatten beat columns to align with analyses
    val flatCols: List[BeatColumn] = beatColumns.flatten

    // Roman numeral row
    val rnLine = annotationLine(
      totalWidth,
      flatCols.zip(analyses).map: (col, analysis) =>
        val rn = analysis.chords.headOption
          .flatMap(_.romanNumerals.toList.headOption)
          .getOrElse("?")
        (col.colOffset + 1, rn)
    )

    // NCT label row (only if any NCTs exist)
    val nctLine =
      if analyses.exists(_.notes.exists(_.nonChordToneType.isDefined)) then
        Some(
          annotationLine(
            totalWidth,
            flatCols.zip(analyses).flatMap: (col, analysis) =>
              val nctLabels = analysis.notes
                .filter(_.nonChordToneType.isDefined)
                .map(an => nctAbbrev(an.nonChordToneType.get))
                .distinct
              if nctLabels.nonEmpty then
                List((col.colOffset + 1, nctLabels.mkString(",")))
              else Nil
          )
        )
      else None

    // Error row (note-level and chord-level)
    val errLine =
      if analyses.exists(a =>
          a.errors.nonEmpty || a.notes.exists(_.errors.nonEmpty)
        )
      then
        Some(
          annotationLine(
            totalWidth,
            flatCols.zip(analyses).flatMap: (col, analysis) =>
              val noteErrs  = analysis.notes.flatMap(_.errors).map(errAbbrev)
              val chordErrs = analysis.errors.map(chordErrAbbrev)
              val allErrs   = (noteErrs ++ chordErrs).distinct
              if allErrs.nonEmpty then
                List((col.colOffset + 1, allErrs.mkString(",")))
              else Nil
          )
        )
      else None

    (List(gridStr, rnLine) ++ nctLine ++ errLine).mkString("\n")
  end renderAnalysis

  private def errAbbrev(err: NoteError): String =
    err match
      case NoteError.ParallelFifths     => "∥5"
      case NoteError.ParallelOctaves    => "∥8"
      case NoteError.DirectFifths       => "→5"
      case NoteError.DirectOctaves      => "→8"
      case NoteError.VoiceCrossing      => "VX"
      case NoteError.SpacingError(_)    => "Sp"
      case NoteError.DoubledLeadingTone    => "2LT"
      case NoteError.UnresolvedLeadingTone => "LT↑"
      case NoteError.UnresolvedChordal7th          => "7↓"
      case NoteError.DissonantInterval              => "Diss"
      case NoteError.ImperfectConsonanceRequired    => "!PC"
      case NoteError.ForbiddenMelodicInterval       => "Mel"
      case NoteError.RepeatedPitch                  => "Rep"
      case NoteError.UnisonNotAtEndpoints           => "U!"
      case NoteError.BadPenultimate                 => "Pen"
      case NoteError.CfNotOnTonic                   => "CF≠1"
      case NoteError.CpLastNotUnison                => "≠8"

  private def chordErrAbbrev(err: ChordError): String =
    err match
      case ChordError.RootNotDoubledInRootPosition     => "2R"
      case ChordError.FifthNotDoubledInSecondInversion => "2×5"

end StaffPrinter
