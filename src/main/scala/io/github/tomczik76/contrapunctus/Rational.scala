package io.github.tomczik76.contrapunctus

/** Minimal rational number type for exact fractional time positions.
  * Used by Pulse.align to compute subdivision boundaries without
  * floating-point imprecision. Denominators in practice are products
  * of small primes (2, 3, 5, 7) from Pulse subdivision factors.
  */
case class Rational private (num: Long, den: Long)
    extends Ordered[Rational]:
  require(den > 0, "Denominator must be positive")

  def +(that: Rational): Rational =
    Rational(num * that.den + that.num * den, den * that.den)

  def -(that: Rational): Rational =
    Rational(num * that.den - that.num * den, den * that.den)

  def *(that: Rational): Rational =
    Rational(num * that.num, den * that.den)

  def /(that: Rational): Rational =
    require(that.num != 0, "Division by zero")
    Rational(num * that.den, den * that.num)

  def compare(that: Rational): Int =
    (num * that.den).compareTo(that.num * den)

  override def toString: String =
    if den == 1 then s"$num" else s"$num/$den"

object Rational:
  def apply(num: Long, den: Long): Rational =
    require(den != 0, "Denominator must not be zero")
    val sign = if den < 0 then -1 else 1
    val g    = gcd(Math.abs(num), Math.abs(den))
    new Rational(sign * num / g, sign * den / g)

  def apply(n: Int): Rational = new Rational(n.toLong, 1L)

  val zero: Rational = Rational(0)
  val one: Rational  = Rational(1)

  given Ordering[Rational] = (a, b) => a.compare(b)

  private def gcd(a: Long, b: Long): Long =
    if b == 0 then a else gcd(b, a % b)
