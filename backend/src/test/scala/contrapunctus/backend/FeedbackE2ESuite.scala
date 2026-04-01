package contrapunctus.backend

import cats.effect.IO
import com.dimafeng.testcontainers.PostgreSQLContainer
import com.dimafeng.testcontainers.munit.TestContainerForAll
import io.circe.Json
import io.circe.syntax._
import munit.CatsEffectSuite
import org.http4s._
import org.http4s.circe.CirceEntityCodec._
import org.http4s.implicits._

class FeedbackE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  import TestApp.authHeader

  // ── Bug Reports ──

  test("submit bug report returns 201") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "bug@test.com", "BugReporter")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/bug-reports")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj(
                "description" -> "The editor crashes when I add a note".asJson,
                "stateJson"   -> Json.obj("page" -> "editor".asJson, "action" -> "addNote".asJson)
              ))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Created)
          assert(body.hcursor.get[String]("id").isRight)
          assertEquals(body.hcursor.get[String]("description"), Right("The editor crashes when I add a note"))
      }
    }
  }

  test("bug report requires auth") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/bug-reports")
              .withEntity(Json.obj("description" -> "test".asJson, "stateJson" -> Json.obj()))
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  test("bug report validates description required") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "bugval@test.com", "BugVal")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/bug-reports")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("description" -> "".asJson, "stateJson" -> Json.obj()))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assertEquals(body.hcursor.get[String]("error"), Right("description is required"))
      }
    }
  }

  // ── Feature Requests ──

  test("submit feature request returns 201") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "feature@test.com", "FeatureReq")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/feature-requests")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("description" -> "Add dark mode".asJson))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Created)
          assert(body.hcursor.get[String]("id").isRight)
          assertEquals(body.hcursor.get[String]("description"), Right("Add dark mode"))
      }
    }
  }

  test("feature request requires auth") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/feature-requests")
              .withEntity(Json.obj("description" -> "test".asJson))
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  test("feature request validates description required") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "frval@test.com", "FRVal")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/feature-requests")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("description" -> "".asJson))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  // ── Corrections ──

  private val sampleCorrection = Json.obj(
    "category"            -> "chord_label".asJson,
    "measure"             -> 3.asJson,
    "beat"                -> 1.asJson,
    "voice"               -> "soprano".asJson,
    "currentAnalysis"     -> Json.obj("label" -> "V".asJson),
    "suggestedCorrection" -> Json.obj("label" -> "V7".asJson),
    "description"         -> "Should be V7 not V".asJson,
    "stateSnapshot"       -> Json.obj("page" -> "analysis".asJson)
  )

  test("submit correction returns 201") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "corr@test.com", "Corrector")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token))
              .withEntity(sampleCorrection)
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Created)
          assertEquals(body.hcursor.get[String]("category"), Right("chord_label"))
          assertEquals(body.hcursor.get[Int]("measure"), Right(3))
          assertEquals(body.hcursor.get[String]("status"), Right("pending"))
      }
    }
  }

  test("correction validates category enum") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "corrval@test.com", "CorrVal")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token))
              .withEntity(sampleCorrection.mapObject(_.add("category", "invalid_category".asJson)))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("correction requires auth") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .withEntity(sampleCorrection)
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  test("list corrections") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "corrlist@test.com", "CorrList")

          _ <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token))
              .withEntity(sampleCorrection)
          )
          _ <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token))
              .withEntity(sampleCorrection.mapObject(_.add("category", "nct_detection".asJson)))
          )

          // List all
          allResp <- app.run(Request[IO](Method.GET, uri"/api/corrections"))
          allBody <- allResp.as[Json]
          _ = assertEquals(allResp.status, Status.Ok)
          _ = assert(allBody.asArray.get.size >= 2)

          // Filter by category
          filtResp <- app.run(Request[IO](Method.GET, uri"/api/corrections?category=chord_label"))
          filtBody <- filtResp.as[Json]
          _ = assertEquals(filtResp.status, Status.Ok)
          filtered = filtBody.asArray.get
          _ = assert(filtered.forall(_.hcursor.get[String]("category").toOption.get == "chord_label"))

          // Filter by status
          statusResp <- app.run(Request[IO](Method.GET, uri"/api/corrections?status=pending"))
          statusBody <- statusResp.as[Json]
        yield
          assertEquals(statusResp.status, Status.Ok)
          assert(statusBody.asArray.get.nonEmpty)
      }
    }
  }

  test("list corrections validates filter enums") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(Request[IO](Method.GET, uri"/api/corrections?status=bogus"))
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("get correction by id") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "corrget@test.com", "CorrGet")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token))
              .withEntity(sampleCorrection)
          )
          createBody <- createResp.as[Json]
          corrId = createBody.hcursor.get[String]("id").toOption.get

          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/corrections/$corrId"))
          )
          getBody <- getResp.as[Json]
        yield
          assertEquals(getResp.status, Status.Ok)
          assertEquals(getBody.hcursor.get[String]("category"), Right("chord_label"))
      }
    }
  }

  test("get nonexistent correction returns 404") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.GET, uri"/api/corrections/00000000-0000-0000-0000-000000000099")
          )
        yield assertEquals(resp.status, Status.NotFound)
      }
    }
  }

  test("vote on correction") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "corrvote1@test.com", "CorrVote1")
          (token2, _) <- TestApp.signup(app, "corrvote2@test.com", "CorrVote2")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token1))
              .withEntity(sampleCorrection)
          )
          createBody <- createResp.as[Json]
          corrId = createBody.hcursor.get[String]("id").toOption.get

          // Vote up
          voteResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/corrections/$corrId/vote"))
              .putHeaders(authHeader(token2))
              .withEntity(Json.obj("vote" -> "up".asJson))
          )
          _ = assertEquals(voteResp.status, Status.Ok)

          // Verify upvotes increased
          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/corrections/$corrId"))
          )
          getBody <- getResp.as[Json]
        yield
          assertEquals(getBody.hcursor.get[Int]("upvotes"), Right(1))
      }
    }
  }

  test("vote validates vote value") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "corrbadvote@test.com", "CorrBadVote")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token))
              .withEntity(sampleCorrection)
          )
          createBody <- createResp.as[Json]
          corrId = createBody.hcursor.get[String]("id").toOption.get

          resp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/corrections/$corrId/vote"))
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("vote" -> "invalid".asJson))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  // ── Roadmap Votes ──

  test("get and toggle roadmap votes") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "roadmap@test.com", "RoadmapVoter")

          // Get initial votes
          getResp <- app.run(
            Request[IO](Method.GET, uri"/api/roadmap-votes")
              .putHeaders(authHeader(token))
          )
          getBody <- getResp.as[Json]
          _ = assertEquals(getResp.status, Status.Ok)
          _ = assert(getBody.hcursor.downField("counts").focus.isDefined)
          _ = assert(getBody.hcursor.downField("userVotes").focus.isDefined)

          // Vote for a feature
          voteResp <- app.run(
            Request[IO](Method.POST, uri"/api/roadmap-votes/lms_integration")
              .putHeaders(authHeader(token))
          )
          voteBody <- voteResp.as[Json]
          _ = assertEquals(voteResp.status, Status.Ok)
          _ = assertEquals(voteBody.hcursor.get[Boolean]("voted"), Right(true))

          // Toggle off
          toggleResp <- app.run(
            Request[IO](Method.POST, uri"/api/roadmap-votes/lms_integration")
              .putHeaders(authHeader(token))
          )
          toggleBody <- toggleResp.as[Json]
        yield
          assertEquals(toggleResp.status, Status.Ok)
          assertEquals(toggleBody.hcursor.get[Boolean]("voted"), Right(false))
      }
    }
  }

  test("roadmap votes require auth") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(Request[IO](Method.GET, uri"/api/roadmap-votes"))
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }
