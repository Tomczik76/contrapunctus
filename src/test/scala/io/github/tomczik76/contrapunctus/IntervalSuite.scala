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
