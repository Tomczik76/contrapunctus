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
import contrapunctus.backend.db.Users
import contrapunctus.backend.domain.User
import contrapunctus.backend.services.AuthService
import skunk.Session
import cats.effect.Resource

import java.util.UUID

case class UpdateProfileRequest(
  displayName: String,
  country: Option[String],
  city: Option[String]
)
object UpdateProfileRequest:
  given Decoder[UpdateProfileRequest] = deriveDecoder

object ProfileRoutes:
  import Validation._

  def routes(pool: Resource[IO, Session[IO]], jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO]:
      case req @ GET -> Root / "profile" =>
        withAuth(req, jwtSecret) { userId =>
          pool.use(_.option(Users.findById)(userId)).flatMap {
            case Some(user) => Ok(user.asJson)
            case None       => NotFound(Json.obj("error" -> Json.fromString("user not found")))
          }
        }

      case req @ PUT -> Root / "profile" =>
        withAuth(req, jwtSecret) { userId =>
          req.as[UpdateProfileRequest].flatMap { body =>
            validate(
              body.displayName.trim.isEmpty -> "display name is required",
              tooLong(body.displayName, MaxShortText) -> s"display name too long (max $MaxShortText)",
              tooLong(body.country, MaxShortText) -> "country too long",
              tooLong(body.city, MaxShortText) -> "city too long",
            ) {
              val name = body.displayName.trim
              val country = body.country.map(_.trim).filter(_.nonEmpty)
              val city = body.city.map(_.trim).filter(_.nonEmpty)
              pool.use(_.option(Users.updateProfile)((name, country, city, userId))).flatMap {
                case Some(user) => Ok(user.asJson)
                case None       => NotFound(Json.obj("error" -> Json.fromString("user not found")))
              }
            }
          }
        }

  private def withAuth(req: Request[IO], jwtSecret: String)(action: UUID => IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    IO.pure {
      req.headers
        .get[Authorization]
        .collect { case Authorization(Credentials.Token(_, token)) => token }
        .flatMap(AuthService.verifyToken(_, jwtSecret))
    }.flatMap {
      case None         => Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
      case Some(userId) => action(userId)
    }.handleErrorWith { e =>
      IO(e.printStackTrace()) *>
        InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
    }
