package contrapunctus.backend.middleware

import cats.data.Kleisli
import cats.effect.{IO, Resource}
import org.http4s.{HttpRoutes, Request}
import org.http4s.Credentials
import org.http4s.headers.Authorization
import contrapunctus.backend.db.Users
import contrapunctus.backend.services.AuthService
import skunk.Session

object LastSeenMiddleware:
  def apply(pool: Resource[IO, Session[IO]], jwtSecret: String)(routes: HttpRoutes[IO]): HttpRoutes[IO] =
    Kleisli { (req: Request[IO]) =>
      routes(req).semiflatMap { response =>
        val update = req.headers
          .get[Authorization]
          .collect { case Authorization(Credentials.Token(_, token)) => token }
          .flatMap(AuthService.verifyToken(_, jwtSecret)) match
            case Some(userId) =>
              pool.use(_.execute(Users.updateLastSeenAt)(userId)).void.handleError(_ => ())
            case None => IO.unit
        update.as(response)
      }
    }
