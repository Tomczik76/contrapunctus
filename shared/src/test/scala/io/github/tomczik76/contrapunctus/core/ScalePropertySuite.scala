package io.github.tomczik76.contrapunctus.core

import org.scalacheck.Prop._
import org.scalacheck.Gen

class ScalePropertySuite extends munit.ScalaCheckSuite:

  val genNoteType: Gen[NoteType] = Gen.oneOf(NoteType.values.toList)
  val genScale: Gen[Scale]       = Gen.oneOf(Scale.values.toList)

  // Natural-note tonics (no accidental displacement on the tonic).
  val genNaturalTonic: Gen[NoteType] = Gen.oneOf(
    NoteType.C, NoteType.D, NoteType.E, NoteType.F,
    NoteType.G, NoteType.A, NoteType.B
  )

  // Notes without double sharps/flats. With a natural tonic, the max
  // discrepancy between any scale degree interval and the natural letter
  // interval is 1 semitone. A single accidental adds at most 1 more,
  // keeping the total alteration within ±2 (valid Alteration range).
  val genStandardNote: Gen[NoteType] = Gen.oneOf(
    NoteType.C, NoteType.`C#`, NoteType.Db,
    NoteType.D, NoteType.`D#`, NoteType.Eb,
    NoteType.E, NoteType.Fb, NoteType.`E#`,
    NoteType.F, NoteType.`F#`, NoteType.`Gb`,
    NoteType.G, NoteType.`G#`, NoteType.Ab,
    NoteType.A, NoteType.`A#`, NoteType.Bb,
    NoteType.B, NoteType.Cb, NoteType.`B#`
  )

  // ── Universal properties (hold for all NoteType combinations) ──

  property("alteration is always within [-2, 2]") {
    forAll(genScale, genNoteType, genNoteType) { (scale, tonic, note) =>
      val result = scale.alteredScaleDegree(tonic, note)
      result.toNonEmptyList.toList.foreach: asd =>
        assert(
          asd.alteration.semitones >= -2 && asd.alteration.semitones <= 2,
          s"Alteration ${asd.alteration} out of range for $note in $tonic $scale"
        )
    }
  }

  property("degree interval + alteration reconstructs the semitone distance") {
    forAll(genScale, genNoteType, genNoteType) { (scale, tonic, note) =>
      val result = scale.alteredScaleDegree(tonic, note)
      val interval = tonic.intervalAbove(note).value
      result.toNonEmptyList.toList.foreach: asd =>
        val degreeInterval = scale.intervals.toList(asd.degree.ordinal).value
        assertEquals(
          (degreeInterval + asd.alteration.semitones + 12) % 12,
          interval % 12,
          s"Round-trip failed for $note in $tonic $scale: " +
            s"degree=${asd.degree}, alteration=${asd.alteration}"
        )
    }
  }

  // ── Spelling-aware properties ──
  // Natural tonics + standard notes (no double accidentals) guarantee
  // the letter-based path is always taken, producing a single unambiguous
  // result whose degree matches the letter distance.

  property("returns exactly one result for standard spellings") {
    forAll(genScale, genNaturalTonic, genStandardNote) { (scale, tonic, note) =>
      val result = scale.alteredScaleDegree(tonic, note)
      assertEquals(
        result.toNonEmptyList.size, 1,
        s"Expected 1 result for $note in $tonic $scale, got ${result.toNonEmptyList}"
      )
    }
  }

  property("returned degree matches letter distance from tonic") {
    forAll(genScale, genNaturalTonic, genStandardNote) { (scale, tonic, note) =>
      val asd = scale.alteredScaleDegree(tonic, note).toNonEmptyList.head
      val expectedDegree = (note.letterIndex - tonic.letterIndex + 7) % 7
      assertEquals(
        asd.degree.ordinal, expectedDegree,
        s"$note in $tonic $scale: expected degree ordinal $expectedDegree " +
          s"but got ${asd.degree} (ordinal ${asd.degree.ordinal})"
      )
    }
  }

  property("diatonic notes have Natural alteration") {
    forAll(genScale, genNaturalTonic) { (scale, tonic) =>
      val scaleIntervals = scale.intervals.toList.map(_.value)
      val tonicLetter = tonic.letterIndex
      for (iv, degreeIdx) <- scaleIntervals.zipWithIndex do
        val pc = (tonic.value + iv) % 12
        val expectedLetter = (tonicLetter + degreeIdx) % 7
        val candidate = NoteType.values.find: nt =>
          nt.value == pc && nt.letterIndex == expectedLetter
        candidate.foreach: diatonicNote =>
          val asd = scale.alteredScaleDegree(tonic, diatonicNote).toNonEmptyList.head
          assertEquals(
            asd.alteration, Alteration.Natural,
            s"Diatonic note $diatonicNote (degree $degreeIdx) in $tonic $scale " +
              s"should be Natural but got ${asd.alteration}"
          )
    }
  }

  property("enharmonic equivalents with different letters produce different degrees") {
    // Only use standard notes (no double accidentals) so both members of
    // the pair take the letter-based path with natural tonics.
    val standardNotes = List(
      NoteType.C, NoteType.`C#`, NoteType.Db,
      NoteType.D, NoteType.`D#`, NoteType.Eb,
      NoteType.E, NoteType.Fb, NoteType.`E#`,
      NoteType.F, NoteType.`F#`, NoteType.`Gb`,
      NoteType.G, NoteType.`G#`, NoteType.Ab,
      NoteType.A, NoteType.`A#`, NoteType.Bb,
      NoteType.B, NoteType.Cb, NoteType.`B#`
    )
    val enharmonicPairs: List[(NoteType, NoteType)] =
      for
        a <- standardNotes
        b <- standardNotes
        if a.value == b.value && a.letterIndex != b.letterIndex
      yield (a, b)

    forAll(genScale, genNaturalTonic, Gen.oneOf(enharmonicPairs)) {
      (scale, tonic, pair) =>
        val (noteA, noteB) = pair
        val asdA = scale.alteredScaleDegree(tonic, noteA).toNonEmptyList.head
        val asdB = scale.alteredScaleDegree(tonic, noteB).toNonEmptyList.head
        assertNotEquals(
          asdA.degree, asdB.degree,
          s"$noteA and $noteB (pitch class ${noteA.value}) in $tonic $scale " +
            s"should have different degrees but both got ${asdA.degree}"
        )
    }
  }

end ScalePropertySuite
