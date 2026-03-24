package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Json, Encoder}
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.Authorization
import org.http4s.Credentials
import contrapunctus.backend.db.Classes
import contrapunctus.backend.services.{AuthService, EducatorService}

import java.util.UUID

object JoinRoutes:
  given Encoder[Classes.ClassInfo] = Encoder.instance { c =>
    Json.obj(
      "id"           -> c.id.toString.asJson,
      "name"         -> c.name.asJson,
      "status"       -> c.status.asJson,
      "educatorId"   -> c.educatorId.toString.asJson,
      "educatorName" -> c.educatorName.asJson
    )
  }

  def routes(educatorService: EducatorService, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ GET -> Root / "join" / inviteCode =>
        parseUUID(inviteCode) match
          case None =>
            NotFound(Json.obj("error" -> Json.fromString("invalid invite code")))
          case Some(code) =>
            educatorService.getClassByInviteCode(code).flatMap {
              case None =>
                NotFound(Json.obj("error" -> Json.fromString("class not found")))
              case Some(info) =>
                val base = info.asJson
                extractUserId(req, jwtSecret).flatMap {
                  case None =>
                    Ok(base.deepMerge(Json.obj("enrolled" -> Json.False)))
                  case Some(userId) =>
                    educatorService.isEnrolled(info.id, userId).flatMap { enrolled =>
                      val isOwner = userId == info.educatorId
                      Ok(base.deepMerge(Json.obj(
                        "enrolled" -> Json.fromBoolean(enrolled),
                        "isOwner"  -> Json.fromBoolean(isOwner)
                      )))
                    }
                }
            }

      case req @ POST -> Root / "join" / inviteCode =>
        extractUserId(req, jwtSecret).flatMap {
          case None =>
            Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
          case Some(userId) =>
            parseUUID(inviteCode) match
              case None =>
                NotFound(Json.obj("error" -> Json.fromString("invalid invite code")))
              case Some(code) =>
                educatorService.getClassByInviteCode(code).flatMap {
                  case None =>
                    NotFound(Json.obj("error" -> Json.fromString("class not found")))
                  case Some(info) if info.status != "active" =>
                    BadRequest(Json.obj("error" -> Json.fromString("this class is no longer accepting new students")))
                  case Some(info) if info.educatorId == userId =>
                    BadRequest(Json.obj("error" -> Json.fromString("you cannot enroll in your own class")))
                  case Some(info) =>
                    educatorService.enrollStudent(info.id, userId).flatMap { _ =>
                      Ok(Json.obj(
                        "classId"   -> info.id.toString.asJson,
                        "className" -> info.name.asJson,
                        "enrolled"  -> Json.True
                      ))
                    }
                }
        }.handleErrorWith { e =>
          IO(e.printStackTrace()) *>
            InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
        }
    }

  private def parseUUID(s: String): Option[UUID] =
    scala.util.Try(UUID.fromString(s)).toOption

  private def extractUserId(req: Request[IO], jwtSecret: String): IO[Option[UUID]] =
    IO.pure {
      req.headers
        .get[Authorization]
        .collect { case Authorization(Credentials.Token(_, token)) => token }
        .flatMap(AuthService.verifyToken(_, jwtSecret))
    }
