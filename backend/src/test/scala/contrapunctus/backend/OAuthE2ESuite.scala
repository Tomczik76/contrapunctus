package contrapunctus.backend

import cats.effect.IO
import com.dimafeng.testcontainers.PostgreSQLContainer
import com.dimafeng.testcontainers.munit.TestContainerForAll
import io.circe.Json
import io.circe.syntax._
import munit.CatsEffectSuite
import org.http4s._
import org.http4s.circe.CirceEntityCodec._
import org.http4s.client.Client
import org.http4s.dsl.io._
import org.http4s.implicits._

class OAuthE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  private val testClientId = "test-google-client-id"

  /** A fake HTTP client that mimics Google's tokeninfo endpoint. */
  private def fakeGoogleClient(
    responses: Map[String, Json] = Map.empty
  ): Client[IO] =
    Client.fromHttpApp(HttpRoutes.of[IO] {
      case req @ GET -> Root / "tokeninfo" =>
        val idToken = req.uri.query.params.getOrElse("id_token", "")
        responses.get(idToken) match
          case Some(json) => Ok(json)
          case None       => BadRequest(Json.obj("error" -> "invalid_token".asJson))
    }.orNotFound)

  private def validTokenInfo(sub: String, email: String, name: String): Json =
    Json.obj(
      "aud"   -> testClientId.asJson,
      "sub"   -> sub.asJson,
      "email" -> email.asJson,
      "name"  -> name.asJson
    )

  private def googleLoginRequest(idToken: String, isEducator: Boolean = false): Request[IO] =
    Request[IO](Method.POST, uri"/api/oauth/google")
      .withEntity(Json.obj(
        "idToken"    -> idToken.asJson,
        "isEducator" -> isEducator.asJson
      ))

  private def withOAuthApp(c: PostgreSQLContainer, tokenResponses: Map[String, Json])(
    f: HttpApp[IO] => IO[Unit]
  ): IO[Unit] =
    TestDatabase.migrate(c) *>
      TestDatabase.sessionPool(c).use { pool =>
        import cats.syntax.semigroupk._
        import contrapunctus.backend.routes._
        import contrapunctus.backend.services._
        import org.http4s.server.Router

        val emailService = EmailService.noOp
        val userService  = UserService.make(pool, TestApp.jwtSecret, emailService)
        val httpClient   = fakeGoogleClient(tokenResponses)
        val oAuthService = OAuthService.make(pool, httpClient, TestApp.jwtSecret, testClientId, emailService)

        val apiRoutes = SignupRoutes.routes(userService)
          <+> LoginRoutes.routes(userService)
          <+> OAuthRoutes.routes(oAuthService)

        val app = Router("/api" -> apiRoutes).orNotFound
        f(app)
      }

  test("Google OAuth creates new user on first login") {
    withContainers { case c: PostgreSQLContainer =>
      val tokens = Map("valid-token" -> validTokenInfo("google-123", "alice@gmail.com", "Alice"))
      withOAuthApp(c, tokens) { app =>
        for
          resp <- app.run(googleLoginRequest("valid-token"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assert(body.hcursor.get[String]("token").isRight)
          assertEquals(body.hcursor.downField("user").get[String]("email"), Right("alice@gmail.com"))
          assertEquals(body.hcursor.downField("user").get[String]("displayName"), Right("Alice"))
      }
    }
  }

  test("Google OAuth returns same user on subsequent login") {
    withContainers { case c: PostgreSQLContainer =>
      val tokens = Map("valid-token" -> validTokenInfo("google-456", "bob@gmail.com", "Bob"))
      withOAuthApp(c, tokens) { app =>
        for
          resp1 <- app.run(googleLoginRequest("valid-token"))
          body1 <- resp1.as[Json]
          resp2 <- app.run(googleLoginRequest("valid-token"))
          body2 <- resp2.as[Json]
        yield
          assertEquals(resp1.status, Status.Ok)
          assertEquals(resp2.status, Status.Ok)
          assertEquals(
            body1.hcursor.downField("user").get[String]("id"),
            body2.hcursor.downField("user").get[String]("id")
          )
      }
    }
  }

  test("Google OAuth links to existing email/password account") {
    withContainers { case c: PostgreSQLContainer =>
      val tokens = Map("link-token" -> validTokenInfo("google-789", "existing@test.com", "Existing"))
      withOAuthApp(c, tokens) { app =>
        for
          // Create account with email/password first
          signupResp <- TestApp.signup(app, "existing@test.com", "Existing")
          (_, signupBody) = signupResp
          originalId = signupBody.hcursor.downField("user").get[String]("id").toOption.get

          // Login with Google using same email
          resp <- app.run(googleLoginRequest("link-token"))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          // Should be the same user, not a new one
          assertEquals(body.hcursor.downField("user").get[String]("id"), Right(originalId))
      }
    }
  }

  test("Google OAuth with invalid token returns 401") {
    withContainers { case c: PostgreSQLContainer =>
      withOAuthApp(c, Map.empty) { app =>
        for
          resp <- app.run(googleLoginRequest("bad-token"))
        yield assertEquals(resp.status, Status.InternalServerError)
      }
    }
  }

  test("Google OAuth with wrong audience returns 401") {
    withContainers { case c: PostgreSQLContainer =>
      val wrongAud = Json.obj(
        "aud"   -> "wrong-client-id".asJson,
        "sub"   -> "google-999".asJson,
        "email" -> "wrong@gmail.com".asJson,
        "name"  -> "Wrong".asJson
      )
      val tokens = Map("wrong-aud-token" -> wrongAud)
      withOAuthApp(c, tokens) { app =>
        for
          resp <- app.run(googleLoginRequest("wrong-aud-token"))
        yield assertEquals(resp.status, Status.Unauthorized)
      }
    }
  }

  test("Google OAuth educator signup sets isEducator flag") {
    withContainers { case c: PostgreSQLContainer =>
      val tokens = Map("edu-token" -> validTokenInfo("google-edu", "teacher@gmail.com", "Teacher"))
      withOAuthApp(c, tokens) { app =>
        for
          resp <- app.run(googleLoginRequest("edu-token", isEducator = true))
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Ok)
          assertEquals(body.hcursor.downField("user").get[Boolean]("isEducator"), Right(true))
      }
    }
  }
