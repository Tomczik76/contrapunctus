package io.github.tomczik76.contrapunctus

class AnalysisSuite extends munit.FunSuite:

  test("I — C major root position in C major"):
    val chord = Chord(NoteType.C, Triads.Major.Inversions.Root)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.C)
    val analyzed = AnalyzedChord(chord, asd)
    println(analyzed)
    assert(analyzed.romanNumerals.toList.contains("I"))

  test("ii — D minor root position in C major"):
    val chord = Chord(NoteType.D, Triads.Minor.Inversions.Root)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.D)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("ii"))

  test("vii° — B diminished root position in C major"):
    val chord = Chord(NoteType.B, Triads.Diminished.Inversions.Root)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.B)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("vii°"))

  test("V⁷ — G dominant seventh root position in C major"):
    val chord = Chord(NoteType.G, Sevenths.DominantSeventh.Inversions.Root)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.G)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("V⁷"))

  test("V⁶₅ — G dominant seventh first inversion in C major"):
    val chord = Chord(NoteType.G, Sevenths.DominantSeventh.Inversions.First)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.G)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("V⁶₅"))

  test("I⁶ — C major first inversion in C major"):
    val chord = Chord(NoteType.C, Triads.Major.Inversions.First)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.C)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("I⁶"))

  test("iv⁶₄ — F minor second inversion in C major"):
    val chord = Chord(NoteType.F, Triads.Minor.Inversions.Second)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.F)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("iv⁶₄"))

  test("III+ — Eb augmented root position in C minor"):
    val chord = Chord(NoteType.Eb, Triads.Augmented.Inversions.Root)
    val asd = Scale.NaturalMinor.alteredScaleDegree(NoteType.C, NoteType.Eb)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("III+"))

  test("viiø⁷ — B half-diminished seventh in C major"):
    val chord =
      Chord(NoteType.B, Sevenths.HalfDiminishedSeventh.Inversions.Root)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.B)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("viiø⁷"))

  test("IΔ⁷ — C major seventh root position in C major"):
    val chord = Chord(NoteType.C, Sevenths.MajorSeventh.Inversions.Root)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.C)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("IΔ⁷"))

  test("vii°⁷ — B diminished seventh in C major"):
    val chord =
      Chord(NoteType.B, Sevenths.DiminishedSeventh.Inversions.Root)
    val asd = Scale.Major.alteredScaleDegree(NoteType.C, NoteType.B)
    val analyzed = AnalyzedChord(chord, asd)
    assert(analyzed.romanNumerals.toList.contains("vii°⁷"))

  test("ii⁷ V⁷ IΔ⁷ progression in G major"):
    import Note.*
    val am7   = Pulse.Atom(A(3), C(4), E(4), G(4))
    val d7    = Pulse.Atom(D(4), `F#`(4), A(4), C(5))
    val gmaj7 = Pulse.Atom(G(3), B(3), D(4), `F#`(4))

    val results = Analysis(NoteType.G, Scale.Major, am7, d7, gmaj7)

    val analyses = results.toList.collect { case Pulse.Atom(nel) =>
      nel.head
    }

    def allNumerals(a: Analysis): Set[String] =
      a.chords.flatMap(_.romanNumerals.toList)

    assertEquals(analyses.size, 3)
    assert(allNumerals(analyses(0)).contains("ii⁷"))
    assert(allNumerals(analyses(1)).contains("V⁷"))
    assert(allNumerals(analyses(2)).contains("IΔ⁷"))

  test("ScaleDegree.romanNumeral is accessible"):
    assertEquals(ScaleDegree.Tonic.romanNumeral, "I")
    assertEquals(ScaleDegree.Dominant.romanNumeral, "V")
    assertEquals(ScaleDegree.LeadingTone.romanNumeral, "VII")
