package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import io.circe.Json
import org.http4s.client.Client
import org.http4s.{Request, Method, Uri}
import org.http4s.circe.CirceEntityCodec._
import skunk.Session
import contrapunctus.backend.db.{AuthProviders, Users}
import contrapunctus.backend.domain.User

import java.util.UUID

trait OAuthService:
  def authenticateGoogle(idToken: String, isEducator: Boolean): IO[Either[OAuthService.OAuthError, (User, String)]]

object OAuthService:
  enum OAuthError:
    case InvalidToken
    case ProviderError(msg: String)

  def make(
    pool: Resource[IO, Session[IO]],
    httpClient: Client[IO],
    jwtSecret: String,
    googleClientId: String
  ): OAuthService =
    new OAuthService:
      def authenticateGoogle(idToken: String, isEducator: Boolean): IO[Either[OAuthError, (User, String)]] =
        verifyGoogleToken(idToken).flatMap {
          case Left(err) => IO.pure(Left(err))
          case Right((googleSub, email, name)) =>
            findOrCreateUser("google", googleSub, email, name, isEducator).map(Right(_))
        }

      private def verifyGoogleToken(idToken: String): IO[Either[OAuthError, (String, String, String)]] =
        val uri = Uri.unsafeFromString(s"https://oauth2.googleapis.com/tokeninfo?id_token=$idToken")
        httpClient.expect[Json](Request[IO](Method.GET, uri))
          .map { json =>
            val cursor = json.hcursor
            val aud = cursor.get[String]("aud").toOption
            val sub = cursor.get[String]("sub").toOption
            val email = cursor.get[String]("email").toOption
            val name = cursor.get[String]("name").toOption.getOrElse(
              cursor.get[String]("email").toOption.getOrElse("User")
            )

            if aud.contains(googleClientId) && sub.isDefined && email.isDefined then
              Right((sub.get, email.get, name))
            else
              Left(OAuthError.InvalidToken)
          }
          .handleErrorWith { e =>
            IO.pure(Left(OAuthError.ProviderError(e.getMessage)))
          }

      private def findOrCreateUser(
        provider: String,
        providerId: String,
        email: String,
        displayName: String,
        isEducator: Boolean
      ): IO[(User, String)] =
        pool.use { session =>
          // Check if this provider account is already linked
          session.option(AuthProviders.findByProvider)((provider, providerId)).flatMap {
            case Some(userId) =>
              // Known provider link — find user and issue token
              session.unique(Users.findById)(userId).map { user =>
                (user, AuthService.createToken(user.id, jwtSecret))
              }
            case None =>
              // Check if a user with this email already exists (account linking)
              session.option(Users.findByEmail)(email).flatMap {
                case Some((user, _)) =>
                  // Link provider to existing user
                  session.execute(AuthProviders.insert)((user.id, provider, providerId)) *>
                    IO.pure((user, AuthService.createToken(user.id, jwtSecret)))
                case None =>
                  // Create new user without password
                  session.unique(Users.insertOAuth)((email, displayName, isEducator)).flatMap { user =>
                    session.execute(AuthProviders.insert)((user.id, provider, providerId)) *>
                      IO.pure((user, AuthService.createToken(user.id, jwtSecret)))
                  }
              }
          }
        }
