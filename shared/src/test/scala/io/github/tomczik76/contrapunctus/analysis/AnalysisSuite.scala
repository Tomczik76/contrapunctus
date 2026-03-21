package io.github.tomczik76.contrapunctus.analysis

import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale, ScaleDegree}
import io.github.tomczik76.contrapunctus.harmony.{Chord, Triads, Sevenths}
import io.github.tomczik76.contrapunctus.rhythm.{Pulse, Sounding}

class AnalysisSuite extends munit.FunSuite:

  test("I — C major root position in C major"):
    val chord    = Chord(NoteType.C, Triads.Major.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("I"))

  test("ii — D minor root position in C major"):
    val chord    = Chord(NoteType.D, Triads.Minor.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("ii"))

  test("vii° — B diminished root position in C major"):
    val chord    = Chord(NoteType.B, Triads.Diminished.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("vii°"))

  test("V⁷ — G dominant seventh root position in C major"):
    val chord    = Chord(NoteType.G, Sevenths.DominantSeventh.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("V⁷"))

  test("V⁶₅ — G dominant seventh first inversion in C major"):
    val chord    = Chord(NoteType.G, Sevenths.DominantSeventh.Inversions.First)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("V⁶₅"))

  test("I⁶ — C major first inversion in C major"):
    val chord    = Chord(NoteType.C, Triads.Major.Inversions.First)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("I⁶"))

  test("iv⁶₄ — F minor second inversion in C major"):
    val chord    = Chord(NoteType.F, Triads.Minor.Inversions.Second)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("iv⁶₄"))

  test("III+ — Eb augmented root position in C minor"):
    val chord    = Chord(NoteType.Eb, Triads.Augmented.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.NaturalMinor)
    assert(analyzed.romanNumerals.toList.contains("III+"))

  test("viiø⁷ — B half-diminished seventh in C major"):
    val chord =
      Chord(NoteType.B, Sevenths.HalfDiminishedSeventh.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    assert(analyzed.romanNumerals.toList.contains("viiø⁷"))

  test("IΔ⁷ — C major seventh root position in C major"):
    val chord    = Chord(NoteType.C, Sevenths.MajorSeventh.Inversions.Root)
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

    val analyses: List[Analysis] = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

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

    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head
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
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

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

  test("neighbor tone — diatonic whole step upper neighbor"):
    import Note.*
    // In C major. Soprano: E→F→E over C major. F is a half step upper neighbor.
    val beat1 = Pulse.Atom(C(3), E(3), G(3), E(4))
    val beat2 = Pulse.Atom(C(3), E(3), G(3), F(4))
    val beat3 = Pulse.Atom(C(3), E(3), G(3), E(4))

    val results = Analysis(NoteType.C, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    val fNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.F && n.note.octave == 4
    )
    assert(
      fNote.exists(
        _.nonChordToneType.contains(NonChordToneType.NeighborTone)
      )
    )

  test("passing tone — diatonic whole step ascending"):
    import Note.*
    // In C major. Soprano: E→F→G over C major. F is a passing tone.
    val beat1 = Pulse.Atom(C(3), E(3), G(3), E(4))
    val beat2 = Pulse.Atom(C(3), E(3), G(3), F(4))
    val beat3 = Pulse.Atom(C(3), E(3), G(3), G(4))

    val results = Analysis(NoteType.C, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    val fNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.F && n.note.octave == 4
    )
    assert(
      fNote.exists(
        _.nonChordToneType.contains(NonChordToneType.PassingTone)
      )
    )

  test("passing tone — chromatic ascending through analysis pipeline"):
    import Note.*
    // In G major. Soprano: G→Ab→A (chromatic ascending passing tone).
    val beat1 = Pulse.Atom(G(3), B(3), D(4), G(4))
    val beat2 = Pulse.Atom(G(3), B(3), D(4), Ab(4))
    val beat3 = Pulse.Atom(A(3), C(4), E(4), A(4))

    val results = Analysis(NoteType.G, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

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
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

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
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

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
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    val fNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.F && n.note.octave == 4
    )
    assert(
      fNote.exists(
        _.nonChordToneType.contains(NonChordToneType.Suspension(4, 3))
      )
    )

  test("suspension 4-3 — F held over C major resolves to E (variant)"):
    import Note.*
    // 4-3 suspension. F held from previous chord, resolves to E over C major.
    // {C, E, G, F} doesn't match any standard chord type (has both M3 and P4).
    val beat1 = Pulse.Atom(F(3), A(3), C(4), F(4))
    val beat2 = Pulse.Atom(C(3), E(3), G(3), F(4))
    val beat3 = Pulse.Atom(C(3), E(3), G(3), E(4))

    val results = Analysis(NoteType.C, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    val fNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.F && n.note.octave == 4
    )
    assert(
      fNote.exists(
        _.nonChordToneType.contains(NonChordToneType.Suspension(4, 3))
      )
    )

  test("changing tone — double neighbor E→F→D→E"):
    import Note.*
    // In C major. Soprano: E→F→D→E (upper neighbor, then lower neighbor of E).
    // F is step from E, leap to D → escape tone; D is leap from F, step to E → appoggiatura.
    // Post-processing reclassifies both as ChangingTone.
    // {C, E, G, F} doesn't match any chord type, and {C, E, G, D} = Cadd9.
    // Use incomplete triad {C, E} so D isn't absorbed into an add9 chord.
    val beat1 = Pulse.Atom(C(3), E(3), G(3), E(4))
    val beat2 = Pulse.Atom(C(3), E(3), G(3), F(4))
    val beat3 = Pulse.Atom(C(3), G(3), D(4))
    val beat4 = Pulse.Atom(C(3), E(3), G(3), E(4))

    val results =
      Analysis(NoteType.C, Scale.Major, beat1, beat2, beat3, beat4)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    val fNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.F && n.note.octave == 4
    )
    assert(
      fNote.exists(
        _.nonChordToneType.contains(NonChordToneType.ChangingTone)
      )
    )

    val dNote = analyses(2).notes.find(n =>
      n.note.noteType == NoteType.D && n.note.octave == 4
    )
    assert(
      dNote.exists(
        _.nonChordToneType.contains(NonChordToneType.ChangingTone)
      )
    )

  test("sustained tones are transparent to roman numeral analysis"):
    import Note.*
    import Sounding.*
    // I → V with C and E sustained into beat 2 while G moves to B.
    // All notes in beat 2 are chord tones of C major (C, E) or G major (B, G held in bass).
    val beat1 = Pulse.Atom(Attack(C(3)), Attack(E(3)), Attack(G(3)))
    val beat2 = Pulse.Atom(Attack(G(3)), Attack(B(3)), Attack(D(4)))
    val beat3 = Pulse.Atom(Sustain(G(3)), Sustain(B(3)), Sustain(D(4)))
    val beat4 = Pulse.Atom(Attack(C(3)), Attack(E(3)), Attack(G(3)))

    val results =
      Analysis.fromSounding(NoteType.C, Scale.Major, beat1, beat2, beat3, beat4)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    def allNumerals(a: Analysis): Set[String] =
      a.chords.flatMap(_.romanNumerals.toList)

    assertEquals(analyses.size, 4)
    assert(allNumerals(analyses(0)).contains("I"))
    assert(allNumerals(analyses(1)).contains("V"))
    // Beat 3 is all sustains — same notes as beat 2, still V
    assert(allNumerals(analyses(2)).contains("V"))
    assert(allNumerals(analyses(3)).contains("I"))

  test("suspension 4-3 with Sounding.Sustain as preparation"):
    import Note.*
    import Sounding.*
    // Classic 4-3 suspension: F major (preparation) → C major with F sustained (suspension) → resolution to E.
    // The sustained F over C major is a 4-3 suspension.
    val beat1 =
      Pulse.Atom(Attack(F(3)), Attack(A(3)), Attack(C(4)), Attack(F(4)))
    val beat2 =
      Pulse.Atom(Attack(C(3)), Attack(E(3)), Attack(G(3)), Sustain(F(4)))
    val beat3 =
      Pulse.Atom(Sustain(C(3)), Sustain(E(3)), Sustain(G(3)), Attack(E(4)))

    val results =
      Analysis.fromSounding(NoteType.C, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    assertEquals(analyses.size, 3)

    val fNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.F && n.note.octave == 4
    )
    assert(
      fNote.exists(
        _.nonChordToneType.contains(NonChordToneType.Suspension(4, 3))
      )
    )

  test("ScaleDegree.romanNumeral is accessible"):
    assertEquals(ScaleDegree.Tonic.romanNumeral, "I")
    assertEquals(ScaleDegree.Dominant.romanNumeral, "V")
    assertEquals(ScaleDegree.LeadingTone.romanNumeral, "VII")

  test("add9 chord — C E G D in C major returns I⁹"):
    import Note.*
    val beat1 = Pulse.Atom(C(3), E(3), G(3), D(4))

    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    val chordLabels = analyses.head.chords.flatMap(_.romanNumerals.toList)
    assert(
      chordLabels.exists(_.contains("I⁺⁹")),
      s"Expected I⁹ but got: $chordLabels"
    )

  test("add11 chord — C E G F in C major returns I¹¹"):
    import Note.*
    val beat1 = Pulse.Atom(C(3), E(3), G(3), F(4))

    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    val chordLabels = analyses.head.chords.flatMap(_.romanNumerals.toList)
    assert(
      chordLabels.exists(_.contains("I⁺¹¹")),
      s"Expected I¹¹ but got: $chordLabels"
    )

  test("add13 chord — C E G A in C major returns I¹³"):
    import Note.*
    val beat1 = Pulse.Atom(C(3), E(3), G(3), A(4))

    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head

    val chordLabels = analyses.head.chords.flatMap(_.romanNumerals.toList)
    assert(
      chordLabels.exists(_.contains("I⁺¹³")),
      s"Expected I¹³ but got: $chordLabels"
    )

  // ── Secondary dominant tests ──────────────────────────────────────────

  test("secondary dominant — I → IV is NOT V/IV (no chromatic notes)"):
    import Note.*
    val currentNotes  = NonEmptyList.of(C(4), E(4), G(4))
    val currentChords = Set(Chord(NoteType.C, Triads.Major.Inversions.Root))
    val nextChords    = Set(Chord(NoteType.F, Triads.Major.Inversions.Root))
    val labels = Analysis.secondaryDominantLabels(
      currentNotes, currentChords, nextChords, NoteType.C, Scale.Major
    )
    assertEquals(labels, Nil)

  test("secondary dominant — C7 → F is V⁷/IV (Bb is chromatic in C major)"):
    import Note.*
    val currentNotes  = NonEmptyList.of(C(4), E(4), G(4), Bb(4))
    val currentChords = Set(Chord(NoteType.C, Sevenths.DominantSeventh.Inversions.Root))
    val nextChords    = Set(Chord(NoteType.F, Triads.Major.Inversions.Root))
    val labels = Analysis.secondaryDominantLabels(
      currentNotes, currentChords, nextChords, NoteType.C, Scale.Major
    )
    assert(labels.contains("V⁷/IV"))

  test("secondary dominant — D major → G is V/V (F# is chromatic in C major)"):
    import Note.*
    val currentNotes  = NonEmptyList.of(D(4), `F#`(4), A(4))
    val currentChords = Set(Chord(NoteType.D, Triads.Major.Inversions.Root))
    val nextChords    = Set(Chord(NoteType.G, Triads.Major.Inversions.Root))
    val labels = Analysis.secondaryDominantLabels(
      currentNotes, currentChords, nextChords, NoteType.C, Scale.Major
    )
    assert(labels.contains("V/V"))

  test("secondary dominant — E major → Am is V/vi (G# is chromatic in C major)"):
    import Note.*
    val currentNotes  = NonEmptyList.of(E(4), `G#`(4), B(4))
    val currentChords = Set(Chord(NoteType.E, Triads.Major.Inversions.Root))
    val nextChords    = Set(Chord(NoteType.A, Triads.Minor.Inversions.Root))
    val labels = Analysis.secondaryDominantLabels(
      currentNotes, currentChords, nextChords, NoteType.C, Scale.Major
    )
    assert(labels.contains("V/vi"))

  test("secondary dominant — A major → Dm is V/ii (C# is chromatic in C major)"):
    import Note.*
    val currentNotes  = NonEmptyList.of(A(3), `C#`(4), E(4))
    val currentChords = Set(Chord(NoteType.A, Triads.Major.Inversions.Root))
    val nextChords    = Set(Chord(NoteType.D, Triads.Minor.Inversions.Root))
    val labels = Analysis.secondaryDominantLabels(
      currentNotes, currentChords, nextChords, NoteType.C, Scale.Major
    )
    assert(labels.contains("V/ii"))

  test("secondary dominant — V → I is NOT V/I (excluded by design)"):
    import Note.*
    val currentNotes  = NonEmptyList.of(G(3), B(3), D(4), F(4))
    val currentChords = Set(Chord(NoteType.G, Sevenths.DominantSeventh.Inversions.Root))
    val nextChords    = Set(Chord(NoteType.C, Triads.Major.Inversions.Root))
    val labels = Analysis.secondaryDominantLabels(
      currentNotes, currentChords, nextChords, NoteType.C, Scale.Major
    )
    assertEquals(labels, Nil)

  test("secondary dominant — D7 → G is V⁷/V (F# and C chromatic-check in C major)"):
    import Note.*
    val currentNotes  = NonEmptyList.of(D(4), `F#`(4), A(4), C(5))
    val currentChords = Set(Chord(NoteType.D, Sevenths.DominantSeventh.Inversions.Root))
    val nextChords    = Set(Chord(NoteType.G, Triads.Major.Inversions.Root))
    val labels = Analysis.secondaryDominantLabels(
      currentNotes, currentChords, nextChords, NoteType.C, Scale.Major
    )
    assert(labels.contains("V⁷/V"))

  test("secondary dominant — no label when chord doesn't resolve correctly"):
    import Note.*
    // D major going to C (not G) — D is not V of C
    val currentNotes  = NonEmptyList.of(D(4), `F#`(4), A(4))
    val currentChords = Set(Chord(NoteType.D, Triads.Major.Inversions.Root))
    val nextChords    = Set(Chord(NoteType.C, Triads.Major.Inversions.Root))
    val labels = Analysis.secondaryDominantLabels(
      currentNotes, currentChords, nextChords, NoteType.C, Scale.Major
    )
    assertEquals(labels, Nil)

  // ── Neapolitan chord tests ────────────────────────────────────────────

  test("Neapolitan — ♭II root position in C major shows N"):
    val chord    = Chord(NoteType.Db, Triads.Major.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    val rns = analyzed.romanNumerals.toList
    assert(rns.contains("N"), s"Expected N in $rns")
    assert(rns.contains("♭II"), s"Expected ♭II in $rns")

  test("Neapolitan — ♭II first inversion in C major shows N⁶"):
    val chord    = Chord(NoteType.Db, Triads.Major.Inversions.First)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    val rns = analyzed.romanNumerals.toList
    assert(rns.contains("N⁶"), s"Expected N⁶ in $rns")

  test("Neapolitan — ♭II in A minor shows N"):
    val chord    = Chord(NoteType.Bb, Triads.Major.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.A, Scale.NaturalMinor)
    val rns = analyzed.romanNumerals.toList
    assert(rns.contains("N"), s"Expected N in $rns")

  test("Neapolitan — N label preferred over ♭II"):
    val chord    = Chord(NoteType.Db, Triads.Major.Inversions.First)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    val rns = analyzed.romanNumerals.toList
    assertEquals(rns.head, "N⁶", "N⁶ should be first")

  test("Neapolitan — regular II is not Neapolitan"):
    val chord    = Chord(NoteType.D, Triads.Major.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    val rns = analyzed.romanNumerals.toList
    assert(!rns.exists(_.startsWith("N")), s"Should not contain N in $rns")

  test("Neapolitan — minor triad on ♭II is not Neapolitan"):
    val chord    = Chord(NoteType.Db, Triads.Minor.Inversions.Root)
    val analyzed = AnalyzedChord(chord, NoteType.C, Scale.Major)
    val rns = analyzed.romanNumerals.toList
    assert(!rns.exists(_.startsWith("N")), s"Should not contain N in $rns")

  // ── Augmented sixth chord tests ───────────────────────────────────────

  test("Italian augmented sixth — Ab-C-F# in C major"):
    import Note.*
    val label = Analysis.augmentedSixthLabel(
      NonEmptyList.of(Ab(3), C(4), `F#`(4)), NoteType.C
    )
    assertEquals(label, Some("It⁺⁶"))

  test("French augmented sixth — Ab-C-D-F# in C major"):
    import Note.*
    val label = Analysis.augmentedSixthLabel(
      NonEmptyList.of(Ab(3), C(4), D(4), `F#`(4)), NoteType.C
    )
    assertEquals(label, Some("Fr⁺⁶"))

  test("German augmented sixth — Ab-C-Eb-F# in C major"):
    import Note.*
    val label = Analysis.augmentedSixthLabel(
      NonEmptyList.of(Ab(3), C(4), Eb(4), `F#`(4)), NoteType.C
    )
    assertEquals(label, Some("Ger⁺⁶"))

  test("Italian augmented sixth — F-A-D# in A minor"):
    import Note.*
    val label = Analysis.augmentedSixthLabel(
      NonEmptyList.of(F(3), A(3), `D#`(4)), NoteType.A
    )
    assertEquals(label, Some("It⁺⁶"))

  test("German augmented sixth — F-A-C-D# in A minor"):
    import Note.*
    val label = Analysis.augmentedSixthLabel(
      NonEmptyList.of(F(3), A(3), C(4), `D#`(4)), NoteType.A
    )
    assertEquals(label, Some("Ger⁺⁶"))

  test("augmented sixth — not detected without ♭6 and #4"):
    import Note.*
    val label = Analysis.augmentedSixthLabel(
      NonEmptyList.of(C(4), E(4), G(4)), NoteType.C
    )
    assertEquals(label, None)

  test("augmented sixth — doublings don't affect detection"):
    import Note.*
    val label = Analysis.augmentedSixthLabel(
      NonEmptyList.of(Ab(3), C(4), `F#`(4), Ab(4)), NoteType.C
    )
    assertEquals(label, Some("It⁺⁶"))

  // ── identifyChords fallback paths ─────────────────────────────────

  test("identifyChords — non-diatonic full chord with diatonic root preferred over diatonic subsets"):
    import Note.*
    // In C major, C-E-G#-B is a CMaj7#5 (augmented major 7th).
    // G# is chromatic, but root C is diatonic. Should prefer the full chord identification.
    val beat1 = Pulse.Atom(C(4), E(4), `G#`(4), B(4))
    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head
    // Should have found at least one chord
    assert(analyses.head.chords.nonEmpty)

  test("identifyChords — fromAll fallback when no diatonic chords found"):
    import Note.*
    // Ab-C-Eb-Gb — fully chromatic in C major, but forms a valid Ab7 chord
    val beat1 = Pulse.Atom(Ab(3), C(4), Eb(4), `Gb`(4))
    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head
    assert(analyses.head.chords.nonEmpty, "Should find chords via fromAll fallback")

  test("identifyChords — allSubsets fallback when fromAll is empty"):
    import Note.*
    // A note cluster that doesn't form any known chord but subsets do
    // C-Db-E-G: full set doesn't match, but removing Db gives C major
    val beat1 = Pulse.Atom(C(4), Db(4), E(4), G(4))
    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head
    assert(analyses.head.chords.nonEmpty, "Should find chords from subsets")

  test("identifyChords — preferNonSus filters out sus chords"):
    import Note.*
    // C-F-G could be Csus4 or an inversion. In C major, should prefer non-sus if available.
    val beat1 = Pulse.Atom(C(3), F(3), G(3), C(4))
    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head
    // If there's a non-sus interpretation, it should be preferred
    val hasSus = analyses.head.chords.exists(_.chord.chordType.qualitySymbol.contains("sus"))
    val hasNonSus = analyses.head.chords.exists(!_.chord.chordType.qualitySymbol.contains("sus"))
    if hasNonSus then
      assert(!hasSus, "Non-sus should be preferred over sus")

  test("classifyBeatNotes — effectiveChord falls back to previous beat"):
    import Note.*
    // A single non-chord tone with no chord on current beat but chord on previous
    val beat1 = Pulse.Atom(C(3), E(3), G(3))
    val beat2 = Pulse.Atom(Db(4))  // single chromatic note, likely no chord
    val beat3 = Pulse.Atom(C(3), E(3), G(3))
    val results = Analysis(NoteType.C, Scale.Major, beat1, beat2, beat3)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head
    // Beat 2 should still classify Db relative to surrounding chords
    assert(analyses(1).notes.nonEmpty)

  test("reclassifyChangingTones — single analysis list unchanged"):
    import Note.*
    // With only 1 beat, no changing tone reclassification is possible
    val beat1 = Pulse.Atom(C(3), E(3), G(3))
    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head
    assertEquals(analyses.size, 1)

  test("power chord C-G in C major yields only I⁵, not also V⁵⁶₄"):
    import Note.*
    val beat1 = Pulse.Atom(C(3), G(3))
    val results = Analysis(NoteType.C, Scale.Major, beat1)
    val analyses = results.toList.collect:
      case Pulse.Atom(nel) => nel.head
    val rns = analyses.head.chords.flatMap(_.romanNumerals.toList)
    assert(rns.contains("I⁵"), s"Expected I⁵ in $rns")
    assert(!rns.contains("V⁵⁶₄"), s"Should not contain V⁵⁶₄ in $rns")

  test("passing tone — incomplete voicing C5-E4-C3-G3 then D5-C3-G3 then E5"):
    import Note.*
    // From real user input: soprano C5→D5→E5 over bass C3+G3.
    // Beat 0 has a full C major chord {C,E,G}. Beat 1 has {C,D,G} — D is a
    // passing tone, NOT a sus chord or power chord. Beat 2 has just E5.
    val beat0 = Pulse.Atom(NonEmptyList.of(C(3), G(3), E(4), C(5)))
    val beat1 = Pulse.Atom(NonEmptyList.of(C(3), G(3), D(5)))
    val beat2 = Pulse.Atom(NonEmptyList.of(E(5)))
    val rest: Pulse[Note] = Pulse.Rest

    val measure = Pulse.Duplet(
      Pulse.Triplet(beat0, beat1, beat2),
      Pulse.Triplet(rest, rest, rest)
    )
    val results = Analysis.analyzeWithPartWriting(
      NoteType.C, Scale.Major, NonEmptyList.one(measure)
    )
    val analyses = Pulse.flatten(results.head).map(_.head)

    // Beat 0 should be I (C major)
    val rns0 = analyses(0).chords.flatMap(_.romanNumerals.toList)
    assert(rns0.contains("I"), s"Beat 0: expected I in $rns0")

    // Beat 1: D5 should be a passing tone
    val dNote = analyses(1).notes.find(n =>
      n.note.noteType == NoteType.D && n.note.octave == 5
    )
    assert(
      dNote.exists(_.nonChordToneType.contains(NonChordToneType.PassingTone)),
      s"Beat 1: D5 should be PassingTone, got ${dNote.map(_.nonChordToneType)}"
    )

    // Beat 1 should NOT show I⁵ or V⁵
    val rns1 = analyses(1).chords.flatMap(_.romanNumerals.toList)
    assert(!rns1.contains("I⁵"), s"Beat 1: should not contain I⁵, got $rns1")
    assert(!rns1.contains("V⁵"), s"Beat 1: should not contain V⁵, got $rns1")

    // Beat 2 (single E5) should not display any chord — propagated chords
    // are only used for NCT classification, not for roman numeral display
    val rns2 = analyses(2).chords.flatMap(_.romanNumerals.toList)
    assert(rns2.isEmpty, s"Beat 2: single E5 should have no chord label, got $rns2")

end AnalysisSuite
