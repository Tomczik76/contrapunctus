package io.github.tomczik76.contrapunctus

class NonChordToneSuite extends munit.FunSuite:
  import Note.*

  // C major triad for most tests
  val cMajor: Chord = Chord(NoteType.C, Triads.Major.Inversions.Root)
  val gMajor: Chord = Chord(NoteType.G, Triads.Major.Inversions.Root)

  test("chord tone returns None"):
    val result = NonChordToneAnalysis.classify(
      prev = Some((C(4), cMajor)),
      current = (E(4), cMajor),
      next = Some((G(4), cMajor))
    )
    assertEquals(result, None)

  test("passing tone — stepwise same direction"):
    // C -> D -> E over C major; D is not a chord tone, approached and left by step in same direction
    val result = NonChordToneAnalysis.classify(
      prev = Some((C(4), cMajor)),
      current = (D(4), cMajor),
      next = Some((E(4), cMajor))
    )
    assertEquals(result, Some(NonChordToneType.PassingTone))

  test("passing tone — descending"):
    // E -> D -> C over C major
    val result = NonChordToneAnalysis.classify(
      prev = Some((E(4), cMajor)),
      current = (D(4), cMajor),
      next = Some((C(4), cMajor))
    )
    assertEquals(result, Some(NonChordToneType.PassingTone))

  test("neighbor tone — step away and return"):
    // C -> D -> C over C major
    val result = NonChordToneAnalysis.classify(
      prev = Some((C(4), cMajor)),
      current = (D(4), cMajor),
      next = Some((C(4), cMajor))
    )
    assertEquals(result, Some(NonChordToneType.NeighborTone))

  test("appoggiatura — leap to, step away"):
    // G -> F -> E over C major; F is non-chord tone, leapt to from below (G3->F4 would be leap)
    // Use a clear leap: C4 -> F4 -> E4
    val result = NonChordToneAnalysis.classify(
      prev = Some((C(4), cMajor)),
      current = (F(4), cMajor),
      next = Some((E(4), cMajor))
    )
    assertEquals(result, Some(NonChordToneType.Appoggiatura))

  test("escape tone — step to, leap away"):
    // E -> F -> C over C major; F is non-chord tone, step from E, leap to C
    val result = NonChordToneAnalysis.classify(
      prev = Some((E(4), cMajor)),
      current = (F(4), cMajor),
      next = Some((C(5), cMajor))
    )
    assertEquals(result, Some(NonChordToneType.EscapeTone))

  test("suspension — held over, resolves down by step"):
    // E over C major becomes E over G major (non-chord tone), resolves to D
    // With bass G: E is a 6th above G, D is a 5th → 6-5 suspension
    val result = NonChordToneAnalysis.classify(
      prev = Some((E(4), cMajor)),
      current = (E(4), gMajor),
      next = Some((D(4), gMajor)),
      bass = Some(G(3))
    )
    assertEquals(result, Some(NonChordToneType.Suspension(6, 5)))

  test("suspension 4-3 — fourth resolves to third"):
    // F held over C major, resolves to E. Bass = C.
    val result = NonChordToneAnalysis.classify(
      prev = Some((F(4), Chord(NoteType.F, Triads.Major.Inversions.Root))),
      current = (F(4), cMajor),
      next = Some((E(4), cMajor)),
      bass = Some(C(4))
    )
    assertEquals(result, Some(NonChordToneType.Suspension(4, 3)))

  test("retardation — held over, resolves up by step"):
    // F# over G major is a chord tone, but let's use F over C major -> F over G major resolving to G
    val fMajor: Chord = Chord(NoteType.F, Triads.Major.Inversions.Root)
    val result = NonChordToneAnalysis.classify(
      prev = Some((F(4), fMajor)),
      current = (F(4), gMajor),
      next = Some((G(4), gMajor))
    )
    assertEquals(result, Some(NonChordToneType.Retardation))

  test("anticipation — arrives early at next chord tone"):
    // Over C major, G -> D -> D where D anticipates next chord (G major)
    val result = NonChordToneAnalysis.classify(
      prev = Some((E(4), cMajor)),
      current = (D(4), cMajor),
      next = Some((D(4), gMajor))
    )
    assertEquals(result, Some(NonChordToneType.Anticipation))

  test("pedal tone — same pitch held through chord changes"):
    // C held as pedal while chord changes to G major (C is not in G major triad... actually it is not)
    // Actually G major = G B D, so C is not a chord tone
    val result = NonChordToneAnalysis.classify(
      prev = Some((C(4), cMajor)),
      current = (C(4), gMajor),
      next = Some((C(4), cMajor))
    )
    assertEquals(result, Some(NonChordToneType.PedalTone))

  test("isChordTone on Chord — root"):
    assert(cMajor.isChordTone(NoteType.C))

  test("isChordTone on Chord — third"):
    assert(cMajor.isChordTone(NoteType.E))

  test("isChordTone on Chord — fifth"):
    assert(cMajor.isChordTone(NoteType.G))

  test("isChordTone on Chord — non-chord tone"):
    assert(!cMajor.isChordTone(NoteType.D))
    assert(!cMajor.isChordTone(NoteType.F))

  test("isChordTone on inverted chord"):
    val cMajorFirstInv = Chord(NoteType.C, Triads.Major.Inversions.First)
    assert(cMajorFirstInv.isChordTone(NoteType.C))
    assert(cMajorFirstInv.isChordTone(NoteType.E))
    assert(cMajorFirstInv.isChordTone(NoteType.G))
    assert(!cMajorFirstInv.isChordTone(NoteType.D))

  test("isChordTone on seventh chord"):
    val g7 = Chord(NoteType.G, Sevenths.DominantSeventh.Inversions.Root)
    assert(g7.isChordTone(NoteType.G))
    assert(g7.isChordTone(NoteType.B))
    assert(g7.isChordTone(NoteType.D))
    assert(g7.isChordTone(NoteType.F))
    assert(!g7.isChordTone(NoteType.C))
