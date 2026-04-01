package contrapunctus.backend

import cats.effect.IO
import com.dimafeng.testcontainers.PostgreSQLContainer
import com.dimafeng.testcontainers.munit.TestContainerForAll
import io.circe.Json
import io.circe.syntax._
import munit.CatsEffectSuite
import org.http4s._
import org.http4s.circe.CirceEntityCodec._
import org.http4s.implicits._

class AuthE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  private def signupRequest(email: String, displayName: String, password: String, isEducator: Boolean = false): Request[IO] =
    Request[IO](Method.POST, uri"/api/signup")
      .withEntity(Json.obj(
        "email"       -> email.asJson,
        "displayName" -> displayName.asJson,
        "password"    -> password.asJson,
        "isEducator"  -> isEducator.asJson
      ))

  private def loginRequest(email: String, password: String): Request[IO] =
    Request[IO](Method.POST, uri"/api/login")
      .withEntity(Json.obj(
        "email"    -> email.asJson,
        "password" -> password.asJson
      ))

  test("signup returns 201 with token and user") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(signupRequest("alice@test.com", "Alice", "password123"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Created)
          assert(body.hcursor.get[String]("token").isRight)
          assertEquals(body.hcursor.downField("user").get[String]("email"), Right("alice@test.com"))
          assertEquals(body.hcursor.downField("user").get[String]("displayName"), Right("Alice"))
      }
    }
  }

  test("signup with duplicate email returns 409") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          _     <- app.run(signupRequest("dup@test.com", "First", "password123"))
          resp2 <- app.run(signupRequest("dup@test.com", "Second", "password456"))
        yield assertEquals(resp2.status, Status.Conflict)
      }
    }
  }

  test("signup validates required fields") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(signupRequest("", "Alice", "password123"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assertEquals(body.hcursor.get[String]("error"), Right("email is required"))
      }
    }
  }

  test("signup validates password length") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(signupRequest("short@test.com", "Alice", "short"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assertEquals(body.hcursor.get[String]("error"), Right("password must be at least 8 characters"))
      }
    }
  }

  test("signup validates email format") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(signupRequest("not-an-email", "Alice", "password123"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.BadRequest)
          assertEquals(body.hcursor.get[String]("error"), Right("invalid email format"))
      }
    }
  }

  test("login with valid credentials returns 200 with token") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          _    <- app.run(signupRequest("login@test.com", "LoginUser", "password123"))
          resp <- app.run(loginRequest("login@test.com", "password123"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assert(body.hcursor.get[String]("token").isRight)
          assertEquals(body.hcursor.downField("user").get[String]("email"), Right("login@test.com"))
      }
    }
  }

  test("login with wrong password returns 401") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          _    <- app.run(signupRequest("wrong@test.com", "User", "password123"))
          resp <- app.run(loginRequest("wrong@test.com", "wrongpassword"))
        yield assertEquals(resp.status, Status.Unauthorized)
      }
    }
  }

  test("login with nonexistent email returns 401") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(loginRequest("nobody@test.com", "password123"))
        yield assertEquals(resp.status, Status.Unauthorized)
      }
    }
  }

  test("signup as educator sets isEducator flag") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(signupRequest("educator@test.com", "Teacher", "password123", isEducator = true))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Created)
          assertEquals(body.hcursor.downField("user").get[Boolean]("isEducator"), Right(true))
      }
    }
  }
