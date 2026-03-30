package contrapunctus.backend.routes

import cats.effect.{IO, Resource}
import io.circe.{Decoder, Json}
import io.circe.generic.semiauto.deriveDecoder
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import skunk.Session
import contrapunctus.backend.db.{Admin, RoadmapVotes}
import contrapunctus.backend.domain.{AnalysisCorrection, BugReport, FeatureRequest, User}

case class StatusUpdate(status: String)

object StatusUpdate:
  given Decoder[StatusUpdate] = deriveDecoder

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

      case req @ GET -> Root / "admin" / "corrections" =>
        withAdminAuth(req, adminPassword) {
          pool.use(_.execute(Admin.allCorrections)).flatMap(corrections => Ok(corrections.asJson))
        }

      case req @ PUT -> Root / "admin" / "corrections" / UUIDVar(id) / "status" =>
        withAdminAuth(req, adminPassword) {
          req.as[StatusUpdate].flatMap { body =>
            import Validation._
            validate(
              notIn(body.status, CorrectionStatuses) -> s"status must be one of: ${CorrectionStatuses.mkString(", ")}"
            ) {
              pool.use(_.execute(Admin.updateCorrectionStatus)((body.status, id))).flatMap(_ =>
                Ok(Json.obj("ok" -> Json.fromBoolean(true)))
              )
            }
          }
        }
    }

  private def withAdminAuth(req: Request[IO], adminPassword: String)(action: IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    val token = req.headers.get(org.typelevel.ci.CIString("X-Admin-Token")).map(_.head.value)
    if token.contains(adminPassword) then action
    else Forbidden(Json.obj("error" -> Json.fromString("invalid admin token")))
