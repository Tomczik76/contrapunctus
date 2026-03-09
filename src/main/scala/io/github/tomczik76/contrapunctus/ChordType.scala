package io.github.tomczik76.contrapunctus

import cats.data.{NonEmptyList, NonEmptyMap, NonEmptySet}
import cats.implicits.*
import cats.kernel.Order
import Interval.{
  AugmentedFifth,
  DiminishedFifth,
  MajorSecond,
  MajorThird,
  MinorThird,
  PerfectFifth,
  PerfectFourth,
  PerfectUnison
}

sealed trait ChordType:
  val intervals: NonEmptySet[Interval]
  val rootInterval: Interval
  def ordinal: Int

trait ChordGroup:
  def allBaseTypes: List[BaseChordType]

  private def generateInversions(
      baseChordType: BaseChordType
  ): NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val inversions = baseChordType.allInversions.map(chordType =>
      NonEmptyMap.of(
        chordType.intervals -> NonEmptySet.of(chordType: ChordType)
      )
    )
    inversions.tail.foldLeft(inversions.head)(_ |+| _)

  lazy val chordTypes
      : NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val inversions =
      allBaseTypes.map(x => generateInversions(x))
    inversions.tail.foldLeft(inversions.head)(_ |+| _)

trait BaseChordType:
  def allInversions: List[ChordType]

trait InvertibleChordType extends BaseChordType:
  val rootIntervals: NonEmptySet[Interval]
  protected def numInversions: Int

  private lazy val inversionsList: List[NonEmptyList[Interval]] =
    Iterator
      .iterate(rootIntervals.toNonEmptyList)(ChordType.invert)
      .take(numInversions)
      .toList

  protected def inversionIntervals(k: Int): NonEmptySet[Interval] =
    val inv = inversionsList(k)
    NonEmptySet.of(inv.head, inv.tail*)

  protected def inversionRootInterval(k: Int): Interval =
    if k == 0 then inversionsList(0).head
    else if k == 1 then inversionsList(1).last
    else inversionsList(k).toList(numInversions - k)

object ChordType:
  given Order[ChordType] = Order.by(_.hashCode())

  def invert(intervals: NonEmptyList[Interval]): NonEmptyList[Interval] =
    intervals match
      case _ if intervals.size == 1 => intervals
      case _ =>
        val _ :: head :: tail = intervals.toList: @unchecked
        val middle = tail
          .map { interval =>
            val int       = interval.value - head.value
            val semitones = if int < 0 then int + 12 else int
            Interval(semitones % 12)
              .getOrElse(Interval.fromOrdinal(semitones % 12))
          }

        NonEmptyList.of(PerfectUnison, middle :+ head.invert*)

  private def initializeChordGroups(
      groups: ChordGroup*
  ): NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    groups.map(_.chordTypes).reduce(_ |+| _)

  private lazy val intervalMap = initializeChordGroups(
    Triads,
    Sevenths,
    Ninths,
    Elevenths,
    Thirteenths,
    AlteredChords
  )

  def apply(intervals: NonEmptySet[Interval]): Set[ChordType] =
    intervalMap
      .mapKeys(_.map(_.normalizedValue))
      .apply(intervals.map(_.normalizedValue))
      .toSet
      .flatMap(_.toList.toSet)

  def fromNotes(notes: NonEmptySet[Note]): Set[ChordType] =
    val option =
      for
        bass      <- notes.toList.minByOption(_.midi)
        intervals <- notes.toList.traverse(bass.interval)
      yield ChordType(NonEmptySet.of(intervals.head, intervals.tail*))
    option.toSet.flatten
end ChordType

object Triads extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = Triads.values.toList

