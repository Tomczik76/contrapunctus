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

import java.util.{Base64, UUID}

class SharedProjectE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  import TestApp.authHeader

  private val tinyPngBase64 = Base64.getEncoder.encodeToString(
    Array[Byte](0x89.toByte, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90.toByte, 0x77, 0x53,
      0xde.toByte, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
      0x54, 0x08, 0xd7.toByte, 0x63, 0xf8.toByte, 0xcf.toByte,
      0xc0.toByte, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2.toByte,
      0x21, 0xbc.toByte, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae.toByte, 0x42, 0x60, 0x82.toByte)
  )

  private def createProject(app: HttpApp[IO], token: String, name: String = "Test Project"): IO[Json] =
    for
      resp <- app.run(
        Request[IO](Method.POST, uri"/api/projects")
          .putHeaders(authHeader(token))
          .withEntity(Json.obj(
            "name" -> name.asJson,
            "trebleBeats" -> Json.arr(),
            "bassBeats" -> Json.arr(),
            "tsTop" -> 4.asJson,
            "tsBottom" -> 4.asJson,
            "tonicIdx" -> 0.asJson,
            "scaleName" -> "major".asJson
          ))
      )
      body <- resp.as[Json]
    yield body

  test("sharing a project marks it as shared") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "sp1@test.com", "SP1")
          project    <- createProject(app, token)
          projectId  = project.hcursor.get[String]("id").toOption.get
          // Share the project
          _          <- app.run(
            Request[IO](Method.POST, uri"/api/share")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj(
                "sourceType" -> "project".asJson,
                "sourceId" -> projectId.asJson,
                "title" -> "Shared Score".asJson,
                "description" -> "".asJson,
                "imageBase64" -> tinyPngBase64.asJson
              ))
          )
          // Fetch via public endpoint — should now work
          pubResp    <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/projects/$projectId/public"))
          )
          pubBody    <- pubResp.as[Json]
        yield
          assertEquals(pubResp.status, Status.Ok)
          assertEquals(pubBody.hcursor.get[String]("name"), Right("Test Project"))
          assert(pubBody.hcursor.get[String]("userId").isLeft, "userId should be omitted")
      }
    }
  }

  test("unshared project returns 404 on public endpoint") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "sp2@test.com", "SP2")
          project    <- createProject(app, token)
          projectId  = project.hcursor.get[String]("id").toOption.get
          pubResp    <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/projects/$projectId/public"))
          )
        yield assertEquals(pubResp.status, Status.NotFound)
      }
    }
  }

  test("non-existent project returns 404 on public endpoint") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          pubResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/projects/${UUID.randomUUID()}/public"))
          )
        yield assertEquals(pubResp.status, Status.NotFound)
      }
    }
  }

  test("public endpoint does not require authentication") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "sp3@test.com", "SP3")
          project    <- createProject(app, token)
          projectId  = project.hcursor.get[String]("id").toOption.get
          // Share it first
          _          <- app.run(
            Request[IO](Method.POST, uri"/api/share")
              .putHeaders(authHeader(token))
              .withEntity(Json.obj(
                "sourceType" -> "project".asJson,
                "sourceId" -> projectId.asJson,
                "title" -> "Score".asJson,
                "description" -> "".asJson,
                "imageBase64" -> tinyPngBase64.asJson
              ))
          )
          // Fetch without auth header
          pubResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/projects/$projectId/public"))
          )
        yield assertEquals(pubResp.status, Status.Ok)
      }
    }
  }
