package io.github.tomczik76.contrapunctus.analysis

import io.github.tomczik76.contrapunctus.core.{Note, NoteType}
import io.github.tomczik76.contrapunctus.harmony.{Chord, Triads}
import org.scalacheck.Prop._
import org.scalacheck.Gen

class NonChordTonePropertySuite extends munit.ScalaCheckSuite:

  // ── genericInterval properties ──

  property("genericInterval always returns a value in [1, 7]") {
    forAll(Gen.choose(-1000, 1000)) { semitones =>
      val result = NonChordToneAnalysis.genericInterval(semitones)
      assert(
        result >= 1 && result <= 7,
        s"genericInterval($semitones) = $result, expected [1, 7]"
      )
    }
  }

  property("genericInterval(0) is always 1 (unison)") {
    assertEquals(NonChordToneAnalysis.genericInterval(0), 1)
  }

  property("genericInterval is periodic with period 12") {
    forAll(Gen.choose(-100, 100)) { semitones =>
      assertEquals(
        NonChordToneAnalysis.genericInterval(semitones),
        NonChordToneAnalysis.genericInterval(semitones + 12),
        s"genericInterval($semitones) != genericInterval(${semitones + 12})"
      )
    }
  }

  property("genericInterval complements sum to 9") {
    // In music theory, a generic interval + its complement = 9
    // e.g. 2nd (2) + 7th (7) = 9, 3rd (3) + 6th (6) = 9
    // Exclude tritone (6) — it is its own complement and maps to 4+4=8
    forAll(Gen.choose(1, 11).suchThat(_ != 6)) { semitones =>
      if semitones >= 1 && semitones <= 11 && semitones != 6 then
        val a = NonChordToneAnalysis.genericInterval(semitones)
        val b = NonChordToneAnalysis.genericInterval(12 - semitones)
        assertEquals(
          a + b, 9,
          s"genericInterval($semitones)=$a + genericInterval(${12 - semitones})=$b should sum to 9"
        )
    }
  }

  // ── classify properties ──

  val genNoteType: Gen[NoteType] = Gen.oneOf(
    NoteType.C, NoteType.D, NoteType.E, NoteType.F,
    NoteType.G, NoteType.A, NoteType.B,
    NoteType.`C#`, NoteType.Eb, NoteType.`F#`, NoteType.Ab, NoteType.Bb
  )
  val genOctave: Gen[Int] = Gen.choose(2, 5)
  val genNote: Gen[Note] = for
    nt  <- genNoteType
    oct <- genOctave
  yield Note(nt, oct)

  val genTriadRoot: Gen[NoteType] = Gen.oneOf(
    NoteType.C, NoteType.D, NoteType.E, NoteType.F,
    NoteType.G, NoteType.A, NoteType.B
  )

  property("chord tones always classify as None") {
    forAll(genTriadRoot, genOctave) { (root, octave) =>
      val chord = Chord(root, Triads.Major.Inversions.Root)
      // Build a chord tone from the root
      val note = Note(root, octave)
      assertEquals(
        NonChordToneAnalysis.classify(
          prev = Some((note, chord)),
          current = (note, chord),
          next = Some((note, chord))
        ),
        None,
        s"Chord tone $note over $root major should classify as None"
      )
    }
  }

  property("classify returns None when prev and next are both absent") {
    forAll(genNote, genTriadRoot) { (note, root) =>
      val chord = Chord(root, Triads.Major.Inversions.Root)
      val result = NonChordToneAnalysis.classify(
        prev = None,
        current = (note, chord),
        next = None
      )
      assertEquals(result, None, s"No context should yield None for $note")
    }
  }

  property("passing tone: stepwise same direction classifies as PassingTone") {
    // Generate ascending stepwise patterns: note-1, note, note+1
    forAll(Gen.choose(36, 84)) { midi =>
      val mkNote = (m: Int) => {
        val pc = m % 12
        val oct = m / 12 - 1
        val nt = NoteType.values.find(_.value == pc).get
        Note(nt, oct)
      }
      val prev = mkNote(midi - 1)
      val current = mkNote(midi)
      val next = mkNote(midi + 1)
      // Use a chord where current is NOT a chord tone
      // C major triad: C E G — pick midi values that avoid these pitch classes
      val cMajor = Chord(NoteType.C, Triads.Major.Inversions.Root)
      if !cMajor.isChordTone(current.noteType) then
        val result = NonChordToneAnalysis.classify(
          prev = Some((prev, cMajor)),
          current = (current, cMajor),
          next = Some((next, cMajor))
        )
        assertEquals(
          result, Some(NonChordToneType.PassingTone),
          s"Ascending step $prev -> $current -> $next should be PassingTone"
        )
    }
  }

  property("neighbor tone: step away and return classifies as NeighborTone") {
    // note, note+1, note — where note+1 is non-chord-tone
    forAll(Gen.choose(36, 84)) { midi =>
      val mkNote = (m: Int) => {
        val pc = m % 12
        val oct = m / 12 - 1
        val nt = NoteType.values.find(_.value == pc).get
        Note(nt, oct)
      }
      val origin = mkNote(midi)
      val neighbor = mkNote(midi + 1)
      val cMajor = Chord(NoteType.C, Triads.Major.Inversions.Root)
      if !cMajor.isChordTone(neighbor.noteType) then
        val result = NonChordToneAnalysis.classify(
          prev = Some((origin, cMajor)),
          current = (neighbor, cMajor),
          next = Some((origin, cMajor))
        )
        assertEquals(
          result, Some(NonChordToneType.NeighborTone),
          s"$origin -> $neighbor -> $origin should be NeighborTone"
        )
    }
  }

  property("pedal tone: same pitch held through is PedalTone") {
    // prev=note, current=note, next=note where note is non-chord-tone
    forAll(genNote) { note =>
      val cMajor = Chord(NoteType.C, Triads.Major.Inversions.Root)
      if !cMajor.isChordTone(note.noteType) then
        val result = NonChordToneAnalysis.classify(
          prev = Some((note, cMajor)),
          current = (note, cMajor),
          next = Some((note, cMajor))
        )
        assertEquals(
          result, Some(NonChordToneType.PedalTone),
          s"$note held through should be PedalTone"
        )
    }
  }

end NonChordTonePropertySuite
