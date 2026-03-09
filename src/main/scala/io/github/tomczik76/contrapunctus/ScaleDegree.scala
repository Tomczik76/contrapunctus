package io.github.tomczik76.contrapunctus

import cats.Order

enum ScaleDegree(value: Int, romanNumeral: String):
  case Tonic       extends ScaleDegree(1, "I")
  case Supertonic  extends ScaleDegree(2, "II")
  case Mediant     extends ScaleDegree(3, "III")
  case Subdominant extends ScaleDegree(4, "IV")
  case Dominant    extends ScaleDegree(5, "V")
  case Submediant  extends ScaleDegree(6, "VI")
  case LeadingTone extends ScaleDegree(7, "VII")

case class AlteredScaleDegree(
    degree: ScaleDegree,
    alteration: Alteration
)

object AlteredScaleDegree:
  given Order[AlteredScaleDegree] =
    Order.by(a => a.degree.ordinal - a.alteration.semitones)

enum Alteration(val semitones: Int):
  case DoubleFlat  extends Alteration(-2)
  case Flat        extends Alteration(-1)
  case Natural     extends Alteration(0)
  case Sharp       extends Alteration(1)
  case DoubleSharp extends Alteration(2)

  override def toString: String =
    this match
      case Alteration.DoubleFlat  => "𝄫"
      case Alteration.Flat        => "♭"
      case Alteration.Natural     => "♮"
      case Alteration.Sharp       => "♯"
      case Alteration.DoubleSharp => "𝄪"

object Alteration:
  def unsafeApply(semitones: Int): Alteration =
    semitones match
      case DoubleFlat.semitones  => DoubleFlat
      case Flat.semitones        => Flat
      case Natural.semitones     => Natural
      case Sharp.semitones       => Sharp
      case DoubleSharp.semitones => DoubleSharp
      case _ =>
        throw IllegalArgumentException(s"Illegal semitones for Alteration")
