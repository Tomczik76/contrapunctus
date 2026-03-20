package io.github.tomczik76.contrapunctus.rhythm

class RationalSuite extends munit.FunSuite:

  test("normalization"):
    assertEquals(Rational(2, 4), Rational(1, 2))
    assertEquals(Rational(6, 9), Rational(2, 3))

  test("negative denominator normalized"):
    assertEquals(Rational(1, -2), Rational(-1, 2))

  test("arithmetic"):
    assertEquals(Rational(1, 3) + Rational(1, 6), Rational(1, 2))
    assertEquals(Rational(1, 2) - Rational(1, 3), Rational(1, 6))
    assertEquals(Rational(2, 3) * Rational(3, 4), Rational(1, 2))
    assertEquals(Rational(1, 2) / Rational(3, 1), Rational(1, 6))

  test("ordering"):
    assert(Rational(1, 3) < Rational(1, 2))
    assert(Rational(2, 3) > Rational(1, 2))
    assert(Rational(1, 2) == Rational(2, 4))

  test("zero and one"):
    assertEquals(Rational.zero, Rational(0, 1))
    assertEquals(Rational.one, Rational(1, 1))

  test("toString — whole number omits denominator"):
    assertEquals(Rational(3, 1).toString, "3")

  test("toString — fraction shows numerator/denominator"):
    assertEquals(Rational(1, 3).toString, "1/3")

  test("division by zero throws"):
    interceptMessage[IllegalArgumentException]("requirement failed: Division by zero"):
      Rational(1, 2) / Rational(0)

  test("zero denominator throws"):
    interceptMessage[IllegalArgumentException]("requirement failed: Denominator must not be zero"):
      Rational(1, 0)

end RationalSuite
