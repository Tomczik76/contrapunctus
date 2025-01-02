import cats.implicits.*
import Interval.*
import cats.data.NonEmptyList
import Inversion as GlobalInversion

import SeventhChordType.DiminishedSeventh

sealed trait Inversion(val value: Int)

trait ChordType(
    rootIntervals: Set[Interval],
    val inversion: Inversion
):
  private val sortedIntervals: List[Interval] = rootIntervals.toList
    .sortBy(_.trueValue)

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

  val intervals = invert(sortedIntervals, inversion.value).toSet
  val rootInterval: Interval = sortedIntervals(inversion.value).invert

object TriadChordType:
  enum Inversion(value: Int) extends GlobalInversion(value):
    case Root extends Inversion(0)
    case First extends Inversion(1)
    case Second extends Inversion(2)

enum TriadChordType(
    rootIntervals: Set[Interval],
    inversion: TriadChordType.Inversion
) extends ChordType(rootIntervals, inversion):
  case Minor(inver: TriadChordType.Inversion)
      extends TriadChordType(
        Set(PerfectUnison, MinorThird, PerfectFifth),
        inver
      )
  case Major(inver: TriadChordType.Inversion)
      extends TriadChordType(Set(PerfectUnison, MajorThird, PerfectFifth), inver)
  case Diminished(inver: TriadChordType.Inversion)
      extends TriadChordType(Set(PerfectUnison, MinorThird, DiminishedFifth), inver)
  case Augmented(inver: TriadChordType.Inversion)
      extends TriadChordType(Set(PerfectUnison, MajorThird, AugmentedFifth), inver)

object SeventhChordType:
  enum Inversion(value: Int) extends GlobalInversion(value):
    case Root extends Inversion(0)
    case First extends Inversion(1)
    case Second extends Inversion(2)
    case Third extends Inversion(3)

enum SeventhChordType(
    rootIntervals: Set[Interval],
    inversion: SeventhChordType.Inversion
) extends ChordType(rootIntervals, inversion):
  case MinorSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(PerfectUnison, MinorThird, PerfectFifth, Interval.MinorSeventh),
        inver
      )
  case MinorMajorSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(PerfectUnison, MinorThird, PerfectFifth, Interval.MajorSeventh),
        inver
      )
  case DominantSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(PerfectUnison, MajorThird, PerfectFifth, Interval.MinorSeventh),
        inver
      )
  case MajorSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(PerfectUnison, MajorThird, PerfectFifth, Interval.MajorSeventh),
        inver
      )
  case DiminishedSeventh(inver: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(PerfectUnison, MinorThird, DiminishedFifth, Interval.DiminishedSeventh),
        inver
      )

object NinthChordType:
  enum Inversion(value: Int) extends GlobalInversion(value):
    case Root extends Inversion(0)
    case First extends Inversion(1)
    case Second extends Inversion(2)
    case Third extends Inversion(3)
    case Fourth extends Inversion(4)

enum NinthChordType(
    rootIntervals: Set[Interval],
    inversion: NinthChordType.Inversion
) extends ChordType(rootIntervals, inversion):
  case MinorNinth(inver: NinthChordType.Inversion)
      extends NinthChordType(
        Set(
          PerfectUnison,
          MinorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MajorNinth
        ),
        inver
      )
  case DominantNinth(inver: NinthChordType.Inversion)
      extends NinthChordType(
        Set(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          Interval.MajorNinth
        ),
        inver
      )

  case MajorNinth(inver: NinthChordType.Inversion)
      extends NinthChordType(
        Set(
          PerfectUnison,
          MajorThird,
          PerfectFifth,
          Interval.MajorSeventh,
          Interval.MajorNinth
        ),
        inver
      )
  case MinorMajorNinth(inver: NinthChordType.Inversion)
      extends NinthChordType(
        Set(
          PerfectUnison,
          MinorThird,
          PerfectFifth,
          Interval.MajorSeventh,
          Interval.MajorNinth
        ),
        inver
      )
  case MinorNinthOmit5(inver: NinthChordType.Inversion)
  extends NinthChordType(
    Set(
      PerfectUnison,
      MinorThird,
      Interval.MajorSeventh,
      Interval.MajorNinth
    ),
    inver
  )
  case DominantNinthOmit5(inver: NinthChordType.Inversion)
  extends NinthChordType(
    Set(
      PerfectUnison,
      MajorThird,
      Interval.MinorSeventh,
      Interval.MajorNinth
    ),
    inver
  )
  case MajorNinthOmit5(inver: NinthChordType.Inversion)
  extends NinthChordType(
    Set(
      PerfectUnison,
      MajorThird,
      Interval.MajorSeventh,
      Interval.MajorNinth
    ),
    inver
  )
  case MinorMajorNinthOmit5(inver: NinthChordType.Inversion)
    extends NinthChordType(
      Set(
        PerfectUnison,
        MinorThird,
        Interval.MajorSeventh,
        Interval.MajorNinth
      ),
      inver
    )

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
      SeventhChordType.DominantSeventh(_),
      SeventhChordType.MinorMajorSeventh(_),
      SeventhChordType.MajorSeventh(_),
      SeventhChordType.DiminishedSeventh(_)
    )

  private val NinthChordTypes = List(
    NinthChordType.MinorNinth(_),
    NinthChordType.DominantNinth(_),
    NinthChordType.MajorNinth(_)
  )

  private val triadPairs: Map[Set[Interval], Set[ChordType]] = {
    val chordTypes = for {
      inversion <- TriadChordType.Inversion.values
      chordTypeConstructor <- triadChordTypes
      chordType = chordTypeConstructor(inversion)
    } yield chordType

    chordTypes.toList.foldMap(chordType =>
      Map(chordType.intervals -> Set(chordType))
    )
  }

  private val seventhPairs: Map[Set[Interval], Set[ChordType]] = {
    val chordTypes = for {
      inversion <- SeventhChordType.Inversion.values
      chordTypeConstructor <- seventhChordTypes
      chordType = chordTypeConstructor(inversion)
    } yield chordType

    chordTypes.toList.foldMap(chordType =>
      Map(chordType.intervals -> Set(chordType))
    )
  }

  private val NinthPairs: Map[Set[Interval], Set[ChordType]] = {
    val chordTypes = for {
      inversion <- NinthChordType.Inversion.values
      chordTypeConstructor <- NinthChordTypes
      chordType = chordTypeConstructor(inversion)
    } yield chordType

    chordTypes.toList.foldMap(chordType =>
      Map(chordType.intervals -> Set(chordType))
    )
  }
  private val intervalMap = triadPairs |+| seventhPairs |+| NinthPairs

  def apply(intervals: Set[Interval]): Option[Set[ChordType]] =
    intervalMap.get(intervals)

  def fromNotes(notes: Set[Note]): Option[Set[ChordType]] =
    for
      bass <- notes.minByOption(_.midi)
      intervals <- notes.toList.traverse(bass.interval)
      chordType <- ChordType(intervals.toSet)
    yield chordType

case class Chord(root: NoteType, chordType: ChordType)
object Chord:
  def fromNotes(notes: Set[Note]): Option[Set[Chord]] =
    for
      bass <- notes.minByOption(_.midi)
      intervalNotePairs <- notes.toList
        .traverse(note => bass.interval(note).tupleRight(note))
        .map(_.toMap)
      chordTypes <- ChordType(intervalNotePairs.keySet)
      chords <- chordTypes.toList.traverse(chordType =>
        intervalNotePairs
          .get(chordType.rootInterval)
          .map(note => Chord(note.noteType, chordType))
      )
    yield chords.toSet
