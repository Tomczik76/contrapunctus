package io.github.tomczik76.contrapunctus.core

import cats.Order
import org.scalacheck.Prop._
import org.scalacheck.Gen

class ScaleDegreePropertySuite extends munit.ScalaCheckSuite:

  val genAlteration: Gen[Alteration] = Gen.oneOf(Alteration.values.toList)
  val genScaleDegree: Gen[ScaleDegree] = Gen.oneOf(ScaleDegree.values.toList)
  val genSemitones: Gen[Int] = Gen.oneOf(-2, -1, 0, 1, 2)

  val genAlteredScaleDegree: Gen[AlteredScaleDegree] = for
    degree     <- genScaleDegree
    alteration <- genAlteration
  yield AlteredScaleDegree(degree, alteration)

  // ── Alteration round-trip ──

  property("unsafeApply(alteration.semitones) recovers the original alteration") {
    forAll(genAlteration) { alt =>
      assertEquals(
        Alteration.unsafeApply(alt.semitones), alt,
        s"Round-trip failed for $alt (semitones=${alt.semitones})"
      )
    }
  }

  // ── Alteration semitone bounds ──

  property("alteration semitones are always in [-2, 2]") {
    forAll(genAlteration) { alt =>
      assert(
        alt.semitones >= -2 && alt.semitones <= 2,
        s"$alt has semitones ${alt.semitones} outside [-2, 2]"
      )
    }
  }

  // ── Alteration semitone uniqueness ──

  property("each alteration maps to a unique semitone value") {
    val semitoneMap = Alteration.values.groupBy(_.semitones)
    semitoneMap.foreach: (semitones, alts) =>
      assertEquals(
        alts.size, 1,
        s"Semitone $semitones maps to multiple alterations: ${alts.mkString(", ")}"
      )
  }

  // ── unsafeApply rejects invalid values ──

  property("unsafeApply throws for values outside [-2, 2]") {
    forAll(Gen.choose(-100, 100).suchThat(v => v < -2 || v > 2)) { v =>
      val threw = try { Alteration.unsafeApply(v); false } catch { case _: IllegalArgumentException => true }
      assert(threw, s"unsafeApply($v) should have thrown IllegalArgumentException")
    }
  }

  // ── ScaleDegree ordinals are sequential 0-6 ──

  property("ScaleDegree ordinals cover [0, 6]") {
    forAll(genScaleDegree) { degree =>
      assert(
        degree.ordinal >= 0 && degree.ordinal <= 6,
        s"$degree has ordinal ${degree.ordinal}"
      )
    }
  }

  // ── AlteredScaleDegree ordering transitivity ──

  property("AlteredScaleDegree ordering is transitive") {
    forAll(genAlteredScaleDegree, genAlteredScaleDegree, genAlteredScaleDegree) {
      (a, b, c) =>
        val ord = summon[Order[AlteredScaleDegree]]
        if ord.lteqv(a, b) && ord.lteqv(b, c) then
          assert(
            ord.lteqv(a, c),
            s"Transitivity violated: $a <= $b && $b <= $c but $a > $c"
          )
    }
  }

  // ── AlteredScaleDegree ordering antisymmetry ──

  property("AlteredScaleDegree ordering is antisymmetric") {
    forAll(genAlteredScaleDegree, genAlteredScaleDegree) { (a, b) =>
      val ord = summon[Order[AlteredScaleDegree]]
      if ord.lteqv(a, b) && ord.lteqv(b, a) then
        assertEquals(
          ord.compare(a, b), 0,
          s"Antisymmetry violated: $a <= $b && $b <= $a but compare != 0"
        )
    }
  }

  // ── Alteration ordering matches semitone ordering ──

  property("sharper alteration has higher semitone value") {
    forAll(genAlteration, genAlteration) { (a, b) =>
      assertEquals(
        a.semitones.compareTo(b.semitones).sign,
        a.ordinal.compareTo(b.ordinal).sign,
        s"$a (semitones=${a.semitones}) vs $b (semitones=${b.semitones})"
      )
    }
  }

end ScaleDegreePropertySuite
