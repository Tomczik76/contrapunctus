enum NoteType(val value: Int):
  case C extends NoteType(0)
  case `C#` extends NoteType(1)
  case Db extends NoteType(1)
  case D extends NoteType(2)
  case `D#` extends NoteType(3)
  case Eb extends NoteType(3)
  case E extends NoteType(4)
  case F extends NoteType(5)
  case `F#` extends NoteType(6)
  case `Gb` extends NoteType(6)
  case G extends NoteType(7)
  case `G#` extends NoteType(8)
  case Ab extends NoteType(8)
  case A extends NoteType(9)
  case `A#` extends NoteType(10)
  case Bb extends NoteType(10)
  case B extends NoteType(11)
  case `B#` extends NoteType(12)
  case Cb extends NoteType(12)

  override def equals(that: Any): Boolean = that match
    case note: NoteType => this.value == note.value
    case _              => false

case class Note(noteType: NoteType, octave: Int):
  val midi = noteType.value + (octave + 1) * 12
  def interval(note: Note): Option[Interval] =
    if (midi < note.midi) Interval((note.midi - this.midi) % 12)
    else Interval((this.midi - note.midi) % 12)

object C:
  def apply(octave: Int) =
    Note(NoteType.C, octave)
object `C#`:
  def apply(octave: Int) =
    Note(NoteType.`C#`, octave)
object Db:
  def apply(octave: Int) =
    Note(NoteType.Db, octave)
object D:
  def apply(octave: Int) =
    Note(NoteType.D, octave)
object `D#`:
  def apply(octave: Int) =
    Note(NoteType.`D#`, octave)
object Eb:
  def apply(octave: Int) =
    Note(NoteType.Eb, octave)
object E:
  def apply(octave: Int) =
    Note(NoteType.E, octave)
object F:
  def apply(octave: Int) =
    Note(NoteType.F, octave)
object `F#`:
  def apply(octave: Int) =
    Note(NoteType.`F#`, octave)
object `Gb`:
  def apply(octave: Int) =
    Note(NoteType.`Gb`, octave)
object G:
  def apply(octave: Int) =
    Note(NoteType.G, octave)
object `G#`:
  def apply(octave: Int) =
    Note(NoteType.`G#`, octave)
object Ab:
  def apply(octave: Int) =
    Note(NoteType.Ab, octave)
object A:
  def apply(octave: Int) =
    Note(NoteType.A, octave)
object `A#`:
  def apply(octave: Int) =
    Note(NoteType.`A#`, octave)
object Bb:
  def apply(octave: Int) =
    Note(NoteType.Bb, octave)
object B:
  def apply(octave: Int) =
    Note(NoteType.B, octave)
object `B#`:
  def apply(octave: Int) =
    Note(NoteType.`B#`, octave)
object Cb:
  def apply(octave: Int) =
    Note(NoteType.Cb, octave)
