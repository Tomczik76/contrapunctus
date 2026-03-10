package io.github.tomczik76.contrapunctus

class ScaleSuite extends munit.FunSuite:

  test("alteredScaleDegree should not crash when note exceeds scale's max interval"):
    // B natural is 11 semitones above C, but NaturalMinor's highest interval
    // is MinorSeventh (10). indexWhere returns -1, causing IndexOutOfBoundsException.
    Scale.NaturalMinor.alteredScaleDegree(NoteType.C, NoteType.B)

  // --- Scale intervals ---

  test("Major scale has 7 intervals"):
    assertEquals(Scale.Major.intervals.size, 7)

  test("NaturalMinor scale has 7 intervals"):
    assertEquals(Scale.NaturalMinor.intervals.size, 7)

  test("HarmonicMinor scale has 7 intervals"):
    assertEquals(Scale.HarmonicMinor.intervals.size, 7)

  test("HarmonicMinor has raised 7th (MajorSeventh)"):
    assert(Scale.HarmonicMinor.intervals.toList.contains(Interval.MajorSeventh))

  test("NaturalMinor has MinorSeventh"):
    assert(Scale.NaturalMinor.intervals.toList.contains(Interval.MinorSeventh))

  // --- alteredScaleDegree: exact match ---

  test("C in C Major is Tonic, Natural"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.C)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Tonic)
    assertEquals(asd.alteration, Alteration.Natural)

  test("G in C Major is Dominant, Natural"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.G)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Dominant)
    assertEquals(asd.alteration, Alteration.Natural)

  test("E in C Major is Mediant, Natural"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.E)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Mediant)
    assertEquals(asd.alteration, Alteration.Natural)

  // --- alteredScaleDegree: between scale degrees ---

  test("C# in C Major returns two altered scale degrees"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.`C#`)
    // C# is between C (Tonic) and D (Supertonic)
    assertEquals(result.toNonEmptyList.size, 2)

  test("F# in C Major returns two altered scale degrees"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.`F#`)
    assertEquals(result.toNonEmptyList.size, 2)

  // --- alteredScaleDegree: different tonics ---

  test("E in A Major is Dominant, Natural"):
    val result = Scale.Major.alteredScaleDegree(NoteType.A, NoteType.E)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Dominant)
    assertEquals(asd.alteration, Alteration.Natural)

  // --- alteredScaleDegree: harmonic minor ---

  test("B in C HarmonicMinor is LeadingTone, Natural"):
    val result = Scale.HarmonicMinor.alteredScaleDegree(NoteType.C, NoteType.B)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.LeadingTone)
    assertEquals(asd.alteration, Alteration.Natural)
