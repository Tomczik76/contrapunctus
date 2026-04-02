package io.github.tomczik76.contrapunctus.analysis

import io.github.tomczik76.contrapunctus.core.{Note, NoteType, Scale}
import org.scalacheck.{Gen, Prop}

class SpeciesCounterpointPropertySuite extends munit.ScalaCheckSuite:

  /** Generate a note in a reasonable range (C2 to C6). */
  private val noteGen: Gen[Note] = for
    pc     <- Gen.oneOf(NoteType.values.toSeq.take(12)) // C through B (no double sharps/flats)
    octave <- Gen.choose(2, 5)
  yield Note(pc, octave)

  /** Generate a pair of notes at a specific interval class. */
  private def pairAtIntervalClass(ic: Int): Gen[(Note, Note)] = for
    base <- noteGen
    // Ensure upper note is above or equal
    upperMidi = base.midi + ic
    if upperMidi <= 84 // C6
  yield
    val upperPc = NoteType.values.find(_.value == upperMidi % 12).get
    val upperOct = upperMidi / 12 - 1
    (base, Note(upperPc, upperOct))

  // Consonant interval classes: 0, 3, 4, 7, 8, 9
  private val consonantIcGen: Gen[Int] = Gen.oneOf(0, 3, 4, 7, 8, 9)
  // Dissonant interval classes: 1, 2, 5, 6, 10, 11
  private val dissonantIcGen: Gen[Int] = Gen.oneOf(1, 2, 5, 6, 10, 11)

  property("any consonant interval produces no DissonantInterval error") {
    Prop.forAll(consonantIcGen) { ic =>
      // Build a 2-beat CF/CP where beat 0 is at unison (P1) and beat 1 at the given ic
      // We only care about beat 1 for consonance; beat 0 at unison satisfies endpoint rules
      val cf = List(Note(NoteType.C, 3), Note(NoteType.C, 3))
      val cpMidi1 = Note(NoteType.C, 3).midi + ic
      val cpNote1Pc = NoteType.values.find(_.value == cpMidi1 % 12).get
      val cpNote1 = Note(cpNote1Pc, cpMidi1 / 12 - 1)
      val cp = List(Note(NoteType.C, 3), cpNote1)
      val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
      !errors.exists(_._3 == NoteError.DissonantInterval)
    }
  }

  property("any dissonant interval produces at least one DissonantInterval error") {
    Prop.forAll(dissonantIcGen) { ic =>
      val cf = List(Note(NoteType.C, 3), Note(NoteType.C, 3))
      val cpMidi1 = Note(NoteType.C, 3).midi + ic
      val cpNote1Pc = NoteType.values.find(_.value == cpMidi1 % 12).get
      val cpNote1 = Note(cpNote1Pc, cpMidi1 / 12 - 1)
      val cp = List(Note(NoteType.C, 3), cpNote1)
      val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
      errors.exists(_._3 == NoteError.DissonantInterval)
    }
  }

  property("parallel motion to P5 always flagged") {
    // Generate two consecutive P5s with both voices moving in the same direction
    Prop.forAll(Gen.choose(1, 6)) { step =>
      val cf = List(Note(NoteType.C, 3), Note(NoteType.values((step) % 12), 3))
      val cp = List(Note(NoteType.G, 3), Note(NoteType.values((step + 7) % 12), 3))
      // Only check if both voices actually moved (same direction)
      val cfMoved = cf(0).midi != cf(1).midi
      val cpMoved = cp(0).midi != cp(1).midi
      if cfMoved && cpMoved then
        val errors = SpeciesCounterpoint.check(cf, cp, NoteType.C, Scale.Major, cfIsLower = true)
        // If second interval is still P5 (ic=7) and both moved, should have parallel 5ths
        val ic = Math.abs(cf(1).midi - cp(1).midi) % 12
        if ic == 7 then errors.exists(_._3 == NoteError.ParallelFifths)
        else true // interval changed, no parallel 5ths expected
      else true // one voice didn't move, no parallel motion
    }
  }

end SpeciesCounterpointPropertySuite
