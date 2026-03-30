package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.Authorization
import org.http4s.Credentials
import contrapunctus.backend.db.{Classes, EducatorLessons}
import contrapunctus.backend.services.{AuthService, EducatorService}

import java.util.UUID
import java.time.OffsetDateTime

case class CreateClassRequest(name: String)
case class UpdateClassRequest(name: String, status: String)
case class AssignLessonRequest(lessonId: String)
case class ReorderLessonsRequest(lessonIds: List[String])
case class GradeWorkRequest(score: BigDecimal)
object GradeWorkRequest:
  given Decoder[GradeWorkRequest] = deriveDecoder

case class CreateLessonRequest(
  title: String,
  description: String,
  difficulty: String,
  template: String,
  tonicIdx: Int,
  scaleName: String,
  tsTop: Int,
  tsBottom: Int,
  sopranoBeats: Json,
  bassBeats: Option[Json],
  figuredBass: Option[Json]
)

object CreateClassRequest:
  given Decoder[CreateClassRequest] = deriveDecoder

object UpdateClassRequest:
  given Decoder[UpdateClassRequest] = deriveDecoder

object AssignLessonRequest:
  given Decoder[AssignLessonRequest] = deriveDecoder

object ReorderLessonsRequest:
  given Decoder[ReorderLessonsRequest] = deriveDecoder

object CreateLessonRequest:
  given Decoder[CreateLessonRequest] = deriveDecoder

