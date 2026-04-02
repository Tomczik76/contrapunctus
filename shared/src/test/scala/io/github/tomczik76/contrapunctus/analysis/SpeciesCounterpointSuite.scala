package io.github.tomczik76.contrapunctus.analysis

import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}

class SpeciesCounterpointSuite extends munit.FunSuite:
  import Note.*

  private def hasError(
      errors: List[(Int, Note, NoteError)],
      err: NoteError
  ): Boolean = errors.exists(_._3 == err)

  // ── Consonant intervals accepted ──

  test("thirds are consonant"):
    // CF: C3, CP: E3 (M3 = 4 semitones)
    val cf = List(C(3), C(3))
    val cp = List(E(3), E(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.DissonantInterval))

  test("minor third is consonant"):
    val cf = List(C(3), C(3))
    val cp = List(Eb(3), Eb(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.DissonantInterval))

  test("perfect fifth is consonant"):
    val cf = List(C(3), C(3))
    val cp = List(G(3), G(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.DissonantInterval))

  test("minor sixth is consonant"):
    val cf = List(C(3), C(3))
    val cp = List(Ab(3), Ab(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.DissonantInterval))

  test("major sixth is consonant"):
    val cf = List(C(3), C(3))
    val cp = List(A(3), A(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.DissonantInterval))

  test("octave is consonant"):
    val cf = List(C(3), C(3))
    val cp = List(C(4), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.DissonantInterval))

  // ── Dissonant intervals flagged ──

  test("second is dissonant"):
    // CF: C3, CP: D3 (M2 = 2 semitones)
    val cf = List(C(3), D(3), E(3))
    val cp = List(D(3), E(3), F(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.DissonantInterval))

  test("perfect fourth is dissonant in two-voice counterpoint"):
    val cf = List(C(3), C(3))
    val cp = List(F(3), F(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.DissonantInterval))

  test("seventh is dissonant"):
    val cf = List(C(3), C(3))
    val cp = List(B(3), B(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.DissonantInterval))

  test("tritone is dissonant"):
    // CF: C3, CP: F#3 (tritone = 6 semitones, ic = 6)
    val cf = List(C(3), C(3))
    val cp = List(`F#`(3), `F#`(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.DissonantInterval))

  // ── Parallel 5ths/8ves ──

  test("parallel fifths detected"):
    // Beat 0: C3-G3 (P5), Beat 1: D3-A3 (P5)
    val cf = List(C(3), D(3))
    val cp = List(G(3), A(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.ParallelFifths))

  test("parallel octaves detected"):
    val cf = List(C(3), D(3))
    val cp = List(C(4), D(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.ParallelOctaves))

  // ── Voice crossing ──

  test("voice crossing detected when CP goes below CF"):
    // CF is lower voice, but CP note is below CF note
    val cf = List(E(4), E(4))
    val cp = List(C(4), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.VoiceCrossing))

  // ── First/last beat perfect consonance ──

  test("first beat must be perfect consonance"):
    // Start on M3 — not perfect consonance
    val cf = List(C(3), D(3), C(3))
    val cp = List(E(3), A(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.ImperfectConsonanceRequired))

  test("last beat must be perfect consonance"):
    val cf = List(C(3), D(3), C(3))
    val cp = List(C(4), A(3), E(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.ImperfectConsonanceRequired))

  test("perfect consonance at endpoints passes"):
    // P5 at start, P8 at end
    val cf = List(C(3), D(3), C(3))
    val cp = List(G(3), A(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.ImperfectConsonanceRequired))

  // ── Penultimate approach ──

  test("bad penultimate approach flagged — CF lower expects M6"):
    // CF lower: penultimate should be M6 (ic=9). Using P5 instead.
    val cf = List(C(3), D(3), C(3))
    val cp = List(C(4), A(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.BadPenultimate))

  test("correct penultimate approach — CF lower, M6 to P8"):
    // Penultimate: D3-B3 = M6 (ic=9), resolving to C3-C4 = P8
    val cf = List(C(3), D(3), C(3))
    val cp = List(C(4), B(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.BadPenultimate))

  // ── Repeated pitches allowed ──

  test("repeated pitch is allowed in first species"):
    val cf = List(C(3), D(3), E(3))
    val cp = List(G(3), G(3), G(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.RepeatedPitch))

  // ── Unison only at endpoints ──

  test("unison on interior beat flagged"):
    val cf = List(C(3), D(3), C(3))
    val cp = List(C(3), D(3), C(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.UnisonNotAtEndpoints))

  test("unison on first/last beat allowed"):
    val cf = List(C(3), D(3), C(3))
    val cp = List(C(3), A(3), C(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.UnisonNotAtEndpoints))

  // ── Forbidden melodic intervals ──

  test("tritone leap flagged"):
    // C4 to F#4 = 6 semitones (tritone)
    val cf = List(C(3), C(3))
    val cp = List(C(4), `F#`(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.ForbiddenMelodicInterval))

  test("leap greater than octave flagged"):
    // C4 to D5 = 14 semitones (> 12)
    val cf = List(C(3), C(3))
    val cp = List(C(4), D(5))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.ForbiddenMelodicInterval))

  test("octave leap allowed"):
    val cf = List(C(3), C(3))
    val cp = List(C(4), C(5))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.ForbiddenMelodicInterval))

  test("step motion allowed"):
    val cf = List(C(3), D(3))
    val cp = List(E(3), F(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.ForbiddenMelodicInterval))

  // ── CF must start and end on tonic ──

  test("CF not starting on tonic is flagged"):
    val cf = List(E(3), D(3), C(3)) // starts on E, not C
    val cp = List(C(4), B(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.CfNotOnTonic))

  test("CF not ending on tonic is flagged"):
    val cf = List(C(3), D(3), E(3)) // ends on E, not C
    val cp = List(C(4), B(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.CfNotOnTonic))

  test("CF starting and ending on tonic passes"):
    val cf = List(C(3), E(3), D(3), C(3))
    val cp = List(G(3), C(4), B(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.CfNotOnTonic))

  test("CF on tonic works with non-C key"):
    val cf = List(G(3), A(3), G(3)) // G major
    val cp = List(D(4), C(4), D(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.G, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.CfNotOnTonic))

  // ── CP last note must be unison/octave ──

  test("CP ending on fifth is flagged"):
    // CF ends on C3, CP ends on G3 (P5, not unison/octave)
    val cf = List(C(3), D(3), C(3))
    val cp = List(G(3), A(3), G(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(hasError(errors, NoteError.CpLastNotUnison))

  test("CP ending on octave passes"):
    val cf = List(C(3), E(3), D(3), C(3))
    val cp = List(G(3), C(4), B(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.CpLastNotUnison))

  test("CP ending on unison passes"):
    val cf = List(C(3), D(3), C(3))
    val cp = List(C(3), A(3), C(3))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(!hasError(errors, NoteError.CpLastNotUnison))

  // ── Valid counterpoint passes clean ──

  test("valid first species counterpoint produces no errors"):
    // C major, CF in bass: C3 D3 E3 D3 C3
    // CP in treble: C4 B3 A3 B3 C4
    // Intervals: P8, M6, P4(flagged)... let me pick better
    // CF: C3 D3 E3 D3 C3
    // CP: G3 A3 C4 B3 C4
    // Intervals: P5, P5(parallel!)... need to be more careful
    // A clean example:
    // CF: C3 E3 D3 C3
    // CP: C4 C4 B3 C4
    // Beat 0: C3-C4 = P8 (perfect, ok for first)
    // Beat 1: E3-C4 = m6 (ic=8, consonant)
    // Beat 2: D3-B3 = M6 (ic=9, consonant, correct penultimate for CF lower)
    // Beat 3: C3-C4 = P8 (perfect, ok for last)
    // No repeated pitches in CP: C4, C4 — oops, repeated
    // CP: G3, C4, B3, C4
    // Beat 0: C3-G3 = P5 (perfect)
    // Beat 1: E3-C4 = m6 (consonant)
    // Beat 2: D3-B3 = M6 (penultimate ok)
    // Beat 3: C3-C4 = P8 (perfect)
    // CP melodic: G3→C4 (P4=5), C4→B3 (m2=1), B3→C4 (m2=1) — all ok
    // Parallel check: P5→m6 (different), m6→M6 (different), M6→P8 (different) — ok
    val cf = List(C(3), E(3), D(3), C(3))
    val cp = List(G(3), C(4), B(3), C(4))
    val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
    assert(errors.isEmpty, s"Expected no errors but got: $errors")

end SpeciesCounterpointSuite
