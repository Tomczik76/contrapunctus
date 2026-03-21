package contrapunctus.backend

import cats.syntax.semigroupk._
import cats.effect.{IO, Resource}
import com.comcast.ip4s._
import fs2.io.net.Network
import org.http4s.HttpRoutes
import org.http4s.dsl.io._
import org.http4s.implicits._
import org.http4s.server.Router
import org.http4s.server.middleware.{CORS, Logger}
import org.http4s.ember.server.EmberServerBuilder
import skunk.Session
import contrapunctus.backend.routes.{AdminRoutes, BugReportRoutes, FeatureRequestRoutes, LoginRoutes, RoadmapRoutes, SignupRoutes}
import contrapunctus.backend.services.{BugReportService, FeatureRequestService, UserService}

object Server:
  def run(pool: Resource[IO, Session[IO]], jwtSecret: String, adminPassword: String): IO[Nothing] =
    given Network[IO] = Network.forAsync[IO]

    val userService           = UserService.make(pool, jwtSecret)
    val bugReportService      = BugReportService.make(pool)
    val featureRequestService = FeatureRequestService.make(pool)

    val healthRoutes = HttpRoutes.of[IO] { case GET -> Root / "health" => Ok("ok") }
    val apiRoutes    = SignupRoutes.routes(userService)
                   <+> LoginRoutes.routes(userService)
                   <+> BugReportRoutes.routes(bugReportService, jwtSecret)
                   <+> FeatureRequestRoutes.routes(featureRequestService, jwtSecret)
                   <+> RoadmapRoutes.routes(pool, jwtSecret)
                   <+> AdminRoutes.routes(pool, adminPassword)

    val loggedApiRoutes = Logger.httpRoutes(logHeaders = false, logBody = false)(apiRoutes)
    val routes          = Router("/" -> healthRoutes, "/api" -> loggedApiRoutes)
    val corsRoutes      = CORS.policy.withAllowOriginAll(routes.orNotFound)

    EmberServerBuilder
      .default[IO]
      .withHost(ipv4"0.0.0.0")
      .withPort(port"8080")
      .withHttpApp(corsRoutes)
      .build
      .useForever
