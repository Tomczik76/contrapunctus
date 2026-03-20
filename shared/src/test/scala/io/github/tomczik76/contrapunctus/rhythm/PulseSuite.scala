package io.github.tomczik76.contrapunctus.rhythm

import io.github.tomczik76.contrapunctus.core.{Note, NoteType}
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

  // --- flatten ---

  test("flatten — Atom returns single element list"):
    val pulse: Pulse[Int] = Pulse.Atom(42)
    assertEquals(Pulse.flatten(pulse), List(cats.data.NonEmptyList.one(42)))

  test("flatten — Rest returns empty list"):
    assertEquals(Pulse.flatten(Pulse.Rest), Nil)

  test("flatten — Duplet flattens to two elements"):
    val pulse: Pulse[Int] = Pulse.Duplet(1, 2)
    assertEquals(Pulse.flatten(pulse).size, 2)

  test("flatten — Triplet flattens to three elements"):
    val pulse: Pulse[Int] = Pulse.Triplet(1, 2, 3)
    assertEquals(Pulse.flatten(pulse).size, 3)

  test("flatten — Quintuplet flattens to five elements"):
    val pulse: Pulse[Int] = Pulse.Quintuplet(1, 2, 3, 4, 5)
    assertEquals(Pulse.flatten(pulse).size, 5)

  test("flatten — Septuplet flattens to seven elements"):
    val pulse: Pulse[Int] = Pulse.Septuplet(1, 2, 3, 4, 5, 6, 7)
    assertEquals(Pulse.flatten(pulse).size, 7)

  test("flatten — nested structure flattens all leaves"):
    val pulse: Pulse[Int] =
      Pulse.Duplet(Pulse.Triplet(1, 2, 3), Pulse.Atom(4))
    assertEquals(Pulse.flatten(pulse).size, 4)

  test("flatten — Rest inside Duplet is skipped"):
    val pulse: Pulse[Int] = Pulse.Duplet(Pulse.Atom(1), Pulse.Rest)
    assertEquals(Pulse.flatten(pulse).size, 1)

  // --- map ---

  test("map over Atom doubles value"):
    val pulse: Pulse[Int] = Pulse.Atom(5)
    assertEquals(pulse.map(_ * 2), Pulse.Atom(10))

  test("map over Duplet transforms both children"):
    val pulse: Pulse[Int] = Pulse.Duplet(1, 2)
    val mapped = pulse.map(_ + 10)
    assertEquals(
      Pulse.flatten(mapped).flatMap(_.toList),
      List(11, 12)
    )

  test("map over Triplet transforms all children"):
    val pulse: Pulse[Int] = Pulse.Triplet(1, 2, 3)
    val mapped = pulse.map(_.toString)
    assertEquals(
      Pulse.flatten(mapped).flatMap(_.toList),
      List("1", "2", "3")
    )

  test("map over Quintuplet transforms all children"):
    val pulse: Pulse[Int] = Pulse.Quintuplet(1, 2, 3, 4, 5)
    val mapped = pulse.map(_ * 2)
    assertEquals(
      Pulse.flatten(mapped).flatMap(_.toList),
      List(2, 4, 6, 8, 10)
    )

  test("map over Septuplet transforms all children"):
    val pulse: Pulse[Int] = Pulse.Septuplet(1, 2, 3, 4, 5, 6, 7)
    val mapped = pulse.map(_ * 3)
    assertEquals(
      Pulse.flatten(mapped).flatMap(_.toList),
      List(3, 6, 9, 12, 15, 18, 21)
    )

  test("map over Rest returns Rest"):
    val pulse: Pulse[Int] = Pulse.Rest
    assertEquals(pulse.map(_ + 1), Pulse.Rest)

  // --- timed: quintuplet and septuplet ---

  test("timed — quintuplet produces 1/5 spans"):
    val pulse: Pulse[Int] = Pulse.Quintuplet(1, 2, 3, 4, 5)
    val spans = Pulse.timed(pulse)
    assertEquals(spans.size, 5)
    assertEquals(spans(0)._1, Rational(0))
    assertEquals(spans(0)._2, Rational(1, 5))
    assertEquals(spans(4)._1, Rational(4, 5))
    assertEquals(spans(4)._2, Rational(1))

  test("timed — septuplet produces 1/7 spans"):
    val pulse: Pulse[Int] = Pulse.Septuplet(1, 2, 3, 4, 5, 6, 7)
    val spans = Pulse.timed(pulse)
    assertEquals(spans.size, 7)
    assertEquals(spans(0)._1, Rational(0))
    assertEquals(spans(0)._2, Rational(1, 7))
    assertEquals(spans(6)._1, Rational(6, 7))
    assertEquals(spans(6)._2, Rational(1))

  test("timed — Rest produces None value"):
    val spans = Pulse.timed(Pulse.Rest: Pulse[Int])
    assertEquals(spans.size, 1)
    assertEquals(spans(0)._3, None)

  // --- Atom variadic constructor ---

  test("Atom variadic constructor creates chord"):
    val chord = Pulse.Atom(C(4), E(4), G(4))
    chord match
      case Pulse.Atom(nel) => assertEquals(nel.size, 3)
      case _               => fail("Expected Atom")

  // --- mapWithState with counting state ---

  test("mapWithState threads state across leaves"):
    val pulse: Pulse[String] = Pulse.Triplet("a", "b", "c")
    val (mapped, finalCount) = PulseTransform.mapWithState(pulse, 0):
      (notes, count) =>
        (notes.map(s => s"$s$count"), count + 1)
    assertEquals(
      Pulse.flatten(mapped).flatMap(_.toList),
      List("a0", "b1", "c2")
    )
    assertEquals(finalCount, 3)

  // --- mapWithState with Quintuplet and Septuplet (exercises PulseF Functor/Traverse) ---

  test("mapWithState over Quintuplet transforms all leaves"):
    val pulse: Pulse[Int] = Pulse.Quintuplet(1, 2, 3, 4, 5)
    val (mapped, count) = PulseTransform.mapWithState(pulse, 0):
      (notes, c) => (notes.map(_ + c), c + 1)
    assertEquals(
      Pulse.flatten(mapped).flatMap(_.toList),
      List(1, 3, 5, 7, 9)
    )
    assertEquals(count, 5)

  test("mapWithState over Septuplet transforms all leaves"):
    val pulse: Pulse[Int] = Pulse.Septuplet(10, 20, 30, 40, 50, 60, 70)
    val (mapped, count) = PulseTransform.mapWithState(pulse, 0):
      (notes, c) => (notes.map(_ => c), c + 1)
    assertEquals(
      Pulse.flatten(mapped).flatMap(_.toList),
      List(0, 1, 2, 3, 4, 5, 6)
    )
    assertEquals(count, 7)

  test("mapWithState over Rest preserves Rest"):
    val pulse: Pulse[Int] = Pulse.Duplet(Pulse.Atom(1), Pulse.Rest)
    val (mapped, count) = PulseTransform.mapWithState(pulse, 0):
      (notes, c) => (notes.map(_ + c), c + 1)
    assertEquals(count, 1)
    Pulse.flatten(mapped) match
      case List(nel) => assertEquals(nel.head, 1)
      case _         => fail("Expected one leaf")

  // --- mapWithStateList ---

  test("mapWithStateList threads state across multiple pulses"):
    import cats.data.NonEmptyList
    val pulses = NonEmptyList.of(
      Pulse.Atom(1): Pulse[Int],
      Pulse.Atom(2): Pulse[Int],
      Pulse.Atom(3): Pulse[Int]
    )
    val (mapped, finalSum) = PulseTransform.mapWithStateList(pulses, 0):
      (notes, sum) =>
        val newSum = sum + notes.head
        (notes.map(_ => newSum), newSum)
    assertEquals(
      mapped.toList.flatMap(Pulse.flatten).flatMap(_.toList),
      List(1, 3, 6)
    )
    assertEquals(finalSum, 6)

  // --- convenience constructors ---

  test("Pulse.duplet constructs a Duplet from two Pulses"):
    val p = Pulse.duplet(Pulse.Atom(1), Pulse.Atom(2))
    assertEquals(Pulse.flatten(p).flatMap(_.toList), List(1, 2))

  test("Pulse.triplet constructs a Triplet from three Pulses"):
    val p = Pulse.triplet(Pulse.Atom(1), Pulse.Atom(2), Pulse.Atom(3))
    assertEquals(Pulse.flatten(p).flatMap(_.toList), List(1, 2, 3))

  test("Pulse.quintuplet constructs a Quintuplet from five Pulses"):
    val p = Pulse.quintuplet(
      Pulse.Atom(1), Pulse.Atom(2), Pulse.Atom(3), Pulse.Atom(4), Pulse.Atom(5)
    )
    assertEquals(Pulse.flatten(p).flatMap(_.toList), List(1, 2, 3, 4, 5))

  test("Pulse.septuplet constructs a Septuplet from seven Pulses"):
    val p = Pulse.septuplet(
      Pulse.Atom(1), Pulse.Atom(2), Pulse.Atom(3), Pulse.Atom(4),
      Pulse.Atom(5), Pulse.Atom(6), Pulse.Atom(7)
    )
    assertEquals(Pulse.flatten(p).flatMap(_.toList), List(1, 2, 3, 4, 5, 6, 7))

  // --- PulseF Functor ---

  test("PulseF standalone Functor.map exercises the Functor given directly"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import cats.data.NonEmptyList
    // Directly instantiate the standalone Functor given (not the Traverse one)
    val f = PulseF.given_Functor_PulseF[Int]
    assertEquals(f.map(PulseF.DupletF(1, 2))(_ * 10), PulseF.DupletF(10, 20))
    assertEquals(f.map(PulseF.TripletF(1, 2, 3))(_ + 1), PulseF.TripletF(2, 3, 4))
    assertEquals(f.map(PulseF.QuintupletF(1, 2, 3, 4, 5))(_ * 2), PulseF.QuintupletF(2, 4, 6, 8, 10))
    assertEquals(f.map(PulseF.SeptupletF(1, 2, 3, 4, 5, 6, 7))(_ + 10), PulseF.SeptupletF(11, 12, 13, 14, 15, 16, 17))
    assertEquals(f.map(PulseF.AtomF[Int, Int](NonEmptyList.one(42)))(_ + 1), PulseF.AtomF(NonEmptyList.one(42)))
    assertEquals(f.map(PulseF.RestF: PulseF[Int, Int])(_ + 1), PulseF.RestF)

  // --- PulseF Traverse: foldLeft ---

  test("PulseF Traverse.foldLeft over DupletF"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    assertEquals(t.foldLeft(PulseF.DupletF(1, 2), 0)(_ + _), 3)

  test("PulseF Traverse.foldLeft over TripletF"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    assertEquals(t.foldLeft(PulseF.TripletF(1, 2, 3), 0)(_ + _), 6)

  test("PulseF Traverse.foldLeft over QuintupletF"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    assertEquals(t.foldLeft(PulseF.QuintupletF(1, 2, 3, 4, 5), 0)(_ + _), 15)

  test("PulseF Traverse.foldLeft over SeptupletF"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    assertEquals(t.foldLeft(PulseF.SeptupletF(1, 2, 3, 4, 5, 6, 7), 0)(_ + _), 28)

  test("PulseF Traverse.foldLeft over AtomF and RestF returns initial"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    import cats.data.NonEmptyList
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    assertEquals(t.foldLeft(PulseF.AtomF[Int, Int](NonEmptyList.one(99)), 0)(_ + _), 0)
    assertEquals(t.foldLeft(PulseF.RestF: PulseF[Int, Int], 0)(_ + _), 0)

  // --- PulseF Traverse: foldRight ---

  test("PulseF Traverse.foldRight over DupletF"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    import cats.Eval
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    val result = t.foldRight(PulseF.DupletF(1, 2), Eval.now(0))((a, b) => b.map(_ + a)).value
    assertEquals(result, 3)

  test("PulseF Traverse.foldRight over TripletF"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    import cats.Eval
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    val result = t.foldRight(PulseF.TripletF(1, 2, 3), Eval.now(0))((a, b) => b.map(_ + a)).value
    assertEquals(result, 6)

  test("PulseF Traverse.foldRight over QuintupletF"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    import cats.Eval
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    val result = t.foldRight(PulseF.QuintupletF(1, 2, 3, 4, 5), Eval.now(0))((a, b) => b.map(_ + a)).value
    assertEquals(result, 15)

  test("PulseF Traverse.foldRight over SeptupletF"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    import cats.Eval
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    val result = t.foldRight(PulseF.SeptupletF(1, 2, 3, 4, 5, 6, 7), Eval.now(0))((a, b) => b.map(_ + a)).value
    assertEquals(result, 28)

  test("PulseF Traverse.foldRight over AtomF and RestF returns initial"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import PulseF.given
    import cats.Eval
    import cats.data.NonEmptyList
    val t = summon[cats.Traverse[[r] =>> PulseF[Int, r]]]
    assertEquals(t.foldRight(PulseF.AtomF[Int, Int](NonEmptyList.one(99)), Eval.now(0))((a, b) => b.map(_ + a)).value, 0)
    assertEquals(t.foldRight(PulseF.RestF: PulseF[Int, Int], Eval.now(0))((a, b) => b.map(_ + a)).value, 0)

  // --- PulseF coalgebra and algebra ---

  test("PulseF algebra reconstructs Pulse from all PulseF variants"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import cats.data.NonEmptyList
    val alg = PulseF.algebra[Int]
    val a1: Pulse[Int] = Pulse.Atom(1)
    val a2: Pulse[Int] = Pulse.Atom(2)
    val a3: Pulse[Int] = Pulse.Atom(3)
    val a4: Pulse[Int] = Pulse.Atom(4)
    val a5: Pulse[Int] = Pulse.Atom(5)
    val a6: Pulse[Int] = Pulse.Atom(6)
    val a7: Pulse[Int] = Pulse.Atom(7)
    assertEquals(alg(PulseF.DupletF(a1, a2)), Pulse.Duplet(a1, a2))
    assertEquals(alg(PulseF.TripletF(a1, a2, a3)), Pulse.Triplet(a1, a2, a3))
    assertEquals(alg(PulseF.QuintupletF(a1, a2, a3, a4, a5)), Pulse.Quintuplet(a1, a2, a3, a4, a5))
    assertEquals(alg(PulseF.SeptupletF(a1, a2, a3, a4, a5, a6, a7)), Pulse.Septuplet(a1, a2, a3, a4, a5, a6, a7))
    assertEquals(alg(PulseF.AtomF[Int, Pulse[Int]](NonEmptyList.one(42))), Pulse.Atom(NonEmptyList.one(42)))
    assertEquals(alg(PulseF.RestF: PulseF[Int, Pulse[Int]]), Pulse.Rest)

  test("PulseF coalgebra decomposes all Pulse variants"):
    import io.github.tomczik76.contrapunctus.rhythm.PulseF
    import cats.data.NonEmptyList
    val coalg = PulseF.coalgebra[Int]
    val a1: Pulse[Int] = Pulse.Atom(1)
    val a2: Pulse[Int] = Pulse.Atom(2)
    val a3: Pulse[Int] = Pulse.Atom(3)
    val a4: Pulse[Int] = Pulse.Atom(4)
    val a5: Pulse[Int] = Pulse.Atom(5)
    val a6: Pulse[Int] = Pulse.Atom(6)
    val a7: Pulse[Int] = Pulse.Atom(7)
    assertEquals(coalg(Pulse.Duplet(a1, a2)), PulseF.DupletF(a1, a2))
    assertEquals(coalg(Pulse.Triplet(a1, a2, a3)), PulseF.TripletF(a1, a2, a3))
    assertEquals(coalg(Pulse.Quintuplet(a1, a2, a3, a4, a5)), PulseF.QuintupletF(a1, a2, a3, a4, a5))
    assertEquals(coalg(Pulse.Septuplet(a1, a2, a3, a4, a5, a6, a7)), PulseF.SeptupletF(a1, a2, a3, a4, a5, a6, a7))
    assertEquals(coalg(Pulse.Atom(NonEmptyList.one(42))), PulseF.AtomF[Int, Pulse[Int]](NonEmptyList.one(42)))
    assertEquals(coalg(Pulse.Rest), PulseF.RestF)

end PulseSuite
