package io.github.tomczik76.contrapunctus

import cats.data.NonEmptySet

import scala.collection.immutable.SortedSet

import cats.implicits.*

case class Chord(root: NoteType, chordType: ChordType):
  def alteredScaleDegree(
      tonicNoteType: NoteType,
      scale: Scale
  ): NonEmptySet[AlteredScaleDegree] =
    scale.alteredScaleDegree(tonicNoteType, root)

  def isChordTone(noteType: NoteType): Boolean =
    val intervalFromRoot = root.intervalAbove(noteType).normalizedValue
    val rootOffset       = chordType.rootInterval.normalizedValue
    chordType.intervals.exists { i =>
      (i.normalizedValue - rootOffset + 12) % 12 == intervalFromRoot
    }

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
