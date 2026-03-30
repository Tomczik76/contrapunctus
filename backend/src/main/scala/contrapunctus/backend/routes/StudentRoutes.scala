package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.deriveDecoder
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.Authorization
import org.http4s.Credentials
import contrapunctus.backend.db.{Classes, EducatorLessons}
import contrapunctus.backend.services.{AuthService, EducatorService}

import java.util.UUID

case class SaveWorkRequest(trebleBeats: Json, bassBeats: Json, studentRomans: Json)
object SaveWorkRequest:
  given Decoder[SaveWorkRequest] = deriveDecoder

case class SubmitWorkRequest()
object SubmitWorkRequest:
  given Decoder[SubmitWorkRequest] = Decoder.instance(_ => Right(SubmitWorkRequest()))

object StudentRoutes:
  given Encoder[Classes.EnrolledClassRow] = Encoder.instance { c =>
    Json.obj(
      "id"               -> c.id.toString.asJson,
      "name"             -> c.name.asJson,
      "educatorName"     -> c.educatorName.asJson,
      "totalLessons"     -> c.totalLessons.asJson,
      "completedLessons" -> c.completedLessons.asJson
    )
  }

  given Encoder[Classes.StudentLessonRow] = Encoder.instance { l =>
    Json.obj(
      "id"          -> l.id.toString.asJson,
      "title"       -> l.title.asJson,
      "description" -> l.description.asJson,
      "difficulty"  -> l.difficulty.asJson,
      "template"    -> l.template.asJson,
      "sortOrder"   -> l.sortOrder.asJson,
      "score"       -> l.score.map(_.toDouble).asJson,
      "workStatus"  -> l.workStatus.asJson
    )
  }

  given Encoder[EducatorLessons.EducatorLessonDetail] = Encoder.instance { l =>
    Json.obj(
      "id"           -> l.id.toString.asJson,
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

  given Encoder[Classes.StudentWork] = Encoder.instance { w =>
    Json.obj(
      "trebleBeats"   -> w.trebleBeats,
      "bassBeats"     -> w.bassBeats,
      "studentRomans" -> w.studentRomans,
      "score"         -> w.score.map(_.toDouble).asJson,
      "status"        -> w.status.asJson
    )
  }

  private def parseUUID(s: String): Option[UUID] =
    scala.util.Try(UUID.fromString(s)).toOption

  def routes(educatorService: EducatorService, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ GET -> Root / "student" / "classes" =>
        withUser(req, jwtSecret) { userId =>
          educatorService.listEnrolledClasses(userId).flatMap(classes => Ok(classes.asJson))
        }

      case req @ GET -> Root / "student" / "classes" / classId / "lessons" =>
        withUser(req, jwtSecret) { userId =>
          parseUUID(classId) match
            case None => BadRequest(Json.obj("error" -> Json.fromString("invalid class id")))
            case Some(cid) =>
              educatorService.isEnrolled(cid, userId).flatMap {
                case false => Forbidden(Json.obj("error" -> Json.fromString("not enrolled")))
                case true =>
                  educatorService.listStudentClassLessons(cid, userId).flatMap(lessons => Ok(lessons.asJson))
              }
        }

      case req @ GET -> Root / "student" / "classes" / classId / "lessons" / lessonId =>
        withUser(req, jwtSecret) { userId =>
          (parseUUID(classId), parseUUID(lessonId)) match
            case (Some(cid), Some(lid)) =>
              educatorService.getStudentLesson(lid, cid, userId).flatMap {
                case Some(lesson) => Ok(lesson.asJson)
                case None         => NotFound(Json.obj("error" -> Json.fromString("lesson not found or not enrolled")))
              }
            case _ => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
        }

      // Get saved work for a lesson
      case req @ GET -> Root / "student" / "classes" / classId / "lessons" / lessonId / "work" =>
        withUser(req, jwtSecret) { userId =>
          (parseUUID(classId), parseUUID(lessonId)) match
            case (Some(cid), Some(lid)) =>
              educatorService.isEnrolled(cid, userId).flatMap {
                case false => Forbidden(Json.obj("error" -> Json.fromString("not enrolled")))
                case true =>
                  educatorService.getWork(userId, lid, cid).flatMap {
                    case Some(work) => Ok(work.asJson)
                    case None       => NotFound(Json.obj("error" -> Json.fromString("no saved work")))
                  }
              }
            case _ => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
        }

      // Save work (draft)
      case req @ PUT -> Root / "student" / "classes" / classId / "lessons" / lessonId / "work" =>
        withUser(req, jwtSecret) { userId =>
          (parseUUID(classId), parseUUID(lessonId)) match
            case (Some(cid), Some(lid)) =>
              educatorService.isEnrolled(cid, userId).flatMap {
                case false => Forbidden(Json.obj("error" -> Json.fromString("not enrolled")))
                case true =>
                  req.as[SaveWorkRequest].flatMap { body =>
                    import Validation._
                    validate(
                      jsonTooBig(body.trebleBeats)   -> "trebleBeats too large",
                      jsonTooBig(body.bassBeats)     -> "bassBeats too large",
                      jsonTooBig(body.studentRomans) -> "studentRomans too large",
                    ) {
                      educatorService.saveWork(userId, lid, cid, body.trebleBeats, body.bassBeats, body.studentRomans).flatMap {
                        case Some(work) => Ok(work.asJson)
                        case None       => Conflict(Json.obj("error" -> Json.fromString("lesson already submitted")))
                      }
                    }
                  }
              }
            case _ => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
        }

      // Submit work (final)
      case req @ POST -> Root / "student" / "classes" / classId / "lessons" / lessonId / "submit" =>
        withUser(req, jwtSecret) { userId =>
          (parseUUID(classId), parseUUID(lessonId)) match
            case (Some(cid), Some(lid)) =>
              educatorService.isEnrolled(cid, userId).flatMap {
                case false => Forbidden(Json.obj("error" -> Json.fromString("not enrolled")))
                case true =>
                  educatorService.submitWork(userId, lid, cid).flatMap {
                    case Some(work) => Ok(work.asJson)
                    case None       => Conflict(Json.obj("error" -> Json.fromString("no draft to submit or already submitted")))
                  }
              }
            case _ => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
        }
    }

  private def withUser(req: Request[IO], jwtSecret: String)(action: UUID => IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
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
