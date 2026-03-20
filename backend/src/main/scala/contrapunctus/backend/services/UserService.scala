package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import skunk.Session
import contrapunctus.backend.db.Users
import contrapunctus.backend.domain.User

case class SignupInput(email: String, displayName: String, password: String)
case class LoginInput(email: String, password: String)

trait UserService:
  def signup(input: SignupInput): IO[Either[UserService.SignupError, (User, String)]]
  def login(input: LoginInput): IO[Either[UserService.LoginError, (User, String)]]

object UserService:
  enum SignupError:
    case EmailAlreadyRegistered

  enum LoginError:
    case InvalidCredentials

  def make(pool: Resource[IO, Session[IO]], jwtSecret: String): UserService =
    new UserService:
      def signup(input: SignupInput): IO[Either[SignupError, (User, String)]] =
        pool.use { session =>
          val hash = AuthService.hashPassword(input.password)
          session
            .unique(Users.insert)((input.email, input.displayName, hash))
            .map { user =>
              val token = AuthService.createToken(user.id, jwtSecret)
              Right((user, token))
            }
            .recoverWith {
              case e if Option(e.getMessage).exists(_.contains("23505")) =>
                IO.pure(Left(SignupError.EmailAlreadyRegistered))
            }
        }

      def login(input: LoginInput): IO[Either[LoginError, (User, String)]] =
        pool.use { session =>
          session
            .option(Users.findByEmail)(input.email)
            .map {
              case Some((user, hash)) if AuthService.checkPassword(input.password, hash) =>
                val token = AuthService.createToken(user.id, jwtSecret)
                Right((user, token))
              case _ =>
                Left(LoginError.InvalidCredentials)
            }
        }
