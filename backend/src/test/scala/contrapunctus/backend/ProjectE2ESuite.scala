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

class ProjectE2ESuite extends CatsEffectSuite with TestContainerForAll:

  override val containerDef = PostgreSQLContainer.Def(
    dockerImageName = org.testcontainers.utility.DockerImageName.parse("postgres:17"),
    databaseName = "contrapunctus_test",
    username = "test",
    password = "test"
  )

  import TestApp.authHeader

  private val sampleProject = Json.obj(
    "name"        -> "My Composition".asJson,
    "trebleBeats" -> Json.arr(),
    "bassBeats"   -> Json.arr(),
    "tsTop"       -> 4.asJson,
    "tsBottom"    -> 4.asJson,
    "tonicIdx"    -> 0.asJson,
    "scaleName"   -> "major".asJson
  )

  test("create project returns 201") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "proj@test.com", "ProjUser")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .putHeaders(authHeader(token))
              .withEntity(sampleProject)
          )
          body <- resp.as[Json]
        yield
          assertEquals(resp.status, Status.Created)
          assertEquals(body.hcursor.get[String]("name"), Right("My Composition"))
          assert(body.hcursor.get[String]("id").isRight)
      }
    }
  }

  test("create project without auth returns 403") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .withEntity(sampleProject)
          )
        yield assertEquals(resp.status, Status.Forbidden)
      }
    }
  }

  test("create project validates name required") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "val@test.com", "Validator")
          resp <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .putHeaders(authHeader(token))
              .withEntity(sampleProject.mapObject(_.add("name", "".asJson)))
          )
        yield assertEquals(resp.status, Status.BadRequest)
      }
    }
  }

  test("list projects returns empty then populated") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "list@test.com", "ListUser")
          emptyResp <- app.run(
            Request[IO](Method.GET, uri"/api/projects")
              .putHeaders(authHeader(token))
          )
          emptyBody <- emptyResp.as[Json]
          _ <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .putHeaders(authHeader(token))
              .withEntity(sampleProject)
          )
          fullResp <- app.run(
            Request[IO](Method.GET, uri"/api/projects")
              .putHeaders(authHeader(token))
          )
          fullBody <- fullResp.as[Json]
        yield
          assertEquals(emptyResp.status, Status.Ok)
          assertEquals(emptyBody.asArray.map(_.size), Some(0))
          assertEquals(fullResp.status, Status.Ok)
          assertEquals(fullBody.asArray.map(_.size), Some(1))
      }
    }
  }

  test("get project by id") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "get@test.com", "GetUser")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .putHeaders(authHeader(token))
              .withEntity(sampleProject)
          )
          createBody <- createResp.as[Json]
          id = createBody.hcursor.get[String]("id").toOption.get
          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/projects/$id"))
              .putHeaders(authHeader(token))
          )
          getBody <- getResp.as[Json]
        yield
          assertEquals(getResp.status, Status.Ok)
          assertEquals(getBody.hcursor.get[String]("name"), Right("My Composition"))
      }
    }
  }

  test("update project") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "upd@test.com", "UpdUser")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .putHeaders(authHeader(token))
              .withEntity(sampleProject)
          )
          createBody <- createResp.as[Json]
          id = createBody.hcursor.get[String]("id").toOption.get
          updResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/projects/$id"))
              .putHeaders(authHeader(token))
              .withEntity(sampleProject.mapObject(_.add("name", "Renamed".asJson)))
          )
          updBody <- updResp.as[Json]
        yield
          assertEquals(updResp.status, Status.Ok)
          assertEquals(updBody.hcursor.get[String]("name"), Right("Renamed"))
      }
    }
  }

  test("update returns 404 for other user's project") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "owner@test.com", "Owner")
          (token2, _) <- TestApp.signup(app, "other@test.com", "Other")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .putHeaders(authHeader(token1))
              .withEntity(sampleProject)
          )
          createBody <- createResp.as[Json]
          id = createBody.hcursor.get[String]("id").toOption.get
          updResp <- app.run(
            Request[IO](Method.PUT, Uri.unsafeFromString(s"/api/projects/$id"))
              .putHeaders(authHeader(token2))
              .withEntity(sampleProject.mapObject(_.add("name", "Stolen".asJson)))
          )
        yield assertEquals(updResp.status, Status.NotFound)
      }
    }
  }

  test("delete project") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token, _) <- TestApp.signup(app, "del@test.com", "DelUser")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .putHeaders(authHeader(token))
              .withEntity(sampleProject)
          )
          createBody <- createResp.as[Json]
          id = createBody.hcursor.get[String]("id").toOption.get
          delResp <- app.run(
            Request[IO](Method.DELETE, Uri.unsafeFromString(s"/api/projects/$id"))
              .putHeaders(authHeader(token))
          )
          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/projects/$id"))
              .putHeaders(authHeader(token))
          )
        yield
          assertEquals(delResp.status, Status.Ok)
          assertEquals(getResp.status, Status.NotFound)
      }
    }
  }

  test("cannot access other user's project") {
    withContainers { case c: PostgreSQLContainer =>
      TestApp.withApp(c) { app =>
        for
          (token1, _) <- TestApp.signup(app, "user1@test.com", "User1")
          (token2, _) <- TestApp.signup(app, "user2@test.com", "User2")
          createResp <- app.run(
            Request[IO](Method.POST, uri"/api/projects")
              .putHeaders(authHeader(token1))
              .withEntity(sampleProject)
          )
          createBody <- createResp.as[Json]
          id = createBody.hcursor.get[String]("id").toOption.get
          getResp <- app.run(
            Request[IO](Method.GET, Uri.unsafeFromString(s"/api/projects/$id"))
              .putHeaders(authHeader(token2))
          )
        yield assertEquals(getResp.status, Status.NotFound)
      }
    }
  }
