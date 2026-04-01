package io.github.tomczik76.contrapunctus.harmony

import cats.data.NonEmptyList
import io.github.tomczik76.contrapunctus.core.Interval
import org.scalacheck.Prop._
import org.scalacheck.Gen

class ChordTypePropertySuite extends munit.ScalaCheckSuite:

  val allBaseTypes: List[InvertibleChordType] =
    Triads.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      Sevenths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      Ninths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      AddNinths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      AddElevenths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      Elevenths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      Thirteenths.allBaseTypes.collect { case t: InvertibleChordType => t } ++
      AlteredChords.allBaseTypes.collect { case t: InvertibleChordType => t }

  val genBaseType: Gen[InvertibleChordType] = Gen.oneOf(allBaseTypes)

  // ── Property 1: inversion cycle preserves pitch class set ──
  // All inversions should normalize to the same pitch class set as root position.

  property("all inversions share the same normalized pitch class set") {
    forAll(genBaseType) { baseType =>
      val rootPCs = baseType.rootIntervals.map(_.normalizedValue).toSortedSet
      baseType.allInversions.foreach: inv =>
        val rootOffset = inv.rootInterval.normalizedValue
        val pcs = inv.intervals
          .map(i => (i.normalizedValue - rootOffset + 12) % 12)
          .toSortedSet
        assertEquals(
          pcs, rootPCs,
          s"${baseType.productPrefix} ${inv}: normalized PCs $pcs != root PCs $rootPCs"
        )
    }
  }

  // ── Property 2: root position always starts with PerfectUnison ──

  property("root position intervals always contain PerfectUnison") {
    forAll(genBaseType) { baseType =>
      assert(
        baseType.rootIntervals.contains(Interval.PerfectUnison),
        s"${baseType.productPrefix} root intervals lack PerfectUnison: ${baseType.rootIntervals}"
      )
    }
  }

  // ── Property 3: ChordType.invert preserves interval count ──

  property("ChordType.invert preserves the number of intervals") {
    forAll(genBaseType) { baseType =>
      val rootList = baseType.rootIntervals.toNonEmptyList
      val inverted = ChordType.invert(rootList)
      assertEquals(
        inverted.size, rootList.size,
        s"${baseType.productPrefix}: invert changed interval count from ${rootList.size} to ${inverted.size}"
      )
    }
  }

  // ── Property 4: inversion always starts with PerfectUnison ──

  property("ChordType.invert always produces PerfectUnison as first interval") {
    forAll(genBaseType) { baseType =>
      val rootList = baseType.rootIntervals.toNonEmptyList
      val inverted = ChordType.invert(rootList)
      assertEquals(
        inverted.head, Interval.PerfectUnison,
        s"${baseType.productPrefix}: inverted intervals don't start with PerfectUnison: $inverted"
      )
    }
  }

  // ── Property 5: figured bass is non-null for all inversions ──

  property("figuredBass is defined for every inversion") {
    forAll(genBaseType) { baseType =>
      baseType.allInversions.zipWithIndex.foreach: (inv, idx) =>
        val fb = inv.figuredBass
        assert(
          fb != null,
          s"${baseType.productPrefix} inversion $idx has null figuredBass"
        )
    }
  }

  // ── Property 6: inversions have strictly increasing ordinals ──

  property("inversion ordinals are sequential from 0") {
    forAll(genBaseType) { baseType =>
      baseType.allInversions.zipWithIndex.foreach: (inv, idx) =>
        assertEquals(
          inv.ordinal, idx,
          s"${baseType.productPrefix} inversion $idx has ordinal ${inv.ordinal}"
        )
    }
  }

  // ── Property 7: ChordType.invert is an N-cycle ──
  // Applying invert N times (N = number of pitch classes) returns to the
  // same normalized pitch class set as the original.

  property("inverting N times cycles back to the original pitch class set") {
    forAll(genBaseType) { baseType =>
      val rootList = baseType.rootIntervals.toNonEmptyList
      val n = baseType.rootIntervals.map(_.normalizedValue).toSortedSet.size
      val cycled = Iterator.iterate(rootList)(ChordType.invert).drop(n).next()
      val originalPCs = rootList.toList.map(_.normalizedValue).toSet
      val cycledPCs   = cycled.toList.map(_.normalizedValue).toSet
      assertEquals(
        cycledPCs, originalPCs,
        s"${baseType.productPrefix}: after $n inversions, PCs $cycledPCs != original $originalPCs"
      )
    }
  }

end ChordTypePropertySuite
