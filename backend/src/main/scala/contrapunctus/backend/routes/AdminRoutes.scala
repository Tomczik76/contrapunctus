package contrapunctus.backend.routes

import cats.effect.{IO, Resource}
import io.circe.Json
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import skunk.Session
import contrapunctus.backend.db.{Admin, RoadmapVotes}
import contrapunctus.backend.domain.{BugReport, FeatureRequest, User}

object AdminRoutes:
  def routes(pool: Resource[IO, Session[IO]], adminPassword: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ GET -> Root / "admin" / "users" =>
        withAdminAuth(req, adminPassword) {
          pool.use(_.execute(Admin.allUsers)).flatMap(users => Ok(users.asJson))
        }

      case req @ GET -> Root / "admin" / "bug-reports" =>
        withAdminAuth(req, adminPassword) {
          pool.use(_.execute(Admin.allBugReports)).flatMap(reports => Ok(reports.asJson))
        }

      case req @ GET -> Root / "admin" / "feature-requests" =>
        withAdminAuth(req, adminPassword) {
          pool.use(_.execute(Admin.allFeatureRequests)).flatMap(requests => Ok(requests.asJson))
        }

      case req @ GET -> Root / "admin" / "roadmap-votes" =>
        withAdminAuth(req, adminPassword) {
          pool.use(_.execute(RoadmapVotes.countsByFeature)).flatMap { counts =>
            val countsMap = counts.map((k, v) => k -> Json.fromLong(v)).toMap
            Ok(Json.fromJsonObject(io.circe.JsonObject.fromMap(countsMap)))
          }
        }
    }

  private def withAdminAuth(req: Request[IO], adminPassword: String)(action: IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    val token = req.headers.get(org.typelevel.ci.CIString("X-Admin-Token")).map(_.head.value)
    if token.contains(adminPassword) then action
    else Forbidden(Json.obj("error" -> Json.fromString("invalid admin token")))
