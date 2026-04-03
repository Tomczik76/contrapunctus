package contrapunctus.backend

import io.circe.{Json}
import io.circe.syntax._
import munit.ScalaCheckSuite
import org.scalacheck.{Arbitrary, Gen, Prop}
import contrapunctus.backend.domain.SharedSolution

import java.time.OffsetDateTime
import java.util.UUID

class SharedSolutionPropertySuite extends ScalaCheckSuite:

  private val genUUID: Gen[UUID] = Gen.delay(Gen.const(UUID.randomUUID()))

  private val genOffsetDateTime: Gen[OffsetDateTime] =
    Gen.const(OffsetDateTime.now())

  private val genSharedSolution: Gen[SharedSolution] = for
    attemptId   <- genUUID
    userId      <- genUUID
    displayName <- Gen.alphaNumStr.suchThat(_.nonEmpty)
    score       <- Gen.option(Gen.choose(BigDecimal(0), BigDecimal(100)))
    completed   <- Gen.oneOf(true, false)
    submittedAt <- Gen.option(genOffsetDateTime)
    upvoteCount <- Gen.choose(0, 1000)
    userUpvoted <- Gen.oneOf(true, false)
  yield SharedSolution(
    attemptId = attemptId,
    userId = userId,
    displayName = displayName,
    trebleBeats = Json.arr(),
    bassBeats = Json.arr(),
    studentRomans = Json.obj(),
    score = score,
    completed = completed,
    submittedAt = submittedAt,
    upvoteCount = upvoteCount,
    userUpvoted = userUpvoted
  )

  given Arbitrary[SharedSolution] = Arbitrary(genSharedSolution)

  property("SharedSolution JSON round-trip") {
    Prop.forAll { (sol: SharedSolution) =>
      import SharedSolution.given
      val json = sol.asJson
      val decoded = json.as[SharedSolution]
      decoded.isRight && decoded.toOption.get == sol
    }
  }
