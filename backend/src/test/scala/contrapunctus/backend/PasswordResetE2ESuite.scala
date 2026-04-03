package contrapunctus.backend

import cats.effect.IO
import cats.effect.kernel.Ref
import com.dimafeng.testcontainers.PostgreSQLContainer
import com.dimafeng.testcontainers.munit.TestContainerForAll
import io.circe.Json
import io.circe.syntax._
import munit.CatsEffectSuite
import org.http4s._
import org.http4s.circe.CirceEntityCodec._
import org.http4s.implicits._
import contrapunctus.backend.services.EmailService

class PasswordResetE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  /** An EmailService that captures the last reset token sent. */
  private def capturingEmailService: IO[(EmailService, Ref[IO, Option[(String, String)]])] =
    Ref.of[IO, Option[(String, String)]](None).map { ref =>
      val service = new EmailService:
        def sendPasswordReset(toEmail: String, resetToken: String): IO[Unit] =
          ref.set(Some((toEmail, resetToken)))
        def sendSignupNotification(userEmail: String, displayName: String, isEducator: Boolean, provider: String): IO[Unit] =
          IO.unit
      (service, ref)
    }

  private def forgotPasswordRequest(email: String): Request[IO] =
    Request[IO](Method.POST, uri"/api/forgot-password")
      .withEntity(Json.obj("email" -> email.asJson))

  private def resetPasswordRequest(token: String, newPassword: String): Request[IO] =
    Request[IO](Method.POST, uri"/api/reset-password")
      .withEntity(Json.obj(
        "token"       -> token.asJson,
        "newPassword" -> newPassword.asJson
      ))

  private def loginRequest(email: String, password: String): Request[IO] =
    Request[IO](Method.POST, uri"/api/login")
      .withEntity(Json.obj(
        "email"    -> email.asJson,
        "password" -> password.asJson
      ))

  private def withCapturingApp(c: PostgreSQLContainer)(
    f: (HttpApp[IO], Ref[IO, Option[(String, String)]]) => IO[Unit]
  ): IO[Unit] =
    TestDatabase.migrate(c) *>
      TestDatabase.sessionPool(c).use { pool =>
        capturingEmailService.flatMap { (emailService, tokenRef) =>
          import cats.syntax.semigroupk._
          import contrapunctus.backend.routes._
          import contrapunctus.backend.services._
          import org.http4s.server.Router

          val userService    = UserService.make(pool, TestApp.jwtSecret, EmailService.noOp)
          val resetService   = PasswordResetService.make(pool, emailService)

          val apiRoutes = SignupRoutes.routes(userService)
            <+> LoginRoutes.routes(userService)
            <+> PasswordResetRoutes.routes(resetService)

          val app = Router("/api" -> apiRoutes).orNotFound
          f(app, tokenRef)
        }
      }

  test("forgot-password always returns 200 even for nonexistent email") {
    withContainers { case c: PostgreSQLContainer =>
      withCapturingApp(c) { (app, tokenRef) =>
        for
          resp <- app.run(forgotPasswordRequest("nobody@test.com"))
          body <- resp.as[Json]
          sent <- tokenRef.get
        yield
          assertEquals(resp.status, Status.Ok)
          assert(body.hcursor.get[String]("message").isRight)
          assertEquals(sent, None) // No email sent for unknown address
      }
    }
  }

  test("forgot-password sends token for existing user") {
    withContainers { case c: PostgreSQLContainer =>
      withCapturingApp(c) { (app, tokenRef) =>
        for
          _ <- TestApp.signup(app, "reset@test.com", "ResetUser")
          resp <- app.run(forgotPasswordRequest("reset@test.com"))
          sent <- tokenRef.get
        yield
          assertEquals(resp.status, Status.Ok)
          assert(sent.isDefined, "Email should have been sent")
          assertEquals(sent.get._1, "reset@test.com")
          assert(sent.get._2.length == 64, "Token should be 64-char hex")
      }
    }
  }

  test("reset-password with valid token changes password") {
    withContainers { case c: PostgreSQLContainer =>
      withCapturingApp(c) { (app, tokenRef) =>
        for
          _    <- TestApp.signup(app, "change@test.com", "ChangeUser")
          _    <- app.run(forgotPasswordRequest("change@test.com"))
          sent <- tokenRef.get
          token = sent.get._2

          resp <- app.run(resetPasswordRequest(token, "newPassword123"))
          body <- resp.as[Json]

          // Old password should no longer work
          loginOld <- app.run(loginRequest("change@test.com", "password123"))
          // New password should work
          loginNew <- app.run(loginRequest("change@test.com", "newPassword123"))
        yield
          assertEquals(resp.status, Status.Ok)
          assertEquals(loginOld.status, Status.Unauthorized)
          assertEquals(loginNew.status, Status.Ok)
      }
    }
  }

  test("reset-password with invalid token returns 400") {
    withContainers { case c: PostgreSQLContainer =>
      withCapturingApp(c) { (app, _) =>
        for
          resp <- app.run(resetPasswordRequest("bogus-token", "newPassword123"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assertEquals(body.hcursor.get[String]("error"), Right("Invalid or expired reset link"))
      }
    }
  }

  test("reset-password token can only be used once") {
    withContainers { case c: PostgreSQLContainer =>
      withCapturingApp(c) { (app, tokenRef) =>
        for
          _    <- TestApp.signup(app, "once@test.com", "OnceUser")
          _    <- app.run(forgotPasswordRequest("once@test.com"))
          sent <- tokenRef.get
          token = sent.get._2

          resp1 <- app.run(resetPasswordRequest(token, "firstReset1!"))
          resp2 <- app.run(resetPasswordRequest(token, "secondReset2!"))
        yield
          assertEquals(resp1.status, Status.Ok)
          assertEquals(resp2.status, Status.BadRequest)
      }
    }
  }

  test("reset-password validates password length") {
    withContainers { case c: PostgreSQLContainer =>
      withCapturingApp(c) { (app, tokenRef) =>
        for
          _    <- TestApp.signup(app, "short@test.com", "ShortUser")
          _    <- app.run(forgotPasswordRequest("short@test.com"))
          sent <- tokenRef.get
          token = sent.get._2

          resp <- app.run(resetPasswordRequest(token, "short"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assertEquals(body.hcursor.get[String]("error"), Right("password must be at least 8 characters"))
      }
    }
  }
