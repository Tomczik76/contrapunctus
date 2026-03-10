package io.github.tomczik76.contrapunctus.harmony

import cats.data.{NonEmptyList, NonEmptySet}
import io.github.tomczik76.contrapunctus.core.{Note, NoteType}
import Note.*

class ChordSuite extends munit.FunSuite:
  test("ChordType.fromNotes test"):
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(A(0), C(1), E(1))),
      Set[ChordType](Triads.Minor.Inversions.Root)
    )

    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(A(0), C(0), E(1))),
      Set[ChordType](Triads.Minor.Inversions.First)
    )
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(A(0), C(1), E(0))),
      Set[ChordType](Triads.Minor.Inversions.Second)
    )
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(C(1), E(1), G(1))),
      Set[ChordType](Triads.Major.Inversions.Root)
    )
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(C(1), E(0), G(1))),
      Set[ChordType](Triads.Major.Inversions.First)
    )
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(C(1), E(1), G(0))),
      Set[ChordType](Triads.Major.Inversions.Second)
    )
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(B(0), D(1), F(1))),
      Set[ChordType](Triads.Diminished.Inversions.Root)
    )
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(B(0), D(0), F(1))),
      Set[ChordType](Triads.Diminished.Inversions.First)
    )
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(B(0), D(1), F(0))),
      Set[ChordType](Triads.Diminished.Inversions.Second)
    )
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(B(0), D(1), F(0), Ab(1))),
      Set[ChordType](
        Sevenths.DiminishedSeventh.Inversions.Root,
        Sevenths.DiminishedSeventh.Inversions.First,
        Sevenths.DiminishedSeventh.Inversions.Second,
        Sevenths.DiminishedSeventh.Inversions.Third
      )
    )
  test("ChordType tests"):
    assertEquals(
      Chord.fromNotes(A(0), C(1), E(1)),
      Set(
        Chord(NoteType.A, Triads.Minor.Inversions.Root)
      )
    )
    assertEquals(
      Chord.fromNotes(A(1), C(0), E(1)),
      Set(
        Chord(
          NoteType.A,
          Triads.Minor.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(A(1), C(1), E(0)),
      Set(
        Chord(NoteType.A, Triads.Minor.Inversions.Second)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1)),
      Set(
        Chord(NoteType.C, Triads.Major.Inversions.Root)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(0), G(1)),
      Set(
        Chord(
          NoteType.C,
          Triads.Major.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(0)),
      Set(
        Chord(
          NoteType.C,
          Triads.Major.Inversions.Second
        )
      )
    )
    assertEquals(
      Chord.fromNotes(B(0), D(1), F(1)),
      Set(
        Chord(
          NoteType.B,
          Triads.Diminished.Inversions.Root
        )
      )
    )
    assertEquals(
      Chord.fromNotes(B(0), D(0), F(1)),
      Set(
        Chord(
          NoteType.B,
          Triads.Diminished.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(B(0), D(1), F(0)),
      Set(
        Chord(
          NoteType.B,
          Triads.Diminished.Inversions.Second
        )
      )
    )
    assertEquals(
      Chord.fromNotes(A(0), C(1), E(1), G(1)),
      Set(
        Chord(NoteType.A, Sevenths.MinorSeventh.Inversions.Root),
        Chord(NoteType.C, Sevenths.MajorSixth.Inversions.Third)
      )
    )
    assertEquals(
      Chord.fromNotes(A(1), C(0), E(1), G(1)),
      Set(
        Chord(NoteType.A, Sevenths.MinorSeventh.Inversions.First),
        Chord(NoteType.C, Sevenths.MajorSixth.Inversions.Root)
      )
    )
    assertEquals(
      Chord.fromNotes(A(1), C(1), E(0), G(1)),
      Set(
        Chord(NoteType.A, Sevenths.MinorSeventh.Inversions.Second),
        Chord(NoteType.C, Sevenths.MajorSixth.Inversions.First)
      )
    )
    assertEquals(
      Chord.fromNotes(A(1), C(1), E(1), G(0)),
      Set(
        Chord(NoteType.A, Sevenths.MinorSeventh.Inversions.Third),
        Chord(NoteType.C, Sevenths.MajorSixth.Inversions.Second)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), B(1)),
      Set(
        Chord(
          NoteType.C,
          Sevenths.MajorSeventh.Inversions.Root
        )
      )
    )

    assertEquals(
      Chord.fromNotes(C(1), E(0), G(1), B(1)),
      Set(
        Chord(
          NoteType.C,
          Sevenths.MajorSeventh.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(0), B(1)),
      Set(
        Chord(
          NoteType.C,
          Sevenths.MajorSeventh.Inversions.Second
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), B(0)),
      Set(
        Chord(
          NoteType.C,
          Sevenths.MajorSeventh.Inversions.Third
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), Bb(1)),
      Set(
        Chord(
          NoteType.C,
          Sevenths.DominantSeventh.Inversions.Root
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(0), G(1), Bb(1)),
      Set(
        Chord(
          NoteType.C,
          Sevenths.DominantSeventh.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(0), Bb(1)),
      Set(
        Chord(
          NoteType.C,
          Sevenths.DominantSeventh.Inversions.Second
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), Bb(0)),
      Set(
        Chord(
          NoteType.C,
          Sevenths.DominantSeventh.Inversions.Third
        )
      )
    )
    assertEquals(
      Chord.fromNotes(B(0), D(1), F(1), Ab(1)),
      Set(
        Chord(
          NoteType.B,
          Sevenths.DiminishedSeventh.Inversions.Root
        ),
        Chord(
          NoteType.D,
          Sevenths.DiminishedSeventh.Inversions.Third
        ),
        Chord(
          NoteType.F,
          Sevenths.DiminishedSeventh.Inversions.Second
        ),
        Chord(
          NoteType.Ab,
          Sevenths.DiminishedSeventh.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), B(1), D(1)),
      Set(
        Chord(
          NoteType.C,
          Ninths.MajorNinth.Inversions.Root
        )
      )
    )
    val majorNinthFirst = Chord.fromNotes(C(1), E(0), G(1), B(1), D(1))
    assert(
      majorNinthFirst.contains(
        Chord(NoteType.C, Ninths.MajorNinth.Inversions.First)
      )
    )
    val majorNinthSecond = Chord.fromNotes(C(1), E(1), G(0), B(1), D(1))
    assert(
      majorNinthSecond.contains(
        Chord(NoteType.C, Ninths.MajorNinth.Inversions.Second)
      )
    )

    val majorNinthThird = Chord.fromNotes(C(1), E(1), G(1), B(0), D(1))
    assert(
      majorNinthThird.contains(
        Chord(NoteType.C, Ninths.MajorNinth.Inversions.Third)
      )
    )

    val majorNinthFourth = Chord.fromNotes(C(1), E(1), G(1), B(1), D(0))
    assert(
      majorNinthFourth.contains(
        Chord(NoteType.C, Ninths.MajorNinth.Inversions.Fourth)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), Bb(1), D(1)),
      Set(
        Chord(
          NoteType.C,
          Ninths.DominantNinth.Inversions.Root
        )
      )
    )
    val domNinthFirst = Chord.fromNotes(C(1), E(0), G(1), Bb(1), D(1))
    assert(
      domNinthFirst.contains(
        Chord(NoteType.C, Ninths.DominantNinth.Inversions.First)
      )
    )

    val domNinthSecond = Chord.fromNotes(C(1), E(1), G(0), Bb(1), D(1))
    assert(
      domNinthSecond.contains(
        Chord(NoteType.C, Ninths.DominantNinth.Inversions.Second)
      )
    )

    val domNinthThird = Chord.fromNotes(C(1), E(1), G(1), Bb(0), D(1))
    assert(
      domNinthThird.contains(
        Chord(NoteType.C, Ninths.DominantNinth.Inversions.Third)
      )
    )

    val domNinthFourth = Chord.fromNotes(C(1), E(1), G(1), Bb(1), D(0))
    assert(
      domNinthFourth.contains(
        Chord(NoteType.C, Ninths.DominantNinth.Inversions.Fourth)
      )
    )

  test("Ninth Chord first inversion"):
    import io.github.tomczik76.contrapunctus.core.Interval
    assertEquals(
      ChordType.invert(
        NonEmptyList.of(
          Interval.PerfectUnison, // A
          Interval.MinorThird,    // C
          Interval.PerfectFifth,  // E
          Interval.MinorSeventh,  // G
          Interval.MajorNinth     // B
        )
      ),
      NonEmptyList.of(
        Interval.PerfectUnison, // C
        Interval.MajorThird,    // E
        Interval.PerfectFifth,  // G
        Interval.MajorSeventh,  // B
        Interval.MajorSixth     // A
      )
    )

  test("Ninth Chord second inversion"):
    import io.github.tomczik76.contrapunctus.core.Interval
    assertEquals(
      ChordType.invert(
        NonEmptyList.of(
          Interval.PerfectUnison, // C
          Interval.MajorThird,    // E
          Interval.PerfectFifth,  // G
          Interval.MajorSeventh,  // B
          Interval.MajorSixth     // A
        )
      ),
      NonEmptyList.of(
        Interval.PerfectUnison, // E
        Interval.MinorThird,    // G
        Interval.PerfectFifth,  // B
        Interval.PerfectFourth, // A
        Interval.MinorSixth     // C
      )
    )

  test("Ninth Chord third inversion"):
    import io.github.tomczik76.contrapunctus.core.Interval
    assertEquals(
      ChordType.invert(
        NonEmptyList.of(
          Interval.PerfectUnison, // E
          Interval.MinorThird,    // G
          Interval.PerfectFifth,  // B
          Interval.PerfectFourth, // A
          Interval.MinorSixth     // C
        )
      ),
      NonEmptyList.of(
        Interval.PerfectUnison, // G
        Interval.MajorThird,    // B
        Interval.MajorSecond,   // A
        Interval.PerfectFourth, // C
        Interval.MajorSixth     // E
      )
    )

  test("Ninth Chord fourth inversion"):
    import io.github.tomczik76.contrapunctus.core.Interval
    assertEquals(
      ChordType.invert(
        NonEmptyList.of(
          Interval.PerfectUnison, // G
          Interval.MajorThird,    // B
          Interval.MajorSecond,   // A
          Interval.PerfectFourth, // C
          Interval.MajorSixth     // E
        )
      ),
      NonEmptyList.of(
        Interval.PerfectUnison, // B
        Interval.MinorSeventh,  // A
        Interval.MinorSecond,   // C
        Interval.PerfectFourth, // E
        Interval.MinorSixth     // G
      )
    )

  test("Sus2 chord tests"):
    assertEquals(
      Chord.fromNotes(C(1), D(1), G(1)),
      Set(
        Chord(NoteType.C, Triads.Sus2.Inversions.Root),
        Chord(NoteType.G, Triads.Sus4.Inversions.First)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), D(0), G(1)),
      Set(
        Chord(NoteType.C, Triads.Sus2.Inversions.First),
        Chord(NoteType.G, Triads.Sus4.Inversions.Second)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), D(1), G(0)),
      Set(
        Chord(NoteType.C, Triads.Sus2.Inversions.Second),
        Chord(NoteType.G, Triads.Sus4.Inversions.Root)
      )
    )

  test("Sus4 chord tests"):
    assertEquals(
      Chord.fromNotes(C(1), F(1), G(1)),
      Set(
        Chord(NoteType.C, Triads.Sus4.Inversions.Root),
        Chord(NoteType.F, Triads.Sus2.Inversions.Second)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), F(0), G(1)),
      Set(
        Chord(NoteType.C, Triads.Sus4.Inversions.First),
        Chord(NoteType.F, Triads.Sus2.Inversions.Root)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), F(1), G(0)),
      Set(
        Chord(NoteType.C, Triads.Sus4.Inversions.Second),
        Chord(NoteType.F, Triads.Sus2.Inversions.First)
      )
    )

  test("Augmented chord tests"):
    assertEquals(
      Chord.fromNotes(C(1), E(1), `G#`(1)),
      Set(
        Chord(NoteType.C, Triads.Augmented.Inversions.Root),
        Chord(NoteType.E, Triads.Augmented.Inversions.Second),
        Chord(NoteType.`G#`, Triads.Augmented.Inversions.First)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(0), `G#`(1)),
      Set(
        Chord(NoteType.C, Triads.Augmented.Inversions.First),
        Chord(NoteType.E, Triads.Augmented.Inversions.Root),
        Chord(NoteType.`G#`, Triads.Augmented.Inversions.Second)
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), `G#`(0)),
      Set(
        Chord(NoteType.C, Triads.Augmented.Inversions.Second),
        Chord(NoteType.E, Triads.Augmented.Inversions.First),
        Chord(NoteType.`G#`, Triads.Augmented.Inversions.Root)
      )
    )

  test("MinorMajor7th chord tests"):
    assertEquals(
      Chord.fromNotes(A(0), C(1), E(1), `G#`(1)),
      Set(Chord(NoteType.A, Sevenths.MinorMajorSeventh.Inversions.Root))
    )
    assertEquals(
      Chord.fromNotes(A(1), C(0), E(1), `G#`(1)),
      Set(Chord(NoteType.A, Sevenths.MinorMajorSeventh.Inversions.First))
    )
    assertEquals(
      Chord.fromNotes(A(1), C(1), E(0), `G#`(1)),
      Set(Chord(NoteType.A, Sevenths.MinorMajorSeventh.Inversions.Second))
    )
    assertEquals(
      Chord.fromNotes(A(1), C(1), E(1), `G#`(0)),
      Set(Chord(NoteType.A, Sevenths.MinorMajorSeventh.Inversions.Third))
    )

  test("MinorNinth chord tests"):
    assertEquals(
      Chord.fromNotes(A(0), C(1), E(1), G(1), B(1)),
      Set(Chord(NoteType.A, Ninths.MinorNinth.Inversions.Root))
    )
    assertEquals(
      Chord.fromNotes(A(1), C(0), E(1), G(1), B(1)),
      Set(Chord(NoteType.A, Ninths.MinorNinth.Inversions.First))
    )

  test("MinorMajorNinth chord tests"):
    assertEquals(
      Chord.fromNotes(A(0), C(1), E(1), `G#`(1), B(1)),
      Set(Chord(NoteType.A, Ninths.MinorMajorNinth.Inversions.Root))
    )

  test("Enharmonic equivalence - C# vs Db"):
    assertEquals(
      Chord.fromNotes(`C#`(1), F(1), `G#`(1)),
      Chord.fromNotes(Db(1), F(1), Ab(1))
    )

  test("ChordType.fromNotes with Sus2"):
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(C(1), D(1), G(1))),
      Set[ChordType](Triads.Sus2.Inversions.Root, Triads.Sus4.Inversions.First)
    )

  test("ChordType.fromNotes with Sus4"):
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(C(1), F(1), G(1))),
      Set[ChordType](Triads.Sus4.Inversions.Root, Triads.Sus2.Inversions.Second)
    )

  test("ChordType.fromNotes with Augmented"):
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(C(1), E(1), `G#`(1))),
      Set[ChordType](
        Triads.Augmented.Inversions.Root,
        Triads.Augmented.Inversions.First,
        Triads.Augmented.Inversions.Second
      )
    )

  test("MinorNinthOmit5 chord tests"):
    assertEquals(
      Chord.fromNotes(A(0), C(1), G(1), B(1)),
      Set(Chord(NoteType.A, Ninths.MinorNinthOmit5.Inversions.Root))
    )

  test("DominantNinthOmit5 chord tests"):
    assertEquals(
      Chord.fromNotes(C(1), E(1), Bb(1), D(1)),
      Set(Chord(NoteType.C, Ninths.DominantNinthOmit5.Inversions.Root))
    )

  test("MajorNinthOmit5 chord tests"):
    assertEquals(
      Chord.fromNotes(C(1), E(1), B(1), D(1)),
      Set(Chord(NoteType.C, Ninths.MajorNinthOmit5.Inversions.Root))
    )

  test("MinorMajorNinthOmit5 chord tests"):
    assertEquals(
      Chord.fromNotes(A(0), C(1), `G#`(1), B(1)),
      Set(Chord(NoteType.A, Ninths.MinorMajorNinthOmit5.Inversions.Root))
    )

  test("ChordType.fromNotes with MinorNinthOmit5"):
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(A(0), C(1), G(1), B(1))),
      Set[ChordType](Ninths.MinorNinthOmit5.Inversions.Root)
    )

  test("ChordType.fromNotes with DominantNinthOmit5"):
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(C(1), E(1), Bb(1), D(1))),
      Set[ChordType](Ninths.DominantNinthOmit5.Inversions.Root)
    )

  test("ChordType.fromNotes with MajorNinthOmit5"):
    assertEquals(
      ChordType.fromNotes(NonEmptySet.of(C(1), E(1), B(1), D(1))),
      Set[ChordType](Ninths.MajorNinthOmit5.Inversions.Root)
    )

  test("PowerChord tests"):
    val powerChord = Chord.fromNotes(C(1), G(1))
    assert(
      powerChord.contains(Chord(NoteType.C, Triads.PowerChord.Inversions.Root))
    )

  test("HalfDiminishedSeventh tests"):
    val halfDim7 = Chord.fromNotes(B(0), D(1), F(1), A(1))
    assert(
      halfDim7.contains(
        Chord(NoteType.B, Sevenths.HalfDiminishedSeventh.Inversions.Root)
      )
    )

  test("AugmentedSeventh tests"):
    val aug7 = Chord.fromNotes(C(1), E(1), `G#`(1), Bb(1))
    assert(
      aug7.contains(
        Chord(NoteType.C, Sevenths.AugmentedSeventh.Inversions.Root)
      )
    )

  test("AugmentedMajorSeventh tests"):
    assertEquals(
      Chord.fromNotes(C(1), E(1), `G#`(1), B(1)),
      Set(Chord(NoteType.C, Sevenths.AugmentedMajorSeventh.Inversions.Root))
    )

  test("MinorSixth tests"):
    val minorSixth = Chord.fromNotes(A(0), C(1), E(1), `F#`(1))
    assert(
      minorSixth.contains(
        Chord(NoteType.A, Sevenths.MinorSixth.Inversions.Root)
      )
    )

  test("MajorEleventh tests"):
    val majorEleventh = Chord.fromNotes(C(1), E(1), G(1), B(1), D(1), F(1))
    assert(
      majorEleventh.contains(
        Chord(NoteType.C, Elevenths.MajorEleventh.Inversions.Root)
      )
    )

  test("MinorEleventh tests"):
    val minorEleventh = Chord.fromNotes(A(0), C(1), E(1), G(1), B(1), D(1))
    assert(
      minorEleventh.contains(
        Chord(NoteType.A, Elevenths.MinorEleventh.Inversions.Root)
      )
    )

  test("DominantEleventh tests"):
    val dominantEleventh = Chord.fromNotes(C(1), E(1), G(1), Bb(1), D(1), F(1))
    assert(
      dominantEleventh.contains(
        Chord(NoteType.C, Elevenths.DominantEleventh.Inversions.Root)
      )
    )

  test("MajorThirteenth tests"):
    val majorThirteenth =
      Chord.fromNotes(C(1), E(1), G(1), B(1), D(1), F(1), A(1))
    assert(
      majorThirteenth.contains(
        Chord(NoteType.C, Thirteenths.MajorThirteenth.Inversions.Root)
      )
    )

  test("MinorThirteenth tests"):
    val minorThirteenth =
      Chord.fromNotes(A(0), C(1), E(1), G(1), B(1), D(1), `F#`(1))
    assert(
      minorThirteenth.contains(
        Chord(NoteType.A, Thirteenths.MinorThirteenth.Inversions.Root)
      )
    )

  test("DominantThirteenth tests"):
    val dominantThirteenth =
      Chord.fromNotes(C(1), E(1), G(1), Bb(1), D(1), F(1), A(1))
    assert(
      dominantThirteenth.contains(
        Chord(NoteType.C, Thirteenths.DominantThirteenth.Inversions.Root)
      )
    )

  test("SevenFlatNine tests"):
    val sevenFlatNine = Chord.fromNotes(C(1), E(1), G(1), Bb(1), Db(1))
    assert(
      sevenFlatNine.contains(
        Chord(NoteType.C, AlteredChords.SevenFlatNine.Inversions.Root)
      )
    )

  test("SevenSharpNine tests"):
    val sevenSharpNine = Chord.fromNotes(C(1), E(1), G(1), Bb(1), `D#`(1))
    assert(
      sevenSharpNine.contains(
        Chord(NoteType.C, AlteredChords.SevenSharpNine.Inversions.Root)
      )
    )

  test("SevenFlatFive tests"):
    val sevenFlatFive = Chord.fromNotes(C(1), E(1), `F#`(1), Bb(1))
    assert(
      sevenFlatFive.contains(
        Chord(NoteType.C, AlteredChords.SevenFlatFive.Inversions.Root)
      )
    )

  test("SevenFlatFiveFlatNine tests"):
    val sevenFlatFiveFlatNine =
      Chord.fromNotes(C(1), E(1), `F#`(1), Bb(1), Db(1))
    assert(
      sevenFlatFiveFlatNine.contains(
        Chord(NoteType.C, AlteredChords.SevenFlatFiveFlatNine.Inversions.Root)
      )
    )

  test("SevenSharpFiveSharpNine tests"):
    val sevenSharpFiveSharpNine =
      Chord.fromNotes(C(1), E(1), `G#`(1), Bb(1), `D#`(1))
    assert(
      sevenSharpFiveSharpNine.contains(
        Chord(NoteType.C, AlteredChords.SevenSharpFiveSharpNine.Inversions.Root)
      )
    )

end ChordSuite
