package contrapunctus.backend.routes

import cats.effect.{IO, Resource}
import io.circe.Json
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.Authorization
import org.http4s.Credentials
import skunk.Session
import contrapunctus.backend.db.RoadmapVotes
import contrapunctus.backend.services.AuthService

import java.util.UUID

object RoadmapRoutes:
  def routes(pool: Resource[IO, Session[IO]], jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ GET -> Root / "roadmap-votes" =>
        extractUserId(req, jwtSecret).flatMap {
          case None =>
            Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
          case Some(userId) =>
            for
              counts    <- pool.use(_.execute(RoadmapVotes.countsByFeature))
              userVotes <- pool.use(_.execute(RoadmapVotes.userVotes, userId))
              countsMap  = counts.map((k, v) => k -> Json.fromLong(v)).toMap
              resp <- Ok(Json.obj(
                "counts"    -> Json.fromJsonObject(io.circe.JsonObject.fromMap(countsMap)),
                "userVotes" -> userVotes.asJson
              ))
            yield resp
        }

      case req @ POST -> Root / "roadmap-votes" / featureKey =>
        extractUserId(req, jwtSecret).flatMap {
          case None =>
            Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
          case Some(userId) =>
            import Validation._
            validate(
              featureKey.isBlank                  -> "feature key is required",
              tooLong(featureKey, MaxShortText)   -> s"feature key must be at most $MaxShortText characters",
            ) {
              pool.use { session =>
                for
                  exists <- session.unique(RoadmapVotes.exists, (userId, featureKey))
                  _      <- if exists then session.execute(RoadmapVotes.delete, (userId, featureKey))
                            else session.execute(RoadmapVotes.upsert, (userId, featureKey))
                  resp   <- Ok(Json.obj("voted" -> Json.fromBoolean(!exists)))
                yield resp
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
