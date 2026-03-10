package io.github.tomczik76.contrapunctus

import cats.data.NonEmptyList

class PartWritingSuite extends munit.FunSuite:
  import Note.*

  private def voice(notes: Note*): NonEmptyList[Pulse[Note]] =
    NonEmptyList.fromListUnsafe(
      notes.toList.map(n => Pulse.Atom(n): Pulse[Note])
    )

  test("parallel fifths detected"):
    // Soprano: C4→D4, Bass: F3→G3. Both form P5, both step up.
    val soprano = voice(C(4), D(4))
    val bass    = voice(F(3), G(3))
    val errors  = PartWriting.check(List(soprano, bass), NoteType.C, Scale.Major)
    assert(errors.contains(PartWritingError.ParallelFifths(0, 1, 1)))

  test("parallel octaves detected"):
    // Soprano: C4→D4, Bass: C3→D3. Both at octave, both step up.
    val soprano = voice(C(4), D(4))
    val bass    = voice(C(3), D(3))
    val errors  = PartWriting.check(List(soprano, bass), NoteType.C, Scale.Major)
    assert(errors.contains(PartWritingError.ParallelOctaves(0, 1, 1)))

  test("contrary motion to P5 is not parallel fifths"):
    // Soprano: D4→G4 (up), Bass: A3→C3 (down). Arrive at P5 but contrary motion.
    val soprano = voice(D(4), G(4))
    val bass    = voice(A(3), C(3))
    val errors  = PartWriting.check(List(soprano, bass), NoteType.C, Scale.Major)
    assert(errors.isEmpty)

  test("direct fifths detected — soprano leaps to P5 with bass"):
    // Soprano: C4→A4 (leap up), Bass: C3→D3 (step up). Arrive at P5.
    val soprano = voice(C(4), A(4))
    val bass    = voice(C(3), D(3))
    val errors  = PartWriting.check(List(soprano, bass), NoteType.C, Scale.Major)
    assert(errors.contains(PartWritingError.DirectFifths(0, 1, 1)))

  test("direct octaves detected — soprano leaps to octave with bass"):
    // Soprano: E4→D5 (leap up), Bass: G2→D3 (leap up). Arrive at P8.
    val soprano = voice(E(4), D(5))
    val bass    = voice(G(2), D(3))
    val errors  = PartWriting.check(List(soprano, bass), NoteType.C, Scale.Major)
    assert(errors.contains(PartWritingError.DirectOctaves(0, 1, 1)))

  test("no direct fifths when soprano steps"):
    // Soprano: F4→G4 (step up), Bass: B2→C3 (step up).
    // Arrive at P5 by similar motion, but soprano doesn't leap.
    val soprano = voice(F(4), G(4))
    val bass    = voice(B(2), C(3))
    val errors  = PartWriting.check(List(soprano, bass), NoteType.C, Scale.Major)
    assert(errors.isEmpty)

  test("voice crossing detected"):
    // Soprano below bass.
    val soprano = voice(C(3))
    val bass    = voice(G(3))
    val errors  = PartWriting.check(List(soprano, bass), NoteType.C, Scale.Major)
    assert(errors.contains(PartWritingError.VoiceCrossing(0, 1, 0)))

  test("spacing error — upper voices more than octave apart"):
    // Soprano-Alto gap = 13 semitones > 12.
    val soprano = voice(C(5))
    val alto    = voice(B(3))
    val bass    = voice(G(2))
    val errors =
      PartWriting.check(List(soprano, alto, bass), NoteType.C, Scale.Major)
    assert(errors.exists(_.isInstanceOf[PartWritingError.SpacingError]))

  test("tenor-bass spacing up to two octaves is allowed"):
    val soprano = voice(G(4))
    val tenor   = voice(C(4))
    val bass    = voice(E(2))
    val errors =
      PartWriting.check(List(soprano, tenor, bass), NoteType.C, Scale.Major)
    assert(errors.isEmpty)

  test("doubled leading tone detected"):
    // B is leading tone in C major. Two voices on B.
    val soprano = voice(B(4))
    val alto    = voice(B(3))
    val tenor   = voice(G(3))
    val bass    = voice(G(2))
    val errors = PartWriting.check(
      List(soprano, alto, tenor, bass),
      NoteType.C,
      Scale.Major
    )
    assert(errors.contains(PartWritingError.DoubledLeadingTone(0)))

  test("doubled subtonic in natural minor is allowed"):
    // In C natural minor, Bb is the 7th degree (subtonic, not leading tone).
    val soprano = voice(Bb(4))
    val alto    = voice(Bb(3))
    val tenor   = voice(G(3))
    val bass    = voice(Eb(3))
    val errors = PartWriting.check(
      List(soprano, alto, tenor, bass),
      NoteType.C,
      Scale.NaturalMinor
    )
    assert(!errors.exists(_.isInstanceOf[PartWritingError.DoubledLeadingTone]))

  test("correct I → V voice leading — no errors"):
    val soprano = voice(E(4), D(4))
    val alto    = voice(C(4), B(3))
    val tenor   = voice(G(3), G(3))
    val bass    = voice(C(3), G(2))
    val errors = PartWriting.check(
      List(soprano, alto, tenor, bass),
      NoteType.C,
      Scale.Major
    )
    assert(errors.isEmpty)

  test("errors from different categories are accumulated"):
    // Parallel octaves between soprano and alto.
    // Voice crossing between alto and bass (bass above alto).
    val soprano = voice(C(4), D(4))
    val alto    = voice(C(3), D(3))
    val bass    = voice(E(3), F(3))
    val errors =
      PartWriting.check(List(soprano, alto, bass), NoteType.C, Scale.Major)
    assert(errors.exists(_.isInstanceOf[PartWritingError.ParallelOctaves]))
    assert(errors.exists(_.isInstanceOf[PartWritingError.VoiceCrossing]))

  test("voices with rhythmic subdivisions are flattened correctly"):
    // Soprano: Duplet(C4, D4), Bass: Duplet(F3, G3) — parallel fifths.
    val soprano = NonEmptyList.one(Pulse.Duplet(C(4), D(4)): Pulse[Note])
    val bass    = NonEmptyList.one(Pulse.Duplet(F(3), G(3)): Pulse[Note])
    val errors  = PartWriting.check(List(soprano, bass), NoteType.C, Scale.Major)
    assert(errors.contains(PartWritingError.ParallelFifths(0, 1, 1)))

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
    assert(
      result.partWritingErrors.contains(
        PartWritingError.RootNotDoubledInRootPosition(0)
      )
    )

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
    assert(
      !result.partWritingErrors.exists(
        _.isInstanceOf[PartWritingError.RootNotDoubledInRootPosition]
      )
    )

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
    assert(
      result.partWritingErrors.contains(
        PartWritingError.FifthNotDoubledInSecondInversion(0)
      )
    )

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
    assert(
      !result.partWritingErrors.exists(
        _.isInstanceOf[PartWritingError.FifthNotDoubledInSecondInversion]
      )
    )

  // --- Integration with Analysis.fromVoices ---

  private def allNumerals(a: Analysis): Set[String] =
    a.chords.flatMap(_.romanNumerals.toList)

  test("fromVoices — I → ii with parallel fifths reports both analysis and errors"):
    val soprano = voice(G(4), A(4))
    val alto    = voice(E(4), F(4))
    val bass    = voice(C(3), D(3))
    val result =
      Analysis.fromVoices(NoteType.C, Scale.Major, List(soprano, alto, bass))

    assert(result.partWritingErrors.exists(_.isInstanceOf[PartWritingError.ParallelFifths]))

    val analyses = result.harmonicAnalysis.toList.collect {
      case Pulse.Atom(nel) => nel.head
    }
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

    assert(result.partWritingErrors.isEmpty)

    val analyses = result.harmonicAnalysis.toList.collect {
      case Pulse.Atom(nel) => nel.head
    }
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

    assert(result.partWritingErrors.contains(PartWritingError.DoubledLeadingTone(0)))

    val analyses = result.harmonicAnalysis.toList.collect {
      case Pulse.Atom(nel) => nel.head
    }
    assert(allNumerals(analyses(0)).contains("V"))

end PartWritingSuite
