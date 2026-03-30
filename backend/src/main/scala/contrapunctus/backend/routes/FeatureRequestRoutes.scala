package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Json}
import io.circe.generic.semiauto.deriveDecoder
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.Authorization
import org.http4s.Credentials
import contrapunctus.backend.services.{AuthService, FeatureRequestService}

import java.util.UUID

case class FeatureRequestBody(description: String)

object FeatureRequestBody:
  given Decoder[FeatureRequestBody] = deriveDecoder

object FeatureRequestRoutes:
  def routes(featureRequestService: FeatureRequestService, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ POST -> Root / "feature-requests" =>
        extractUserId(req, jwtSecret).flatMap {
          case None =>
            Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
          case Some(userId) =>
            req.as[FeatureRequestBody].flatMap { body =>
              import Validation._
              validate(
                body.description.isBlank             -> "description is required",
                tooLong(body.description, MaxTextLength) -> s"description must be at most $MaxTextLength characters",
              ) {
                featureRequestService
                  .submit(userId, body.description)
                  .flatMap(fr => Created(fr.asJson))
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
