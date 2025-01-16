import Rhythm.TiedNote
import cats.data.NonEmptyList

enum Rhythm[A]:
  case Duplet(one: Rhythm[A], two: Rhythm[A]) extends Rhythm[A]
  case Triplet(one: Rhythm[A], two: Rhythm[A], three: Rhythm[A])
      extends Rhythm[A]
  case Quintuplet(
      one: Rhythm[A],
      two: Rhythm[A],
      three: Rhythm[A],
      four: Rhythm[A],
      five: Rhythm[A]
  ) extends Rhythm[A]
  case Septuplet(
      one: Rhythm[A],
      two: Rhythm[A],
      three: Rhythm[A],
      four: Rhythm[A],
      five: Rhythm[A],
      six: Rhythm[A],
      seven: Rhythm[A]
  )                       extends Rhythm[A]
  case Note(value: A)     extends Rhythm[A]
  case TiedNote(value: A) extends Rhythm[A]
  case Rest               extends Rhythm[Nothing]
end Rhythm

case class TimeSignature(top: Int, bottom: Int)
case class Measure[A](
    timeSignature: TimeSignature,
    rhythm: NonEmptyList[Rhythm[A]]
)
