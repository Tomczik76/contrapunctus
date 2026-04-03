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
import contrapunctus.backend.domain.Project
import contrapunctus.backend.services.{AuthService, ProjectService}

import java.util.UUID

case class SaveProjectRequest(
  name: String,
  trebleBeats: Json,
  bassBeats: Json,
  tsTop: Int,
  tsBottom: Int,
  tonicIdx: Int,
  scaleName: String
)
object SaveProjectRequest:
  given Decoder[SaveProjectRequest] = deriveDecoder

object ProjectRoutes:

  def routes(projectService: ProjectService, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {

      case req @ POST -> Root / "projects" =>
        withAuth(req, jwtSecret) { userId =>
          req.as[SaveProjectRequest].flatMap { body =>
            import Validation._
            validate(
              body.name.isBlank                       -> "name is required",
              tooLong(body.name, MaxShortText)        -> s"name must be at most $MaxShortText characters",
              outOfRange(body.tonicIdx, 0, 13)        -> "tonicIdx must be between 0 and 13",
              notIn(body.scaleName, ScaleNames)        -> s"scaleName must be one of: ${ScaleNames.mkString(", ")}",
              outOfRange(body.tsTop, 1, 12)           -> "tsTop must be between 1 and 12",
              (body.tsBottom != 2 && body.tsBottom != 4 && body.tsBottom != 8) -> "tsBottom must be 2, 4, or 8",
              jsonTooBig(body.trebleBeats)             -> "trebleBeats too large",
              jsonTooBig(body.bassBeats)               -> "bassBeats too large",
            ) {
              projectService.create(userId, body.name.trim, body.trebleBeats, body.bassBeats,
                body.tsTop, body.tsBottom, body.tonicIdx, body.scaleName
              ).flatMap(p => Created(p.asJson))
            }
          }
        }

      case req @ GET -> Root / "projects" =>
        withAuth(req, jwtSecret) { userId =>
          projectService.listByUser(userId).flatMap(ps => Ok(ps.asJson))
        }

      case req @ GET -> Root / "projects" / UUIDVar(id) =>
        withAuth(req, jwtSecret) { userId =>
          projectService.get(id, userId).flatMap {
            case Some(p) => Ok(p.asJson)
            case None    => NotFound(Json.obj("error" -> Json.fromString("not found")))
          }
        }

      case req @ PUT -> Root / "projects" / UUIDVar(id) =>
        withAuth(req, jwtSecret) { userId =>
          req.as[SaveProjectRequest].flatMap { body =>
            import Validation._
            validate(
              body.name.isBlank                       -> "name is required",
              tooLong(body.name, MaxShortText)        -> s"name must be at most $MaxShortText characters",
              outOfRange(body.tonicIdx, 0, 13)        -> "tonicIdx must be between 0 and 13",
              notIn(body.scaleName, ScaleNames)        -> s"scaleName must be one of: ${ScaleNames.mkString(", ")}",
              outOfRange(body.tsTop, 1, 12)           -> "tsTop must be between 1 and 12",
              (body.tsBottom != 2 && body.tsBottom != 4 && body.tsBottom != 8) -> "tsBottom must be 2, 4, or 8",
              jsonTooBig(body.trebleBeats)             -> "trebleBeats too large",
              jsonTooBig(body.bassBeats)               -> "bassBeats too large",
            ) {
              projectService.update(id, userId, body.name.trim, body.trebleBeats, body.bassBeats,
                body.tsTop, body.tsBottom, body.tonicIdx, body.scaleName
              ).flatMap {
                case Some(p) => Ok(p.asJson)
                case None    => NotFound(Json.obj("error" -> Json.fromString("not found")))
              }
            }
          }
        }

      case req @ DELETE -> Root / "projects" / UUIDVar(id) =>
        withAuth(req, jwtSecret) { userId =>
          projectService.delete(id, userId) *> Ok(Json.obj("ok" -> Json.fromBoolean(true)))
        }
    }

  private def withAuth(req: Request[IO], jwtSecret: String)(action: UUID => IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    IO.pure {
      req.headers
        .get[Authorization]
        .collect { case Authorization(Credentials.Token(_, token)) => token }
        .flatMap(AuthService.verifyToken(_, jwtSecret))
    }.flatMap {
      case None =>
        Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
      case Some(userId) =>
        action(userId)
    }.handleErrorWith { e =>
      IO(e.printStackTrace()) *>
        InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
    }
