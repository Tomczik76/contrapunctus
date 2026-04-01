package io.github.tomczik76.contrapunctus.rhythm

import org.scalacheck.Prop._
import org.scalacheck.{Arbitrary, Gen}

class RationalPropertySuite extends munit.ScalaCheckSuite:

  // Generator for non-zero rationals with bounded numerator/denominator
  val genRational: Gen[Rational] = for
    num <- Gen.choose(-1000L, 1000L)
    den <- Gen.choose(1L, 1000L)
  yield Rational(num, den)

  val genNonZeroRational: Gen[Rational] = for
    num <- Gen.choose(-1000L, 1000L).suchThat(_ != 0)
    den <- Gen.choose(1L, 1000L)
  yield Rational(num, den)

  given Arbitrary[Rational] = Arbitrary(genRational)

  // ── Addition ──

  property("addition is commutative") {
    forAll(genRational, genRational) { (a, b) =>
      assertEquals(a + b, b + a)
    }
  }

  property("addition is associative") {
    forAll(genRational, genRational, genRational) { (a, b, c) =>
      assertEquals((a + b) + c, a + (b + c))
    }
  }

  property("zero is additive identity") {
    forAll(genRational) { a =>
      assertEquals(a + Rational.zero, a)
      assertEquals(Rational.zero + a, a)
    }
  }

  property("a - a == zero") {
    forAll(genRational) { a =>
      assertEquals(a - a, Rational.zero)
    }
  }

  // ── Multiplication ──

  property("multiplication is commutative") {
    forAll(genRational, genRational) { (a, b) =>
      assertEquals(a * b, b * a)
    }
  }

  property("multiplication is associative") {
    forAll(genRational, genRational, genRational) { (a, b, c) =>
      assertEquals((a * b) * c, a * (b * c))
    }
  }

  property("one is multiplicative identity") {
    forAll(genRational) { a =>
      assertEquals(a * Rational.one, a)
      assertEquals(Rational.one * a, a)
    }
  }

  property("zero is multiplicative annihilator") {
    forAll(genRational) { a =>
      assertEquals(a * Rational.zero, Rational.zero)
    }
  }

  // ── Division ──

  property("a / a == one for non-zero a") {
    forAll(genNonZeroRational) { a =>
      assertEquals(a / a, Rational.one)
    }
  }

  property("(a * b) / b == a for non-zero b") {
    forAll(genRational, genNonZeroRational) { (a, b) =>
      assertEquals((a * b) / b, a)
    }
  }

  // ── Distributivity ──

  property("multiplication distributes over addition") {
    forAll(genRational, genRational, genRational) { (a, b, c) =>
      assertEquals(a * (b + c), a * b + a * c)
    }
  }

  // ── Ordering ──

  property("comparison is consistent with subtraction sign") {
    forAll(genRational, genRational) { (a, b) =>
      val cmp = a.compare(b)
      val diff = a - b
      assertEquals(cmp.sign, diff.compare(Rational.zero).sign)
    }
  }

  property("comparison is transitive") {
    forAll(genRational, genRational, genRational) { (a, b, c) =>
      if a <= b && b <= c then assert(a <= c)
    }
  }

  // ── Normalization ──

  property("denominator is always positive") {
    forAll(genRational) { a =>
      assert(a.den > 0, s"Expected positive denominator, got ${a.den}")
    }
  }

  property("num and den are coprime") {
    forAll(genRational) { a =>
      def gcd(x: Long, y: Long): Long = if y == 0 then x else gcd(y, x % y)
      assertEquals(gcd(Math.abs(a.num), a.den), 1L)
    }
  }

end RationalPropertySuite
