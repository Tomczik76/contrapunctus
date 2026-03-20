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
import contrapunctus.backend.routes.{LoginRoutes, SignupRoutes}
import contrapunctus.backend.services.UserService

object Server:
  def run(pool: Resource[IO, Session[IO]], jwtSecret: String): IO[Nothing] =
    given Network[IO] = Network.forAsync[IO]

    val userService = UserService.make(pool, jwtSecret)

    val healthRoutes = HttpRoutes.of[IO] { case GET -> Root / "health" => Ok("ok") }
    val apiRoutes    = SignupRoutes.routes(userService)
                   <+> LoginRoutes.routes(userService)

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
