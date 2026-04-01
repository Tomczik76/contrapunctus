package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Json}
import io.circe.generic.semiauto.deriveDecoder
import io.circe.syntax._
import org.http4s.{HttpRoutes, Response, Status}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import contrapunctus.backend.services.OAuthService

case class GoogleOAuthRequest(idToken: String, isEducator: Boolean)
object GoogleOAuthRequest:
  given Decoder[GoogleOAuthRequest] = deriveDecoder

object OAuthRoutes:
  def routes(oAuthService: OAuthService): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ POST -> Root / "oauth" / "google" =>
        req.as[GoogleOAuthRequest]
          .flatMap { body =>
            oAuthService.authenticateGoogle(body.idToken, body.isEducator).flatMap {
              case Right((user, token)) =>
                Ok(AuthResponse(token, user).asJson)
              case Left(OAuthService.OAuthError.InvalidToken) =>
                IO.pure(Response[IO](Status.Unauthorized)
                  .withEntity(Json.obj("error" -> Json.fromString("invalid Google token"))))
              case Left(OAuthService.OAuthError.ProviderError(msg)) =>
                InternalServerError(Json.obj("error" -> Json.fromString("authentication failed")))
            }
          }
          .handleErrorWith { e =>
            IO(e.printStackTrace()) *>
              InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
          }
    }