enum Triads(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  base =>
  protected def numInversions: Int            = 3
  override def allInversions: List[ChordType] = Inversions.values.toList

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root
        extends Inversions(inversionIntervals(0), inversionRootInterval(0))
    case First
        extends Inversions(inversionIntervals(1), inversionRootInterval(1))
    case Second
        extends Inversions(inversionIntervals(2), inversionRootInterval(2))
    override def toString: String =
      s"${base.productPrefix}-${this.productPrefix}"

  case Minor
      extends Triads(NonEmptySet.of(PerfectUnison, MinorThird, PerfectFifth))
  case Major
      extends Triads(NonEmptySet.of(PerfectUnison, MajorThird, PerfectFifth))
  case Diminished
      extends Triads(NonEmptySet.of(PerfectUnison, MinorThird, DiminishedFifth))
  case Augmented
      extends Triads(NonEmptySet.of(PerfectUnison, MajorThird, AugmentedFifth))
  case Sus2
      extends Triads(NonEmptySet.of(PerfectUnison, MajorSecond, PerfectFifth))
  case Sus4
      extends Triads(NonEmptySet.of(PerfectUnison, PerfectFourth, PerfectFifth))
  case PowerChord extends Triads(NonEmptySet.of(PerfectUnison, PerfectFifth))
end Triads

object Sevenths extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = Sevenths.values.toList

enum Sevenths(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  base =>
  protected def numInversions: Int            = 4
  override def allInversions: List[ChordType] = Inversions.values.toList

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root
        extends Inversions(inversionIntervals(0), inversionRootInterval(0))
    case First
        extends Inversions(inversionIntervals(1), inversionRootInterval(1))
    case Second
        extends Inversions(inversionIntervals(2), inversionRootInterval(2))
    case Third
        extends Inversions(inversionIntervals(3), inversionRootInterval(3))
    override def toString: String =
      s"${base.productPrefix}-${this.productPrefix}"

  case MinorSeventh
      extends Sevenths(
        NonEmptySet
          .of(PerfectUnison, MinorThird, PerfectFifth, Interval.MinorSeventh)
      )
  case MinorMajorSeventh
      extends Sevenths(
        NonEmptySet
          .of(PerfectUnison, MinorThird, PerfectFifth, Interval.MajorSeventh)
      )
  case DominantSeventh
      extends Sevenths(
        NonEmptySet
          .of(PerfectUnison, MajorThird, PerfectFifth, Interval.MinorSeventh)
      )
  case MajorSeventh
      extends Sevenths(
        NonEmptySet
          .of(PerfectUnison, MajorThird, PerfectFifth, Interval.MajorSeventh)
      )
  case DiminishedSeventh
      extends Sevenths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          DiminishedFifth,
          Interval.DiminishedSeventh
        )
      )
  case HalfDiminishedSeventh
      extends Sevenths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          DiminishedFifth,
          Interval.MinorSeventh
        )
      )
  case AugmentedSeventh
      extends Sevenths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          AugmentedFifth,
          Interval.MinorSeventh
        )
      )
  case AugmentedMajorSeventh
      extends Sevenths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          AugmentedFifth,
          Interval.MajorSeventh
        )
      )
  case MajorSixth
      extends Sevenths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MajorSixth
        )
      )
  case MinorSixth
      extends Sevenths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          PerfectFifth,
          Interval.MajorSixth
        )
      )
end Sevenths

object Ninths extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = Ninths.values.toList

enum Ninths(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  base =>
  protected def numInversions: Int            = 5
  override def allInversions: List[ChordType] = Inversions.values.toList

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root
        extends Inversions(inversionIntervals(0), inversionRootInterval(0))
    case First
        extends Inversions(inversionIntervals(1), inversionRootInterval(1))
    case Second
        extends Inversions(inversionIntervals(2), inversionRootInterval(2))
    case Third
        extends Inversions(inversionIntervals(3), inversionRootInterval(3))
    case Fourth
        extends Inversions(inversionIntervals(4), inversionRootInterval(4))
    override def toString: String =
      s"${base.productPrefix}-${this.productPrefix}"

  case MinorNinth
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MajorNinth
        )
      )
  case DominantNinth
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MajorNinth
        )
      )
  case MajorNinth
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MajorSeventh,
          Interval.MajorNinth
        )
      )
  case MinorMajorNinth
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          PerfectFifth,
          Interval.MajorSeventh,
          Interval.MajorNinth
        )
      )
  case MinorNinthOmit5
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          Interval.MinorSeventh,
          Interval.MajorNinth
        )
      )
  case DominantNinthOmit5
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          Interval.MinorSeventh,
          Interval.MajorNinth
        )
      )
  case MajorNinthOmit5
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          Interval.MajorSeventh,
          Interval.MajorNinth
        )
      )
  case MinorMajorNinthOmit5
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          Interval.MajorSeventh,
          Interval.MajorNinth
        )
      )
