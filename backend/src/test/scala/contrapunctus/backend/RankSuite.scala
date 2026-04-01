package contrapunctus.backend

import contrapunctus.backend.domain.Rank
import org.scalacheck.Prop._
import org.scalacheck.Gen

class RankSuite extends munit.ScalaCheckSuite:

  // ── fromPoints ──

  property("fromPoints is monotonic: higher points → same or higher rank") {
    forAll(Gen.choose(0, 20000), Gen.choose(0, 20000)) { (a, b) =>
      val rankA = Rank.fromPoints(a)
      val rankB = Rank.fromPoints(b)
      val idxA  = Rank.Ladder.indexWhere(_._2 == rankA)
      val idxB  = Rank.Ladder.indexWhere(_._2 == rankB)
      // Ladder is sorted descending by points, so lower index = higher rank
      if a >= b then assert(idxA <= idxB, s"$a pts ($rankA, idx $idxA) should be >= rank than $b pts ($rankB, idx $idxB)")
    }
  }

  property("fromPoints always returns a valid rank name") {
    forAll(Gen.choose(0, 50000)) { points =>
      val rank = Rank.fromPoints(points)
      assert(Rank.Ladder.exists(_._2 == rank), s"Unknown rank: $rank")
    }
  }

  property("fromPoints for negative points returns Motif") {
    forAll(Gen.choose(-10000, -1)) { points =>
      assertEquals(Rank.fromPoints(points), "Motif")
    }
  }

  // ── nextThreshold ──

  property("nextThreshold returns threshold strictly above current points") {
    forAll(Gen.choose(0, 14999)) { points =>
      Rank.nextThreshold(points) match
        case Some((threshold, _)) => assert(threshold > points)
        case None                 => fail(s"Expected Some for $points pts")
    }
  }

  test("nextThreshold returns None at max rank") {
    assertEquals(Rank.nextThreshold(15000), None)
    assertEquals(Rank.nextThreshold(99999), None)
  }

  // ── difficultyPoints ──

  test("difficultyPoints returns expected values") {
    assertEquals(Rank.difficultyPoints("beginner"), 10)
    assertEquals(Rank.difficultyPoints("intermediate"), 15)
    assertEquals(Rank.difficultyPoints("advanced"), 25)
    assertEquals(Rank.difficultyPoints("expert"), 40)
  }

  test("difficultyPoints defaults to 10 for unknown difficulty") {
    assertEquals(Rank.difficultyPoints("unknown"), 10)
    assertEquals(Rank.difficultyPoints(""), 10)
  }

  property("difficultyPoints is always positive") {
    forAll(Gen.alphaNumStr) { diff =>
      assert(Rank.difficultyPoints(diff) > 0)
    }
  }

  // ── inferDifficulty ──

  property("inferDifficulty always returns a valid difficulty") {
    val validDifficulties = Set("beginner", "intermediate", "advanced", "expert")
    forAll(Gen.choose(BigDecimal(0), BigDecimal(1)), Gen.choose(0, 100)) { (rate, count) =>
      val diff = Rank.inferDifficulty(rate, count)
      assert(validDifficulties.contains(diff), s"Invalid difficulty: $diff for rate=$rate, count=$count")
    }
  }

  property("inferDifficulty returns intermediate for fewer than 5 attempts") {
    forAll(Gen.choose(BigDecimal(0), BigDecimal(1)), Gen.choose(0, 4)) { (rate, count) =>
      assertEquals(Rank.inferDifficulty(rate, count), "intermediate")
    }
  }

  property("inferDifficulty: higher completion rate → easier difficulty (with enough attempts)") {
    val validOrder = List("beginner", "intermediate", "advanced", "expert")
    forAll(Gen.choose(BigDecimal(0), BigDecimal(1)), Gen.choose(BigDecimal(0), BigDecimal(1)), Gen.choose(5, 100)) { (rateA, rateB, count) =>
      val diffA = Rank.inferDifficulty(rateA, count)
      val diffB = Rank.inferDifficulty(rateB, count)
      if rateA >= rateB then
        assert(
          validOrder.indexOf(diffA) <= validOrder.indexOf(diffB),
          s"Rate $rateA ($diffA) should be easier or equal to rate $rateB ($diffB)"
        )
    }
  }

end RankSuite
