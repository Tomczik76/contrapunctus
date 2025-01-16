import cats.Order

enum Interval(val value: Int):
  case PerfectUnison extends Interval(0)
  case MinorSecond   extends Interval(1)
  case MajorSecond   extends Interval(2)
  case MinorThird    extends Interval(3)
  case MajorThird    extends Interval(4)
  case PerfectFourth extends Interval(5)
  case Tritone       extends Interval(6)
  case PerfectFifth  extends Interval(7)
  case MinorSixth    extends Interval(8)
  case MajorSixth    extends Interval(9)
  case MinorSeventh  extends Interval(10)
  case MajorSeventh  extends Interval(11)
  case PerfectOctave extends Interval(12)

  case DiminishedSecond  extends Interval(PerfectUnison.value)
  case AugmentedUnison   extends Interval(MinorSecond.value)
  case DiminishedThird   extends Interval(MajorSecond.value)
  case AugmentedSecond   extends Interval(MinorThird.value)
  case DiminishedFourth  extends Interval(MajorThird.value)
  case AugmentedThird    extends Interval(PerfectFourth.value)
  case DiminishedFifth   extends Interval(Tritone.value)
  case AugmentedFourth   extends Interval(Tritone.value)
  case DiminishedSixth   extends Interval(PerfectFifth.value)
  case AugmentedFifth    extends Interval(MinorSixth.value)
  case DiminishedSeventh extends Interval(MajorSixth.value)
  case AugmentedSixth    extends Interval(MinorSeventh.value)
  case DiminishedOctave  extends Interval(MajorSeventh.value)
  case AugmentedSeventh  extends Interval(PerfectOctave.value)

  case MinorNinth extends Interval(PerfectOctave.value + MinorSecond.value)
  case MajorNinth extends Interval(PerfectOctave.value + MajorSecond.value)
  case MinorTenth extends Interval(PerfectOctave.value + MinorThird.value)
  case MajorTenth extends Interval(PerfectOctave.value + MajorThird.value)
  case PerfectEleventh
      extends Interval(PerfectOctave.value + PerfectFourth.value)
  case PerfectTwelfth extends Interval(PerfectOctave.value + PerfectFifth.value)
  case MinorThirteenth extends Interval(PerfectOctave.value + MinorSixth.value)
  case MajorThirteenth extends Interval(PerfectOctave.value + MajorSixth.value)
  case MinorFourteenth
      extends Interval(PerfectOctave.value + MinorSeventh.value)
  case MajorFourteenth
      extends Interval(PerfectOctave.value + MajorSeventh.value)
  case DoubleOctave extends Interval(PerfectOctave.value * 2)

  case DiminishedNinth      extends Interval(PerfectOctave.value)
  case AugmentedOctave      extends Interval(MinorNinth.value)
  case DiminishedTenth      extends Interval(MajorNinth.value)
  case AugmentedNinth       extends Interval(MinorTenth.value)
  case DiminishedEleventh   extends Interval(MajorTenth.value)
  case AugmentedTenth       extends Interval(PerfectEleventh.value)
  case DiminishedTwelfth    extends Interval(PerfectOctave.value)
  case AugmentedEleventh    extends Interval(PerfectOctave.value)
  case DiminishedThirteenth extends Interval(PerfectTwelfth.value)
  case AugmentedTwelfth     extends Interval(MinorThirteenth.value)
  case DiminishedFourteenth extends Interval(MajorThirteenth.value)
  case AugmentedThirteenth  extends Interval(MinorFourteenth.value)
  case DiminishedFifteenth  extends Interval(MajorFourteenth.value)
  case AugmentedFourteenth  extends Interval(DoubleOctave.value)

  val normalizedValue: Int = value % 12

  def invert: Interval =
    if this == PerfectUnison then PerfectUnison
    else Interval.fromOrdinal(12 - normalizedValue)
end Interval

object Interval:

  def apply(value: Int): Option[Interval] =
    value match
      case PerfectUnison.`value`   => Some(PerfectUnison)
      case MinorSecond.`value`     => Some(MinorSecond)
      case MajorSecond.`value`     => Some(MajorSecond)
      case MinorThird.`value`      => Some(MinorThird)
      case MajorThird.`value`      => Some(MajorThird)
      case PerfectFourth.`value`   => Some(PerfectFourth)
      case Tritone.`value`         => Some(Tritone)
      case PerfectFifth.`value`    => Some(PerfectFifth)
      case MinorSixth.`value`      => Some(MinorSixth)
      case MajorSixth.`value`      => Some(MajorSixth)
      case MinorSeventh.`value`    => Some(MinorSeventh)
      case MajorSeventh.`value`    => Some(MajorSeventh)
      case PerfectOctave.`value`   => Some(PerfectOctave)
      case MinorNinth.`value`      => Some(MinorNinth)
      case MajorNinth.`value`      => Some(MajorNinth)
      case MinorTenth.`value`      => Some(MinorTenth)
      case MajorTenth.`value`      => Some(MajorTenth)
      case PerfectEleventh.`value` => Some(PerfectEleventh)
      case PerfectTwelfth.`value`  => Some(PerfectTwelfth)
      case MinorThirteenth.`value` => Some(MinorThirteenth)
      case MajorThirteenth.`value` => Some(MajorThirteenth)
      case MinorFourteenth.`value` => Some(MinorFourteenth)
      case MajorFourteenth.`value` => Some(MajorFourteenth)
      case DoubleOctave.`value`    => Some(DoubleOctave)
      case _                       => None

  implicit object intervalOrdering extends Ordering[Interval]:
    override def compare(x: Interval, y: Interval): Int = x.value - y.value

  implicit object intervalOrder extends Order[Interval]:
    override def compare(x: Interval, y: Interval): Int = x.value - y.value
end Interval
