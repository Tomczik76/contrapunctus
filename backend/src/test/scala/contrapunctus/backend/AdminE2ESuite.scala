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

class AdminE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  import TestApp.{adminHeader, authHeader}

  private val sampleLesson = Json.obj(
    "title"       -> "Admin Lesson".asJson,
    "description" -> "Built-in lesson".asJson,
    "difficulty"  -> "intermediate".asJson,
    "template"    -> "harmonize_melody".asJson,
    "tonicIdx"    -> 0.asJson,
    "scaleName"   -> "major".asJson,
    "tsTop"       -> 4.asJson,
    "tsBottom"    -> 4.asJson,
    "sopranoBeats" -> Json.arr(),
    "sortOrder"   -> 1.asJson
  )

  // ── Admin Auth ──

  test("admin endpoints require admin token") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp1 <- app.run(Request[IO](Method.GET, uri"/api/admin/users"))
          resp2 <- app.run(Request[IO](Method.GET, uri"/api/admin/bug-reports"))
          resp3 <- app.run(Request[IO](Method.GET, uri"/api/admin/feature-requests"))
          resp4 <- app.run(Request[IO](Method.GET, uri"/api/admin/corrections"))
        yield
          assertEquals(resp1.status, Status.Forbidden)
          assertEquals(resp2.status, Status.Forbidden)
          assertEquals(resp3.status, Status.Forbidden)
          assertEquals(resp4.status, Status.Forbidden)
      }
    }
  }

  test("admin with wrong token returns 403") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.GET, uri"/api/admin/users")
              .putHeaders(Header.Raw(org.typelevel.ci.CIString("X-Admin-Token"), "wrong-password"))
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  // ── Admin Dashboard ──

  test("admin lists users") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          _ <- TestApp.signup(app, "admin_u1@test.com", "AdminUser1")
          _ <- TestApp.signup(app, "admin_u2@test.com", "AdminUser2")

          resp <- app.run(
            Request[IO](Method.GET, uri"/api/admin/users")
              .putHeaders(adminHeader)
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assert(body.asArray.get.size >= 2)
      }
    }
  }

  test("admin lists bug reports") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "admin_bug@test.com", "AdminBug")

          // Submit a bug report
          _ <- app.run(
            Request[IO](Method.POST, uri"/api/bug-reports")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj(
                "description" -> "Test bug".asJson,
                "stateJson"   -> Json.obj()
              ))
          )

          resp <- app.run(
            Request[IO](Method.GET, uri"/api/admin/bug-reports")
              .putHeaders(adminHeader)
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assert(body.asArray.get.nonEmpty)
      }
    }
  }

  test("admin lists feature requests") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "admin_fr@test.com", "AdminFR")

          _ <- app.run(
            Request[IO](Method.POST, uri"/api/feature-requests")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("description" -> "Test feature".asJson))
          )

          resp <- app.run(
            Request[IO](Method.GET, uri"/api/admin/feature-requests")
              .putHeaders(adminHeader)
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assert(body.asArray.get.nonEmpty)
      }
    }
  }

  test("admin lists and updates correction status") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "admin_corr@test.com", "AdminCorr")

          // Submit a correction
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj(
                "category"            -> "chord_label".asJson,
                "measure"             -> 1.asJson,
                "beat"                -> 1.asJson,
                "currentAnalysis"     -> Json.obj(),
                "suggestedCorrection" -> Json.obj(),
                "stateSnapshot"       -> Json.obj()
              ))
          )
          createBody <- createResp.as[Json]
          corrId = createBody.hcursor.get[String]("id").toOption.get

          // List corrections as admin
          listResp <- app.run(
            Request[IO](Method.GET, uri"/api/admin/corrections")
              .putHeaders(adminHeader)
          )
          listBody <- listResp.as[Json]
          _ = assert(listBody.asArray.get.nonEmpty)

          // Update status
          updateResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/admin/corrections/$corrId/status"))
              .putHeaders(adminHeader)
              .withEntity(Json.obj("status" -> "confirmed".asJson))
          )
        yield assertEquals(updateResp.status, Status.Ok)
      }
    }
  }

  test("admin correction status update validates enum") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "admin_corrval@test.com", "AdminCorrVal")

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/corrections")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj(
                "category"            -> "chord_label".asJson,
                "measure"             -> 1.asJson,
                "beat"                -> 1.asJson,
                "currentAnalysis"     -> Json.obj(),
                "suggestedCorrection" -> Json.obj(),
                "stateSnapshot"       -> Json.obj()
              ))
          )
          createBody <- createResp.as[Json]
          corrId = createBody.hcursor.get[String]("id").toOption.get

          resp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/admin/corrections/$corrId/status"))
              .putHeaders(adminHeader)
              .withEntity(Json.obj("status" -> "bogus".asJson))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("admin roadmap votes") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "admin_rv@test.com", "AdminRV")

          // Cast a roadmap vote
          _ <- app.run(
            Request[IO](Method.POST, uri"/api/roadmap-votes/dark_mode")
              .putHeaders(authHeader(token))
          )

          resp <- app.run(
            Request[IO](Method.GET, uri"/api/admin/roadmap-votes")
              .putHeaders(adminHeader)
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assert(body.isObject)
      }
    }
  }

  // ── Lesson Admin CRUD ──

  test("admin lesson CRUD") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          // Create
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/admin/lessons")
              .putHeaders(adminHeader)
              .withEntity(sampleLesson)
          )
          createBody <- createResp.as[Json]
          _ = assertEquals(createResp.status, Status.Created)
          lessonId = createBody.hcursor.get[String]("id").toOption.get

          // List
          listResp <- app.run(
            Request[IO](Method.GET, uri"/api/admin/lessons")
              .putHeaders(adminHeader)
          )
          listBody <- listResp.as[Json]
          _ = assert(listBody.asArray.get.nonEmpty)

          // Update
          updResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/admin/lessons/$lessonId"))
              .putHeaders(adminHeader)
              .withEntity(sampleLesson.mapObject(_.add("title", "Updated Admin Lesson".asJson)))
          )
          updBody <- updResp.as[Json]
          _ = assertEquals(updResp.status, Status.Ok)
          _ = assertEquals(updBody.hcursor.get[String]("title"), Right("Updated Admin Lesson"))

          // Delete
          delResp <- app.run(
            Request[IO](Method.DELETE, Uri.unsafeFromString(s"/api/admin/lessons/$lessonId"))
              .putHeaders(adminHeader)
          )
        yield assertEquals(delResp.status, Status.Ok)
      }
    }
  }

  test("admin lesson create validates fields") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/admin/lessons")
              .putHeaders(adminHeader)
              .withEntity(sampleLesson.mapObject(_.add("title", "".asJson)))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("admin lesson endpoints require admin token") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/admin/lessons")
              .withEntity(sampleLesson)
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  // ── Public Lesson Routes ──

  test("public lesson list and get") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          // Create a lesson via admin
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/admin/lessons")
              .putHeaders(adminHeader)
              .withEntity(sampleLesson)
          )
          createBody <- createResp.as[Json]
          lessonId = createBody.hcursor.get[String]("id").toOption.get

          // Public list
          listResp <- app.run(Request[IO](Method.GET, uri"/api/lessons"))
          listBody <- listResp.as[Json]
          _ = assertEquals(listResp.status, Status.Ok)
          _ = assert(listBody.asArray.get.nonEmpty)

          // Public get
          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/lessons/$lessonId"))
          )
          getBody <- getResp.as[Json]
        yield
          assertEquals(getResp.status, Status.Ok)
          assertEquals(getBody.hcursor.get[String]("title"), Right("Admin Lesson"))
      }
    }
  }

  test("public get nonexistent lesson returns 404") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.GET, uri"/api/lessons/00000000-0000-0000-0000-000000000099")
          )
        yield assertEquals(resp.status, Status.NotFound)
      }
    }
  }

  test("public get lesson with invalid id returns 400") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.GET, uri"/api/lessons/not-a-uuid")
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }
