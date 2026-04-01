package io.github.tomczik76.contrapunctus.rhythm

import cats.data.NonEmptyList
import org.scalacheck.Prop._
import org.scalacheck.Gen

class PulsePropertySuite extends munit.ScalaCheckSuite:

  // Generate Pulse[Int] trees of bounded depth
  def genPulse(maxDepth: Int): Gen[Pulse[Int]] =
    if maxDepth <= 0 then genLeaf
    else Gen.frequency(
      3 -> genLeaf,
      1 -> genDuplet(maxDepth - 1),
      1 -> genTriplet(maxDepth - 1)
    )

  val genLeaf: Gen[Pulse[Int]] = Gen.frequency(
    4 -> Gen.choose(0, 100).map(n => Pulse.Atom(NonEmptyList.one(n))),
    1 -> Gen.const(Pulse.Rest)
  )

  def genDuplet(depth: Int): Gen[Pulse[Int]] = for
    a <- genPulse(depth)
    b <- genPulse(depth)
  yield Pulse.Duplet(a, b)

  def genTriplet(depth: Int): Gen[Pulse[Int]] = for
    a <- genPulse(depth)
    b <- genPulse(depth)
    c <- genPulse(depth)
  yield Pulse.Triplet(a, b, c)

  val genSmallPulse: Gen[Pulse[Int]] = genPulse(2)

  /** Count total atoms (non-Rest leaves) in a Pulse tree. */
  private def atomCount[A](p: Pulse[A]): Int =
    Pulse.flatten(p).size

  /** Structural equality that handles covariant Rest correctly. */
  private def structEqual(a: Pulse[Int], b: Pulse[Int]): Boolean =
    (a, b) match
      case (Pulse.Rest, Pulse.Rest)           => true
      case (Pulse.Atom(x), Pulse.Atom(y))     => x == y
      case (Pulse.Duplet(a1, a2), Pulse.Duplet(b1, b2)) =>
        structEqual(a1, b1) && structEqual(a2, b2)
      case (Pulse.Triplet(a1, a2, a3), Pulse.Triplet(b1, b2, b3)) =>
        structEqual(a1, b1) && structEqual(a2, b2) && structEqual(a3, b3)
      case (Pulse.Quintuplet(a1, a2, a3, a4, a5), Pulse.Quintuplet(b1, b2, b3, b4, b5)) =>
        structEqual(a1, b1) && structEqual(a2, b2) && structEqual(a3, b3) &&
          structEqual(a4, b4) && structEqual(a5, b5)
      case (Pulse.Septuplet(a1, a2, a3, a4, a5, a6, a7), Pulse.Septuplet(b1, b2, b3, b4, b5, b6, b7)) =>
        structEqual(a1, b1) && structEqual(a2, b2) && structEqual(a3, b3) &&
          structEqual(a4, b4) && structEqual(a5, b5) && structEqual(a6, b6) && structEqual(a7, b7)
      case _ => false

  // ── Functor law 1: map(identity) preserves structure ──

  property("map(identity) preserves structure") {
    forAll(genSmallPulse) { pulse =>
      assert(
        structEqual(pulse.map(identity), pulse),
        s"map(identity) changed structure of $pulse"
      )
    }
  }

  // ── Functor law 2: map composition ──

  property("map(f).map(g) == map(f andThen g)") {
    val f: Int => Int = _ + 1
    val g: Int => Int = _ * 2
    forAll(genSmallPulse) { pulse =>
      val composed = pulse.map(f andThen g)
      val chained  = pulse.map(f).map(g)
      assert(
        structEqual(composed, chained),
        s"Functor composition law violated for $pulse"
      )
    }
  }

  // ── flatten preserves atom count through map ──

  property("map preserves atom count") {
    forAll(genSmallPulse) { pulse =>
      val before = atomCount(pulse)
      val after  = atomCount(pulse.map(_ + 1))
      assertEquals(after, before, s"map changed atom count for $pulse")
    }
  }

  // ── timed: time spans are contiguous ──

  property("timed spans are contiguous (each end == next start)") {
    forAll(genSmallPulse) { pulse =>
      val spans = Pulse.timed(pulse)
      spans.zip(spans.drop(1)).foreach: (current, next) =>
        assertEquals(
          current._2, next._1,
          s"Gap between spans: ${current._2} != ${next._1}"
        )
    }
  }

  // ── timed: total coverage [0, 1) ──

  property("timed covers [0, 1): starts at 0, ends at 1") {
    forAll(genSmallPulse) { pulse =>
      val spans = Pulse.timed(pulse)
      if spans.nonEmpty then
        assertEquals(spans.head._1, Rational.zero, "First span should start at 0")
        assertEquals(spans.last._2, Rational.one, "Last span should end at 1")
    }
  }

  // ── timed: atom count matches flatten ──

  property("timed Some entries match flatten count") {
    forAll(genSmallPulse) { pulse =>
      val timedAtoms = Pulse.timed(pulse).count(_._3.isDefined)
      val flatAtoms  = Pulse.flatten(pulse).size
      assertEquals(
        timedAtoms, flatAtoms,
        s"timed has $timedAtoms atoms but flatten has $flatAtoms"
      )
    }
  }

  // ── timed: all spans have positive duration ──

  property("every timed span has positive duration") {
    forAll(genSmallPulse) { pulse =>
      Pulse.timed(pulse).foreach: (start, end, _) =>
        assert(
          start < end,
          s"Non-positive span: [$start, $end)"
        )
    }
  }

  // ── align: all voices present at every column ──

  property("align produces columns with entries for every voice") {
    val genVoices = for
      n <- Gen.choose(1, 3)
      voices <- Gen.listOfN(n, genSmallPulse)
    yield voices.toIndexedSeq

    forAll(genVoices) { voices =>
      val columns = Pulse.align(voices)
      columns.foreach: col =>
        assertEquals(
          col.values.size, voices.size,
          s"Column at t=${col.time} has ${col.values.size} entries but expected ${voices.size}"
        )
    }
  }

end PulsePropertySuite
