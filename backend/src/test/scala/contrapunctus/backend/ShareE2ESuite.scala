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

class ShareE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  import TestApp.authHeader

  // Minimal valid 1x1 pixel PNG
  private val tinyPngBytes: Array[Byte] = Array[Byte](
    0x89.toByte, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90.toByte, 0x77, 0x53,
    0xde.toByte, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xd7.toByte, 0x63, 0xf8.toByte, 0xcf.toByte,
    0xc0.toByte, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, 0xe2.toByte,
    0x21, 0xbc.toByte, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae.toByte, 0x42, 0x60, 0x82.toByte
  )

  private val tinyPngBase64 = Base64.getEncoder.encodeToString(tinyPngBytes)

  private def sampleShareRequest(sourceType: String = "project") = Json.obj(
    "sourceType"  -> sourceType.asJson,
    "sourceId"    -> UUID.randomUUID().toString.asJson,
    "title"       -> "My Score".asJson,
    "description" -> "A beautiful composition".asJson,
    "imageBase64" -> tinyPngBase64.asJson
  )

  test("create share returns 201 with valid data") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "share1@test.com", "ShareUser1")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/share")
              .putHeaders(authHeader(token))
              .withEntity(sampleShareRequest())
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Created)
          assert(body.hcursor.get[String]("id").isRight)
          assertEquals(body.hcursor.get[String]("title"), Right("My Score"))
          assertEquals(body.hcursor.get[String]("sourceType"), Right("project"))
          assert(body.hcursor.get[String]("shareUrl").isRight)
          assert(body.hcursor.get[String]("imageUrl").toOption.get.contains(".png"))
      }
    }
  }

  test("create share without auth returns 403") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/share")
              .withEntity(sampleShareRequest())
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  test("create share with invalid sourceType returns 400") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "share2@test.com", "ShareUser2")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/share")
              .putHeaders(authHeader(token))
              .withEntity(sampleShareRequest("invalid"))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("get share page returns HTML with OG tags") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "share3@test.com", "ShareUser3")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/share")
              .putHeaders(authHeader(token))
              .withEntity(sampleShareRequest())
          )
          createBody <- createResp.as[Json]
          id = createBody.hcursor.get[String]("id").toOption.get
          pageResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/share/$id"))
          )
          html <- pageResp.bodyText.compile.string
        yield
          assertEquals(pageResp.status, Status.Ok)
          assert(html.contains("og:title"), s"Expected og:title in HTML")
          assert(html.contains("My Score"), s"Expected title in HTML")
          assert(html.contains("og:image"), s"Expected og:image in HTML")
          assert(html.contains(".png"), s"Expected S3 image URL in HTML")
          assert(html.contains("twitter:card"), s"Expected twitter:card in HTML")
          assert(html.contains("Contrapunctus"), s"Expected Contrapunctus in title")
      }
    }
  }

  test("get non-existent share returns 404") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        val fakeId = UUID.randomUUID()
        for
          pageResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/share/$fakeId"))
          )
        yield assertEquals(pageResp.status, Status.NotFound)
      }
    }
  }
