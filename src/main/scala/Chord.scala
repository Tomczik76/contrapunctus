import cats.implicits.*
import Interval.*
import cats.data.{NonEmptyList, NonEmptySet}
import Inversion as GlobalInversion

import SeventhChordType.DiminishedSeventh

import scala.collection.immutable.SortedSet

sealed trait Inversion(val value: Int)

trait ChordType(
    rootIntervals: NonEmptySet[Interval],
    val inversion: Inversion
):

  def invert(intervals: List[Interval], times: Int): List[Interval] =
    (intervals, times) match
      case (Nil, _)         => Nil
      case (List(_), _)     => intervals
      case (_, i) if i <= 0 => intervals
      case (_ :: head :: tail, times) =>
        val result =
          tail
            .map { interval =>
              val int = interval.value - head.value
              if int < 0 then Interval.fromOrdinal(int + 12)
              else Interval.fromOrdinal(int)
            }
            .prepended(PerfectUnison)
            .appended(head.invert)
        invert(result, times - 1)

  val intervals: NonEmptySet[Interval] = NonEmptySet.fromSetUnsafe(
    SortedSet(invert(rootIntervals.toList, inversion.value)*)
  )
  val rootInterval: Interval = rootIntervals.toList(inversion.value).invert
end ChordType

object TriadChordType:
  enum Inversion(value: Int) extends GlobalInversion(value):
    case Root   extends Inversion(0)
    case First  extends Inversion(1)
    case Second extends Inversion(2)

enum TriadChordType(
    rootIntervals: NonEmptySet[Interval],
    inversion: TriadChordType.Inversion
) extends ChordType(rootIntervals, inversion):
  case Minor(inver: TriadChordType.Inversion)
      extends TriadChordType(
        NonEmptySet(PerfectUnison, SortedSet(MinorThird, PerfectFifth)),
        inver
      )
  case Major(inver: TriadChordType.Inversion)
      extends TriadChordType(
        NonEmptySet(PerfectUnison, SortedSet(MajorThird, PerfectFifth)),
        inver
      )
  case Diminished(inver: TriadChordType.Inversion)
      extends TriadChordType(
        NonEmptySet(PerfectUnison, SortedSet(MinorThird, DiminishedFifth)),
        inver
      )
  case Augmented(inver: TriadChordType.Inversion)
      extends TriadChordType(
        NonEmptySet(PerfectUnison, SortedSet(MajorThird, AugmentedFifth)),
        inver
      )
end TriadChordType

object SeventhChordType:
  enum Inversion(value: Int) extends GlobalInversion(value):
    case Root   extends Inversion(0)
    case First  extends Inversion(1)
    case Second extends Inversion(2)
    case Third  extends Inversion(3)

enum SeventhChordType(
    rootIntervals: NonEmptySet[Interval],
    inversion: SeventhChordType.Inversion
) extends ChordType(rootIntervals, inversion):
  case MinorSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(MinorThird, PerfectFifth, Interval.MinorSeventh)
        ),
        inver
      )
  case MinorMajorSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(MinorThird, PerfectFifth, Interval.MajorSeventh)
        ),
        inver
      )
  case DominantSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(MajorThird, PerfectFifth, Interval.MinorSeventh)
        ),
        inver
      )
  case MajorSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(MajorThird, PerfectFifth, Interval.MajorSeventh)
        ),
        inver
      )
  case DiminishedSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(MinorThird, DiminishedFifth, Interval.DiminishedSeventh)
        ),
        inver
      )
end SeventhChordType

object NinthChordType:
  enum Inversion(value: Int) extends GlobalInversion(value):
    case Root   extends Inversion(0)
    case First  extends Inversion(1)
    case Second extends Inversion(2)
    case Third  extends Inversion(3)
    case Fourth extends Inversion(4)

