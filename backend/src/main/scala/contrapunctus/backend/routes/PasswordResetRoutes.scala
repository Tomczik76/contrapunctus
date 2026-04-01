package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Json}
import io.circe.generic.semiauto.deriveDecoder
import io.circe.syntax._
import org.http4s.HttpRoutes
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import contrapunctus.backend.services.PasswordResetService

case class ForgotPasswordRequest(email: String)
object ForgotPasswordRequest:
  given Decoder[ForgotPasswordRequest] = deriveDecoder

case class ResetPasswordRequest(token: String, newPassword: String)
object ResetPasswordRequest:
  given Decoder[ResetPasswordRequest] = deriveDecoder

object PasswordResetRoutes:
  def routes(resetService: PasswordResetService): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ POST -> Root / "forgot-password" =>
        req.as[ForgotPasswordRequest]
          .flatMap { body =>
            resetService.requestReset(body.email.trim.toLowerCase) *>
              Ok(Json.obj("message" -> Json.fromString("If an account exists with that email, a reset link has been sent")))
          }
          .handleErrorWith { e =>
            IO(e.printStackTrace()) *>
              InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
          }

      case req @ POST -> Root / "reset-password" =>
        req.as[ResetPasswordRequest]
          .flatMap { body =>
            import Validation._
            validate(
              (body.newPassword.length < 8) -> "password must be at least 8 characters",
              tooLong(body.newPassword, MaxShortText) -> s"password must be at most $MaxShortText characters",
            ) {
              resetService.resetPassword(body.token, body.newPassword).flatMap {
                case Right(()) =>
                  Ok(Json.obj("message" -> Json.fromString("Password has been reset")))
                case Left(PasswordResetService.ResetError.InvalidOrExpiredToken) =>
                  BadRequest(Json.obj("error" -> Json.fromString("Invalid or expired reset link")))
              }
            }
          }
          .handleErrorWith { e =>
            IO(e.printStackTrace()) *>
              InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
          }
    }
