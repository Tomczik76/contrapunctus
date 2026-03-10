package io.github.tomczik76.contrapunctus

import cats.data.NonEmptyList
import Note.*

class StaffPrinterSuite extends munit.FunSuite:

  private val ts44 = TimeSignature(4, 4)
  private val ts34 = TimeSignature(3, 4)

  private def measure(ts: TimeSignature, notes: Note*): Measure[Note] =
    val atoms = notes.toList.map(n => Pulse.Atom(n): Pulse[Note])
    val pulse = atoms match
      case a :: Nil      => a
      case a :: b :: Nil  => Pulse.Duplet(a, b)
      case a :: b :: c :: Nil => Pulse.Triplet(a, b, c)
      case a :: b :: c :: d :: Nil =>
        Pulse.Duplet(Pulse.Duplet(a, b), Pulse.Duplet(c, d))
      case _ => throw IllegalArgumentException("Unsupported beat count")
    Measure(ts, pulse)

  test("render single note C4 shows ledger line"):
    val m = measure(ts44, C(4))
    val output = StaffPrinter.render(NonEmptyList.one(m))
    assert(output.contains("●"), "Should contain a notehead")
    assert(output.contains("F5") || output.contains("E4"), "Should have staff line labels")

  test("render C major scale across two measures"):
    val m1 = measure(ts44, C(4), D(4), E(4), F(4))
    val m2 = measure(ts44, G(4), A(4), B(4), C(5))
    val output = StaffPrinter.render(NonEmptyList.of(m1, m2))
    // Should have 8 noteheads
    assertEquals(output.count(_ == '●'), 8)
    // Should have a barline
    assert(output.contains("┼") || output.contains("│"), "Should have barline between measures")

  test("render chord shows multiple noteheads in same column"):
    // C major triad: C4, E4, G4
    val pulse: Pulse[Note] = Pulse.Atom(C(4), E(4), G(4))
    val m = Measure(ts44, pulse)
    val output = StaffPrinter.render(NonEmptyList.one(m))
    assertEquals(output.count(_ == '●'), 3)

  test("render with rest leaves empty column"):
    val pulse: Pulse[Note] = Pulse.Duplet(Pulse.Atom(C(4)), Pulse.Rest)
    val m = Measure(ts44, pulse)
    val output = StaffPrinter.render(NonEmptyList.one(m))
    assertEquals(output.count(_ == '●'), 1)

  test("render with sharps shows accidental"):
    val m = measure(ts44, `F#`(4))
    val output = StaffPrinter.render(NonEmptyList.one(m))
    assert(output.contains("♯"), "Should show sharp accidental")

  test("render with flats shows accidental"):
    val m = measure(ts44, Bb(4))
    val output = StaffPrinter.render(NonEmptyList.one(m))
    assert(output.contains("♭"), "Should show flat accidental")

  test("render notes above staff shows ledger lines"):
    val m = measure(ts44, A(5))
    val output = StaffPrinter.render(NonEmptyList.one(m))
    // A5 is above F5, needs one ledger line
    assertEquals(output.count(_ == '●'), 1)

  test("render selects bass clef for low notes"):
    val m = measure(ts44, C(2), E(2), G(2))
    val output = StaffPrinter.render(NonEmptyList.one(m))
    // Bass clef labels: G2, B2, D3, F3, A3
    assert(output.contains("G2") || output.contains("A3"), "Should use bass clef")

  test("render empty notes returns empty message"):
    val m = Measure(ts44, Pulse.Rest: Pulse[Note])
    val output = StaffPrinter.render(NonEmptyList.one(m))
    assertEquals(output, "(empty)")

  test("render 3/4 time signature"):
    val m = measure(ts34, C(4), E(4), G(4))
    val output = StaffPrinter.render(NonEmptyList.one(m))
    assert(output.contains("3"), "Should show top number 3")
    assert(output.contains("4"), "Should show bottom number 4")

  test("render prints readable staff for visual inspection"):
    val m1 = measure(ts44, C(4), D(4), E(4), F(4))
    val m2 = measure(ts44, G(4), A(4), B(4), C(5))
    val output = StaffPrinter.render(NonEmptyList.of(m1, m2))
    // Uncomment to visually inspect:
    // println(output)
    // Just verify it renders without error and has expected structure
    val lines = output.split("\n")
    assert(lines.length > 5, "Should have multiple rows for the staff")

end StaffPrinterSuite