enum NinthChordType(
    rootIntervals: NonEmptySet[Interval],
    inversion: NinthChordType.Inversion
) extends ChordType(rootIntervals, inversion):
  case MinorNinth(inver: NinthChordType.Inversion)
      extends NinthChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(
            MinorThird,
            PerfectFifth,
            Interval.MinorSeventh,
            Interval.MajorNinth
          )
        ),
        inver
      )
  case DominantNinth(inver: NinthChordType.Inversion)
      extends NinthChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(
            MajorThird,
            PerfectFifth,
            Interval.MinorSeventh,
            Interval.MajorNinth
          )
        ),
        inver
      )

  case MajorNinth(inver: NinthChordType.Inversion)
      extends NinthChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(
            MajorThird,
            PerfectFifth,
            Interval.MajorSeventh,
            Interval.MajorNinth
          )
        ),
        inver
      )
  case MinorMajorNinth(inver: NinthChordType.Inversion)
      extends NinthChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(
            MinorThird,
            PerfectFifth,
            Interval.MajorSeventh,
            Interval.MajorNinth
          )
        ),
        inver
      )
  case MinorNinthOmit5(inver: NinthChordType.Inversion)
      extends NinthChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(
            MinorThird,
            Interval.MajorSeventh,
            Interval.MajorNinth
          )
        ),
        inver
      )
  case DominantNinthOmit5(inver: NinthChordType.Inversion)
      extends NinthChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(
            MajorThird,
            Interval.MinorSeventh,
            Interval.MajorNinth
          )
        ),
        inver
      )
  case MajorNinthOmit5(inver: NinthChordType.Inversion)
      extends NinthChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(
            MajorThird,
            Interval.MajorSeventh,
            Interval.MajorNinth
          )
        ),
        inver
      )
  case MinorMajorNinthOmit5(inver: NinthChordType.Inversion)
      extends NinthChordType(
        NonEmptySet(
          PerfectUnison,
          SortedSet(
            MinorThird,
            Interval.MajorSeventh,
            Interval.MajorNinth
          )
        ),
        inver
      )
end NinthChordType

object ChordType:
  private val triadChordTypes =
    List(
      TriadChordType.Minor(_),
      TriadChordType.Major(_),
      TriadChordType.Diminished(_)
    )

  private val seventhChordTypes =
    List(
      SeventhChordType.MinorSeventh(_),
      SeventhChordType.MajorSeventh(_),
      SeventhChordType.DominantSeventh(_),
      SeventhChordType.MinorMajorSeventh(_),
      SeventhChordType.DiminishedSeventh(_)
    )

  private val NinthChordTypes = List(
    NinthChordType.MinorNinth(_),
    NinthChordType.MajorNinth(_),
    NinthChordType.DominantNinth(_)
  )

  private val triadPairs: Map[NonEmptySet[Int], NonEmptyList[ChordType]] =
    val chordTypes = for
      chordTypeConstructor <- triadChordTypes
      inversion            <- TriadChordType.Inversion.values
      chordType = chordTypeConstructor(inversion)
    yield chordType

    chordTypes.foldMap(chordType =>
      Map(
        chordType.intervals.map(_.normalizedValue) -> NonEmptyList.of(chordType)
      )
    )

  private val seventhPairs: Map[NonEmptySet[Int], NonEmptyList[ChordType]] =
    val chordTypes = for
      chordTypeConstructor <- seventhChordTypes
      inversion            <- SeventhChordType.Inversion.values
      chordType = chordTypeConstructor(inversion)
    yield chordType

    chordTypes.foldMap(chordType =>
      Map(
        chordType.intervals.map(_.normalizedValue) -> NonEmptyList.of(chordType)
      )
    )

  private val ninthPairs: Map[NonEmptySet[Int], NonEmptyList[ChordType]] =
    val chordTypes = for
      chordTypeConstructor <- NinthChordTypes
      inversion            <- NinthChordType.Inversion.values
      chordType = chordTypeConstructor(inversion)
    yield chordType

    chordTypes.foldMap(chordType =>
      Map(
        chordType.intervals.map(_.normalizedValue) -> NonEmptyList.of(chordType)
      )
    )
  private val intervalMap = triadPairs |+| seventhPairs |+| ninthPairs

  def apply(intervals: NonEmptySet[Interval]): Set[ChordType] =
    intervalMap
      .get(intervals.map(_.normalizedValue))
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
  def fromNotes(notes: NonEmptySet[Note]): Set[Chord] =
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
end Chord
