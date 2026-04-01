package io.github.tomczik76.contrapunctus.core

import org.scalacheck.Prop._
import org.scalacheck.Gen

class IntervalPropertySuite extends munit.ScalaCheckSuite:

  // Simple intervals within an octave (values 0-11)
  val withinOctaveIntervals: List[Interval] = List(
    Interval.PerfectUnison, Interval.MinorSecond, Interval.MajorSecond,
    Interval.MinorThird, Interval.MajorThird, Interval.PerfectFourth,
    Interval.Tritone, Interval.PerfectFifth, Interval.MinorSixth,
    Interval.MajorSixth, Interval.MinorSeventh, Interval.MajorSeventh
  )

  val genWithinOctaveInterval: Gen[Interval] = Gen.oneOf(withinOctaveIntervals)

  // All intervals that have explicit inversion mappings
  val invertibleIntervals: List[Interval] = List(
    Interval.PerfectUnison, Interval.DiminishedSecond, Interval.AugmentedUnison,
    Interval.DiminishedThird, Interval.AugmentedSecond, Interval.DiminishedFourth,
    Interval.AugmentedThird, Interval.DiminishedFifth, Interval.AugmentedFourth,
    Interval.DiminishedSixth, Interval.AugmentedFifth, Interval.DiminishedSeventh,
    Interval.AugmentedSixth, Interval.DiminishedOctave, Interval.AugmentedSeventh,
  ) ++ withinOctaveIntervals

  val genInvertible: Gen[Interval] = Gen.oneOf(invertibleIntervals.distinct)

  // ── Inversion properties ──

  property("within-octave interval + inversion values sum to 12 (except unison)") {
    forAll(genWithinOctaveInterval) { interval =>
      if interval != Interval.PerfectUnison then
        assertEquals(
          interval.value + interval.invert.value, 12,
          s"${interval} (${interval.value}) + ${interval.invert} (${interval.invert.value}) should = 12"
        )
    }
  }

  property("unison inverts to itself") {
    assertEquals(Interval.PerfectUnison.invert, Interval.PerfectUnison)
  }

  // ── Interval.apply factory ──

  // Values that the Interval.apply factory covers (0-12 simple, then compound)
  val knownValues: Set[Int] = Interval.values.map(_.value).toSet

  property("Interval.apply returns Some for all known interval values") {
    forAll(Gen.oneOf(knownValues.toList)) { v =>
      assert(Interval.apply(v).isDefined, s"Interval($v) should be Some")
    }
  }

  property("Interval.apply returns None for negative values") {
    forAll(Gen.choose(-1000, -1)) { v =>
      assertEquals(Interval.apply(v), None)
    }
  }

  property("Interval.apply returns None for values above double octave") {
    forAll(Gen.choose(25, 1000)) { v =>
      assertEquals(Interval.apply(v), None)
    }
  }

  property("Interval.apply(v).get.value == v when defined") {
    forAll(Gen.oneOf(knownValues.toList)) { v =>
      assertEquals(Interval.apply(v).get.value, v)
    }
  }

  // ── normalizedValue ──

  property("normalizedValue is always in [0, 11]") {
    forAll(genInvertible) { interval =>
      assert(interval.normalizedValue >= 0 && interval.normalizedValue < 12,
        s"${interval}.normalizedValue = ${interval.normalizedValue} out of range")
    }
  }

  property("normalizedValue == value % 12") {
    forAll(genInvertible) { interval =>
      assertEquals(interval.normalizedValue, interval.value % 12)
    }
  }

  // ── NoteType.intervalAbove ──

  val genNoteType: Gen[NoteType] = Gen.oneOf(NoteType.values.toList)

  property("intervalAbove returns interval with value in [0, 11]") {
    forAll(genNoteType, genNoteType) { (a, b) =>
      val interval = a.intervalAbove(b)
      assert(interval.value >= 0 && interval.value <= 11,
        s"${a}.intervalAbove(${b}) = ${interval} (value ${interval.value})")
    }
  }

  property("intervalAbove(self) is PerfectUnison") {
    forAll(genNoteType) { note =>
      assertEquals(note.intervalAbove(note), Interval.PerfectUnison)
    }
  }

end IntervalPropertySuite
