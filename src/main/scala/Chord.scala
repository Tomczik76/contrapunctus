import Interval.*
import cats.data.{NonEmptyList, NonEmptyMap, NonEmptySet}
import cats.implicits.*
import cats.kernel.Order

import scala.collection.immutable.SortedSet

sealed trait ChordType:
  val intervals: NonEmptySet[Interval]
  val rootInterval: Interval

object Triads:
  private def generateInversions(
      triads: Triads
  ): NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val inversions = triads.Inversions.values.toList.map(inversion =>
      NonEmptyMap.of(
        inversion.intervals ->
          NonEmptySet.of(inversion: ChordType)
      )
    )
    inversions.tail.foldLeft(inversions.head)(_ |+| _)

  val chordTypes: NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val inversions =
      Triads.values.toList.map(x => generateInversions(x))
    inversions.tail.foldLeft(inversions.head)(_ |+| _)

enum Triads(val rootIntervals: NonEmptySet[Interval]):
  base =>

  private lazy val firstInversion =
    ChordType.invert(rootIntervals.toNonEmptyList)
  private lazy val secondInversion = ChordType.invert(firstInversion)

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root extends Inversions(rootIntervals, rootIntervals.head)
    case First
        extends Inversions(
          NonEmptySet.of(firstInversion.head, firstInversion.tail*),
          firstInversion.last
        )
    case Second
        extends Inversions(
          NonEmptySet.of(secondInversion.head, secondInversion.tail*),
          secondInversion.tail.head
        )

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

end Triads

object Sevenths:
  private def generateInversions(
      sevenths: Sevenths
  ): NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val inversions = sevenths.Inversions.values.toList.map(inversion =>
      NonEmptyMap.of(
        inversion.intervals ->
          NonEmptySet.of(inversion: ChordType)
      )
    )
    inversions.tail.foldLeft(inversions.head)(_ |+| _)

  val chordTypes: NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val inversions =
      Sevenths.values.toList.map(x => generateInversions(x))
    inversions.tail.foldLeft(inversions.head)(_ |+| _)

enum Sevenths(val rootIntervals: NonEmptySet[Interval]):
  base =>

  private lazy val firstInversion =
    ChordType.invert(rootIntervals.toNonEmptyList)
  private lazy val secondInversion = ChordType.invert(firstInversion)
  private lazy val thirdInversion  = ChordType.invert(secondInversion)

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root extends Inversions(rootIntervals, rootIntervals.head)
    case First
        extends Inversions(
          NonEmptySet.of(firstInversion.head, firstInversion.tail*),
          firstInversion.last
        )
    case Second
        extends Inversions(
          NonEmptySet.of(secondInversion.head, secondInversion.tail*),
          secondInversion.tail.tail.head
        )
    case Third
        extends Inversions(
          NonEmptySet.of(thirdInversion.head, thirdInversion.tail*),
          thirdInversion.tail.head
        )

    override def toString: String =
      s"${base.productPrefix}-${this.productPrefix}"
  end Inversions

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
end Sevenths

object Ninths:
  private def generateInversions(
      ninths: Ninths
  ): NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val inversions = ninths.Inversions.values.toList.map(inversion =>
      NonEmptyMap.of(
        inversion.intervals ->
          NonEmptySet.of(inversion: ChordType)
      )
    )
    inversions.tail.foldLeft(inversions.head)(_ |+| _)

  val chordTypes: NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    val inversions =
      Ninths.values.toList.map(x => generateInversions(x))
    inversions.tail.foldLeft(inversions.head)(_ |+| _)

enum Ninths(val rootIntervals: NonEmptySet[Interval]):
  base =>

  private lazy val firstInversion =
    ChordType.invert(rootIntervals.toNonEmptyList)
  private lazy val secondInversion = ChordType.invert(firstInversion)
  private lazy val thirdInversion  = ChordType.invert(secondInversion)
  private lazy val fourthInversion = ChordType.invert(thirdInversion)

  enum Inversions(
      val intervals: NonEmptySet[Interval],
      val rootInterval: Interval
  ) extends ChordType:
    case Root extends Inversions(rootIntervals, rootIntervals.head)
    case First
        extends Inversions(
          NonEmptySet.of(firstInversion.head, firstInversion.tail*),
          firstInversion.last
        )
    case Second
        extends Inversions(
          NonEmptySet.of(secondInversion.head, secondInversion.tail*),
          secondInversion.tail.tail.tail.head
        )
    case Third
        extends Inversions(
          NonEmptySet.of(thirdInversion.head, thirdInversion.tail*),
          thirdInversion.tail.tail.head
        )
    case Fourth
        extends Inversions(
          NonEmptySet.of(fourthInversion.head, fourthInversion.tail*),
          fourthInversion.tail.head
        )
    override def toString: String =
      s"${base.productPrefix}-${this.productPrefix}"
  end Inversions

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
/*
  case MinorNinthOmit5
      extends Ninths(
        NonEmptySet.of(
          PerfectUnison,
          MinorThird,
          Interval.MajorSeventh,
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
      )*/
end Ninths

object ChordType:
  given Order[ChordType] = Order.by(_.hashCode())

  def invert(intervals: NonEmptyList[Interval]): NonEmptyList[Interval] =
    intervals match
      case _ if intervals.size == 1 => intervals
      case _ =>
        val _ :: head :: tail = intervals.toList: @unchecked
        val middle = tail
          .map { interval =>
            val int = interval.value - head.value
            if int < 0 then Interval.fromOrdinal(int + 12)
            else Interval.fromOrdinal(int)
          }

        NonEmptyList.of(PerfectUnison, middle :+ head.invert*)

  private val intervalMap
      : NonEmptyMap[NonEmptySet[Interval], NonEmptySet[ChordType]] =
    Triads.chordTypes |+| Sevenths.chordTypes |+| Ninths.chordTypes

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

case class Chord(root: NoteType, chordType: ChordType)
object Chord:
  def fromNotes(note: Note, rest: Note*): Set[Chord] =
    val notes = NonEmptySet.of(note, rest*)
    val option = for
      bass <- notes.toList.minByOption(_.midi)
      intervalNoteMap <- notes.toList
        .traverse(note => bass.interval(note).tupleRight(note))
        .map(_.toMap)
      chordTypes = ChordType(
        NonEmptySet.fromSetUnsafe(SortedSet.from(intervalNoteMap.keySet))
      )
      normalizedNoteMap = intervalNoteMap.map { case (interval, note) =>
        interval.normalizedValue -> note
      }
      chords <- chordTypes.toList.traverse(chordType =>
        normalizedNoteMap
          .get(chordType.rootInterval.normalizedValue)
          .map(note => Chord(note.noteType, chordType))
      )
    yield chords
    option.toSet.flatten
  end fromNotes
end Chord
