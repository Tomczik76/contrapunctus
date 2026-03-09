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
