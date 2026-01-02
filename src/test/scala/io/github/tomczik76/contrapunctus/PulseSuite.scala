package io.github.tomczik76.contrapunctus

import Note.*
import Pulse.*
class PulseSuite extends munit.FunSuite:

  private def transpose(note: Note, semitones: Int): Note =
    val newMidi   = note.midi + semitones
    val newOctave = (newMidi / 12) - 1
    val pc        = Math.floorMod(newMidi, 12)
    val noteType  = NoteType.values.find(_.value == pc).get
    Note(noteType, newOctave)

  test("mapWithState transposes a simple melody"):
    val melody: Pulse[Note] =
      Duplet(C(4), D(4))

    val (mapped, _) = PulseTransform.mapWithState(melody, ()): (notes, s) =>
      (notes.map(transpose(_, 2)), s)

    val expected: Pulse[Note] =
      Duplet(D(4), E(4))

    assertEquals(mapped, expected)

  test("mapWithState transposes a longer melody with nested groups"):
    val melody: Pulse[Note] =
      Quintuplet(
        Atom(C(4)), // C
        Atom(D(4)), // D
        Duplet(
          E(4), // E
          F(4)  // F
        ),
        Atom(G(4)), // G
        Atom(A(4))  // A
      )

    val (mapped, _) = PulseTransform.mapWithState(melody, ()): (notes, s) =>
      (notes.map(transpose(_, 3)), s) // transpose up a minor third

    val expected: Pulse[Note] =
      Quintuplet(
        Atom(Eb(4)),
        Atom(F(4)),
        Duplet(
          Atom(G(4)),
          Atom(Ab(4))
        ),
        Atom(Bb(4)),
        Atom(C(5))
      )

    assertEquals(mapped, expected)
end PulseSuite
