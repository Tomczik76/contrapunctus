import cats.data.{NonEmptyList, NonEmptySet}

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
        Chord(
          NoteType.A,
          Sevenths.MinorSeventh.Inversions.Root
        )
      )
    )
    assertEquals(
      Chord.fromNotes(A(1), C(0), E(1), G(1)),
      Set(
        Chord(
          NoteType.A,
          Sevenths.MinorSeventh.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(A(1), C(1), E(0), G(1)),
      Set(
        Chord(
          NoteType.A,
          Sevenths.MinorSeventh.Inversions.Second
        )
      )
    )
    assertEquals(
      Chord.fromNotes(A(1), C(1), E(1), G(0)),
      Set(
        Chord(
          NoteType.A,
          Sevenths.MinorSeventh.Inversions.Third
        )
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
    assertEquals(
      Chord.fromNotes(C(1), E(0), G(1), B(1), D(1)),
      Set(
        Chord(
          NoteType.C,
          Ninths.MajorNinth.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(0), B(1), D(1)),
      Set(
        Chord(
          NoteType.C,
          Ninths.MajorNinth.Inversions.Second
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), B(0), D(1)),
      Set(
        Chord(
          NoteType.C,
          Ninths.MajorNinth.Inversions.Third
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), B(1), D(0)),
      Set(
        Chord(
          NoteType.C,
          Ninths.MajorNinth.Inversions.Fourth
        )
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
    assertEquals(
      Chord.fromNotes(C(1), E(0), G(1), Bb(1), D(1)),
      Set(
        Chord(
          NoteType.C,
          Ninths.DominantNinth.Inversions.First
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(0), Bb(1), D(1)),
      Set(
        Chord(
          NoteType.C,
          Ninths.DominantNinth.Inversions.Second
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), Bb(0), D(1)),
      Set(
        Chord(
          NoteType.C,
          Ninths.DominantNinth.Inversions.Third
        )
      )
    )
    assertEquals(
      Chord.fromNotes(C(1), E(1), G(1), Bb(1), D(0)),
      Set(
        Chord(
          NoteType.C,
          Ninths.DominantNinth.Inversions.Fourth
        )
      )
    )

  test("Ninth Chord first inversion"):
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
        Interval.MinorSixth    // C
      )
    )

  test("Ninth Chord third inversion"):
    assertEquals(
      ChordType.invert(
        NonEmptyList.of(
          Interval.PerfectUnison, // E
          Interval.MinorThird, // G
          Interval.PerfectFifth, // B
          Interval.PerfectFourth, // A
          Interval.MinorSixth // C
        )
      ),
      NonEmptyList.of(
        Interval.PerfectUnison, // G
        Interval.MajorThird, // B
        Interval.MajorSecond, // A
        Interval.PerfectFourth, // C
        Interval.MajorSixth // E
      )
    )

  test("Ninth Chord fourth inversion"):
    assertEquals(
      ChordType.invert(
        NonEmptyList.of(
          Interval.PerfectUnison, // G
          Interval.MajorThird, // B
          Interval.MajorSecond, // A
          Interval.PerfectFourth, // C
          Interval.MajorSixth // E
        )
      ),
      NonEmptyList.of(
        Interval.PerfectUnison, // B
        Interval.MinorSeventh, // A
        Interval.MinorSecond, // C
        Interval.PerfectFourth, // E
        Interval.MinorSixth // G
      )
    )

end ChordSuite
