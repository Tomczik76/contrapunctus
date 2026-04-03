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

class CommunityE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  import TestApp.authHeader

  private val sampleExercise = Json.obj(
    "title"       -> "Test Exercise".asJson,
    "description" -> "A test exercise".asJson,
    "template"    -> "harmonize_melody".asJson,
    "tonicIdx"    -> 0.asJson,
    "scaleName"   -> "major".asJson,
    "tsTop"       -> 4.asJson,
    "tsBottom"    -> 4.asJson,
    "sopranoBeats" -> Json.arr(),
    "tags"        -> List("test").asJson
  )

  test("create exercise returns 201") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "creator@test.com", "Creator")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Created)
          assertEquals(body.hcursor.get[String]("title"), Right("Test Exercise"))
          assertEquals(body.hcursor.get[String]("status"), Right("draft"))
      }
    }
  }

  test("create exercise without auth returns 403") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .withEntity(sampleExercise)
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  test("create exercise validates title required") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "val@test.com", "Validator")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise.mapObject(_.add("title", "".asJson)))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assertEquals(body.hcursor.get[String]("error"), Right("title is required"))
      }
    }
  }

  test("create exercise validates template") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "val2@test.com", "Validator2")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise.mapObject(_.add("template", "invalid".asJson)))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assert(body.hcursor.get[String]("error").toOption.get.contains("template"))
      }
    }
  }

  test("list published exercises (empty initially)") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(Request[IO](Method.GET, uri"/api/community/exercises"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assertEquals(body, Json.arr())
      }
    }
  }

  test("publish exercise then list it") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "pub@test.com", "Publisher")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get

          pubResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(token))
          )
          pubBody <- pubResp.as[Json]
          _ = assertEquals(pubResp.status, Status.Ok)
          _ = assertEquals(pubBody.hcursor.get[String]("status"), Right("published"))

          listResp <- app.run(Request[IO](Method.GET, uri"/api/community/exercises"))
          listBody <- listResp.as[Json]
        yield
          assertEquals(listResp.status, Status.Ok)
          val exercises = listBody.asArray.get
          assertEquals(exercises.size, 1)
          assertEquals(exercises.head.hcursor.get[String]("title"), Right("Test Exercise"))
      }
    }
  }

  test("get exercise by id") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "getbyid@test.com", "GetById")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get

          getResp <- app.run(Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId")))
          getBody <- getResp.as[Json]
        yield
          assertEquals(getResp.status, Status.Ok)
          assertEquals(getBody.hcursor.get[String]("title"), Right("Test Exercise"))
      }
    }
  }

  test("get nonexistent exercise returns 404") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(Request[IO](Method.GET, uri"/api/community/exercises/00000000-0000-0000-0000-000000000001"))
        yield assertEquals(resp.status, Status.NotFound)
      }
    }
  }

  test("list my exercises") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "mine@test.com", "Mine")
          _ <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          _ <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise.mapObject(_.add("title", "Second".asJson)))
          )

          resp <- app.run(
            Request[IO](Method.GET, uri"/api/community/exercises/mine")
              .putHeaders(authHeader(token))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assertEquals(body.asArray.get.size, 2)
      }
    }
  }

  test("delete exercise hides it from my list") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "del@test.com", "Deleter")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get

          delResp <- app.run(
            Request[IO](Method.DELETE, Uri.unsafeFromString(s"/api/community/exercises/$exId"))
              .putHeaders(authHeader(token))
          )
          _ = assertEquals(delResp.status, Status.Ok)

          listResp <- app.run(
            Request[IO](Method.GET, uri"/api/community/exercises/mine")
              .putHeaders(authHeader(token))
          )
          listBody <- listResp.as[Json]
        yield assertEquals(listBody.asArray.get.size, 0)
      }
    }
  }

  test("update draft exercise") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "upd@test.com", "Updater")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get

          updResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId"))
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise.mapObject(_.add("title", "Updated Title".asJson)))
          )
          updBody <- updResp.as[Json]
        yield
          assertEquals(updResp.status, Status.Ok)
          assertEquals(updBody.hcursor.get[String]("title"), Right("Updated Title"))
      }
    }
  }

  test("vote on exercise") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "voter_creator@test.com", "VCreator")
          (token2, _) <- TestApp.signup(app, "voter@test.com", "Voter")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token1))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(token1))
          )

          voteResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/vote"))
              .putHeaders(authHeader(token2))
              .withEntity(Json.obj("vote" -> "up".asJson))
          )
          _ = assertEquals(voteResp.status, Status.Ok)

          getVoteResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/vote"))
              .putHeaders(authHeader(token2))
          )
          voteBody <- getVoteResp.as[Json]
          _ = assertEquals(voteBody.hcursor.get[String]("vote"), Right("up"))

          exResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId"))
          )
          exBody <- exResp.as[Json]
        yield assertEquals(exBody.hcursor.get[Int]("upvotes"), Right(1))
      }
    }
  }

  test("toggle vote off") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "tog_creator@test.com", "TogCreator")
          (token2, _) <- TestApp.signup(app, "toggler@test.com", "Toggler")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token1))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(token1))
          )

          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/vote"))
              .putHeaders(authHeader(token2))
              .withEntity(Json.obj("vote" -> "up".asJson))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/vote"))
              .putHeaders(authHeader(token2))
              .withEntity(Json.obj("vote" -> "up".asJson))
          )

          getVoteResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/vote"))
              .putHeaders(authHeader(token2))
          )
          voteBody <- getVoteResp.as[Json]
        yield
          assert(voteBody.hcursor.get[String]("vote").isLeft || voteBody.hcursor.downField("vote").focus.contains(Json.Null))
      }
    }
  }

  test("save and retrieve attempt") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "att_creator@test.com", "AttCreator")
          (token2, _) <- TestApp.signup(app, "attempter@test.com", "Attempter")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token1))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(token1))
          )

          saveResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(token2))
              .withEntity(Json.obj(
                "trebleBeats"   -> Json.arr(),
                "bassBeats"     -> Json.arr(),
                "studentRomans" -> Json.obj()
              ))
          )
          _ = assertEquals(saveResp.status, Status.Ok)

          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(token2))
          )
          getBody <- getResp.as[Json]
        yield
          assertEquals(getResp.status, Status.Ok)
          assertEquals(getBody.hcursor.get[String]("status"), Right("draft"))
      }
    }
  }

  test("submit attempt") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "sub_creator@test.com", "SubCreator")
          (token2, _) <- TestApp.signup(app, "submitter@test.com", "Submitter")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token1))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(token1))
          )

          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(token2))
              .withEntity(Json.obj(
                "trebleBeats"   -> Json.arr(),
                "bassBeats"     -> Json.arr(),
                "studentRomans" -> Json.obj()
              ))
          )

          subResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(token2))
              .withEntity(Json.obj("score" -> 85.asJson, "completed" -> true.asJson))
          )
          subBody <- subResp.as[Json]
        yield
          assertEquals(subResp.status, Status.Ok)
          assertEquals(subBody.hcursor.get[String]("status"), Right("submitted"))
          // Server-side scoring: empty beats → score 0 → completed = false
          assertEquals(subBody.hcursor.get[Boolean]("completed"), Right(false))
      }
    }
  }

  test("submit attempt updates exercise stats") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "stats_creator@test.com", "StatsCreator")
          (user1Token, _)   <- TestApp.signup(app, "stats_user1@test.com", "StatsUser1")
          (user2Token, _)   <- TestApp.signup(app, "stats_user2@test.com", "StatsUser2")

          // Creator creates and publishes exercise
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(creatorToken))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(creatorToken))
          )

          // User 1 saves and submits
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(user1Token))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(user1Token))
              .withEntity(Json.obj())
          )

          // Check stats after first submission
          ex1Resp <- app.run(Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId")))
          ex1Body <- ex1Resp.as[Json]
          _ = assertEquals(ex1Body.hcursor.get[Int]("attemptCount"), Right(1))

          // User 2 saves and submits
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(user2Token))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(user2Token))
              .withEntity(Json.obj())
          )

          // Check stats after second submission
          ex2Resp <- app.run(Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId")))
          ex2Body <- ex2Resp.as[Json]
        yield
          assertEquals(ex2Body.hcursor.get[Int]("attemptCount"), Right(2))
      }
    }
  }

  test("resubmission does not double-count attempt") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "resub_creator@test.com", "ResubCreator")
          (userToken, _)    <- TestApp.signup(app, "resubber@test.com", "Resubber")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(creatorToken))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(creatorToken))
          )

          // Save, submit, save again (revise), resubmit
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(userToken))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(userToken))
              .withEntity(Json.obj())
          )
          // Revise (save resets status to draft)
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(userToken))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          // Resubmit
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(userToken))
              .withEntity(Json.obj())
          )

          exResp <- app.run(Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId")))
          exBody <- exResp.as[Json]
        yield
          // Still 1 attempt — same user resubmitting shouldn't double-count
          assertEquals(exBody.hcursor.get[Int]("attemptCount"), Right(1))
      }
    }
  }

  test("submit without draft returns 409") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "nodraft_c@test.com", "NoDraftC")
          (token2, _) <- TestApp.signup(app, "nodraft@test.com", "NoDraft")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token1))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get

          subResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(token2))
              .withEntity(Json.obj("score" -> 50.asJson, "completed" -> false.asJson))
          )
        yield assertEquals(subResp.status, Status.Conflict)
      }
    }
  }

  test("points summary available after signup") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "points@test.com", "PointsUser")
          resp <- app.run(
            Request[IO](Method.GET, uri"/api/community/points")
              .putHeaders(authHeader(token))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assertEquals(body.hcursor.get[Int]("totalPoints"), Right(0))
          assertEquals(body.hcursor.get[String]("rankTitle"), Right("Motif"))
      }
    }
  }

  test("publishing exercise awards points") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "pts_pub@test.com", "PtsPub")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get

          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(token))
          )

          ptsResp <- app.run(
            Request[IO](Method.GET, uri"/api/community/points")
              .putHeaders(authHeader(token))
          )
          ptsBody <- ptsResp.as[Json]
        yield
          val totalPoints = ptsBody.hcursor.get[Int]("totalPoints").toOption.get
          assert(totalPoints > 0, s"Expected points > 0 after publishing, got $totalPoints")
      }
    }
  }

  test("leaderboard hides 0-point users") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          _ <- TestApp.signup(app, "zero@test.com", "ZeroPoints")
          resp <- app.run(Request[IO](Method.GET, uri"/api/community/leaderboard"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          val rows = body.asArray.get
          assert(rows.forall(r => r.hcursor.get[Int]("totalPoints").toOption.get > 0))
      }
    }
  }

  test("leaderboard includes users with points") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "leader@test.com", "Leader")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(token))
          )

          resp <- app.run(Request[IO](Method.GET, uri"/api/community/leaderboard"))
          body <- resp.as[Json]
        yield
          val rows = body.asArray.get
          assert(rows.nonEmpty)
          assert(rows.exists(r => r.hcursor.get[String]("displayName").toOption.get == "Leader"))
      }
    }
  }

  test("weekly leaderboard") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(Request[IO](Method.GET, uri"/api/community/leaderboard?timeframe=weekly"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assert(body.isArray)
      }
    }
  }

  test("points history") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "hist@test.com", "Hist")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(token))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(token))
          )

          resp <- app.run(
            Request[IO](Method.GET, uri"/api/community/points/history")
              .putHeaders(authHeader(token))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          val events = body.asArray.get
          assert(events.nonEmpty)
      }
    }
  }

  // ── Solution Gallery Tests ──

  /** Helper: create exercise, publish, save attempt, submit */
  private def createAndSubmit(app: HttpApp[IO], creatorToken: String, solverToken: String, shared: Boolean = true): IO[(String, String)] =
    for
      createResp <- app.run(
        Request[IO](Method.POST, uri"/api/community/exercises")
          .putHeaders(authHeader(creatorToken))
          .withEntity(sampleExercise)
      )
      createBody <- createResp.as[Json]
      exId = createBody.hcursor.get[String]("id").toOption.get
      _ <- app.run(
        Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
          .putHeaders(authHeader(creatorToken))
      )
      _ <- app.run(
        Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
          .putHeaders(authHeader(solverToken))
          .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
      )
      subResp <- app.run(
        Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
          .putHeaders(authHeader(solverToken))
          .withEntity(Json.obj("shared" -> shared.asJson))
      )
      subBody <- subResp.as[Json]
      attemptId = subBody.hcursor.get[String]("id").toOption.get
    yield (exId, attemptId)

  test("submit with shared=true marks attempt as shared") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "sh_creator@test.com", "ShCreator")
          (solverToken, _)  <- TestApp.signup(app, "sh_solver@test.com", "ShSolver")
          (exId, _) <- createAndSubmit(app, creatorToken, solverToken, shared = true)
          attResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(solverToken))
          )
          attBody <- attResp.as[Json]
        yield
          assertEquals(attBody.hcursor.get[Boolean]("shared"), Right(true))
      }
    }
  }

  test("submit with shared=false marks attempt as not shared") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "nsh_creator@test.com", "NshCreator")
          (solverToken, _)  <- TestApp.signup(app, "nsh_solver@test.com", "NshSolver")
          (exId, _) <- createAndSubmit(app, creatorToken, solverToken, shared = false)
          attResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(solverToken))
          )
          attBody <- attResp.as[Json]
        yield
          assertEquals(attBody.hcursor.get[Boolean]("shared"), Right(false))
      }
    }
  }

  test("solutions endpoint returns only shared solutions") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "sol_creator@test.com", "SolCreator")
          (solver1Token, _) <- TestApp.signup(app, "sol_shared@test.com", "SolShared")
          (solver2Token, _) <- TestApp.signup(app, "sol_private@test.com", "SolPrivate")
          (solver3Token, _) <- TestApp.signup(app, "sol_viewer@test.com", "SolViewer")

          // Create and publish exercise
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(creatorToken))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(creatorToken))
          )

          // Solver 1: submit shared
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(solver1Token))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(solver1Token))
              .withEntity(Json.obj("shared" -> true.asJson))
          )

          // Solver 2: submit not shared
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(solver2Token))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(solver2Token))
              .withEntity(Json.obj("shared" -> false.asJson))
          )

          // Solver 3: submit shared (so they can view solutions)
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(solver3Token))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(solver3Token))
              .withEntity(Json.obj("shared" -> true.asJson))
          )

          // Solver 3 fetches solutions
          solResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/solutions"))
              .putHeaders(authHeader(solver3Token))
          )
          solBody <- solResp.as[Json]
        yield
          assertEquals(solResp.status, Status.Ok)
          val sols = solBody.asArray.get
          // Should see solver1 and solver3's solutions (both shared), not solver2
          assertEquals(sols.size, 2)
          val names = sols.flatMap(_.hcursor.get[String]("displayName").toOption)
          assert(names.contains("SolShared"))
          assert(names.contains("SolViewer"))
          assert(!names.contains("SolPrivate"))
      }
    }
  }

  test("solutions endpoint returns 403 if user has not submitted") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "sol403_creator@test.com", "Sol403Creator")
          (viewerToken, _)  <- TestApp.signup(app, "sol403_viewer@test.com", "Sol403Viewer")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(creatorToken))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(creatorToken))
          )

          resp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/solutions"))
              .putHeaders(authHeader(viewerToken))
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  test("upvote solution awards points and toggles") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "upv_creator@test.com", "UpvCreator")
          (solverToken, _)  <- TestApp.signup(app, "upv_solver@test.com", "UpvSolver")
          (voterToken, _)   <- TestApp.signup(app, "upv_voter@test.com", "UpvVoter")

          // Create exercise, solver submits shared
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(creatorToken))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(creatorToken))
          )
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(solverToken))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          subResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(solverToken))
              .withEntity(Json.obj("shared" -> true.asJson))
          )
          subBody <- subResp.as[Json]
          attemptId = subBody.hcursor.get[String]("id").toOption.get

          // Voter submits too (to be able to view solutions)
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(voterToken))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(voterToken))
              .withEntity(Json.obj("shared" -> true.asJson))
          )

          // Get solver's points before upvote
          solverPtsBefore <- app.run(
            Request[IO](Method.GET, uri"/api/community/points")
              .putHeaders(authHeader(solverToken))
          ).flatMap(_.as[Json])
          solverPts0 = solverPtsBefore.hcursor.get[Int]("totalPoints").toOption.get

          // Voter upvotes solver's solution
          upvResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/solutions/$attemptId/upvote"))
              .putHeaders(authHeader(voterToken))
          )
          upvBody <- upvResp.as[Json]
          _ = assertEquals(upvResp.status, Status.Ok)
          _ = assertEquals(upvBody.hcursor.get[Boolean]("upvoted"), Right(true))

          // Check solver got +5 points
          solverPtsAfter <- app.run(
            Request[IO](Method.GET, uri"/api/community/points")
              .putHeaders(authHeader(solverToken))
          ).flatMap(_.as[Json])
          solverPts1 = solverPtsAfter.hcursor.get[Int]("totalPoints").toOption.get
          _ = assert(solverPts1 - solverPts0 >= 5, s"Expected solver to gain at least 5 points, got ${solverPts1 - solverPts0}")

          // Toggle off: upvote again removes it
          upvResp2 <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/solutions/$attemptId/upvote"))
              .putHeaders(authHeader(voterToken))
          )
          upvBody2 <- upvResp2.as[Json]
        yield
          assertEquals(upvBody2.hcursor.get[Boolean]("upvoted"), Right(false))
      }
    }
  }

  test("cannot upvote own solution (no points awarded)") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "self_creator@test.com", "SelfCreator")
          (solverToken, _)  <- TestApp.signup(app, "self_solver@test.com", "SelfSolver")
          (exId, attemptId) <- createAndSubmit(app, creatorToken, solverToken, shared = true)

          // Get solver's points before self-upvote
          ptsBefore <- app.run(
            Request[IO](Method.GET, uri"/api/community/points")
              .putHeaders(authHeader(solverToken))
          ).flatMap(_.as[Json])
          pts0 = ptsBefore.hcursor.get[Int]("totalPoints").toOption.get

          // Solver tries to upvote own solution
          upvResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/solutions/$attemptId/upvote"))
              .putHeaders(authHeader(solverToken))
          )
          _ = assertEquals(upvResp.status, Status.Ok)

          // Points should not increase from self-upvote
          ptsAfter <- app.run(
            Request[IO](Method.GET, uri"/api/community/points")
              .putHeaders(authHeader(solverToken))
          ).flatMap(_.as[Json])
          pts1 = ptsAfter.hcursor.get[Int]("totalPoints").toOption.get
        yield
          assertEquals(pts0, pts1, "Self-upvote should not award points")
      }
    }
  }

  test("exercise upvote now gives +5 to creator") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "v5_creator@test.com", "V5Creator")
          (voterToken, _)   <- TestApp.signup(app, "v5_voter@test.com", "V5Voter")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(creatorToken))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(creatorToken))
          )

          // Get creator points before vote (they already got points for publishing)
          ptsBefore <- app.run(
            Request[IO](Method.GET, uri"/api/community/points")
              .putHeaders(authHeader(creatorToken))
          ).flatMap(_.as[Json])
          pts0 = ptsBefore.hcursor.get[Int]("totalPoints").toOption.get

          // Voter upvotes the exercise
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/vote"))
              .putHeaders(authHeader(voterToken))
              .withEntity(Json.obj("vote" -> "up".asJson))
          )

          // Check creator got +5
          ptsAfter <- app.run(
            Request[IO](Method.GET, uri"/api/community/points")
              .putHeaders(authHeader(creatorToken))
          ).flatMap(_.as[Json])
          pts1 = ptsAfter.hcursor.get[Int]("totalPoints").toOption.get
        yield
          assertEquals(pts1 - pts0, 5, s"Expected +5 for exercise upvote, got ${pts1 - pts0}")
      }
    }
  }

  test("exercise author can view solutions without submitting") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "auth_sol_creator@test.com", "AuthSolCreator")
          (solverToken, _)  <- TestApp.signup(app, "auth_sol_solver@test.com", "AuthSolSolver")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(creatorToken))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(creatorToken))
          )

          // Solver submits a shared solution
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(solverToken))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(solverToken))
              .withEntity(Json.obj("shared" -> true.asJson))
          )

          // Creator (who has NOT submitted) can view solutions
          solResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/solutions"))
              .putHeaders(authHeader(creatorToken))
          )
          solBody <- solResp.as[Json]
        yield
          assertEquals(solResp.status, Status.Ok)
          val sols = solBody.asArray.get
          assertEquals(sols.size, 1)
          assertEquals(sols.head.hcursor.get[String]("displayName"), Right("AuthSolSolver"))
      }
    }
  }

  test("unauthenticated user can view shared solutions") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (creatorToken, _) <- TestApp.signup(app, "pub_sol_creator@test.com", "PubSolCreator")
          (solverToken, _)  <- TestApp.signup(app, "pub_sol_solver@test.com", "PubSolSolver")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/community/exercises")
              .putHeaders(authHeader(creatorToken))
              .withEntity(sampleExercise)
          )
          createBody <- createResp.as[Json]
          exId = createBody.hcursor.get[String]("id").toOption.get
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/publish"))
              .putHeaders(authHeader(creatorToken))
          )

          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/community/exercises/$exId/attempt"))
              .putHeaders(authHeader(solverToken))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/community/exercises/$exId/submit"))
              .putHeaders(authHeader(solverToken))
              .withEntity(Json.obj("shared" -> true.asJson))
          )

          // Unauthenticated request (no auth header)
          solResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/community/exercises/$exId/solutions"))
          )
          solBody <- solResp.as[Json]
        yield
          assertEquals(solResp.status, Status.Ok)
          val sols = solBody.asArray.get
          assertEquals(sols.size, 1)
          assertEquals(sols.head.hcursor.get[String]("displayName"), Right("PubSolSolver"))
          // userUpvoted should be false for unauthenticated user
          assertEquals(sols.head.hcursor.get[Boolean]("userUpvoted"), Right(false))
      }
    }
  }
