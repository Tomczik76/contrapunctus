import Interval.* 

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