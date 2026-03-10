package io.github.tomczik76.contrapunctus

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

end RationalSuite
