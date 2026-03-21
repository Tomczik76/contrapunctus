package io.github.tomczik76.contrapunctus.harmony

import cats.data.{NonEmptyList, NonEmptyMap, NonEmptySet}
import cats.implicits.*
import cats.kernel.Order
import io.github.tomczik76.contrapunctus.core.{Interval, Note}
import io.github.tomczik76.contrapunctus.core.Interval.{
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
  def isMinorQuality: Boolean
  def qualitySymbol: String
  def figuredBass: String

/** A concrete inversion of a base chord type. Replaces the per-group inner
  * Inversions enums — all delegation (isMinorQuality, qualitySymbol,
  * figuredBass, toString) is handled once here.
  */
case class Inversion(
    base: InvertibleChordType,
    index: Int,
    intervals: NonEmptySet[Interval],
    rootInterval: Interval
) extends ChordType:
  def ordinal: Int            = index
  def isMinorQuality: Boolean = base.isMinorQuality
  def qualitySymbol: String   = base.qualitySymbol
  def figuredBass: String     = base.figuredBassAt(index)
  override def toString: String =
    s"${base.productPrefix}-${Inversion.inversionName(index)}"

object Inversion:
  private val names =
    Array("Root", "First", "Second", "Third", "Fourth", "Fifth", "Sixth")
  private[harmony] def inversionName(index: Int): String =
    if index < names.length then names(index) else s"Inv$index"

trait ChordGroup:
  def allBaseTypes: List[BaseChordType]

  private def generateInversions(
      baseChordType: BaseChordType
  ): NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val numPitchClasses = baseChordType.allInversions.head
      .intervals.map(_.normalizedValue).toSortedSet.size
    val dedupedInversions = baseChordType.allInversions.take(numPitchClasses)
    val inversions = dedupedInversions.map(chordType =>
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

trait InvertibleChordType extends BaseChordType with Product:
  val rootIntervals: NonEmptySet[Interval]
  protected def numInversions: Int
  def isMinorQuality: Boolean
  def qualitySymbol: String
  def figuredBassAt(inversionIndex: Int): String

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

  override lazy val allInversions: List[ChordType] =
    (0 until numInversions).toList.map: i =>
      Inversion(this, i, inversionIntervals(i), inversionRootInterval(i))

  /** Named accessors for inversions, replacing the former inner Inversions
    * enum. Usage: `Triads.Minor.Inversions.Root` becomes
    * `Triads.Minor.Inversions.Root`.
    */
  object Inversions:
    def Root: ChordType   = allInversions(0)
    def First: ChordType  = allInversions(1)
    def Second: ChordType = allInversions(2)
    def Third: ChordType =
      if numInversions > 3 then allInversions(3)
      else
        throw IndexOutOfBoundsException(
          s"No third inversion for $productPrefix"
        )
    def Fourth: ChordType =
      if numInversions > 4 then allInversions(4)
      else
        throw IndexOutOfBoundsException(
          s"No fourth inversion for $productPrefix"
        )
    def Fifth: ChordType =
      if numInversions > 5 then allInversions(5)
      else
        throw IndexOutOfBoundsException(
          s"No fifth inversion for $productPrefix"
        )
    def Sixth: ChordType =
      if numInversions > 6 then allInversions(6)
      else
        throw IndexOutOfBoundsException(
          s"No sixth inversion for $productPrefix"
        )
  end Inversions
end InvertibleChordType

object ChordType:
  given Order[ChordType] = Order.by(_.toString)

  def invert(intervals: NonEmptyList[Interval]): NonEmptyList[Interval] =
    intervals match
      case _ if intervals.size == 1 => intervals
      case _ =>
        val _ :: head :: tail = intervals.toList: @unchecked
        val middle = tail
          .map: interval =>
            val int       = interval.value - head.value
            val semitones = if int < 0 then int + 12 else int
            Interval(semitones % 12)
              .getOrElse(Interval.fromOrdinal(semitones % 12))

        NonEmptyList.of(PerfectUnison, middle :+ head.invert*)

  private def initializeChordGroups(
      groups: ChordGroup*
  ): NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    groups.map(_.chordTypes).reduce(_ |+| _)

  private lazy val intervalMap = initializeChordGroups(
    Triads,
    Sevenths,
    Ninths,
    AddNinths,
    AddElevenths,
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
  protected def numInversions: Int = 3

  def isMinorQuality: Boolean =
    this match
      case Minor | Diminished => true
      case _                  => false

  def qualitySymbol: String =
    this match
      case Diminished => "°"
      case Augmented  => "+"
      case Sus2       => "sus2"
      case Sus4       => "sus4"
      case PowerChord => "⁵"
      case _          => ""

  def figuredBassAt(inversionIndex: Int): String =
    inversionIndex match
      case 0 => ""
      case 1 => "⁶"
      case 2 => "⁶₄"

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
  protected def numInversions: Int = 4

  def isMinorQuality: Boolean =
    this match
      case MinorSeventh | MinorMajorSeventh | DiminishedSeventh |
          HalfDiminishedSeventh | MinorSixth =>
        true
      case _ => false

  def qualitySymbol: String =
    this match
      case DiminishedSeventh                => "°"
      case HalfDiminishedSeventh            => "ø"
      case AugmentedSeventh                 => "+"
      case AugmentedMajorSeventh            => "+Δ"
      case MajorSeventh | MinorMajorSeventh => "Δ"
      case _                                => ""

  def figuredBassAt(inversionIndex: Int): String =
    val isSixth = this match
      case MajorSixth | MinorSixth => true
      case _                       => false
    (isSixth, inversionIndex) match
      case (true, 0)  => "⁺¹³"
      case (false, 0) => "⁷"
      case (_, 1)     => "⁶₅"
      case (_, 2)     => "⁴₃"
      case (_, 3)     => "⁴₂"
      case _          => ""

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
  protected def numInversions: Int = 5

  def isMinorQuality: Boolean =
    this match
      case MinorNinth | MinorMajorNinth | MinorNinthOmit5 |
          MinorMajorNinthOmit5 =>
        true
      case _ => false

  def qualitySymbol: String =
    this match
      case MajorNinth | MinorMajorNinth | MajorNinthOmit5 |
          MinorMajorNinthOmit5 =>
        "Δ"
      case _ => ""

  def figuredBassAt(inversionIndex: Int): String = "⁹"

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

object AddNinths extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = AddNinths.values.toList

enum AddNinths(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  protected def numInversions: Int = 4

  def isMinorQuality: Boolean =
    this match
      case MinorAdd9 => true
      case _         => false

  def qualitySymbol: String = ""

  def figuredBassAt(inversionIndex: Int): String = "⁺⁹"

  case MajorAdd9
      extends AddNinths(
        NonEmptySet.of(PerfectUnison, MajorThird, PerfectFifth, Interval.MajorNinth)
      )
  case MinorAdd9
      extends AddNinths(
        NonEmptySet.of(PerfectUnison, MinorThird, PerfectFifth, Interval.MajorNinth)
      )
end AddNinths

object AddElevenths extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = AddElevenths.values.toList

enum AddElevenths(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  protected def numInversions: Int = 4

  def isMinorQuality: Boolean =
    this match
      case MinorAdd11 => true
      case _          => false

  def qualitySymbol: String = ""

  def figuredBassAt(inversionIndex: Int): String = "⁺¹¹"

  case MajorAdd11
      extends AddElevenths(
        NonEmptySet.of(PerfectUnison, MajorThird, PerfectFifth, Interval.PerfectEleventh)
      )
  case MinorAdd11
      extends AddElevenths(
        NonEmptySet.of(PerfectUnison, MinorThird, PerfectFifth, Interval.PerfectEleventh)
      )
end AddElevenths

object Elevenths extends ChordGroup:
  override def allBaseTypes: List[BaseChordType] = Elevenths.values.toList

enum Elevenths(val rootIntervals: NonEmptySet[Interval])
    extends InvertibleChordType:
  protected def numInversions: Int = 6

  def isMinorQuality: Boolean =
    this match
      case MinorEleventh => true
      case _             => false

  def qualitySymbol: String =
    this match
      case MajorEleventh => "Δ"
      case _             => ""

  def figuredBassAt(inversionIndex: Int): String = "¹¹"

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
  protected def numInversions: Int = 7

  def isMinorQuality: Boolean =
    this match
      case MinorThirteenth => true
      case _               => false

  def qualitySymbol: String =
    this match
      case MajorThirteenth => "Δ"
      case _               => ""

  def figuredBassAt(inversionIndex: Int): String = "¹³"

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
  protected def numInversions: Int = 5

  def isMinorQuality: Boolean = false

  def qualitySymbol: String =
    this match
      case SevenSharpFiveSharpNine => "+"
      case _                       => ""

  def figuredBassAt(inversionIndex: Int): String =
    this match
      case SevenFlatNine           => "⁷♭⁹"
      case SevenSharpNine          => "⁷♯⁹"
      case SevenFlatFive           => "⁷♭⁵"
      case SevenFlatFiveFlatNine   => "⁷♭⁵♭⁹"
      case SevenSharpFiveSharpNine => "⁷♯⁹"

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
