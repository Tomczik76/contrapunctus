package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Json, JsonObject}
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request, Response}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import contrapunctus.backend.services.LessonService
import contrapunctus.backend.domain.Lesson

object LessonRoutes:
  def publicRoutes(lessonService: LessonService): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case GET -> Root / "lessons" =>
        lessonService.list.flatMap(lessons => Ok(lessons.asJson))

      case GET -> Root / "lessons" / id =>
        IO(java.util.UUID.fromString(id)).attempt.flatMap {
          case Left(_) => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
          case Right(uuid) =>
            lessonService.get(uuid).flatMap {
              case Some(lesson) => Ok(lesson.asJson)
              case None         => NotFound(Json.obj("error" -> Json.fromString("lesson not found")))
            }
        }
    }

  def adminRoutes(lessonService: LessonService, adminPassword: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ GET -> Root / "admin" / "lessons" =>
        withAdminAuth(req, adminPassword) {
          lessonService.list.flatMap(lessons => Ok(lessons.asJson))
        }

      case req @ POST -> Root / "admin" / "lessons" =>
        withAdminAuth(req, adminPassword) {
          req.as[Json].flatMap { body =>
            val c = body.hcursor
            val result = for
              title        <- c.get[String]("title")
              description  <- c.get[String]("description")
              difficulty   <- c.get[String]("difficulty")
              template     <- c.get[String]("template")
              tonicIdx     <- c.get[Int]("tonicIdx")
              scaleName    <- c.get[String]("scaleName")
              tsTop        <- c.get[Int]("tsTop")
              tsBottom     <- c.get[Int]("tsBottom")
              sopranoBeats <- c.get[Json]("sopranoBeats")
              bassBeats    <- Right(c.get[Json]("bassBeats").toOption)
              figuredBass  <- Right(c.get[Json]("figuredBass").toOption)
              sortOrder    <- c.get[Int]("sortOrder")
            yield (title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, sortOrder)

            result match
              case Left(err) => BadRequest(Json.obj("error" -> Json.fromString(err.getMessage)))
              case Right((title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, sortOrder)) =>
                validateAdminLesson(title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass) {
                  lessonService.create(title.trim, description.trim, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, sortOrder)
                    .flatMap(lesson => Created(lesson.asJson))
                }
          }
        }

      case req @ PUT -> Root / "admin" / "lessons" / id =>
        withAdminAuth(req, adminPassword) {
          IO(java.util.UUID.fromString(id)).attempt.flatMap {
            case Left(_) => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
            case Right(uuid) =>
              req.as[Json].flatMap { body =>
                val c = body.hcursor
                val result = for
                  title        <- c.get[String]("title")
                  description  <- c.get[String]("description")
                  difficulty   <- c.get[String]("difficulty")
                  template     <- c.get[String]("template")
                  tonicIdx     <- c.get[Int]("tonicIdx")
                  scaleName    <- c.get[String]("scaleName")
                  tsTop        <- c.get[Int]("tsTop")
                  tsBottom     <- c.get[Int]("tsBottom")
                  sopranoBeats <- c.get[Json]("sopranoBeats")
                  bassBeats    <- Right(c.get[Json]("bassBeats").toOption)
                  figuredBass  <- Right(c.get[Json]("figuredBass").toOption)
                  sortOrder    <- c.get[Int]("sortOrder")
                yield (title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, sortOrder)

                result match
                  case Left(err) => BadRequest(Json.obj("error" -> Json.fromString(err.getMessage)))
                  case Right((title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, sortOrder)) =>
                    validateAdminLesson(title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass) {
                      lessonService.update(uuid, title.trim, description.trim, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, sortOrder)
                        .flatMap(lesson => Ok(lesson.asJson))
                    }
              }
          }
        }

      case req @ DELETE -> Root / "admin" / "lessons" / id =>
        withAdminAuth(req, adminPassword) {
          IO(java.util.UUID.fromString(id)).attempt.flatMap {
            case Left(_) => BadRequest(Json.obj("error" -> Json.fromString("invalid id")))
            case Right(uuid) =>
              lessonService.delete(uuid).flatMap(_ => Ok(Json.obj("ok" -> Json.fromBoolean(true))))
          }
        }
    }

  private def validateAdminLesson(
    title: String, description: String, difficulty: String, template: String,
    tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
    sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json]
  )(action: => IO[Response[IO]]): IO[Response[IO]] =
    import Validation._
    validate(
      title.isBlank                           -> "title is required",
      tooLong(title, MaxShortText)              -> s"title must be at most $MaxShortText characters",
      description.isBlank                     -> "description is required",
      tooLong(description, MaxTextLength)        -> s"description must be at most $MaxTextLength characters",
      notIn(difficulty, Difficulties)         -> s"difficulty must be one of: ${Difficulties.mkString(", ")}",
      notIn(template, Templates)              -> s"template must be one of: ${Templates.mkString(", ")}",
      outOfRange(tonicIdx, 0, 13)             -> "tonicIdx must be between 0 and 13",
      notIn(scaleName, ScaleNames)            -> s"scaleName must be one of: ${ScaleNames.mkString(", ")}",
      outOfRange(tsTop, 1, 12)                -> "tsTop must be between 1 and 12",
      (tsBottom != 2 && tsBottom != 4 && tsBottom != 8) -> "tsBottom must be 2, 4, or 8",
      jsonTooBig(sopranoBeats)                -> "sopranoBeats too large",
      bassBeats.exists(jsonTooBig(_))         -> "bassBeats too large",
      figuredBass.exists(jsonTooBig(_))       -> "figuredBass too large",
    )(action)

  private def withAdminAuth(req: Request[IO], adminPassword: String)(action: IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    val token = req.headers.get(org.typelevel.ci.CIString("X-Admin-Token")).map(_.head.value)
    if token.contains(adminPassword) then action
    else Forbidden(Json.obj("error" -> Json.fromString("invalid admin token")))
