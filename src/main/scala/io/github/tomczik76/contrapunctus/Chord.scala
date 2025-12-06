package io.github.tomczik76.contrapunctus

import cats.data.NonEmptySet

import scala.collection.immutable.SortedSet

import cats.implicits.*

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
