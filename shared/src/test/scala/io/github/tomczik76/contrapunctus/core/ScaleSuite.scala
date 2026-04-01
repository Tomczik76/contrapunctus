package io.github.tomczik76.contrapunctus.core

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

  // --- alteredScaleDegree: spelling-aware disambiguation ---

  test("C# in C Major is ♯I (letter C → Tonic)"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.`C#`)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Tonic)
    assertEquals(asd.alteration, Alteration.Sharp)
    assertEquals(result.toNonEmptyList.size, 1)

  test("Db in C Major is ♭II (letter D → Supertonic)"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.Db)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Supertonic)
    assertEquals(asd.alteration, Alteration.Flat)
    assertEquals(result.toNonEmptyList.size, 1)

  test("F# in C Major is ♯IV (letter F → Subdominant)"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.`F#`)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Subdominant)
    assertEquals(asd.alteration, Alteration.Sharp)
    assertEquals(result.toNonEmptyList.size, 1)

  test("Gb in C Major is ♭V (letter G → Dominant)"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.`Gb`)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Dominant)
    assertEquals(asd.alteration, Alteration.Flat)
    assertEquals(result.toNonEmptyList.size, 1)

  test("Ab in C Major is ♭VI (letter A → Submediant)"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.Ab)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Submediant)
    assertEquals(asd.alteration, Alteration.Flat)
    assertEquals(result.toNonEmptyList.size, 1)

  test("G# in C Major is ♯V (letter G → Dominant)"):
    val result = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.`G#`)
    val asd = result.toNonEmptyList.head
    assertEquals(asd.degree, ScaleDegree.Dominant)
    assertEquals(asd.alteration, Alteration.Sharp)
    assertEquals(result.toNonEmptyList.size, 1)

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