object EducatorRoutes:
  import contrapunctus.backend.domain.User.given

  given Encoder[Classes.ClassRow] = Encoder.instance { c =>
    Json.obj(
      "id"           -> c.id.toString.asJson,
      "educatorId"   -> c.educatorId.toString.asJson,
      "name"         -> c.name.asJson,
      "inviteCode"   -> c.inviteCode.toString.asJson,
      "status"       -> c.status.asJson,
      "studentCount" -> c.studentCount.asJson,
      "createdAt"    -> c.createdAt.toString.asJson
    )
  }

  given Encoder[EducatorLessons.EducatorLessonDetail] = Encoder.instance { l =>
    Json.obj(
      "id"           -> l.id.toString.asJson,
      "educatorId"   -> l.educatorId.toString.asJson,
      "title"        -> l.title.asJson,
      "description"  -> l.description.asJson,
      "difficulty"   -> l.difficulty.asJson,
      "template"     -> l.template.asJson,
      "tonicIdx"     -> l.tonicIdx.asJson,
      "scaleName"    -> l.scaleName.asJson,
      "tsTop"        -> l.tsTop.asJson,
      "tsBottom"     -> l.tsBottom.asJson,
      "sopranoBeats" -> l.sopranoBeats,
      "bassBeats"    -> l.bassBeats.getOrElse(Json.Null),
      "figuredBass"  -> l.figuredBass.getOrElse(Json.Null),
      "createdAt"    -> l.createdAt.toString.asJson
    )
  }

  given Encoder[EducatorLessons.EducatorLessonRow] = Encoder.instance { l =>
    Json.obj(
      "id"              -> l.id.toString.asJson,
      "educatorId"      -> l.educatorId.toString.asJson,
      "title"           -> l.title.asJson,
      "description"     -> l.description.asJson,
      "difficulty"      -> l.difficulty.asJson,
      "template"        -> l.template.asJson,
      "createdAt"       -> l.createdAt.toString.asJson,
      "assignedClasses" -> l.assignedClasses
    )
  }

  given Encoder[Classes.StudentRow] = Encoder.instance { s =>
    Json.obj(
      "id"               -> s.id.toString.asJson,
      "displayName"      -> s.displayName.asJson,
      "email"            -> s.email.asJson,
      "enrolledAt"       -> s.enrolledAt.toString.asJson,
      "lessonsCompleted" -> s.lessonsCompleted.asJson,
      "lastActiveAt"     -> s.lastActiveAt.map(_.toString).asJson
    )
  }

  given Encoder[Classes.ClassLessonRow] = Encoder.instance { l =>
    Json.obj(
      "id"                -> l.id.toString.asJson,
      "title"             -> l.title.asJson,
      "difficulty"        -> l.difficulty.asJson,
      "template"          -> l.template.asJson,
      "sortOrder"         -> l.sortOrder.asJson,
      "studentsCompleted" -> l.studentsCompleted.asJson,
      "avgScore"          -> l.avgScore.map(_.toDouble).asJson
    )
  }

  private def parseUUID(s: String): Option[UUID] =
    scala.util.Try(UUID.fromString(s)).toOption

  def routes(educatorService: EducatorService, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ GET -> Root / "educator" / "classes" =>
        withEducator(req, jwtSecret) { userId =>
          educatorService.listClasses(userId).flatMap(classes => Ok(classes.asJson))
        }

      case req @ POST -> Root / "educator" / "classes" =>
        withEducator(req, jwtSecret) { userId =>
          req.as[CreateClassRequest].flatMap { body =>
            import Validation._
            validate(
              body.name.isBlank              -> "name is required",
              tooLong(body.name, MaxShortText) -> s"name must be at most $MaxShortText characters",
            ) {
              educatorService.createClass(userId, body.name.trim).flatMap(cls => Created(cls.asJson))
            }
          }
        }

      case req @ GET -> Root / "educator" / "classes" / classId =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case Some(cls) => Ok(cls.asJson)
                case None      => NotFound(Json.obj("error" -> Json.fromString("class not found")))
              }
        }

      case req @ PUT -> Root / "educator" / "classes" / classId =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              req.as[UpdateClassRequest].flatMap { body =>
                import Validation._
                validate(
                  body.name.isBlank                    -> "name is required",
                  tooLong(body.name, MaxShortText)       -> s"name must be at most $MaxShortText characters",
                  notIn(body.status, ClassStatuses)     -> s"status must be one of: ${ClassStatuses.mkString(", ")}",
                ) {
                  educatorService.updateClass(cid, userId, body.name.trim, body.status).flatMap {
                    case Some(cls) => Ok(cls.asJson)
                    case None      => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                  }
                }
              }
        }

      case req @ GET -> Root / "educator" / "lessons" =>
        withEducator(req, jwtSecret) { userId =>
          educatorService.listLessons(userId).flatMap(lessons => Ok(lessons.asJson))
        }

      case req @ POST -> Root / "educator" / "classes" / classId / "regenerate-invite" =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              educatorService.regenerateInviteCode(cid, userId).flatMap {
                case Some(cls) => Ok(cls.asJson)
                case None      => NotFound(Json.obj("error" -> Json.fromString("class not found")))
              }
        }

      case req @ GET -> Root / "educator" / "classes" / classId / "students" =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  educatorService.listStudents(cid).flatMap(students => Ok(students.asJson))
              }
        }

      case req @ DELETE -> Root / "educator" / "classes" / classId / "students" / studentId =>
        withEducator(req, jwtSecret) { userId =>
          (parseUUID(classId), parseUUID(studentId)) match
            case (Some(cid), Some(sid)) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  educatorService.removeStudent(cid, sid).flatMap(_ =>
                    Ok(Json.obj("removed" -> Json.True))
                  )
              }
            case _ => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
        }

      case req @ GET -> Root / "educator" / "classes" / classId / "lessons" =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  educatorService.listClassLessons(cid).flatMap(lessons => Ok(lessons.asJson))
              }
        }

      case req @ POST -> Root / "educator" / "classes" / classId / "lessons" =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  req.as[AssignLessonRequest].flatMap { body =>
                    parseUUID(body.lessonId) match
                      case None => BadRequest(Json.obj("error" -> Json.fromString("invalid lesson id")))
                      case Some(lid) =>
                        educatorService.assignLesson(cid, lid).flatMap {
                          case Some(lesson) => Created(lesson.asJson)
                          case None         => Conflict(Json.obj("error" -> Json.fromString("lesson already assigned")))
                        }
                  }
              }
        }

      case req @ DELETE -> Root / "educator" / "classes" / classId / "lessons" / lessonId =>
        withEducator(req, jwtSecret) { userId =>
          (parseUUID(classId), parseUUID(lessonId)) match
            case (Some(cid), Some(lid)) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  educatorService.unassignLesson(cid, lid).flatMap(_ =>
                    Ok(Json.obj("removed" -> Json.True))
                  )
              }
            case _ => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
        }

      case req @ PUT -> Root / "educator" / "classes" / classId / "lessons" / "order" =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  req.as[ReorderLessonsRequest].flatMap { body =>
                    val ids = body.lessonIds.flatMap(parseUUID)
                    educatorService.reorderLessons(cid, ids).flatMap(_ =>
                      Ok(Json.obj("reordered" -> Json.True))
                    )
                  }
              }
        }

      case req @ POST -> Root / "educator" / "lessons" =>
        withEducator(req, jwtSecret) { userId =>
          req.as[CreateLessonRequest].flatMap { body =>
            validateLesson(body) {
              educatorService.createLesson(
                userId, body.title.trim, body.description.trim, body.difficulty, body.template,
                body.tonicIdx, body.scaleName, body.tsTop, body.tsBottom,
                body.sopranoBeats, body.bassBeats, body.figuredBass
              ).flatMap(lesson => Created(lesson.asJson))
            }
          }
        }

      case req @ GET -> Root / "educator" / "lessons" / lessonId =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(lessonId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid lesson id")))
            case Some(lid) =>
              educatorService.getLesson(lid, userId).flatMap {
                case Some(lesson) => Ok(lesson.asJson)
                case None         => NotFound(Json.obj("error" -> Json.fromString("lesson not found")))
              }
        }

      case req @ PUT -> Root / "educator" / "lessons" / lessonId =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(lessonId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid lesson id")))
            case Some(lid) =>
              req.as[CreateLessonRequest].flatMap { body =>
                validateLesson(body) {
                  educatorService.updateLesson(
                    lid, userId, body.title.trim, body.description.trim, body.difficulty, body.template,
                    body.tonicIdx, body.scaleName, body.tsTop, body.tsBottom,
                    body.sopranoBeats, body.bassBeats, body.figuredBass
                  ).flatMap {
                    case Some(lesson) => Ok(lesson.asJson)
                    case None         => NotFound(Json.obj("error" -> Json.fromString("lesson not found")))
                  }
                }
              }
        }

      case req @ DELETE -> Root / "educator" / "lessons" / lessonId =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(lessonId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid lesson id")))
            case Some(lid) =>
              educatorService.deleteLesson(lid, userId).flatMap(_ =>
                Ok(Json.obj("deleted" -> Json.True))
              )
        }

      case req @ POST -> Root / "educator" / "lessons" / lessonId / "duplicate" =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(lessonId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid lesson id")))
            case Some(lid) =>
              educatorService.duplicateLesson(lid, userId).flatMap {
                case Some(lesson) => Created(lesson.asJson)
                case None         => NotFound(Json.obj("error" -> Json.fromString("lesson not found")))
              }
        }

      // Gradebook: all student scores for a class
      case req @ GET -> Root / "educator" / "classes" / classId / "grades" =>
        withEducator(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  educatorService.classGrades(cid).flatMap { grades =>
                    Ok(grades.map(g => Json.obj(
                      "studentId"   -> g.studentId.toString.asJson,
                      "studentName" -> g.studentName.asJson,
                      "lessonId"    -> g.lessonId.toString.asJson,
                      "score"       -> g.score.map(_.toDouble).asJson,
                      "status"      -> g.status.asJson
                    )).asJson)
                  }
              }
        }

      // View a student's work for a specific lesson
      case req @ GET -> Root / "educator" / "classes" / classId / "students" / studentId / "lessons" / lessonId / "work" =>
        withEducator(req, jwtSecret) { userId =>
          (parseUUID(classId), parseUUID(studentId), parseUUID(lessonId)) match
            case (Some(cid), Some(sid), Some(lid)) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  educatorService.getStudentWork(sid, lid, cid).flatMap {
                    case Some(work) => Ok(Json.obj(
                      "trebleBeats"   -> work.trebleBeats,
                      "bassBeats"     -> work.bassBeats,
                      "studentRomans" -> work.studentRomans,
                      "score"         -> work.score.map(_.toDouble).asJson,
                      "status"        -> work.status.asJson
                    ))
                    case None => NotFound(Json.obj("error" -> Json.fromString("no work found")))
                  }
              }
            case _ => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
        }

      // Grade a student's submitted work
      case req @ PUT -> Root / "educator" / "classes" / classId / "students" / studentId / "lessons" / lessonId / "grade" =>
        withEducator(req, jwtSecret) { userId =>
          (parseUUID(classId), parseUUID(studentId), parseUUID(lessonId)) match
            case (Some(cid), Some(sid), Some(lid)) =>
              educatorService.getClassDetail(cid, userId).flatMap {
                case None => NotFound(Json.obj("error" -> Json.fromString("class not found")))
                case Some(_) =>
                  req.as[GradeWorkRequest].flatMap { body =>
                    import Validation._
                    validate(
                      (body.score < 0 || body.score > 100) -> "score must be between 0 and 100"
                    ) {
                    educatorService.gradeWork(sid, lid, cid, body.score).flatMap {
                      case Some(work) => Ok(Json.obj(
                        "score"  -> work.score.map(_.toDouble).asJson,
                        "status" -> work.status.asJson
                      ))
                      case None => NotFound(Json.obj("error" -> Json.fromString("no submitted work found")))
                    }
                    }
                  }
              }
            case _ => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
        }
    }

  private def validateLesson(body: CreateLessonRequest)(action: => IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    import Validation._
    validate(
      body.title.isBlank                      -> "title is required",
      tooLong(body.title, MaxShortText)         -> s"title must be at most $MaxShortText characters",
      body.description.isBlank                -> "description is required",
      tooLong(body.description, MaxTextLength)  -> s"description must be at most $MaxTextLength characters",
      notIn(body.difficulty, Difficulties)    -> s"difficulty must be one of: ${Difficulties.mkString(", ")}",
      notIn(body.template, Templates)         -> s"template must be one of: ${Templates.mkString(", ")}",
      outOfRange(body.tonicIdx, 0, 13)        -> "tonicIdx must be between 0 and 13",
      notIn(body.scaleName, ScaleNames)       -> s"scaleName must be one of: ${ScaleNames.mkString(", ")}",
      outOfRange(body.tsTop, 1, 12)           -> "tsTop must be between 1 and 12",
      (body.tsBottom != 2 && body.tsBottom != 4 && body.tsBottom != 8) -> "tsBottom must be 2, 4, or 8",
      jsonTooBig(body.sopranoBeats)           -> "sopranoBeats too large",
      body.bassBeats.exists(jsonTooBig(_))    -> "bassBeats too large",
      body.figuredBass.exists(jsonTooBig(_))  -> "figuredBass too large",
    )(action)

  private def withEducator(req: Request[IO], jwtSecret: String)(action: UUID => IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    extractUserId(req, jwtSecret).flatMap {
      case None =>
        Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
      case Some(userId) =>
        action(userId)
    }.handleErrorWith { e =>
      IO(e.printStackTrace()) *>
        InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
    }

  private def extractUserId(req: Request[IO], jwtSecret: String): IO[Option[UUID]] =
    IO.pure {
      req.headers
        .get[Authorization]
        .collect { case Authorization(Credentials.Token(_, token)) => token }
        .flatMap(AuthService.verifyToken(_, jwtSecret))
    }
