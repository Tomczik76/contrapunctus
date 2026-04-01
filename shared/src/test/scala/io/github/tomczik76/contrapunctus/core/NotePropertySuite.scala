package io.github.tomczik76.contrapunctus.core

import cats.Order
import org.scalacheck.Prop._
import org.scalacheck.Gen

class NotePropertySuite extends munit.ScalaCheckSuite:

  val genNoteType: Gen[NoteType] = Gen.oneOf(NoteType.values.toList)
  val genOctave: Gen[Int]        = Gen.choose(-1, 9)

  val genNote: Gen[Note] = for
    nt  <- genNoteType
    oct <- genOctave
  yield Note(nt, oct)

  // ── MIDI formula ──

  property("midi == noteType.value + (octave + 1) * 12") {
    forAll(genNoteType, genOctave) { (nt, oct) =>
      val note = Note(nt, oct)
      assertEquals(
        note.midi,
        nt.value + (oct + 1) * 12,
        s"MIDI formula failed for $nt octave $oct"
      )
    }
  }

  // ── Ordering consistency ──

  property("Note ordering is consistent with midi comparison") {
    forAll(genNote, genNote) { (a, b) =>
      val ord = summon[Order[Note]]
      assertEquals(
        ord.compare(a, b).sign,
        (a.midi - b.midi).sign,
        s"Order mismatch: $a (midi=${a.midi}) vs $b (midi=${b.midi})"
      )
    }
  }

  // ── Enharmonic MIDI equivalence ──

  property("enharmonic NoteTypes at the same octave produce the same midi") {
    val enharmonicPairs = for
      a <- NoteType.values.toList
      b <- NoteType.values.toList
      if a.value == b.value && a.toString != b.toString
    yield (a, b)

    forAll(genOctave, Gen.oneOf(enharmonicPairs)) { (oct, pair) =>
      val (a, b) = pair
      assertEquals(
        Note(a, oct).midi, Note(b, oct).midi,
        s"$a and $b at octave $oct should have same MIDI"
      )
    }
  }

  // ── hashCode consistency ──

  property("enharmonic NoteTypes have equal hashCodes") {
    val enharmonicPairs = for
      a <- NoteType.values.toList
      b <- NoteType.values.toList
      if a.value == b.value && a.toString != b.toString
    yield (a, b)

    forAll(Gen.oneOf(enharmonicPairs)) { (a, b) =>
      assertEquals(
        a.hashCode(), b.hashCode(),
        s"$a and $b are equal but have different hashCodes"
      )
    }
  }

  // ── intervalAbove transitivity ──

  property("intervalAbove is transitive: a→b + b→c ≡ a→c (mod 12)") {
    forAll(genNoteType, genNoteType, genNoteType) { (a, b, c) =>
      val ab = a.intervalAbove(b).value
      val bc = b.intervalAbove(c).value
      val ac = a.intervalAbove(c).value
      assertEquals(
        (ab + bc) % 12, ac,
        s"$a→$b ($ab) + $b→$c ($bc) != $a→$c ($ac) mod 12"
      )
    }
  }

  // ── intervalAbove self is unison ──

  property("intervalAbove(self) is always PerfectUnison") {
    forAll(genNoteType) { nt =>
      assertEquals(
        nt.intervalAbove(nt), Interval.PerfectUnison,
        s"$nt.intervalAbove($nt) should be PerfectUnison"
      )
    }
  }

  // ── intervalAbove range ──

  property("intervalAbove always returns value in [0, 11]") {
    forAll(genNoteType, genNoteType) { (a, b) =>
      val iv = a.intervalAbove(b).value
      assert(
        iv >= 0 && iv <= 11,
        s"$a.intervalAbove($b) = $iv, out of [0, 11]"
      )
    }
  }

  // ── letterIndex coverage ──

  property("letterIndex is always in [0, 6]") {
    forAll(genNoteType) { nt =>
      assert(
        nt.letterIndex >= 0 && nt.letterIndex <= 6,
        s"$nt.letterIndex = ${nt.letterIndex}, out of [0, 6]"
      )
    }
  }

  property("letterIndex matches the first character of the NoteType name") {
    val letterMap = Map('C' -> 0, 'D' -> 1, 'E' -> 2, 'F' -> 3, 'G' -> 4, 'A' -> 5, 'B' -> 6)
    forAll(genNoteType) { nt =>
      val expected = letterMap(nt.toString.head)
      assertEquals(
        nt.letterIndex, expected,
        s"$nt.letterIndex should be $expected"
      )
    }
  }

end NotePropertySuite
