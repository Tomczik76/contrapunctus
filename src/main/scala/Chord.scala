import cats.implicits.*
import Interval.*
import cats.data.NonEmptyList
import Inversion as GlobalInversion

sealed trait Inversion(val value: Int)

trait ChordType(
    rootIntervals: Set[Interval],
    val inversion: Inversion
):
  private val rootInts = rootIntervals.toList
    .sortBy {
      case x: Interval.ExtendedChordInterval => x.value + 12
      case x                                 => x.value
    }

  def invert(intervals: List[Interval], inver: Int): List[Interval] =
    if inver <= 0 then intervals
    else
      val tail = intervals.tail
      val head = tail.head
      val result = tail.tail
        .map { interval =>
          val int = interval.value - head.value
          if int < 0 then Interval.fromOrdinal(int + 12)
          else Interval.fromOrdinal(int)
        }
        .prepended(Unison)
        .appended(head.invert)
      invert(result, inver - 1)

  val intervals = invert(rootInts, inversion.value).toSet
  val rootInterval: Interval = rootInts(inversion.value).invert

object TriadChordType:
  enum Inversion(value: Int) extends GlobalInversion(value):
    case Root extends Inversion(0)
    case First extends Inversion(1)
    case Second extends Inversion(2)

enum TriadChordType(
    rootIntervals: Set[Interval],
    inversion: TriadChordType.Inversion
) extends ChordType(rootIntervals, inversion):
  case Minor(override val inversion: TriadChordType.Inversion)
      extends TriadChordType(
        Set(Unison, MinorThird, PerfectFifth),
        inversion
      )
  case Major(override val inversion: TriadChordType.Inversion)
      extends TriadChordType(Set(Unison, MajorThird, PerfectFifth), inversion)
  case Diminished(override val inversion: TriadChordType.Inversion)
      extends TriadChordType(Set(Unison, MinorThird, Tritone), inversion)
  case Augmented(override val inversion: TriadChordType.Inversion)
      extends TriadChordType(Set(Unison, MajorThird, MajorSixth), inversion)

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
  case MinorSeventh(override val inversion: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(Unison, MinorThird, PerfectFifth, Interval.MinorSeventh),
        inversion
      )
  case MinorMajorSeventh(override val inversion: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(Unison, MinorThird, PerfectFifth, Interval.MajorSeventh),
        inversion
      )
  case DominantSeventh(override val inversion: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(Unison, MajorThird, PerfectFifth, Interval.MinorSeventh),
        inversion
      )
  case MajorSeventh(override val inversion: SeventhChordType.Inversion)
      extends SeventhChordType(
        Set(Unison, MajorThird, PerfectFifth, Interval.MajorSeventh),
        inversion
      )

object NinethChordType:
  enum Inversion(value: Int) extends GlobalInversion(value):
    case Root extends Inversion(0)
    case First extends Inversion(1)
    case Second extends Inversion(2)
    case Third extends Inversion(3)
    case Fourth extends Inversion(4)

enum NinethChordType(
    rootIntervals: Set[Interval],
    inversion: NinethChordType.Inversion
) extends ChordType(rootIntervals, inversion):
  case MinorNineth(override val inversion: NinethChordType.Inversion)
      extends NinethChordType(
        Set(
          Unison,
          MinorThird,
          PerfectFifth,
          Interval.MajorSeventh,
          MajorSecond
        ),
        inversion
      )
  case DominantNineth(override val inversion: NinethChordType.Inversion)
      extends NinethChordType(
        Set(
          Unison,
          MajorThird,
          PerfectFifth,
          Interval.MinorSeventh,
          MajorSecond
        ),
        inversion
      )

  case MajorNineth(override val inversion: NinethChordType.Inversion)
      extends NinethChordType(
        Set(
          Unison,
          MajorThird,
          PerfectFifth,
          Interval.MajorSeventh,
          MajorSecond
        ),
        inversion
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
      SeventhChordType.MajorSeventh(_)
    )

  private val ninethChordTypes = List(
    NinethChordType.MinorNineth(_),
    NinethChordType.DominantNineth(_),
    NinethChordType.MajorNineth(_)
  )

  private val triadPairs =
    for {
      inversion <- TriadChordType.Inversion.values
      chordTypeConstructor <- triadChordTypes
      chordType = chordTypeConstructor(inversion)
      intervals = chordType.intervals
    } yield (intervals -> chordType)

  private val seventhPairs =
    for {
      inversion <- SeventhChordType.Inversion.values
      chordTypeConstructor <- seventhChordTypes
      chordType = chordTypeConstructor(inversion)
      intervals = chordType.intervals
    } yield (intervals -> chordType)

  private val ninethPairs =
    for {
      inversion <- NinethChordType.Inversion.values
      chordTypeConstructor <- ninethChordTypes
      chordType = chordTypeConstructor(inversion)
      intervals = chordType.intervals
    } yield (intervals -> chordType)

  private val intervalMap = (triadPairs ++ seventhPairs ++ ninethPairs).toMap

  def apply(intervals: Set[Interval]): Option[ChordType] =
    intervalMap.get(intervals)

  def fromNotes(notes: Set[Note]): Option[ChordType] =
    for
      bass <- notes.minByOption(_.midi)
      intervals <- notes.toList.traverse(bass.interval)
      chordType <- ChordType(intervals.toSet)
    yield chordType

case class Chord(root: NoteType, chordType: ChordType)
object Chord:
  def fromNotes(notes: Set[Note]): Option[Chord] =
    for
      bass <- notes.minByOption(_.midi)
      intervalNotePairs <- notes.toList
        .traverse(note => bass.interval(note).tupleRight(note))
        .map(_.toMap)
      chordType <- ChordType(intervalNotePairs.keySet)
      root <- intervalNotePairs.get(chordType.rootInterval)
    yield Chord(root.noteType, chordType)
