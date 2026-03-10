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

  test("align — same subdivision produces matching columns"):
    // Two voices, both duplets: columns align 1:1
    val soprano: Pulse[Note] = Duplet(C(4), D(4))
    val bass: Pulse[Note]    = Duplet(F(3), G(3))
    val columns = Pulse.align(IndexedSeq(soprano, bass))
    assertEquals(columns.size, 2)
    assertEquals(columns(0).values(0).map(_.head), Some(C(4)))
    assertEquals(columns(0).values(1).map(_.head), Some(F(3)))
    assertEquals(columns(1).values(0).map(_.head), Some(D(4)))
    assertEquals(columns(1).values(1).map(_.head), Some(G(3)))

  test("align — atom against duplet holds note across subdivisions"):
    // Soprano: two half notes, Bass: one whole note
    val soprano: Pulse[Note] = Duplet(C(4), D(4))
    val bass: Pulse[Note]    = Atom(F(3))
    val columns = Pulse.align(IndexedSeq(soprano, bass))
    assertEquals(columns.size, 2)
    // Bass F3 should sound against both soprano notes
    assertEquals(columns(0).values(0).map(_.head), Some(C(4)))
    assertEquals(columns(0).values(1).map(_.head), Some(F(3)))
    assertEquals(columns(1).values(0).map(_.head), Some(D(4)))
    assertEquals(columns(1).values(1).map(_.head), Some(F(3)))

  test("align — triplet against duplet produces correct grid"):
    // Soprano: triplet (boundaries at 0, 1/3, 2/3)
    // Bass: duplet (boundaries at 0, 1/2)
    // Combined boundaries: 0, 1/3, 1/2, 2/3 → 4 columns
    val soprano: Pulse[Note] = Triplet(C(4), D(4), E(4))
    val bass: Pulse[Note]    = Duplet(F(3), G(3))
    val columns = Pulse.align(IndexedSeq(soprano, bass))
    assertEquals(columns.size, 4)
    // t=0: C4 + F3
    assertEquals(columns(0).values(0).map(_.head), Some(C(4)))
    assertEquals(columns(0).values(1).map(_.head), Some(F(3)))
    // t=1/3: D4 + F3 (bass still on first half)
    assertEquals(columns(1).values(0).map(_.head), Some(D(4)))
    assertEquals(columns(1).values(1).map(_.head), Some(F(3)))
    // t=1/2: D4 still sounding + G3 (bass switches)
    assertEquals(columns(2).values(0).map(_.head), Some(D(4)))
    assertEquals(columns(2).values(1).map(_.head), Some(G(3)))
    // t=2/3: E4 + G3
    assertEquals(columns(3).values(0).map(_.head), Some(E(4)))
    assertEquals(columns(3).values(1).map(_.head), Some(G(3)))

  test("align — rest produces None in column"):
    val soprano: Pulse[Note] = Duplet(Atom(C(4)), Rest)
    val bass: Pulse[Note]    = Duplet(F(3), G(3))
    val columns = Pulse.align(IndexedSeq(soprano, bass))
    assertEquals(columns.size, 2)
    assertEquals(columns(1).values(0), None) // soprano resting
    assertEquals(columns(1).values(1).map(_.head), Some(G(3)))

  test("timed — nested duplet in triplet gives 1/6 spans"):
    val pulse: Pulse[Note] =
      Triplet(
        Atom(C(4)),
        Duplet(D(4), E(4)),
        Atom(F(4))
      )
    val spans = Pulse.timed(pulse)
    assertEquals(spans.size, 4) // C, D, E, F
    // First atom: [0, 1/3)
    assertEquals(spans(0)._1, Rational(0))
    assertEquals(spans(0)._2, Rational(1, 3))
    // Duplet children: [1/3, 1/2) and [1/2, 2/3)
    assertEquals(spans(1)._1, Rational(1, 3))
    assertEquals(spans(1)._2, Rational(1, 2))
    assertEquals(spans(2)._1, Rational(1, 2))
    assertEquals(spans(2)._2, Rational(2, 3))
    // Last atom: [2/3, 1)
    assertEquals(spans(3)._1, Rational(2, 3))
    assertEquals(spans(3)._2, Rational(1))

end PulseSuite