end Ninths

object Elevenths extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = Elevenths.values.toList

enum Elevenths(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  base =>
  protected def numInversions: Int            = 6
  override def allInversions: List[ChordType] = Inversions.values.toList

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root
        extends Inversions(inversionIntervals(0), inversionRootInterval(0))
    case First
        extends Inversions(inversionIntervals(1), inversionRootInterval(1))
    case Second
        extends Inversions(inversionIntervals(2), inversionRootInterval(2))
    case Third
        extends Inversions(inversionIntervals(3), inversionRootInterval(3))
    case Fourth
        extends Inversions(inversionIntervals(4), inversionRootInterval(4))
    case Fifth
        extends Inversions(inversionIntervals(5), inversionRootInterval(5))
    override def toString: String =
      s"${base.productPrefix}-${this.productPrefix}"

  case MajorEleventh
      extends Elevenths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MajorSeventh,
          Interval.MajorNinth,
          Interval.PerfectEleventh
        )
      )
  case MinorEleventh
      extends Elevenths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MajorNinth,
          Interval.PerfectEleventh
        )
      )
  case DominantEleventh
      extends Elevenths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MajorNinth,
          Interval.PerfectEleventh
        )
      )
end Elevenths

object Thirteenths extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = Thirteenths.values.toList

enum Thirteenths(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  base =>
  protected def numInversions: Int            = 7
  override def allInversions: List[ChordType] = Inversions.values.toList

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root
        extends Inversions(inversionIntervals(0), inversionRootInterval(0))
    case First
        extends Inversions(inversionIntervals(1), inversionRootInterval(1))
    case Second
        extends Inversions(inversionIntervals(2), inversionRootInterval(2))
    case Third
        extends Inversions(inversionIntervals(3), inversionRootInterval(3))
    case Fourth
        extends Inversions(inversionIntervals(4), inversionRootInterval(4))
    case Fifth
        extends Inversions(inversionIntervals(5), inversionRootInterval(5))
    case Sixth
        extends Inversions(inversionIntervals(6), inversionRootInterval(6))
    override def toString: String =
      s"${base.productPrefix}-${this.productPrefix}"
  end Inversions

  case MajorThirteenth
      extends Thirteenths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MajorSeventh,
          Interval.MajorNinth,
          Interval.PerfectEleventh,
          Interval.MajorThirteenth
        )
      )
  case MinorThirteenth
      extends Thirteenths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MajorNinth,
          Interval.PerfectEleventh,
          Interval.MajorThirteenth
        )
      )
  case DominantThirteenth
      extends Thirteenths(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MajorNinth,
          Interval.PerfectEleventh,
          Interval.MajorThirteenth
        )
      )
end Thirteenths

object AlteredChords extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = AlteredChords.values.toList

enum AlteredChords(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  base =>
  protected def numInversions: Int            = 5
  override def allInversions: List[ChordType] = Inversions.values.toList

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root
        extends Inversions(inversionIntervals(0), inversionRootInterval(0))
    case First
        extends Inversions(inversionIntervals(1), inversionRootInterval(1))
    case Second
        extends Inversions(inversionIntervals(2), inversionRootInterval(2))
    case Third
        extends Inversions(inversionIntervals(3), inversionRootInterval(3))
    case Fourth
        extends Inversions(inversionIntervals(4), inversionRootInterval(4))
    override def toString: String =
      s"${base.productPrefix}-${this.productPrefix}"

  case SevenFlatNine
      extends AlteredChords(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MinorNinth
        )
      )
  case SevenSharpNine
      extends AlteredChords(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MinorTenth
        )
      )
  case SevenFlatFive
      extends AlteredChords(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          DiminishedFifth,
          Interval.MinorSeventh
        )
      )
  case SevenFlatFiveFlatNine
      extends AlteredChords(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          DiminishedFifth,
          Interval.MinorSeventh,
          Interval.MinorNinth
        )
      )
  case SevenSharpFiveSharpNine
      extends AlteredChords(
        NonEmptySet.of(
          PerfectUnison,
          MajorThird,
          AugmentedFifth,
          Interval.MinorSeventh,
          Interval.MinorTenth
        )
      )
end AlteredChords
