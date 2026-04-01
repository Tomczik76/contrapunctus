package contrapunctus.backend

import contrapunctus.backend.routes.Validation
import io.circe.Json
import org.scalacheck.Prop._
import org.scalacheck.Gen

class ValidationSuite extends munit.ScalaCheckSuite:

  // ── tooLong(String) ──

  property("tooLong(s, max) iff s.length > max") {
    forAll(Gen.alphaNumStr, Gen.choose(0, 500)) { (s, max) =>
      assertEquals(Validation.tooLong(s, max), s.length > max)
    }
  }

  // ── tooLong(Option[String]) ──

  property("tooLong(None, max) is always false") {
    forAll(Gen.choose(0, 500)) { max =>
      assertEquals(Validation.tooLong(None, max), false)
    }
  }

  property("tooLong(Some(s), max) iff s.length > max") {
    forAll(Gen.alphaNumStr, Gen.choose(0, 500)) { (s, max) =>
      assertEquals(Validation.tooLong(Some(s), max), s.length > max)
    }
  }

  // ── notIn ──

  property("notIn(s, set) iff !set.contains(s)") {
    val genSet = Gen.containerOf[Set, String](Gen.alphaLowerStr.suchThat(_.nonEmpty))
    forAll(Gen.alphaLowerStr, genSet) { (s, set) =>
      assertEquals(Validation.notIn(s, set), !set.contains(s))
    }
  }

  property("notIn returns false for every element in the set") {
    val genSet = Gen.nonEmptyContainerOf[Set, String](Gen.alphaLowerStr.suchThat(_.nonEmpty))
    forAll(genSet) { set =>
      set.foreach { s =>
        assertEquals(Validation.notIn(s, set), false, s"$s should be found in $set")
      }
    }
  }

  // ── outOfRange ──

  property("outOfRange(n, min, max) iff n < min || n > max") {
    forAll(Gen.choose(-1000, 1000), Gen.choose(-500, 0), Gen.choose(0, 500)) { (n, min, max) =>
      assertEquals(Validation.outOfRange(n, min, max), n < min || n > max)
    }
  }

  property("outOfRange is false for values at boundaries") {
    forAll(Gen.choose(-500, 500)) { bound =>
      assertEquals(Validation.outOfRange(bound, bound, bound), false)
    }
  }

  // ── jsonTooBig ──

  property("jsonTooBig is consistent with serialized size") {
    forAll(Gen.alphaNumStr) { s =>
      val j = Json.fromString(s)
      assertEquals(Validation.jsonTooBig(j, 100), j.noSpaces.length > 100)
    }
  }

  // ── Enum sets are non-empty and match expectations ──

  test("all enum sets are non-empty") {
    assert(Validation.CorrectionCategories.nonEmpty)
    assert(Validation.CorrectionStatuses.nonEmpty)
    assert(Validation.ClassStatuses.nonEmpty)
    assert(Validation.Difficulties.nonEmpty)
    assert(Validation.Templates.nonEmpty)
    assert(Validation.ScaleNames.nonEmpty)
    assert(Validation.VoteValues.nonEmpty)
  }

  test("ClassStatuses contains active and archived (matching DB constraint)") {
    assertEquals(Validation.ClassStatuses, Set("active", "archived"))
  }

end ValidationSuite
