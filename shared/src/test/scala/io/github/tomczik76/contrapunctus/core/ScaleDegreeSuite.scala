package io.github.tomczik76.contrapunctus.core

class ScaleDegreeSuite extends munit.FunSuite:

  // --- ScaleDegree roman numerals ---

  test("Tonic roman numeral is I"):
    assertEquals(ScaleDegree.Tonic.romanNumeral, "I")

  test("Supertonic roman numeral is II"):
    assertEquals(ScaleDegree.Supertonic.romanNumeral, "II")

  test("Mediant roman numeral is III"):
    assertEquals(ScaleDegree.Mediant.romanNumeral, "III")

  test("Subdominant roman numeral is IV"):
    assertEquals(ScaleDegree.Subdominant.romanNumeral, "IV")

  test("Dominant roman numeral is V"):
    assertEquals(ScaleDegree.Dominant.romanNumeral, "V")

  test("Submediant roman numeral is VI"):
    assertEquals(ScaleDegree.Submediant.romanNumeral, "VI")

  test("LeadingTone roman numeral is VII"):
    assertEquals(ScaleDegree.LeadingTone.romanNumeral, "VII")

  // --- Alteration toString ---

  test("Natural toString is ♮"):
    assertEquals(Alteration.Natural.toString, "♮")

  test("Sharp toString is ♯"):
    assertEquals(Alteration.Sharp.toString, "♯")

  test("DoubleSharp toString is 𝄪"):
    assertEquals(Alteration.DoubleSharp.toString, "𝄪")

  // --- Alteration.unsafeApply ---

  test("unsafeApply returns correct alterations"):
    assertEquals(Alteration.unsafeApply(-2), Alteration.DoubleFlat)
    assertEquals(Alteration.unsafeApply(-1), Alteration.Flat)
    assertEquals(Alteration.unsafeApply(0), Alteration.Natural)
    assertEquals(Alteration.unsafeApply(1), Alteration.Sharp)
    assertEquals(Alteration.unsafeApply(2), Alteration.DoubleSharp)

  test("unsafeApply throws for invalid semitones"):
    intercept[IllegalArgumentException]:
      Alteration.unsafeApply(3)

  // --- AlteredScaleDegree ordering ---

  test("AlteredScaleDegree ordering"):
    import cats.Order
    val ord = summon[Order[AlteredScaleDegree]]
    val sharpTonic =
      AlteredScaleDegree(ScaleDegree.Tonic, Alteration.Sharp)
    val naturalDominant =
      AlteredScaleDegree(ScaleDegree.Dominant, Alteration.Natural)
    assert(ord.compare(sharpTonic, naturalDominant) < 0)

end ScaleDegreeSuite
