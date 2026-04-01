package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import skunk.Session
import contrapunctus.backend.db.{PasswordResetTokens, Users}

import java.security.SecureRandom
import java.time.{Instant, OffsetDateTime, ZoneOffset}
import java.util.UUID

trait PasswordResetService:
  def requestReset(email: String): IO[Unit]
  def resetPassword(token: String, newPassword: String): IO[Either[PasswordResetService.ResetError, Unit]]

object PasswordResetService:
  enum ResetError:
    case InvalidOrExpiredToken

  def make(pool: Resource[IO, Session[IO]], emailService: EmailService): PasswordResetService =
    new PasswordResetService:
      private val random = new SecureRandom()

      private def generateToken(): String =
        val bytes = new Array[Byte](32)
        random.nextBytes(bytes)
        bytes.map("%02x".format(_)).mkString

      def requestReset(email: String): IO[Unit] =
        pool.use { session =>
          session.option(Users.findByEmail)(email).flatMap {
            case Some((user, _)) =>
              val token = generateToken()
              val expiresAt = OffsetDateTime.ofInstant(Instant.now.plusSeconds(3600), ZoneOffset.UTC)
              session.execute(PasswordResetTokens.insert)((user.id, token, expiresAt)) *>
                emailService.sendPasswordReset(email, token).handleErrorWith { e =>
                  IO.println(s"[PasswordResetService] Failed to send email to $email: ${e.getMessage}")
                }
            case None =>
              IO.unit // Don't reveal whether email exists
          }
        }

      def resetPassword(token: String, newPassword: String): IO[Either[ResetError, Unit]] =
        pool.use { session =>
          session.option(PasswordResetTokens.findByToken)(token).flatMap {
            case Some((_, userId, expiresAt, used)) if !used && expiresAt.toInstant.isAfter(Instant.now) =>
              val hash = AuthService.hashPassword(newPassword)
              session.execute(Users.updatePasswordHash)((hash, userId)) *>
                session.execute(PasswordResetTokens.markUsed)(token) *>
                IO.pure(Right(()))
            case _ =>
              IO.pure(Left(ResetError.InvalidOrExpiredToken))
          }
        }
