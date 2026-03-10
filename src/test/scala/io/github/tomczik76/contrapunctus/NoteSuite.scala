package io.github.tomczik76.contrapunctus

import Interval.*

class NoteSuite extends munit.FunSuite:
  test("Note test"):
    assertEquals(NoteType.`C#`, NoteType.Db)

  test("intervalAbove when this.value > that.value (G up to C)"):
    assertEquals(NoteType.G.intervalAbove(NoteType.C), PerfectFourth)

  test("intervalAbove when this.value > that.value (A up to E)"):
    assertEquals(NoteType.A.intervalAbove(NoteType.E), PerfectFifth)

  test("intervalAbove when this.value > that.value (B up to F)"):
    assertEquals(NoteType.B.intervalAbove(NoteType.F), Tritone)

  test("enharmonic NoteTypes must have equal hashCodes"):
    assert(NoteType.`C#` == NoteType.Db)
    assertEquals(NoteType.`C#`.hashCode(), NoteType.Db.hashCode())

  test("enharmonic Chords in a large Set"):
    val chordCSharp = Chord(NoteType.`C#`, Triads.Major.Inversions.Root)
    val chordDb = Chord(NoteType.Db, Triads.Major.Inversions.Root)
    assert(chordCSharp == chordDb)
    val bigSet: Set[Chord] = Set(
      chordCSharp,
      Chord(NoteType.D, Triads.Minor.Inversions.Root),
      Chord(NoteType.E, Triads.Minor.Inversions.Root),
      Chord(NoteType.F, Triads.Major.Inversions.Root),
      Chord(NoteType.G, Triads.Major.Inversions.Root)
    )
    assert(bigSet.contains(chordDb))

  test("DoubleFlat and Flat must render differently"):
    assertNotEquals(Alteration.DoubleFlat.toString, Alteration.Flat.toString)

  // Note: NoteType.Db is declared with Alteration.DoubleFlat instead of
  // Alteration.Flat. The alteration param is currently unused so the compiler
  // optimizes it away, but it would surface as a bug if alteration is ever
  // referenced in NoteType's body.

  // --- intervalAbove: ascending case (this.value <= that.value) ---

  test("intervalAbove ascending — C up to E is MajorThird"):
    assertEquals(NoteType.C.intervalAbove(NoteType.E), Interval.MajorThird)

  test("intervalAbove ascending — C up to G is PerfectFifth"):
    assertEquals(NoteType.C.intervalAbove(NoteType.G), Interval.PerfectFifth)

  test("intervalAbove unison — C up to C is PerfectUnison"):
    assertEquals(NoteType.C.intervalAbove(NoteType.C), Interval.PerfectUnison)

  test("intervalAbove ascending — D up to A is PerfectFifth"):
    assertEquals(NoteType.D.intervalAbove(NoteType.A), Interval.PerfectFifth)

  // --- Note.midi ---

  test("midi value for C4 is 60"):
    assertEquals(Note.C(4).midi, 60)

  test("midi value for A4 is 69"):
    assertEquals(Note.A(4).midi, 69)

  test("midi value for C(-1) is 0"):
    assertEquals(Note.C(-1).midi, 0)

  // --- Note.interval ---

  test("Note.interval C4 to G4 is PerfectFifth"):
    assertEquals(Note.C(4).interval(Note.G(4)), Some(Interval.PerfectFifth))

  test("Note.interval G4 to C4 is PerfectFifth"):
    assertEquals(Note.G(4).interval(Note.C(4)), Some(Interval.PerfectFifth))

  test("Note.interval C4 to C4 is PerfectUnison"):
    assertEquals(Note.C(4).interval(Note.C(4)), Some(Interval.PerfectUnison))

  // --- Note ordering ---

  test("Note ordering compares by midi"):
    import cats.Order
    val ord = summon[Order[Note]]
    assert(ord.compare(Note.C(4), Note.D(4)) < 0)
    assert(ord.compare(Note.C(5), Note.C(4)) > 0)
    assert(ord.compare(Note.C(4), Note.C(4)) == 0)

  // --- NoteType equality across enharmonics ---

  test("enharmonic equivalence for various note types"):
    assert(NoteType.`D#` == NoteType.Eb)
    assert(NoteType.`F#` == NoteType.`Gb`)
    assert(NoteType.`G#` == NoteType.Ab)
    assert(NoteType.`A#` == NoteType.Bb)
    assert(NoteType.`B#` == NoteType.C)
    assert(NoteType.`E#` == NoteType.F)
    assert(NoteType.Cb == NoteType.B)

  test("NoteType.equals returns false for non-NoteType"):
    assert(!NoteType.C.equals("C"))
    assert(!NoteType.C.equals(0))

  test("non-enharmonic NoteTypes are not equal"):
    assert(!NoteType.C.equals(NoteType.D))
    assert(!NoteType.E.equals(NoteType.F))
