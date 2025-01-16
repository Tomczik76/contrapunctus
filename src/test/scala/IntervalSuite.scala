import Interval.*
import cats.data.NonEmptySet

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
