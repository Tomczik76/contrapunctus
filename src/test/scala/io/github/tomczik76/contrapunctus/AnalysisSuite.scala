package io.github.tomczik76.contrapunctus

class AnalysisSuite extends munit.FunSuite:

  test("I — C major root position in C major"):
    val chord = Chord(NoteType.C, Triads.Major.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("I"))

  test("ii — D minor root position in C major"):
    val chord = Chord(NoteType.D, Triads.Minor.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("ii"))

  test("vii° — B diminished root position in C major"):
    val chord = Chord(NoteType.B, Triads.Diminished.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("vii°"))

  test("V⁷ — G dominant seventh root position in C major"):
    val chord = Chord(NoteType.G, Sevenths.DominantSeventh.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("V⁷"))

  test("V⁶₅ — G dominant seventh first inversion in C major"):
    val chord = Chord(NoteType.G, Sevenths.DominantSeventh.Inversions.First)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("V⁶₅"))

  test("I⁶ — C major first inversion in C major"):
    val chord = Chord(NoteType.C, Triads.Major.Inversions.First)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("I⁶"))

  test("iv⁶₄ — F minor second inversion in C major"):
    val chord = Chord(NoteType.F, Triads.Minor.Inversions.Second)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("iv⁶₄"))

  test("III+ — Eb augmented root position in C minor"):
    val chord = Chord(NoteType.Eb, Triads.Augmented.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.NaturalMinor)
    assert(analyzed.romanNumerals.toList.contains("III+"))

  test("viiø⁷ — B half-diminished seventh in C major"):
    val chord =
      Chord(NoteType.B, Sevenths.HalfDiminishedSeventh.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("viiø⁷"))

  test("IΔ⁷ — C major seventh root position in C major"):
    val chord = Chord(NoteType.C, Sevenths.MajorSeventh.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("IΔ⁷"))

  test("vii°⁷ — B diminished seventh in C major"):
    val chord =
      Chord(NoteType.B, Sevenths.DiminishedSeventh.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
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

  test("ii⁷ V⁷ IΔ⁷ progression — all notes are chord tones"):
    import Note.*
    val am7   = Pulse.Atom(A(3), C(4), E(4), G(4))
    val d7    = Pulse.Atom(D(4), `F#`(4), A(4), C(5))
    val gmaj7 = Pulse.Atom(G(3), B(3), D(4), `F#`(4))

    val results = Analysis(NoteType.G, Scale.Major, am7, d7, gmaj7)
    val analyses = results.toList.collect { case Pulse.Atom(nel) =>
      nel.head
    }
    assert(analyses.forall(_.notes.forall(_.isChordTone)))

  test("neighbor tone excluded from chord identification"):
    import Note.*
    // G major with doubled root. Top voice does G→Ab→G (upper neighbor).
    // Beat 2: Ab replaces G in the top voice — a true neighbor tone departure.
    // {P1, m2, M3, P5} doesn't match any chord; removing Ab gives G major.
    val beat1 = Pulse.Atom(G(3), B(3), D(4), G(4))
    val beat2 = Pulse.Atom(G(3), B(3), D(4), Ab(4))
    val beat3 = Pulse.Atom(G(3), B(3), D(4), G(4))

    val results = Analysis(NoteType.G, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect { case Pulse.Atom(nel) =>
      nel.head
    }

    val beat2Analysis = analyses(1)
    // Ab should be classified as a neighbor tone
    val abNote = beat2Analysis.notes.find(n =>
      n.note.noteType == NoteType.Ab && n.note.octave == 4
    )
    assert(
      abNote.exists(
        _.nonChordToneType.contains(NonChordToneType.NeighborTone)
      )
    )
    // G, B, D should be chord tones
    assert(
      beat2Analysis.notes
        .filter(_.note.noteType != NoteType.Ab)
        .forall(_.isChordTone)
    )

  test("passing tone — chromatic ascending through analysis pipeline"):
    import Note.*
    // In G major. Soprano: G→Ab→A (chromatic ascending passing tone).
    val beat1 = Pulse.Atom(G(3), B(3), D(4), G(4))
    val beat2 = Pulse.Atom(G(3), B(3), D(4), Ab(4))
    val beat3 = Pulse.Atom(A(3), C(4), E(4), A(4))

    val results = Analysis(NoteType.G, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect { case Pulse.Atom(nel) =>
      nel.head
    }

    val abNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.Ab && n.note.octave == 4
    )
    assert(
      abNote.exists(
        _.nonChordToneType.contains(NonChordToneType.PassingTone)
      )
    )

  test("appoggiatura — leap to Db, step to C"):
    import Note.*
    // In G major. Soprano leaps G4→Db5 then steps Db5→C5.
    val beat1 = Pulse.Atom(G(3), B(3), D(4), G(4))
    val beat2 = Pulse.Atom(G(3), B(3), D(4), Db(5))
    val beat3 = Pulse.Atom(C(3), E(3), G(3), C(5))

    val results = Analysis(NoteType.C, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect { case Pulse.Atom(nel) =>
      nel.head
    }

    val dbNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.Db && n.note.octave == 5
    )
    assert(
      dbNote.exists(
        _.nonChordToneType.contains(NonChordToneType.Appoggiatura)
      )
    )

  test("escape tone — step to Eb, leap to B"):
    import Note.*
    // In G major. Soprano steps D5→Eb5 then leaps Eb5→B4.
    val beat1 = Pulse.Atom(G(3), B(3), D(4), D(5))
    val beat2 = Pulse.Atom(G(3), B(3), D(4), Eb(5))
    val beat3 = Pulse.Atom(G(3), B(3), D(4), B(4))

    val results = Analysis(NoteType.G, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect { case Pulse.Atom(nel) =>
      nel.head
    }

    val ebNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.Eb && n.note.octave == 5
    )
    assert(
      ebNote.exists(
        _.nonChordToneType.contains(NonChordToneType.EscapeTone)
      )
    )

  test("suspension 4-3 — F held over C major resolves to E"):
    import Note.*
    // Classic 4-3 suspension. Soprano holds F from F major, resolves to E over C major.
    val beat1 = Pulse.Atom(F(3), A(3), C(4), F(4))
    val beat2 = Pulse.Atom(C(3), E(3), G(3), F(4))
    val beat3 = Pulse.Atom(C(3), E(3), G(3), E(4))

    val results = Analysis(NoteType.C, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect { case Pulse.Atom(nel) =>
      nel.head
    }

    val fNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.F && n.note.octave == 4
    )
    assert(
      fNote.exists(
        _.nonChordToneType.contains(NonChordToneType.Suspension(4, 3))
      )
    )

  test("suspension 2-1 — D held over C major resolves to C"):
    import Note.*
    // 9-8 suspension (simple interval: 2-1). D held from G major, resolves to C.
    val beat1 = Pulse.Atom(G(3), B(3), D(4))
    val beat2 = Pulse.Atom(C(3), E(3), G(3), D(4))
    val beat3 = Pulse.Atom(C(3), E(3), G(3), C(4))

    val results = Analysis(NoteType.C, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect { case Pulse.Atom(nel) =>
      nel.head
    }

    val dNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.D && n.note.octave == 4
    )
    assert(
      dNote.exists(
        _.nonChordToneType.contains(NonChordToneType.Suspension(2, 1))
      )
    )

  test("ScaleDegree.romanNumeral is accessible"):
    assertEquals(ScaleDegree.Tonic.romanNumeral, "I")
    assertEquals(ScaleDegree.Dominant.romanNumeral, "V")
    assertEquals(ScaleDegree.LeadingTone.romanNumeral, "VII")
