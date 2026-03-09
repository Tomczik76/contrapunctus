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

  test("Pulse[Sounding] represents keyboard music with partial ties"):
    import Sounding.*
    // Piano: C major chord, then C and G tied while E moves to F
    val beat1: Pulse[Sounding] =
      Atom(Attack(C(3)), Attack(E(3)), Attack(G(3)))
    val beat2: Pulse[Sounding] =
      Atom(Sustain(C(3)), Attack(F(3)), Sustain(G(3)))

    // Extract notes from beat2 — all three pitches are sounding
    val sounding = beat2 match
      case Atom(nel) => nel.toList
      case _         => Nil
    assertEquals(sounding.map(_.note), List(C(3), F(3), G(3)))

    // Sustained vs attacked is preserved
    assert(sounding(0).isInstanceOf[Sounding.Sustain])
    assert(sounding(1).isInstanceOf[Sounding.Attack])
    assert(sounding(2).isInstanceOf[Sounding.Sustain])

end PulseSuite
