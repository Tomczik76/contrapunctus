package io.github.tomczik76.contrapunctus

enum NonChordToneType:
  case PassingTone
  case NeighborTone
  case Appoggiatura
  case EscapeTone
  case Suspension
  case Retardation
  case Anticipation
  case PedalTone

case class AnalyzedNote(
    note: Note,
    chord: Chord,
    nonChordToneType: Option[NonChordToneType]
):
  def isChordTone: Boolean = nonChordToneType.isEmpty

object NonChordToneAnalysis:
  private def isStep(a: Note, b: Note): Boolean =
    val diff = Math.abs(a.midi - b.midi)
    diff == 1 || diff == 2

  private def sameDirection(a: Note, b: Note, c: Note): Boolean =
    (b.midi - a.midi > 0) == (c.midi - b.midi > 0)

  def classify(
      prev: Option[(Note, Chord)],
      current: (Note, Chord),
      next: Option[(Note, Chord)]
  ): Option[NonChordToneType] =
    val (note, chord) = current
    if chord.isChordTone(note.noteType) then None
    else
      (prev, next) match
        // Suspension: step down resolution, approached from same pitch (held over)
        case (Some((p, prevChord)), Some((n, _)))
            if p.midi == note.midi && isStep(note, n) && n.midi < note.midi =>
          Some(NonChordToneType.Suspension)

        // Retardation: step up resolution, approached from same pitch (held over)
        case (Some((p, prevChord)), Some((n, _)))
            if p.midi == note.midi && isStep(note, n) && n.midi > note.midi =>
          Some(NonChordToneType.Retardation)

        // Anticipation: same pitch as next note, step from previous
        case (Some((p, _)), Some((n, _)))
            if isStep(p, note) && n.midi == note.midi =>
          Some(NonChordToneType.Anticipation)

        // Passing tone: stepwise in same direction
        case (Some((p, _)), Some((n, _)))
            if isStep(p, note) && isStep(note, n) && sameDirection(p, note, n) =>
          Some(NonChordToneType.PassingTone)

        // Neighbor tone: stepwise, returns to original pitch
        case (Some((p, _)), Some((n, _)))
            if isStep(p, note) && isStep(note, n) && p.midi == n.midi =>
          Some(NonChordToneType.NeighborTone)

        // Appoggiatura: leap to, step away
        case (Some((p, _)), Some((n, _)))
            if !isStep(p, note) && isStep(note, n) =>
          Some(NonChordToneType.Appoggiatura)

        // Escape tone: step to, leap away
        case (Some((p, _)), Some((n, _)))
            if isStep(p, note) && !isStep(note, n) =>
          Some(NonChordToneType.EscapeTone)

        // Pedal tone: same pitch held through chord changes (no prev/next needed for detection)
        case (Some((p, prevChord)), Some((n, _)))
            if p.midi == note.midi && n.midi == note.midi =>
          Some(NonChordToneType.PedalTone)

        case _ => None
end NonChordToneAnalysis
