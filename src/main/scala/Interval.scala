
enum Interval(val trueValue: Int, val value: Int):
  case PerfectUnison extends Interval(0, 0)
  case MinorSecond extends Interval(1, 1)
  case MajorSecond extends Interval(2, 2)
  case MinorThird extends Interval(3, 3)
  case MajorThird extends Interval(4, 4)
  case PerfectFourth extends Interval(5, 5)
  case Tritone extends Interval(6, 6)
  case PerfectFifth extends Interval(7, 7)
  case MinorSixth extends Interval(8, 8)
  case MajorSixth extends Interval(9, 9)
  case MinorSeventh extends Interval(10, 10)
  case MajorSeventh extends Interval(11, 11)
  case PerfectOctave extends Interval(12, PerfectUnison.value)
 
  case DiminishedSecond extends Interval(PerfectUnison.trueValue, PerfectUnison.value)
  case AugmentedUnison extends Interval(MinorSecond.trueValue, MinorSecond.value)
  case DiminishedThird extends Interval(MajorSecond.trueValue, MajorSecond.value)
  case AugmentedSecond extends Interval(MinorThird.trueValue, MinorThird.value)
  case DiminishedFourth extends Interval(MajorThird.trueValue, MajorThird.value)
  case AugmentedThird extends Interval(PerfectFourth.trueValue, PerfectFourth.value)
  case DiminishedFifth extends Interval(Tritone.trueValue, Tritone.value)
  case AugmentedFourth extends Interval(Tritone.trueValue, Tritone.value)
  case DiminishedSixth extends Interval(PerfectFifth.trueValue, PerfectFifth.value)
  case AugmentedFifth extends Interval(MinorSixth.trueValue, MinorSixth.value)
  case DiminishedSeventh extends Interval(MajorSixth.trueValue, MajorSixth.value)
  case AugmentedSixth extends Interval(MinorSeventh.trueValue, MinorSeventh.value)
  case DiminishedOctave extends Interval(MajorSeventh.trueValue, MajorSeventh.value)
  case AugmentedSeventh extends Interval(PerfectOctave.trueValue, PerfectUnison.value)
 
  case MinorNinth extends Interval(PerfectOctave.trueValue + MinorSecond.trueValue, MinorSecond.value)
  case MajorNinth extends Interval(PerfectOctave.trueValue + MajorSecond.trueValue, MajorSecond.value)
  case MinorTenth extends Interval(PerfectOctave.trueValue + MinorThird.trueValue, MinorThird.value)
  case MajorTenth extends Interval(PerfectOctave.trueValue + MajorThird.trueValue, MajorThird.value)
  case PerfectEleventh extends Interval(PerfectOctave.trueValue + PerfectFourth.trueValue, PerfectFourth.value)
  case PerfectTwelfth extends Interval(PerfectOctave.trueValue + PerfectFifth.trueValue, PerfectFifth.value)
  case MinorThirteenth extends Interval(PerfectOctave.trueValue + MinorSixth.trueValue, MinorSixth.value)
  case MajorThirteenth extends Interval(PerfectOctave.trueValue + MajorSixth.trueValue, MajorSixth.value)
  case MinorFourteenth extends Interval(PerfectOctave.trueValue + MinorSeventh.trueValue, MinorSeventh.value)
  case MajorFourteenth extends Interval(PerfectOctave.trueValue + MajorSeventh.trueValue, MajorSeventh.value)
  case DoubleOctave extends Interval(PerfectOctave.trueValue * 2, PerfectOctave.value)

  case DiminishedNinth extends Interval(PerfectOctave.trueValue, PerfectUnison.value)
  case AugmentedOctave extends Interval(MinorNinth.trueValue, MinorNinth.value)
  case DiminishedTenth extends Interval(MajorNinth.trueValue, MajorNinth.value)
  case AugmentedNinth extends Interval(MinorTenth.trueValue, MinorTenth.value)
  case DiminishedEleventh extends Interval(MajorTenth.trueValue, MajorTenth.value)
  case AugmentedTenth extends Interval(PerfectEleventh.trueValue, PerfectEleventh.value)
  case DiminishedTwelfth extends Interval(PerfectOctave.trueValue + Tritone.trueValue, Tritone.value)
  case AugmentedEleventh extends Interval(PerfectOctave.trueValue + Tritone.trueValue, Tritone.value)
  case DiminishedThirteenth extends Interval(PerfectTwelfth.trueValue, PerfectTwelfth.value)
  case AugmentedTwelfth extends Interval(MinorThirteenth.trueValue, MinorThirteenth.value)
  case DiminishedFourteenth extends Interval(MajorThirteenth.trueValue, MajorThirteenth.value)
  case AugmentedThirteenth extends Interval(MinorFourteenth.trueValue, MinorFourteenth.value)
  case DiminishedFifteenth extends Interval(MajorFourteenth.trueValue, MajorFourteenth.value)
  case AugmentedFourteenth extends Interval(DoubleOctave.trueValue, DoubleOctave.value)

  override def equals(that: Any): Boolean =
    that match
      case int: Interval => this.value == int.value
      case _: Any => false

  override def hashCode(): Int = this.value

  def invert: Interval =
    if (this == PerfectUnison) PerfectUnison
    else Interval.fromOrdinal(12 - this.value)

object Interval:

  def apply(value: Int): Option[Interval] =
    value match
      case PerfectUnison.trueValue => Some(PerfectUnison)
      case MinorSecond.trueValue   => Some(MinorSecond)
      case MajorSecond.trueValue   => Some(MajorSecond)
      case MinorThird.trueValue    => Some(MinorThird)
      case MajorThird.trueValue    => Some(MajorThird)
      case PerfectFourth.trueValue => Some(PerfectFourth)
      case Tritone.trueValue       => Some(Tritone)
      case PerfectFifth.trueValue  => Some(PerfectFifth)
      case MinorSixth.trueValue    => Some(MinorSixth)
      case MajorSixth.trueValue    => Some(MajorSixth)
      case MinorSeventh.trueValue  => Some(MinorSeventh)
      case MajorSeventh.trueValue  => Some(MajorSeventh)
      case PerfectOctave.trueValue => Some(PerfectOctave)
      case MinorNinth.trueValue => Some(MinorNinth)
      case MajorNinth.trueValue => Some(MajorNinth)
      case MinorTenth.trueValue => Some(MinorTenth)
      case MajorTenth.trueValue => Some(MajorTenth)
      case PerfectEleventh.trueValue => Some(PerfectEleventh)
      case PerfectTwelfth.trueValue => Some(PerfectTwelfth)
      case MinorThirteenth.trueValue => Some(MinorThirteenth)
      case MajorThirteenth.trueValue => Some(MajorThirteenth)
      case MinorFourteenth.trueValue => Some(MinorFourteenth)
      case MajorFourteenth.trueValue => Some(MajorFourteenth)
      case DoubleOctave.trueValue => Some(DoubleOctave)
      case _                   => None
