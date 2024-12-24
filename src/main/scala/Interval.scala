
enum Interval(val value: Int):
  case Unison extends Interval(0)
  case MinorSecond extends Interval(1)
  case MajorSecond extends Interval(2)
  case MinorThird extends Interval(3)
  case MajorThird extends Interval(4)
  case PerfectFourth extends Interval(5)
  case Tritone extends Interval(6)
  case PerfectFifth extends Interval(7)
  case MinorSixth extends Interval(8)
  case MajorSixth extends Interval(9)
  case MinorSeventh extends Interval(10)
  case MajorSeventh extends Interval(11)
  case AugmentedUnison extends Interval(MinorSecond.value)
  case DiminishedThird extends Interval(MajorSecond.value)
  case DiminishedFourth extends Interval(MajorThird.value)
  case AugmentedThird extends Interval(PerfectFourth.value)
  case AugmentedFourth extends Interval(Tritone.value)
  case DiminishedFifth extends Interval(Tritone.value)
  case AugmentedFifth extends Interval(MinorSixth.value)
  case DiminishedSixth extends Interval(PerfectFifth.value)
  case DiminishedSeventh extends Interval(MajorSixth.value)

  override def equals(that: Any): Boolean =
    that match
      case int: Interval => this.value == int.value
      case _: Any => false

  override def hashCode(): Int = this.value

  def invert: Interval =
    if (this == Unison) Unison 
    else Interval.fromOrdinal(12 - this.value)

object Interval:
  type ExtendedChordInterval = MinorSecond.type | MajorSecond.type |
    PerfectFourth.type | MinorSixth.type | MajorSixth.type
  def apply(value: Int): Option[Interval] =
    value match
      case Unison.value        => Some(Unison)
      case MinorSecond.value   => Some(MinorSecond)
      case MajorSecond.value   => Some(MajorSecond)
      case MinorThird.value    => Some(MinorThird)
      case MajorThird.value    => Some(MajorThird)
      case PerfectFourth.value => Some(PerfectFourth)
      case Tritone.value       => Some(Tritone)
      case PerfectFifth.value  => Some(PerfectFifth)
      case MinorSixth.value    => Some(MinorSixth)
      case MajorSixth.value    => Some(MajorSixth)
      case MinorSeventh.value  => Some(MinorSeventh)
      case MajorSeventh.value  => Some(MajorSeventh)
      case _                   => None
