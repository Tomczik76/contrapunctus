package io.github.tomczik76.contrapunctus.core

import cats.Order
import io.github.tomczik76.contrapunctus.core.Alteration.*

enum NoteType(val value: Int, alteration: Alteration):
  case C    extends NoteType(0, Natural)
  case `B#` extends NoteType(0, Sharp)
  case Dbb  extends NoteType(0, DoubleFlat)

  case `C#`  extends NoteType(1, Sharp)
  case `B##` extends NoteType(1, DoubleSharp)
  case Db    extends NoteType(1, Flat)

  case D     extends NoteType(2, Natural)
  case `C##` extends NoteType(2, DoubleSharp)
  case Ebb   extends NoteType(2, DoubleFlat)

  case `D#` extends NoteType(3, Sharp)
  case Eb   extends NoteType(3, Flat)
  case Fbb  extends NoteType(3, DoubleFlat)

  case E     extends NoteType(4, Natural)
  case `D##` extends NoteType(4, DoubleSharp)
  case Fb    extends NoteType(4, Flat)

  case F    extends NoteType(5, Natural)
  case `E#` extends NoteType(5, Sharp)
  case Gbb  extends NoteType(5, DoubleFlat)

  case `F#`  extends NoteType(6, Sharp)
  case `E##` extends NoteType(6, DoubleSharp)
  case `Gb`  extends NoteType(6, Flat)

  case G     extends NoteType(7, Natural)
  case `F##` extends NoteType(7, DoubleSharp)
  case Abb   extends NoteType(7, DoubleFlat)

  case `G#` extends NoteType(8, Sharp)
  case Ab   extends NoteType(8, Flat)

  case A     extends NoteType(9, Natural)
  case `G##` extends NoteType(9, DoubleSharp)
  case Bbb   extends NoteType(9, DoubleFlat)

  case `A#` extends NoteType(10, Sharp)
  case Bb   extends NoteType(10, Flat)
  case Cbb  extends NoteType(10, DoubleFlat)

  case B     extends NoteType(11, Natural)
  case `A##` extends NoteType(11, DoubleSharp)
  case Cb    extends NoteType(11, Flat)

  def intervalAbove(that: NoteType): Interval =
    val semitones =
      if value <= that.value then that.value - value
      else that.value - value + 12
    Interval(semitones).getOrElse(
      throw AssertionError(s"Unexpected interval value: $semitones")
    )

  override def equals(that: Any): Boolean =
    that match
      case note: NoteType => this.value == note.value
      case _              => false

  override def hashCode(): Int = value.hashCode()
end NoteType

case class Note(noteType: NoteType, octave: Int):
  val midi: Int = noteType.value + (octave + 1) * 12
  def interval(note: Note): Option[Interval] =
    if midi < note.midi then Interval((note.midi - this.midi) % 12)
    else Interval((this.midi - note.midi)                     % 12)

object Note:
  given Order[Note] with
    def compare(x: Note, y: Note): Int = x.midi - y.midi

  object C:
    def apply(octave: Int): Note = Note(NoteType.C, octave)
  object `C#`:
    def apply(octave: Int): Note = Note(NoteType.`C#`, octave)
  object Db:
    def apply(octave: Int): Note = Note(NoteType.Db, octave)
  object D:
    def apply(octave: Int): Note = Note(NoteType.D, octave)
  object `D#`:
    def apply(octave: Int): Note = Note(NoteType.`D#`, octave)
  object Eb:
    def apply(octave: Int): Note = Note(NoteType.Eb, octave)
  object E:
    def apply(octave: Int): Note = Note(NoteType.E, octave)
  object F:
    def apply(octave: Int): Note = Note(NoteType.F, octave)
  object `F#`:
    def apply(octave: Int): Note = Note(NoteType.`F#`, octave)
  object `Gb`:
    def apply(octave: Int): Note = Note(NoteType.`Gb`, octave)
  object G:
    def apply(octave: Int): Note = Note(NoteType.G, octave)
  object `G#`:
    def apply(octave: Int): Note = Note(NoteType.`G#`, octave)
  object Ab:
    def apply(octave: Int): Note = Note(NoteType.Ab, octave)
  object A:
    def apply(octave: Int): Note = Note(NoteType.A, octave)
  object `A#`:
    def apply(octave: Int): Note = Note(NoteType.`A#`, octave)
  object Bb:
    def apply(octave: Int): Note = Note(NoteType.Bb, octave)
  object B:
    def apply(octave: Int): Note = Note(NoteType.B, octave)
  object `B#`:
    def apply(octave: Int): Note = Note(NoteType.`B#`, octave)
  object Cb:
    def apply(octave: Int): Note = Note(NoteType.Cb, octave)
end Note
