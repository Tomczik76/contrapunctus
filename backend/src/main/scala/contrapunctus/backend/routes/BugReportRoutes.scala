package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}
import io.circe.syntax._
import org.http4s.{AuthedRoutes, HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.Authorization
import org.http4s.Credentials
import contrapunctus.backend.domain.BugReport
import contrapunctus.backend.services.{AuthService, BugReportService}

import java.util.UUID

case class BugReportRequest(description: String, stateJson: Json)

object BugReportRequest:
  given Decoder[BugReportRequest] = deriveDecoder

object BugReportRoutes:
  def routes(bugReportService: BugReportService, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ POST -> Root / "bug-reports" =>
        extractUserId(req, jwtSecret).flatMap {
          case None =>
            Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
          case Some(userId) =>
            req.as[BugReportRequest].flatMap { body =>
              import Validation._
              validate(
                body.description.isBlank             -> "description is required",
                tooLong(body.description, MaxTextLength) -> s"description must be at most $MaxTextLength characters",
                jsonTooBig(body.stateJson)            -> "stateJson too large",
              ) {
                bugReportService
                  .submit(userId, body.description, body.stateJson)
                  .flatMap(report => Created(report.asJson))
              }
            }
        }.handleErrorWith { e =>
          IO(e.printStackTrace()) *>
            InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
        }
    }

  private def extractUserId(req: Request[IO], jwtSecret: String): IO[Option[UUID]] =
    IO.pure {
      req.headers
        .get[Authorization]
        .collect { case Authorization(Credentials.Token(_, token)) => token }
        .flatMap(AuthService.verifyToken(_, jwtSecret))
    }
