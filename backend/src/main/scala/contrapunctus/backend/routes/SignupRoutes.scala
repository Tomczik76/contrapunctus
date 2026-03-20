package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}
import io.circe.syntax._
import org.http4s.HttpRoutes
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import contrapunctus.backend.domain.User
import contrapunctus.backend.services.{SignupInput, UserService}

case class SignupRequest(email: String, displayName: String, password: String)

object SignupRequest:
  given Decoder[SignupRequest] = deriveDecoder
  given Encoder[SignupRequest] = deriveEncoder

case class AuthResponse(token: String, user: User)

object AuthResponse:
  given Encoder[AuthResponse] = deriveEncoder

object SignupRoutes:
  def routes(userService: UserService): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ POST -> Root / "signup" =>
        req.as[SignupRequest]
          .flatMap { body =>
            val input = SignupInput(body.email, body.displayName, body.password)
            userService.signup(input).flatMap {
              case Right((user, token)) =>
                Created(AuthResponse(token, user).asJson)
              case Left(UserService.SignupError.EmailAlreadyRegistered) =>
                Conflict(Json.obj("error" -> Json.fromString("email already registered")))
            }
          }
          .handleErrorWith { e =>
            IO(e.printStackTrace()) *>
              InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
          }
    }
