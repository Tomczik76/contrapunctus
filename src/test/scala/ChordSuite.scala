class ChordSuite extends munit.FunSuite:
  test("ChordType.fromNotes test"):
    assertEquals(
      ChordType.fromNotes(Set(A(0), C(1), E(1))),
      Some(TriadChordType.Minor(TriadChordType.Inversion.Root))
    )
    assertEquals(
      ChordType.fromNotes(Set(A(0), C(0), E(1))),
      Some(TriadChordType.Minor(TriadChordType.Inversion.First))
    )
    assertEquals(
      ChordType.fromNotes(Set(A(0), C(1), E(0))),
      Some(TriadChordType.Minor(TriadChordType.Inversion.Second))
    )
    assertEquals(
      ChordType.fromNotes(Set(C(1), E(1), G(1))),
      Some(TriadChordType.Major(TriadChordType.Inversion.Root))
    )
    assertEquals(
      ChordType.fromNotes(Set(C(1), E(0), G(1))),
      Some(TriadChordType.Major(TriadChordType.Inversion.First))
    )
    assertEquals(
      ChordType.fromNotes(Set(C(1), E(1), G(0))),
      Some(TriadChordType.Major(TriadChordType.Inversion.Second))
    )
    assertEquals(
      ChordType.fromNotes(Set(B(0), D(1), F(1))),
      Some(TriadChordType.Diminished(TriadChordType.Inversion.Root))
    )
    assertEquals(
      ChordType.fromNotes(Set(B(0), D(0), F(1))),
      Some(TriadChordType.Diminished(TriadChordType.Inversion.First))
    )
    assertEquals(
      ChordType.fromNotes(Set(B(0), D(1), F(0))),
      Some(TriadChordType.Diminished(TriadChordType.Inversion.Second))
    )
    assertEquals(
      Chord.fromNotes(Set(A(0), C(1), E(1))),
      Some(
        Chord(NoteType.A, TriadChordType.Minor(TriadChordType.Inversion.Root))
      )
    )
    assertEquals(
      Chord.fromNotes(Set(A(1), C(0), E(1))),
      Some(
        Chord(NoteType.A, TriadChordType.Minor(TriadChordType.Inversion.First))
      )
    )
    assertEquals(
      Chord.fromNotes(Set(A(1), C(1), E(0))),
      Some(
        Chord(NoteType.A, TriadChordType.Minor(TriadChordType.Inversion.Second))
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(1), G(1))),
      Some(
        Chord(NoteType.C, TriadChordType.Major(TriadChordType.Inversion.Root))
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(0), G(1))),
      Some(
        Chord(NoteType.C, TriadChordType.Major(TriadChordType.Inversion.First))
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(1), G(0))),
      Some(
        Chord(NoteType.C, TriadChordType.Major(TriadChordType.Inversion.Second))
      )
    )
    assertEquals(
      Chord.fromNotes(Set(B(0), D(1), F(1))),
      Some(
        Chord(
          NoteType.B,
          TriadChordType.Diminished(TriadChordType.Inversion.Root)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(B(0), D(0), F(1))),
      Some(
        Chord(
          NoteType.B,
          TriadChordType.Diminished(TriadChordType.Inversion.First)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(B(0), D(1), F(0))),
      Some(
        Chord(
          NoteType.B,
          TriadChordType.Diminished(TriadChordType.Inversion.Second)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(A(0), C(1), E(1), G(1))),
      Some(
        Chord(
          NoteType.A,
          SeventhChordType.MinorSeventh(SeventhChordType.Inversion.Root)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(A(1), C(0), E(1), G(1))),
      Some(
        Chord(
          NoteType.A,
          SeventhChordType.MinorSeventh(SeventhChordType.Inversion.First)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(A(1), C(1), E(0), G(1))),
      Some(
        Chord(
          NoteType.A,
          SeventhChordType.MinorSeventh(SeventhChordType.Inversion.Second)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(A(1), C(1), E(1), G(0))),
      Some(
        Chord(
          NoteType.A,
          SeventhChordType.MinorSeventh(SeventhChordType.Inversion.Third)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(1), G(1), B(1))),
      Some(
        Chord(
          NoteType.C,
          SeventhChordType.MajorSeventh(SeventhChordType.Inversion.Root)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(0), G(1), B(1))),
      Some(
        Chord(
          NoteType.C,
          SeventhChordType.MajorSeventh(SeventhChordType.Inversion.First)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(1), G(0), B(1))),
      Some(
        Chord(
          NoteType.C,
          SeventhChordType.MajorSeventh(SeventhChordType.Inversion.Second)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(1), G(1), B(0))),
      Some(
        Chord(
          NoteType.C,
          SeventhChordType.MajorSeventh(SeventhChordType.Inversion.Third)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(1), G(1), Bb(1))),
      Some(
        Chord(
          NoteType.C,
          SeventhChordType.DominantSeventh(SeventhChordType.Inversion.Root)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(0), G(1), Bb(1))),
      Some(
        Chord(
          NoteType.C,
          SeventhChordType.DominantSeventh(SeventhChordType.Inversion.First)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(1), G(0), Bb(1))),
      Some(
        Chord(
          NoteType.C,
          SeventhChordType.DominantSeventh(SeventhChordType.Inversion.Second)
        )
      )
    )
    assertEquals(
      Chord.fromNotes(Set(C(1), E(1), G(1), Bb(0))),
      Some(
        Chord(
          NoteType.C,
          SeventhChordType.DominantSeventh(SeventhChordType.Inversion.Third)
        )
      )
    )
    assertEquals(
        Chord.fromNotes(Set(C(1), E(1), G(1), B(1), D(1))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.MajorNineth(NinethChordType.Inversion.Root)
          )
        )
      )  
      assertEquals(
        Chord.fromNotes(Set(C(1), E(0), G(1), B(1), D(1))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.MajorNineth(NinethChordType.Inversion.First)
          )
        )
      )
      assertEquals(
        Chord.fromNotes(Set(C(1), E(1), G(0), B(1), D(1))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.MajorNineth(NinethChordType.Inversion.Second)
          )
        )
      )
      assertEquals(
        Chord.fromNotes(Set(C(1), E(1), G(1), B(0), D(1))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.MajorNineth(NinethChordType.Inversion.Third)
          )
        )
      )
      assertEquals(
        Chord.fromNotes(Set(C(1), E(1), G(1), B(1), D(0))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.MajorNineth(NinethChordType.Inversion.Fourth)
          )
        )
      )
    assertEquals(
        Chord.fromNotes(Set(C(1), E(1), G(1), Bb(1), D(1))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.DominantNineth(NinethChordType.Inversion.Root)
          )
        )
      )  
      assertEquals(
        Chord.fromNotes(Set(C(1), E(0), G(1), Bb(1), D(1))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.DominantNineth(NinethChordType.Inversion.First)
          )
        )
      )
      assertEquals(
        Chord.fromNotes(Set(C(1), E(1), G(0), Bb(1), D(1))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.DominantNineth(NinethChordType.Inversion.Second)
          )
        )
      )
      assertEquals(
        Chord.fromNotes(Set(C(1), E(1), G(1), Bb(0), D(1))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.DominantNineth(NinethChordType.Inversion.Third)
          )
        )
      )
      assertEquals(
        Chord.fromNotes(Set(C(1), E(1), G(1), Bb(1), D(0))),
        Some(
          Chord(
            NoteType.C,
            NinethChordType.DominantNineth(NinethChordType.Inversion.Fourth)
          )
        )
      )