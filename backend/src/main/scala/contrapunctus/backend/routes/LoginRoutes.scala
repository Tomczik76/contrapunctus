package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}
import io.circe.syntax._
import org.http4s.{HttpRoutes, Response, Status}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import contrapunctus.backend.services.{LoginInput, UserService}

case class LoginRequest(email: String, password: String)

object LoginRequest:
  given Decoder[LoginRequest] = deriveDecoder
  given Encoder[LoginRequest] = deriveEncoder

object LoginRoutes:
  def routes(userService: UserService): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ POST -> Root / "login" =>
        req.as[LoginRequest]
          .flatMap { body =>
            userService.login(LoginInput(body.email, body.password)).flatMap {
              case Right((user, token)) =>
                Ok(AuthResponse(token, user).asJson)
              case Left(UserService.LoginError.InvalidCredentials) =>
                IO.pure(Response[IO](Status.Unauthorized)
                  .withEntity(Json.obj("error" -> Json.fromString("invalid email or password"))))
            }
          }
          .handleErrorWith { e =>
            IO(e.printStackTrace()) *>
              InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
          }
    }
