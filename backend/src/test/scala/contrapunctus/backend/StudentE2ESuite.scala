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

class StudentE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  import TestApp.authHeader

  private val sampleLesson = Json.obj(
    "title"       -> "Student Lesson".asJson,
    "description" -> "A lesson for students".asJson,
    "difficulty"  -> "beginner".asJson,
    "template"    -> "harmonize_melody".asJson,
    "tonicIdx"    -> 0.asJson,
    "scaleName"   -> "major".asJson,
    "tsTop"       -> 4.asJson,
    "tsBottom"    -> 4.asJson,
    "sopranoBeats" -> Json.arr()
  )

  /** Sets up educator + class + lesson + enrolled student. Returns (eduToken, stuToken, classId, lessonId) */
  private def setupClassWithStudent(app: HttpApp[IO], suffix: String): IO[(String, String, String, String)] =
    for
      (eduToken, _) <- TestApp.signup(app, s"edu_$suffix@test.com", s"Edu_$suffix", isEducator = true)
      (stuToken, _) <- TestApp.signup(app, s"stu_$suffix@test.com", s"Stu_$suffix")

      classResp <- app.run(
        Request[IO](Method.POST, uri"/api/educator/classes")
          .putHeaders(authHeader(eduToken))
          .withEntity(Json.obj("name" -> s"Class_$suffix".asJson))
      )
      classBody <- classResp.as[Json]
      classId = classBody.hcursor.get[String]("id").toOption.get
      inviteCode = classBody.hcursor.get[String]("inviteCode").toOption.get

      lessonResp <- app.run(
        Request[IO](Method.POST, uri"/api/educator/lessons")
          .putHeaders(authHeader(eduToken))
          .withEntity(sampleLesson)
      )
      lessonBody <- lessonResp.as[Json]
      lessonId = lessonBody.hcursor.get[String]("id").toOption.get

      _ <- app.run(
        Request[IO](Method.POST, Uri.unsafeFromString(s"/api/educator/classes/$classId/lessons"))
          .putHeaders(authHeader(eduToken))
          .withEntity(Json.obj("lessonId" -> lessonId.asJson))
      )

      _ <- app.run(
        Request[IO](Method.POST, Uri.unsafeFromString(s"/api/join/$inviteCode"))
          .putHeaders(authHeader(stuToken))
      )
    yield (eduToken, stuToken, classId, lessonId)

  // ── Join Flow ──

  test("get class info by invite code (unauthenticated)") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _) <- TestApp.signup(app, "edu_joininfo@test.com", "EduJoinInfo", isEducator = true)
          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "JoinInfo Class".asJson))
          )
          classBody <- classResp.as[Json]
          inviteCode = classBody.hcursor.get[String]("inviteCode").toOption.get

          infoResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/join/$inviteCode"))
          )
          infoBody <- infoResp.as[Json]
        yield
          assertEquals(infoResp.status, Status.Ok)
          assertEquals(infoBody.hcursor.get[String]("name"), Right("JoinInfo Class"))
          assertEquals(infoBody.hcursor.get[Boolean]("enrolled"), Right(false))
      }
    }
  }

  test("get class info shows enrolled=true for enrolled student") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _) <- TestApp.signup(app, "edu_joinenr@test.com", "EduJoinEnr", isEducator = true)
          (stuToken, _) <- TestApp.signup(app, "stu_joinenr@test.com", "StuJoinEnr")

          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "Enrolled Class".asJson))
          )
          classBody <- classResp.as[Json]
          inviteCode = classBody.hcursor.get[String]("inviteCode").toOption.get

          // Enroll
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/join/$inviteCode"))
              .putHeaders(authHeader(stuToken))
          )

          // Check info
          infoResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/join/$inviteCode"))
              .putHeaders(authHeader(stuToken))
          )
          infoBody <- infoResp.as[Json]
        yield
          assertEquals(infoBody.hcursor.get[Boolean]("enrolled"), Right(true))
      }
    }
  }

  test("educator sees isOwner=true on their own class invite") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _) <- TestApp.signup(app, "edu_owner@test.com", "EduOwner", isEducator = true)

          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "Owner Class".asJson))
          )
          classBody <- classResp.as[Json]
          inviteCode = classBody.hcursor.get[String]("inviteCode").toOption.get

          infoResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/join/$inviteCode"))
              .putHeaders(authHeader(eduToken))
          )
          infoBody <- infoResp.as[Json]
        yield
          assertEquals(infoBody.hcursor.get[Boolean]("isOwner"), Right(true))
      }
    }
  }

  test("cannot join own class") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _) <- TestApp.signup(app, "edu_noself@test.com", "EduNoSelf", isEducator = true)

          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "Self Class".asJson))
          )
          classBody <- classResp.as[Json]
          inviteCode = classBody.hcursor.get[String]("inviteCode").toOption.get

          joinResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/join/$inviteCode"))
              .putHeaders(authHeader(eduToken))
          )
        yield assertEquals(joinResp.status, Status.BadRequest)
      }
    }
  }

  test("cannot join archived class") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _) <- TestApp.signup(app, "edu_arch@test.com", "EduArch", isEducator = true)
          (stuToken, _) <- TestApp.signup(app, "stu_arch@test.com", "StuArch")

          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "Archived Class".asJson))
          )
          classBody <- classResp.as[Json]
          classId = classBody.hcursor.get[String]("id").toOption.get
          inviteCode = classBody.hcursor.get[String]("inviteCode").toOption.get

          // Archive the class
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/educator/classes/$classId"))
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "Archived Class".asJson, "status" -> "archived".asJson))
          )

          joinResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/join/$inviteCode"))
              .putHeaders(authHeader(stuToken))
          )
        yield assertEquals(joinResp.status, Status.BadRequest)
      }
    }
  }

  test("join with invalid invite code returns 404") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (stuToken, _) <- TestApp.signup(app, "stu_badcode@test.com", "StuBadCode")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/join/00000000-0000-0000-0000-000000000099")
              .putHeaders(authHeader(stuToken))
          )
        yield assertEquals(resp.status, Status.NotFound)
      }
    }
  }

  test("join without auth returns 403") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/join/00000000-0000-0000-0000-000000000099")
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  // ── Student Class & Lesson Access ──

  test("student lists enrolled classes") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (_, stuToken, _, _) <- setupClassWithStudent(app, "listcls")

          resp <- app.run(
            Request[IO](Method.GET, uri"/api/student/classes")
              .putHeaders(authHeader(stuToken))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assertEquals(body.asArray.get.size, 1)
      }
    }
  }

  test("student lists lessons in enrolled class") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (_, stuToken, classId, _) <- setupClassWithStudent(app, "listles")

          resp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons"))
              .putHeaders(authHeader(stuToken))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assertEquals(body.asArray.get.size, 1)
      }
    }
  }

  test("student gets lesson detail") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (_, stuToken, classId, lessonId) <- setupClassWithStudent(app, "lesdetail")

          resp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId"))
              .putHeaders(authHeader(stuToken))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assertEquals(body.hcursor.get[String]("title"), Right("Student Lesson"))
      }
    }
  }

  test("unenrolled student cannot access class lessons") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _) <- TestApp.signup(app, "edu_notenr@test.com", "EduNotEnr", isEducator = true)
          (stuToken, _) <- TestApp.signup(app, "stu_notenr@test.com", "StuNotEnr")

          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "Closed Class".asJson))
          )
          classBody <- classResp.as[Json]
          classId = classBody.hcursor.get[String]("id").toOption.get

          resp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons"))
              .putHeaders(authHeader(stuToken))
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  // ── Student Work Submission ──

  test("student full workflow: save, get, submit work") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (_, stuToken, classId, lessonId) <- setupClassWithStudent(app, "workflow")

          // Save work
          saveResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/work"))
              .putHeaders(authHeader(stuToken))
              .withEntity(Json.obj(
                "trebleBeats"   -> Json.arr(Json.obj("note" -> 60.asJson)),
                "bassBeats"     -> Json.arr(),
                "studentRomans" -> Json.obj("0" -> "I".asJson)
              ))
          )
          saveBody <- saveResp.as[Json]
          _ = assertEquals(saveResp.status, Status.Ok)
          _ = assertEquals(saveBody.hcursor.get[String]("status"), Right("draft"))

          // Get saved work
          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/work"))
              .putHeaders(authHeader(stuToken))
          )
          getBody <- getResp.as[Json]
          _ = assertEquals(getResp.status, Status.Ok)

          // Submit work
          submitResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/submit"))
              .putHeaders(authHeader(stuToken))
          )
          submitBody <- submitResp.as[Json]
          _ = assertEquals(submitResp.status, Status.Ok)
          _ = assertEquals(submitBody.hcursor.get[String]("status"), Right("submitted"))

          // Cannot submit again
          resubmitResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/submit"))
              .putHeaders(authHeader(stuToken))
          )
          _ = assertEquals(resubmitResp.status, Status.Conflict)

          // Cannot save after submit
          resaveResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/work"))
              .putHeaders(authHeader(stuToken))
              .withEntity(Json.obj(
                "trebleBeats"   -> Json.arr(),
                "bassBeats"     -> Json.arr(),
                "studentRomans" -> Json.obj()
              ))
          )
        yield assertEquals(resaveResp.status, Status.Conflict)
      }
    }
  }

  test("submit without saving returns 409") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (_, stuToken, classId, lessonId) <- setupClassWithStudent(app, "nosave")

          resp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/submit"))
              .putHeaders(authHeader(stuToken))
          )
        yield assertEquals(resp.status, Status.Conflict)
      }
    }
  }

  test("get work when none saved returns 404") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (_, stuToken, classId, lessonId) <- setupClassWithStudent(app, "nowork")

          resp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/work"))
              .putHeaders(authHeader(stuToken))
          )
        yield assertEquals(resp.status, Status.NotFound)
      }
    }
  }

  test("student endpoints require auth") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(Request[IO](Method.GET, uri"/api/student/classes"))
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }
