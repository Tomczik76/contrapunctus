package io.github.tomczik76.contrapunctus

import cats.data.NonEmptyList

object StaffPrinter:
  private val letterIdx =
    Map('C' -> 0, 'D' -> 1, 'E' -> 2, 'F' -> 3, 'G' -> 4, 'A' -> 5, 'B' -> 6)
  private val idxToLetter = "CDEFGAB"

  // Treble clef: E4, G4, B4, D5, F5
  private val trebleStaffLines = List(30, 32, 34, 36, 38)
  // Bass clef: G2, B2, D3, F3, A3
  private val bassStaffLines = List(18, 20, 22, 24, 26)

  private val beatWidth = 6
  private val marginWidth = 3
  private val labelWidth = 4

  /** Diatonic position: octave * 7 + letter index. Determines vertical placement
    * on the staff. C4 = 28, D4 = 29, E4 = 30, etc.
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
      case Pulse.Atom(v)          => List(Some(v))
      case Pulse.Rest             => List(None)
      case Pulse.Duplet(a, b)     => extractLeaves(a) ++ extractLeaves(b)
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

  /** Select treble or bass clef based on the median pitch of all notes. */
  private def selectStaffLines(positions: List[Int]): List[Int] =
    val median = positions.sorted.apply(positions.size / 2)
    if median < 28 then bassStaffLines else trebleStaffLines

  /** Abbreviation for NonChordToneType labels. */
  private def nctAbbrev(nct: NonChordToneType): String =
    nct match
      case NonChordToneType.PassingTone       => "PT"
      case NonChordToneType.NeighborTone      => "NT"
      case NonChordToneType.Appoggiatura      => "App"
      case NonChordToneType.EscapeTone        => "ET"
      case NonChordToneType.ChangingTone      => "CT"
      case NonChordToneType.Suspension(f, t)  => s"S$f-$t"
      case NonChordToneType.Retardation       => "Ret"
      case NonChordToneType.Anticipation      => "Ant"
      case NonChordToneType.PedalTone         => "Ped"

  /** Internal model capturing the column layout of beats across measures. */
  private case class BeatColumn(
      colOffset: Int,
      notes: Option[NonEmptyList[Note]]
  )

  /** Shared grid-building logic used by both render and renderAnalysis. When
    * nctNotes is provided, those notes are rendered with ○ instead of ●.
    */
  private def buildGrid(
      measures: NonEmptyList[Measure[Note]],
      nctNotes: Set[Note] = Set.empty
  ): (Array[Array[Char]], List[List[BeatColumn]], Int, Int, List[Int]) =
    val measBeats = measures.toList.map(m => extractLeaves(m.pulses))
    val allNotes  = measBeats.flatten.flatMap(_.toList.flatMap(_.toList))

    val allPositions = allNotes.map(diatonicPos)
    val staffLines   = selectStaffLines(allPositions)
    val staffMin     = staffLines.head
    val staffMax     = staffLines.last

    val noteMin = allPositions.min
    val noteMax = allPositions.max
    val gridMin = math.min(noteMin - 1, staffMin - 1)
    val gridMax = math.max(noteMax + 1, staffMax + 1)
    val numRows = gridMax - gridMin + 1

    val totalBeats  = measBeats.map(_.size).sum
    val numBarlines = measures.size - 1
    val musicWidth  = totalBeats * beatWidth + numBarlines
    val totalWidth  = marginWidth + musicWidth + labelWidth
    val grid        = Array.fill(numRows)(Array.fill(totalWidth)(' '))

    // Draw staff lines
    for dp <- staffLines do
      val row = gridMax - dp
      if row >= 0 && row < numRows then
        for col <- marginWidth until marginWidth + musicWidth do
          grid(row)(col) = '─'

    // Time signature
    val ts = measures.head.timeSignature
    val topTsRow = gridMax - (staffLines(3) + 1)
    val botTsRow = gridMax - (staffLines(1) - 1)
    placeNumber(grid, topTsRow, numRows, ts.top)
    placeNumber(grid, botTsRow, numRows, ts.bottom)

    // Place notes and build column layout
    val beatColumns = List.newBuilder[List[BeatColumn]]
    var colOffset   = marginWidth
    for (mBeats, mi) <- measBeats.zipWithIndex do
      val measureCols = List.newBuilder[BeatColumn]
      for beat <- mBeats do
        measureCols += BeatColumn(colOffset, beat)
        beat match
          case Some(notes) =>
            val allLedgerPos = notes.toList
              .flatMap(n => ledgerLinePositions(diatonicPos(n), staffLines))
              .toSet
            for ldp <- allLedgerPos do
              val lrow = gridMax - ldp
              if lrow >= 0 && lrow < numRows then
                for k <- 1 to 3 do
                  val c = colOffset + k
                  if c < marginWidth + musicWidth then grid(lrow)(c) = '─'

            for note <- notes.toList do
              val dp  = diatonicPos(note)
              val row = gridMax - dp
              if row >= 0 && row < numRows then
                val noteCol = colOffset + 2
                if noteCol < marginWidth + musicWidth then
                  grid(row)(noteCol) =
                    if nctNotes.contains(note) then '○' else '●'
                val acc = accidentalStr(note.noteType)
                if acc.nonEmpty then
                  val start = 2 - acc.length
                  for (ch, i) <- acc.zipWithIndex do
                    val c = colOffset + start + i
                    if c >= 0 && c < marginWidth + musicWidth then
                      grid(row)(c) = ch

          case None => ()

        colOffset += beatWidth

      beatColumns += measureCols.result()
      if mi < measBeats.size - 1 then
        for row <- 0 until numRows do
          val dp = gridMax - row
          if dp >= staffMin && dp <= staffMax then
            val c = colOffset
            if c < marginWidth + musicWidth then
              grid(row)(c) = if staffLines.contains(dp) then '┼' else '│'
        colOffset += 1

    // Right-margin labels
    for dp <- staffLines do
      val row = gridMax - dp
      if row >= 0 && row < numRows then
        val label = s" ${posToName(dp)}"
        for (ch, i) <- label.zipWithIndex do
          val c = marginWidth + musicWidth + i
          if c < totalWidth then grid(row)(c) = ch

    (grid, beatColumns.result(), musicWidth, gridMax, staffLines)
  end buildGrid

  /** Render measures as a text-based staff. */
  def render(measures: NonEmptyList[Measure[Note]]): String =
    val allNotes = measures.toList
      .flatMap(m => extractLeaves(m.pulses))
      .flatMap(_.toList.flatMap(_.toList))
    if allNotes.isEmpty then return "(empty)"

    val (grid, _, _, _, _) = buildGrid(measures)
    grid.map(_.mkString.stripTrailing()).mkString("\n")

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
    val pulses = measures.map(_.pulses)
    val analysisPulses = Analysis(tonic, scale, pulses)
    val analyses: List[Analysis] =
      analysisPulses.toList.flatMap(Pulse.flatten).map(_.head)

    // Collect NCT notes for rendering with ○
    val nctNotes: Set[Note] = analyses
      .flatMap(_.notes.filter(_.nonChordToneType.isDefined).map(_.note))
      .toSet

    val (grid, beatColumns, musicWidth, _, _) =
      buildGrid(measures, nctNotes)
    val totalWidth = marginWidth + musicWidth + labelWidth

    // Flatten beat columns to align with analyses
    val flatCols: List[BeatColumn] = beatColumns.flatten

    // Build annotation lines below the staff
    val sb = new StringBuilder
    sb.append(grid.map(_.mkString.stripTrailing()).mkString("\n"))

    // Roman numeral row
    val rnLine = Array.fill(totalWidth)(' ')
    for (col, analysis) <- flatCols.zip(analyses) do
      val rn = analysis.chords.headOption
        .flatMap(_.romanNumerals.toList.headOption)
        .getOrElse("?")
      for (ch, i) <- rn.zipWithIndex do
        val c = col.colOffset + 1 + i
        if c < totalWidth then rnLine(c) = ch
    sb.append('\n')
    sb.append(rnLine.mkString.stripTrailing())

    // NCT label row (only if any NCTs exist)
    val hasNcts = analyses.exists(_.notes.exists(_.nonChordToneType.isDefined))
    if hasNcts then
      val nctLine = Array.fill(totalWidth)(' ')
      for (col, analysis) <- flatCols.zip(analyses) do
        val nctLabels = analysis.notes
          .filter(_.nonChordToneType.isDefined)
          .map(an => nctAbbrev(an.nonChordToneType.get))
          .distinct
        if nctLabels.nonEmpty then
          val label = nctLabels.mkString(",")
          for (ch, i) <- label.zipWithIndex do
            val c = col.colOffset + 1 + i
            if c < totalWidth then nctLine(c) = ch
      sb.append('\n')
      sb.append(nctLine.mkString.stripTrailing())

    // Error row (note-level and chord-level)
    val hasErrors = analyses.exists(a =>
      a.errors.nonEmpty || a.notes.exists(_.errors.nonEmpty)
    )
    if hasErrors then
      val errLine = Array.fill(totalWidth)(' ')
      for (col, analysis) <- flatCols.zip(analyses) do
        val noteErrs = analysis.notes.flatMap(_.errors).map(errAbbrev)
        val chordErrs = analysis.errors.map(chordErrAbbrev)
        val allErrs = (noteErrs ++ chordErrs).distinct
        if allErrs.nonEmpty then
          val label = allErrs.mkString(",")
          for (ch, i) <- label.zipWithIndex do
            val c = col.colOffset + 1 + i
            if c < totalWidth then errLine(c) = ch
      sb.append('\n')
      sb.append(errLine.mkString.stripTrailing())

    sb.toString
  end renderAnalysis

  private def errAbbrev(err: NoteError): String =
    err match
      case NoteError.ParallelFifths      => "∥5"
      case NoteError.ParallelOctaves     => "∥8"
      case NoteError.DirectFifths        => "→5"
      case NoteError.DirectOctaves       => "→8"
      case NoteError.VoiceCrossing       => "VX"
      case NoteError.SpacingError(_)     => "Sp"
      case NoteError.DoubledLeadingTone  => "2LT"

  private def chordErrAbbrev(err: ChordError): String =
    err match
      case ChordError.RootNotDoubledInRootPosition     => "2R"
      case ChordError.FifthNotDoubledInSecondInversion  => "2×5"

  private def placeNumber(
      grid: Array[Array[Char]],
      row: Int,
      numRows: Int,
      number: Int
  ): Unit =
    if row >= 0 && row < numRows then
      val s = number.toString
      for (ch, i) <- s.zipWithIndex do
        if i < grid(row).length then grid(row)(i) = ch

end StaffPrinter
