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

class EducatorE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  import TestApp.{authHeader, jwtSecret}

  private val sampleLesson = Json.obj(
    "title"       -> "Lesson 1".asJson,
    "description" -> "First lesson".asJson,
    "difficulty"  -> "beginner".asJson,
    "template"    -> "harmonize_melody".asJson,
    "tonicIdx"    -> 0.asJson,
    "scaleName"   -> "major".asJson,
    "tsTop"       -> 4.asJson,
    "tsBottom"    -> 4.asJson,
    "sopranoBeats" -> Json.arr()
  )

  // ── Class Management ──

  test("create and list classes") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "educator1@test.com", "Educator1", isEducator = true)

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "Theory 101".asJson))
          )
          createBody <- createResp.as[Json]
          _ = assertEquals(createResp.status, Status.Created)
          _ = assertEquals(createBody.hcursor.get[String]("name"), Right("Theory 101"))
          _ = assert(createBody.hcursor.get[String]("inviteCode").isRight)

          listResp <- app.run(
            Request[IO](Method.GET, uri"/api/educator/classes")
              .putHeaders(authHeader(token))
          )
          listBody <- listResp.as[Json]
        yield
          assertEquals(listResp.status, Status.Ok)
          assertEquals(listBody.asArray.get.size, 1)
      }
    }
  }

  test("create class validates name required") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_val@test.com", "EduVal", isEducator = true)
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "".asJson))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("get class detail") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_detail@test.com", "EduDetail", isEducator = true)
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "Detail Class".asJson))
          )
          createBody <- createResp.as[Json]
          classId = createBody.hcursor.get[String]("id").toOption.get

          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/classes/$classId"))
              .putHeaders(authHeader(token))
          )
          getBody <- getResp.as[Json]
        yield
          assertEquals(getResp.status, Status.Ok)
          assertEquals(getBody.hcursor.get[String]("name"), Right("Detail Class"))
      }
    }
  }

  test("update class name and status") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_upd@test.com", "EduUpd", isEducator = true)
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "Old Name".asJson))
          )
          createBody <- createResp.as[Json]
          classId = createBody.hcursor.get[String]("id").toOption.get

          updResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/educator/classes/$classId"))
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "New Name".asJson, "status" -> "archived".asJson))
          )
          updBody <- updResp.as[Json]
        yield
          assertEquals(updResp.status, Status.Ok)
          assertEquals(updBody.hcursor.get[String]("name"), Right("New Name"))
          assertEquals(updBody.hcursor.get[String]("status"), Right("archived"))
      }
    }
  }

  test("update class validates status enum") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_badstat@test.com", "EduBadStat", isEducator = true)
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "A Class".asJson))
          )
          createBody <- createResp.as[Json]
          classId = createBody.hcursor.get[String]("id").toOption.get

          resp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/educator/classes/$classId"))
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "A Class".asJson, "status" -> "inactive".asJson))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("regenerate invite code") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_regen@test.com", "EduRegen", isEducator = true)
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "Regen Class".asJson))
          )
          createBody <- createResp.as[Json]
          classId = createBody.hcursor.get[String]("id").toOption.get
          oldCode = createBody.hcursor.get[String]("inviteCode").toOption.get

          regenResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/educator/classes/$classId/regenerate-invite"))
              .putHeaders(authHeader(token))
          )
          regenBody <- regenResp.as[Json]
          newCode = regenBody.hcursor.get[String]("inviteCode").toOption.get
        yield
          assertEquals(regenResp.status, Status.Ok)
          assertNotEquals(oldCode, newCode)
      }
    }
  }

  test("another educator cannot access my class") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "edu_own@test.com", "EduOwn", isEducator = true)
          (token2, _) <- TestApp.signup(app, "edu_other@test.com", "EduOther", isEducator = true)

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(token1))
              .withEntity(Json.obj("name" -> "Private Class".asJson))
          )
          createBody <- createResp.as[Json]
          classId = createBody.hcursor.get[String]("id").toOption.get

          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/classes/$classId"))
              .putHeaders(authHeader(token2))
          )
        yield assertEquals(getResp.status, Status.NotFound)
      }
    }
  }

  // ── Lesson Management ──

  test("create, list, get, update, and delete lesson") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_lesson@test.com", "EduLesson", isEducator = true)

          // Create
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/lessons")
              .putHeaders(authHeader(token))
              .withEntity(sampleLesson)
          )
          createBody <- createResp.as[Json]
          _ = assertEquals(createResp.status, Status.Created)
          lessonId = createBody.hcursor.get[String]("id").toOption.get

          // List
          listResp <- app.run(
            Request[IO](Method.GET, uri"/api/educator/lessons")
              .putHeaders(authHeader(token))
          )
          listBody <- listResp.as[Json]
          _ = assertEquals(listBody.asArray.get.size, 1)

          // Get
          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/lessons/$lessonId"))
              .putHeaders(authHeader(token))
          )
          getBody <- getResp.as[Json]
          _ = assertEquals(getBody.hcursor.get[String]("title"), Right("Lesson 1"))

          // Update
          updResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/educator/lessons/$lessonId"))
              .putHeaders(authHeader(token))
              .withEntity(sampleLesson.mapObject(_.add("title", "Updated Lesson".asJson)))
          )
          updBody <- updResp.as[Json]
          _ = assertEquals(updBody.hcursor.get[String]("title"), Right("Updated Lesson"))

          // Delete
          delResp <- app.run(
            Request[IO](Method.DELETE, Uri.unsafeFromString(s"/api/educator/lessons/$lessonId"))
              .putHeaders(authHeader(token))
          )
          _ = assertEquals(delResp.status, Status.Ok)

          // Verify deleted
          getResp2 <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/lessons/$lessonId"))
              .putHeaders(authHeader(token))
          )
        yield assertEquals(getResp2.status, Status.NotFound)
      }
    }
  }

  test("create lesson validates required fields") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_lval@test.com", "EduLVal", isEducator = true)
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/lessons")
              .putHeaders(authHeader(token))
              .withEntity(sampleLesson.mapObject(_.add("title", "".asJson)))
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assertEquals(body.hcursor.get[String]("error"), Right("title is required"))
      }
    }
  }

  test("duplicate lesson") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_dup@test.com", "EduDup", isEducator = true)

          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/lessons")
              .putHeaders(authHeader(token))
              .withEntity(sampleLesson)
          )
          createBody <- createResp.as[Json]
          lessonId = createBody.hcursor.get[String]("id").toOption.get

          dupResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/educator/lessons/$lessonId/duplicate"))
              .putHeaders(authHeader(token))
          )
          dupBody <- dupResp.as[Json]
        yield
          assertEquals(dupResp.status, Status.Created)
          val dupId = dupBody.hcursor.get[String]("id").toOption.get
          assertNotEquals(dupId, lessonId)
          assert(dupBody.hcursor.get[String]("title").toOption.get.contains("Lesson 1"))
      }
    }
  }

  // ── Class Lesson Assignment ──

  test("assign, list, reorder, and unassign lessons in a class") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "edu_assign@test.com", "EduAssign", isEducator = true)

          // Create class
          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("name" -> "Assignment Class".asJson))
          )
          classBody <- classResp.as[Json]
          classId = classBody.hcursor.get[String]("id").toOption.get

          // Create two lessons
          l1Resp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/lessons")
              .putHeaders(authHeader(token))
              .withEntity(sampleLesson)
          )
          l1Body <- l1Resp.as[Json]
          l1Id = l1Body.hcursor.get[String]("id").toOption.get

          l2Resp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/lessons")
              .putHeaders(authHeader(token))
              .withEntity(sampleLesson.mapObject(_.add("title", "Lesson 2".asJson)))
          )
          l2Body <- l2Resp.as[Json]
          l2Id = l2Body.hcursor.get[String]("id").toOption.get

          // Assign lessons to class
          a1Resp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/educator/classes/$classId/lessons"))
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("lessonId" -> l1Id.asJson))
          )
          _ = assertEquals(a1Resp.status, Status.Created)

          a2Resp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/educator/classes/$classId/lessons"))
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("lessonId" -> l2Id.asJson))
          )
          _ = assertEquals(a2Resp.status, Status.Created)

          // Duplicate assignment should conflict
          dupResp <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/educator/classes/$classId/lessons"))
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("lessonId" -> l1Id.asJson))
          )
          _ = assertEquals(dupResp.status, Status.Conflict)

          // List class lessons
          listResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/classes/$classId/lessons"))
              .putHeaders(authHeader(token))
          )
          listBody <- listResp.as[Json]
          _ = assertEquals(listBody.asArray.get.size, 2)

          // Reorder lessons (swap)
          reorderResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/educator/classes/$classId/lessons/order"))
              .putHeaders(authHeader(token))
              .withEntity(Json.obj("lessonIds" -> List(l2Id, l1Id).asJson))
          )
          _ = assertEquals(reorderResp.status, Status.Ok)

          // Unassign lesson
          unassignResp <- app.run(
            Request[IO](Method.DELETE, Uri.unsafeFromString(s"/api/educator/classes/$classId/lessons/$l1Id"))
              .putHeaders(authHeader(token))
          )
          _ = assertEquals(unassignResp.status, Status.Ok)

          // Verify only one lesson remains
          listResp2 <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/classes/$classId/lessons"))
              .putHeaders(authHeader(token))
          )
          listBody2 <- listResp2.as[Json]
        yield assertEquals(listBody2.asArray.get.size, 1)
      }
    }
  }

  // ── Student Management ──

  test("list students in class and remove student") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _)  <- TestApp.signup(app, "edu_stulist@test.com", "EduStuList", isEducator = true)
          (stuToken, stuBody) <- TestApp.signup(app, "student_list@test.com", "Student1")
          stuId = stuBody.hcursor.downField("user").get[String]("id").toOption.get

          // Create class and get invite code
          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "Student Class".asJson))
          )
          classBody <- classResp.as[Json]
          classId = classBody.hcursor.get[String]("id").toOption.get
          inviteCode = classBody.hcursor.get[String]("inviteCode").toOption.get

          // Student joins
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/join/$inviteCode"))
              .putHeaders(authHeader(stuToken))
          )

          // List students
          listResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/classes/$classId/students"))
              .putHeaders(authHeader(eduToken))
          )
          listBody <- listResp.as[Json]
          _ = assertEquals(listBody.asArray.get.size, 1)

          // Remove student
          removeResp <- app.run(
            Request[IO](Method.DELETE, Uri.unsafeFromString(s"/api/educator/classes/$classId/students/$stuId"))
              .putHeaders(authHeader(eduToken))
          )
          _ = assertEquals(removeResp.status, Status.Ok)

          // Verify student removed
          listResp2 <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/classes/$classId/students"))
              .putHeaders(authHeader(eduToken))
          )
          listBody2 <- listResp2.as[Json]
        yield assertEquals(listBody2.asArray.get.size, 0)
      }
    }
  }

  // ── Gradebook ──

  test("educator can view grades and grade student work") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _)  <- TestApp.signup(app, "edu_grade@test.com", "EduGrade", isEducator = true)
          (stuToken, _)  <- TestApp.signup(app, "stu_grade@test.com", "StuGrade")

          // Create class, lesson, assign, enroll
          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "Grade Class".asJson))
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

          // Student saves and submits work
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/work"))
              .putHeaders(authHeader(stuToken))
              .withEntity(Json.obj(
                "trebleBeats"   -> Json.arr(),
                "bassBeats"     -> Json.arr(),
                "studentRomans" -> Json.obj()
              ))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/submit"))
              .putHeaders(authHeader(stuToken))
          )

          // Educator views grades
          gradesResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/classes/$classId/grades"))
              .putHeaders(authHeader(eduToken))
          )
          gradesBody <- gradesResp.as[Json]
          _ = assertEquals(gradesResp.status, Status.Ok)
          _ = assert(gradesBody.asArray.get.nonEmpty)

          // Educator views student work
          stuId = gradesBody.asArray.get.head.hcursor.get[String]("studentId").toOption.get
          workResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/educator/classes/$classId/students/$stuId/lessons/$lessonId/work"))
              .putHeaders(authHeader(eduToken))
          )
          _ = assertEquals(workResp.status, Status.Ok)

          // Educator grades the work
          gradeResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/educator/classes/$classId/students/$stuId/lessons/$lessonId/grade"))
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("score" -> 92.asJson))
          )
          gradeBody <- gradeResp.as[Json]
        yield
          assertEquals(gradeResp.status, Status.Ok)
          // gradeWork updates the score but keeps status as "submitted"
          assertEquals(gradeBody.hcursor.get[String]("status"), Right("submitted"))
      }
    }
  }

  test("grade validates score range") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (eduToken, _)  <- TestApp.signup(app, "edu_gradeval@test.com", "EduGradeVal", isEducator = true)
          (stuToken, stuBody) <- TestApp.signup(app, "stu_gradeval@test.com", "StuGradeVal")
          stuId = stuBody.hcursor.downField("user").get[String]("id").toOption.get

          classResp <- app.run(
            Request[IO](Method.POST, uri"/api/educator/classes")
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("name" -> "GradeVal Class".asJson))
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
          _ <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/work"))
              .putHeaders(authHeader(stuToken))
              .withEntity(Json.obj("trebleBeats" -> Json.arr(), "bassBeats" -> Json.arr(), "studentRomans" -> Json.obj()))
          )
          _ <- app.run(
            Request[IO](Method.POST, Uri.unsafeFromString(s"/api/student/classes/$classId/lessons/$lessonId/submit"))
              .putHeaders(authHeader(stuToken))
          )

          resp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/educator/classes/$classId/students/$stuId/lessons/$lessonId/grade"))
              .putHeaders(authHeader(eduToken))
              .withEntity(Json.obj("score" -> 150.asJson))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("educator endpoints require auth") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp1 <- app.run(Request[IO](Method.GET, uri"/api/educator/classes"))
          resp2 <- app.run(Request[IO](Method.GET, uri"/api/educator/lessons"))
        yield
          assertEquals(resp1.status, Status.Forbidden)
          assertEquals(resp2.status, Status.Forbidden)
      }
    }
  }
