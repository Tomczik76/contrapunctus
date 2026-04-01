package io.github.tomczik76.contrapunctus.analysis

import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
import io.github.tomczik76.contrapunctus.rhythm.Pulse

class PartWritingSuite extends munit.FunSuite:
  import Note.*

  private def voice(notes: Note*): NonEmptyList[Pulse[Note]] =
    NonEmptyList.fromListUnsafe(
      notes.toList.map(n => Pulse.Atom(n): Pulse[Note])
    )

  /** Extract flat list of Analysis from the result. */
  private def flatAnalyses(
      result: NonEmptyList[Pulse[Analysis]]
  ): List[Analysis] =
    result.toList.flatMap(Pulse.flatten).map(_.head)

  /** Check if any note in any analysis has the given NoteError. */
  private def hasNoteError(
      analyses: List[Analysis],
      err: NoteError
  ): Boolean =
    analyses.exists(_.notes.exists(_.errors.contains(err)))

  /** Check if any analysis has the given ChordError. */
  private def hasChordError(
      analyses: List[Analysis],
      err: ChordError
  ): Boolean =
    analyses.exists(_.errors.contains(err))

  test("parallel fifths detected"):
    // Soprano: C4→D4, Bass: F3→G3. Both form P5, both step up.
    val soprano = voice(C(4), D(4))
    val bass    = voice(F(3), G(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.ParallelFifths))

  test("parallel octaves detected"):
    // Soprano: C4→D4, Bass: C3→D3. Both at octave, both step up.
    val soprano = voice(C(4), D(4))
    val bass    = voice(C(3), D(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.ParallelOctaves))

  test("contrary motion to P5 is not parallel fifths"):
    // Soprano: D4→G4 (up), Bass: A3→C3 (down). Arrive at P5 but contrary motion.
    val soprano = voice(D(4), G(4))
    val bass    = voice(A(3), C(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.ParallelFifths))

  test("direct fifths detected — soprano leaps to P5 with bass"):
    // Soprano: C4→A4 (leap up), Bass: C3→D3 (step up). Arrive at P5.
    val soprano = voice(C(4), A(4))
    val bass    = voice(C(3), D(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.DirectFifths))

  test("direct octaves detected — soprano leaps to octave with bass"):
    // Soprano: E4→D5 (leap up), Bass: G2→D3 (leap up). Arrive at P8.
    val soprano = voice(E(4), D(5))
    val bass    = voice(G(2), D(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.DirectOctaves))

  test("no direct fifths when soprano steps"):
    // Soprano: F4→G4 (step up), Bass: B2→C3 (step up).
    // Arrive at P5 by similar motion, but soprano doesn't leap.
    val soprano = voice(F(4), G(4))
    val bass    = voice(B(2), C(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.DirectFifths))

  test("voice crossing detected"):
    // Soprano below bass.
    val soprano = voice(C(3))
    val bass    = voice(G(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.VoiceCrossing))

  test("spacing error — upper voices more than octave apart"):
    // Soprano-Alto gap = 13 semitones > 12.
    val soprano = voice(C(5))
    val alto    = voice(B(3))
    val bass    = voice(G(2))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, alto, bass))
    val analyses = flatAnalyses(result)
    assert(analyses.exists(_.notes.exists(_.errors.exists:
      case NoteError.SpacingError(_) => true
      case _                         => false
    )))

  test("tenor-bass spacing up to two octaves is allowed"):
    val soprano = voice(G(4))
    val tenor   = voice(C(4))
    val bass    = voice(E(2))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, tenor, bass))
    val analyses = flatAnalyses(result)
    assert(!analyses.exists(_.notes.exists(_.errors.exists:
      case NoteError.SpacingError(_) => true
      case _                         => false
    )))

  test("doubled leading tone detected"):
    // B is leading tone in C major. Two voices on B.
    val soprano = voice(B(4))
    val alto    = voice(B(3))
    val tenor   = voice(G(3))
    val bass    = voice(G(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.DoubledLeadingTone))

  test("doubled subtonic in natural minor is allowed"):
    // In C natural minor, Bb is the 7th degree (subtonic, not leading tone).
    val soprano = voice(Bb(4))
    val alto    = voice(Bb(3))
    val tenor   = voice(G(3))
    val bass    = voice(Eb(3))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.NaturalMinor,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.DoubledLeadingTone))

  test("correct I → V voice leading — no errors"):
    val soprano = voice(E(4), D(4))
    val alto    = voice(C(4), B(3))
    val tenor   = voice(G(3), G(3))
    val bass    = voice(C(3), G(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!analyses.exists(a =>
      a.notes.exists(_.errors.nonEmpty) || a.errors.nonEmpty
    ))

  test("errors from different categories are accumulated"):
    // Parallel octaves between soprano and alto.
    // Voice crossing between alto and bass (bass above alto).
    val soprano = voice(C(4), D(4))
    val alto    = voice(C(3), D(3))
    val bass    = voice(E(3), F(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, alto, bass))
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.ParallelOctaves))
    assert(hasNoteError(analyses, NoteError.VoiceCrossing))

  test("voices with rhythmic subdivisions are flattened correctly"):
    // Soprano: Duplet(C4, D4), Bass: Duplet(F3, G3) — parallel fifths.
    val soprano = NonEmptyList.one(Pulse.Duplet(C(4), D(4)): Pulse[Note])
    val bass    = NonEmptyList.one(Pulse.Duplet(F(3), G(3)): Pulse[Note])
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.ParallelFifths))

  test("analyzeWithPartWriting — parallel fifths detected via inferred voices"):
    // Two consecutive chords with parallel fifths: C4+F3 → D4+G3 (both P5)
    val beat1: Pulse[Note] = Pulse.Atom(C(4), F(3))
    val beat2: Pulse[Note] = Pulse.Atom(D(4), G(3))
    val result = Analysis.analyzeWithPartWriting(
      NoteType.C,
      Scale.Major,
      NonEmptyList.of(beat1, beat2)
    )
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.ParallelFifths))

  test("analyzeWithPartWriting — correct voice leading has no errors"):
    // I → V: C-E-G-C → B-D-G-G (no parallels)
    val beat1: Pulse[Note] = Pulse.Atom(C(5), G(4), E(4), C(3))
    val beat2: Pulse[Note] = Pulse.Atom(D(5), G(4), B(3), G(2))
    val result = Analysis.analyzeWithPartWriting(
      NoteType.C,
      Scale.Major,
      NonEmptyList.of(beat1, beat2)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.ParallelFifths))
    assert(!hasNoteError(analyses, NoteError.ParallelOctaves))

  // --- Integration with Analysis.fromVoices ---

  private def allNumerals(a: Analysis): Set[String] =
    a.chords.flatMap(_.romanNumerals.toList)

  test("fromVoices — I → ii with parallel fifths reports both analysis and errors"):
    val soprano = voice(G(4), A(4))
    val alto    = voice(E(4), F(4))
    val bass    = voice(C(3), D(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, alto, bass))
    val analyses = flatAnalyses(result)

    assert(hasNoteError(analyses, NoteError.ParallelFifths))
    assert(allNumerals(analyses(0)).contains("I"))
    assert(allNumerals(analyses(1)).contains("ii"))

  test("fromVoices — correct I → V returns empty errors with analysis"):
    val soprano = voice(E(4), D(4))
    val alto    = voice(C(4), B(3))
    val tenor   = voice(G(3), G(3))
    val bass    = voice(C(3), G(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)

    assert(!analyses.exists(a =>
      a.notes.exists(_.errors.nonEmpty) || a.errors.nonEmpty
    ))
    assert(allNumerals(analyses(0)).contains("I"))
    assert(allNumerals(analyses(1)).contains("V"))

  test("fromVoices — doubled leading tone in V chord detected"):
    val soprano = voice(B(4))
    val alto    = voice(B(3))
    val tenor   = voice(D(3))
    val bass    = voice(G(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)

    assert(hasNoteError(analyses, NoteError.DoubledLeadingTone))
    assert(allNumerals(analyses(0)).contains("V"))

  test("root position triad with doubled third — root not doubled error"):
    // C major root position: C-E-G-E. Third (E) is doubled instead of root.
    val soprano = voice(E(4))
    val alto    = voice(G(3))
    val tenor   = voice(E(3))
    val bass    = voice(C(3))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(hasChordError(analyses, ChordError.RootNotDoubledInRootPosition))

  test("root position triad with doubled root — no doubling error"):
    // C major root position: C-E-G-C. Root (C) is doubled.
    val soprano = voice(C(5))
    val alto    = voice(G(4))
    val tenor   = voice(E(4))
    val bass    = voice(C(3))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasChordError(analyses, ChordError.RootNotDoubledInRootPosition))

  test("second inversion triad with doubled root — fifth not doubled error"):
    // C major second inversion (bass G): G-C-E-C. Root (C) doubled, not fifth (G).
    val soprano = voice(C(5))
    val alto    = voice(E(4))
    val tenor   = voice(C(4))
    val bass    = voice(G(3))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(hasChordError(analyses, ChordError.FifthNotDoubledInSecondInversion))

  test("second inversion triad with doubled fifth — no doubling error"):
    // C major second inversion (bass G): G-C-E-G. Fifth (G) is doubled.
    val soprano = voice(G(4))
    val alto    = voice(E(4))
    val tenor   = voice(C(4))
    val bass    = voice(G(3))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasChordError(analyses, ChordError.FifthNotDoubledInSecondInversion))

  test("mixed subdivisions — duplet soprano against atom bass detects parallel fifths"):
    val soprano = NonEmptyList.one(Pulse.Duplet(C(4), D(4)): Pulse[Note])
    val bass    = NonEmptyList.one(Pulse.Duplet(F(3), G(3)): Pulse[Note])
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.ParallelFifths))

  test("mixed subdivisions — atom held against duplet does not produce false parallels"):
    // Bass holds F3 throughout — both columns share the same bass, so no voice motion
    val soprano = NonEmptyList.one(Pulse.Duplet(C(4), D(4)): Pulse[Note])
    val bass    = NonEmptyList.one(Pulse.Atom(F(3)): Pulse[Note])
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, bass))
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.ParallelFifths))
    assert(!hasNoteError(analyses, NoteError.ParallelOctaves))

  // --- Chordal 7th resolution ---

  test("chordal 7th resolves down — no error"):
    // V7 → I: soprano F5 resolves down by step to E5.
    val soprano = voice(F(5), E(5))
    val alto    = voice(D(4), C(4))
    val tenor   = voice(B(3), G(3))
    val bass    = voice(G(2), C(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.UnresolvedChordal7th))

  test("chordal 7th leaps instead of resolving — error flagged"):
    // V7 → I: soprano F5 leaps up to G5 instead of resolving down to E5.
    val soprano = voice(F(5), G(5))
    val alto    = voice(D(4), E(4))
    val tenor   = voice(B(3), C(4))
    val bass    = voice(G(2), C(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.UnresolvedChordal7th))

  test("chordal 7th held when chord sustains — no error"):
    // V7 sustained for two beats; F does not need to resolve yet.
    val soprano = voice(F(5), F(5))
    val alto    = voice(D(4), D(4))
    val tenor   = voice(B(3), B(3))
    val bass    = voice(G(2), G(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.UnresolvedChordal7th))

  test("add6 chord — sixth does not trigger chordal 7th rule"):
    // C major 6th (C-E-G-A): the A is a major 6th, not a 7th — no resolution required.
    val soprano = voice(A(4), G(4))
    val alto    = voice(G(4), F(4))
    val tenor   = voice(E(4), D(4))
    val bass    = voice(C(3), G(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.UnresolvedChordal7th))

  // --- Leading tone resolution ---

  test("leading tone resolves up to tonic — no error"):
    // V → I: soprano B4 steps up to C5.
    val soprano = voice(B(4), C(5))
    val alto    = voice(G(4), E(4))
    val tenor   = voice(D(4), C(4))
    val bass    = voice(G(2), C(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.UnresolvedLeadingTone))

  test("leading tone falls instead of resolving — error flagged"):
    // V → IV: soprano B4 falls to A4 instead of rising to C5.
    val soprano = voice(B(4), A(4))
    val alto    = voice(G(4), F(4))
    val tenor   = voice(D(4), C(4))
    val bass    = voice(G(2), F(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.UnresolvedLeadingTone))

  test("leading tone in non-dominant chord — no error"):
    // iii → IV: B is the root of iii, not in a dominant-function chord.
    val soprano = voice(B(4), C(5))
    val alto    = voice(G(4), A(4))
    val tenor   = voice(E(4), F(4))
    val bass    = voice(B(3), C(3))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.Major,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.UnresolvedLeadingTone))

  test("leading tone resolution not checked in natural minor — no error"):
    // Natural minor has no leading tone (♭7), so the rule doesn't apply.
    val soprano = voice(Bb(4), C(5))
    val alto    = voice(G(4), E(4))
    val tenor   = voice(D(4), C(4))
    val bass    = voice(G(2), C(2))
    val result = Analysis.fromVoices(
      NoteType.C,
      Scale.NaturalMinor,
      List(soprano, alto, tenor, bass)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.UnresolvedLeadingTone))

  // --- Voice count changes (inferVoices padding bug) ---

  test("voice count decrease 4→3 — no false parallel octaves"):
    // I → ii: C3-E3-G3-C4 → D3-A3-D4.
    // The C3 voice drops out. D3 and D4 are an octave, and C3 and C4
    // were an octave, but there's no voice-to-voice parallel motion —
    // C3 simply ceases. Should NOT flag parallel octaves.
    val beat1: Pulse[Note] = Pulse.Atom(C(4), G(3), E(3), C(3))
    val beat2: Pulse[Note] = Pulse.Atom(D(4), A(3), D(3))
    val result = Analysis.analyzeWithPartWriting(
      NoteType.C, Scale.Major, NonEmptyList.of(beat1, beat2)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.ParallelOctaves))

  test("voice count decrease 4→3 — no false parallel fifths"):
    // I → V: C3-E3-G3-C4 → G2-B3-D4.
    // Bass voice drops from C3. Should NOT flag parallel fifths
    // from phantom padded voice.
    val beat1: Pulse[Note] = Pulse.Atom(C(4), G(3), E(3), C(3))
    val beat2: Pulse[Note] = Pulse.Atom(D(4), B(3), G(2))
    val result = Analysis.analyzeWithPartWriting(
      NoteType.C, Scale.Major, NonEmptyList.of(beat1, beat2)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.ParallelFifths))

  test("voice count increase 3→4 — real parallel octaves still caught"):
    // C3-G3-C4 → D3-A3-D4-F4. A new voice (F4) enters, but
    // C3→D3 and C4→D4 are real parallel octaves among existing voices.
    val beat1: Pulse[Note] = Pulse.Atom(C(4), G(3), C(3))
    val beat2: Pulse[Note] = Pulse.Atom(F(4), D(4), A(3), D(3))
    val result = Analysis.analyzeWithPartWriting(
      NoteType.C, Scale.Major, NonEmptyList.of(beat1, beat2)
    )
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.ParallelOctaves))

  test("voice count decrease 3→2 — no false parallel octaves"):
    // C3-E4-C5 → D4-G4. Soprano and bass drop out.
    // Should not create phantom parallels.
    val beat1: Pulse[Note] = Pulse.Atom(C(5), E(4), C(3))
    val beat2: Pulse[Note] = Pulse.Atom(G(4), D(4))
    val result = Analysis.analyzeWithPartWriting(
      NoteType.C, Scale.Major, NonEmptyList.of(beat1, beat2)
    )
    val analyses = flatAnalyses(result)
    assert(!hasNoteError(analyses, NoteError.ParallelOctaves))
    assert(!hasNoteError(analyses, NoteError.ParallelFifths))

  test("equal voice count with real parallel octaves — still detected"):
    // Sanity check: 3→3 voices with real parallel octaves.
    // C3-E4-C5 → D3-F4-D5. C3→D3 and C5→D5 are parallel octaves.
    val beat1: Pulse[Note] = Pulse.Atom(C(5), E(4), C(3))
    val beat2: Pulse[Note] = Pulse.Atom(D(5), F(4), D(3))
    val result = Analysis.analyzeWithPartWriting(
      NoteType.C, Scale.Major, NonEmptyList.of(beat1, beat2)
    )
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.ParallelOctaves))

  test("V7/V → V — chordal 7th moving up is flagged via inferred voices"):
    // D3-F#3-A3-C4 → G2-G3-B3-D4.
    // The 7th of D7 (C4, soprano) moves up to D4 instead of resolving down.
    // Voice inference must assign soprano C4→D4 (not C4→B3 by nearest-match)
    // so the unresolved chordal 7th is detected.
    val beat1: Pulse[Note] = Pulse.Atom(C(4), A(3), `F#`(3), D(3))
    val beat2: Pulse[Note] = Pulse.Atom(D(4), B(3), G(3), G(2))
    val result = Analysis.analyzeWithPartWriting(
      NoteType.C, Scale.Major, NonEmptyList.of(beat1, beat2)
    )
    val analyses = flatAnalyses(result)
    assert(hasNoteError(analyses, NoteError.UnresolvedChordal7th))

end PartWritingSuite
