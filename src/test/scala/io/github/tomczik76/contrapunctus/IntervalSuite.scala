package io.github.tomczik76.contrapunctus

import Interval.*
import cats.data.NonEmptySet
import Note.*
class IntervalSuite extends munit.FunSuite:
  test("Interval test"):
    assertEquals(
      C(1).interval(E(1)),
      Some(MajorThird)
    )

  test("Inverted interval test"):
    assertEquals(
      C(1).interval(E(0)),
      Some(MinorSixth)
    )
  test("Test Map lookups 2"):
    val map = Map(NonEmptySet.of(MajorSecond.normalizedValue) -> 1)
    assertEquals(map(NonEmptySet.of(MajorNinth.normalizedValue)), 1)

  test("AugmentedUnison.invert should be DiminishedOctave"):
    assertEquals(AugmentedUnison.invert, DiminishedOctave)

  test("DiminishedFifth.invert should be AugmentedFourth"):
    assertEquals(DiminishedFifth.invert, AugmentedFourth)

  test("AugmentedFifth.invert should be DiminishedFourth"):
    assertEquals(AugmentedFifth.invert, DiminishedFourth)

  test("ChordType.invert computes correct semitone values"):
    import cats.data.NonEmptyList
    // AugmentedSeventh root: [P1(0), M3(4), Aug5(8), m7(10)]
    // First inversion from the third: [P1(0), M3(4), Tritone(6), m6(8)]
    val augSeventh = NonEmptyList.of(PerfectUnison, MajorThird, AugmentedFifth, MinorSeventh)
    val firstInversion = ChordType.invert(augSeventh)
    assertEquals(
      firstInversion.toList.map(_.value),
      List(0, 4, 6, 8)
    )

  // --- invert: all explicitly matched cases ---

  test("PerfectUnison.invert is PerfectUnison"):
    assertEquals(PerfectUnison.invert, PerfectUnison)

  test("DiminishedSecond.invert is AugmentedSeventh"):
    assertEquals(DiminishedSecond.invert, AugmentedSeventh)

  test("DiminishedThird.invert is AugmentedSixth"):
    assertEquals(DiminishedThird.invert, AugmentedSixth)

  test("AugmentedSecond.invert is DiminishedSeventh"):
    assertEquals(AugmentedSecond.invert, DiminishedSeventh)

  test("DiminishedFourth.invert is AugmentedFifth"):
    assertEquals(DiminishedFourth.invert, AugmentedFifth)

  test("AugmentedThird.invert is DiminishedSixth"):
    assertEquals(AugmentedThird.invert, DiminishedSixth)

  test("AugmentedFourth.invert is DiminishedFifth"):
    assertEquals(AugmentedFourth.invert, DiminishedFifth)

  test("DiminishedSixth.invert is AugmentedThird"):
    assertEquals(DiminishedSixth.invert, AugmentedThird)

  test("DiminishedSeventh.invert is AugmentedSecond"):
    assertEquals(DiminishedSeventh.invert, AugmentedSecond)

  test("AugmentedSixth.invert is DiminishedThird"):
    assertEquals(AugmentedSixth.invert, DiminishedThird)

  test("DiminishedOctave.invert is AugmentedUnison"):
    assertEquals(DiminishedOctave.invert, AugmentedUnison)

  test("AugmentedSeventh.invert is DiminishedSecond"):
    assertEquals(AugmentedSeventh.invert, DiminishedSecond)

  // --- invert: fallback branch (natural intervals) ---

  test("MinorSecond.invert is MajorSeventh"):
    assertEquals(MinorSecond.invert, MajorSeventh)

  test("MajorSecond.invert is MinorSeventh"):
    assertEquals(MajorSecond.invert, MinorSeventh)

  test("MinorThird.invert is MajorSixth"):
    assertEquals(MinorThird.invert, MajorSixth)

  test("MajorThird.invert is MinorSixth"):
    assertEquals(MajorThird.invert, MinorSixth)

  test("PerfectFourth.invert is PerfectFifth"):
    assertEquals(PerfectFourth.invert, PerfectFifth)

  test("Tritone.invert is Tritone"):
    assertEquals(Tritone.invert, Tritone)

  test("PerfectFifth.invert is PerfectFourth"):
    assertEquals(PerfectFifth.invert, PerfectFourth)

  test("MinorSixth.invert is MajorThird"):
    assertEquals(MinorSixth.invert, MajorThird)

  test("MajorSixth.invert is MinorThird"):
    assertEquals(MajorSixth.invert, MinorThird)

  test("MinorSeventh.invert is MajorSecond"):
    assertEquals(MinorSeventh.invert, MajorSecond)

  test("MajorSeventh.invert is MinorSecond"):
    assertEquals(MajorSeventh.invert, MinorSecond)

  test("PerfectOctave.invert is PerfectOctave"):
    assertEquals(PerfectOctave.invert, PerfectOctave)

  // --- Interval.apply factory ---

  test("Interval.apply returns correct intervals for all semitone values"):
    assertEquals(Interval(0), Some(PerfectUnison))
    assertEquals(Interval(1), Some(MinorSecond))
    assertEquals(Interval(2), Some(MajorSecond))
    assertEquals(Interval(3), Some(MinorThird))
    assertEquals(Interval(4), Some(MajorThird))
    assertEquals(Interval(5), Some(PerfectFourth))
    assertEquals(Interval(6), Some(Tritone))
    assertEquals(Interval(7), Some(PerfectFifth))
    assertEquals(Interval(8), Some(MinorSixth))
    assertEquals(Interval(9), Some(MajorSixth))
    assertEquals(Interval(10), Some(MinorSeventh))
    assertEquals(Interval(11), Some(MajorSeventh))
    assertEquals(Interval(12), Some(PerfectOctave))

  test("Interval.apply returns compound intervals"):
    assertEquals(Interval(13), Some(MinorNinth))
    assertEquals(Interval(14), Some(MajorNinth))
    assertEquals(Interval(15), Some(MinorTenth))
    assertEquals(Interval(16), Some(MajorTenth))
    assertEquals(Interval(17), Some(PerfectEleventh))
    assertEquals(Interval(19), Some(PerfectTwelfth))
    assertEquals(Interval(20), Some(MinorThirteenth))
    assertEquals(Interval(21), Some(MajorThirteenth))
    assertEquals(Interval(22), Some(MinorFourteenth))
    assertEquals(Interval(23), Some(MajorFourteenth))
    assertEquals(Interval(24), Some(DoubleOctave))

  test("Interval.apply returns None for invalid values"):
    assertEquals(Interval(-1), None)
    assertEquals(Interval(25), None)
    assertEquals(Interval(18), None)

  // --- normalizedValue ---

  test("normalizedValue wraps compound intervals to within octave"):
    assertEquals(MinorNinth.normalizedValue, 1)
    assertEquals(MajorNinth.normalizedValue, 2)
    assertEquals(PerfectEleventh.normalizedValue, 5)
    assertEquals(PerfectTwelfth.normalizedValue, 7)
    assertEquals(DoubleOctave.normalizedValue, 0)

  // --- Ordering ---

  test("Interval ordering compares by semitone value"):
    assert(Interval.intervalOrdering.compare(MinorSecond, MajorSecond) < 0)
    assert(Interval.intervalOrdering.compare(PerfectOctave, PerfectUnison) > 0)
    assert(Interval.intervalOrdering.compare(PerfectFifth, PerfectFifth) == 0)
