package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Json}
import io.circe.generic.semiauto.deriveDecoder
import io.circe.syntax._
import org.http4s.{HttpRoutes, MediaType, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.{Authorization, `Content-Type`}
import org.http4s.Credentials
import contrapunctus.backend.domain.ShareImage
import contrapunctus.backend.services.{AuthService, ExerciseService, ShareService}

import java.util.{Base64, UUID}
import org.http4s.QueryParamDecoder
import org.http4s.dsl.impl.OptionalQueryParamDecoderMatcher

case class CreateShareRequest(
  sourceType: String,
  sourceId: UUID,
  title: String,
  description: String,
  imageBase64: String
)
object CreateShareRequest:
  given Decoder[CreateShareRequest] = deriveDecoder

case class ExerciseShareRequest(
  imageBase64: String
)
object ExerciseShareRequest:
  given Decoder[ExerciseShareRequest] = deriveDecoder

object ShareRoutes:

  private val MaxImageBytes = 500_000 // 500KB
  private object ForceParam extends OptionalQueryParamDecoderMatcher[Boolean]("force")

  def apiRoutes(shareService: ShareService, backendBaseUrl: String, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {

      case req @ POST -> Root / "share" =>
        withAuth(req, jwtSecret) { userId =>
          req.as[CreateShareRequest].flatMap { body =>
            val validSourceTypes = Set("project", "exercise")
            val imageBytes = scala.util.Try(Base64.getDecoder.decode(body.imageBase64)).toOption

            import Validation._
            validate(
              notIn(body.sourceType, validSourceTypes) -> "sourceType must be 'project' or 'exercise'",
              body.title.isBlank                       -> "title is required",
              tooLong(body.title, 300)                 -> "title must be at most 300 characters",
              imageBytes.isEmpty                       -> "imageBase64 must be valid base64",
              imageBytes.exists(_.length > MaxImageBytes) -> s"image must be at most ${MaxImageBytes / 1000}KB",
            ) {
              val decoded = imageBytes.get
              shareService.create(userId, body.sourceType, body.sourceId, body.title.trim, body.description.trim, decoded).flatMap { share =>
                val shareUrl = s"$backendBaseUrl/share/${share.id}"
                val responseJson = share.asJson.mapObject(_.add("shareUrl", Json.fromString(shareUrl)))
                Created(responseJson)
              }
            }
          }
        }
    }

  def exerciseShareRoutes(shareService: ShareService, exerciseService: ExerciseService, backendBaseUrl: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {

      // Returns existing share URL if the exercise hasn't changed, or null
      case GET -> Root / "community" / "exercises" / UUIDVar(exerciseId) / "share" =>
        exerciseService.get(exerciseId).flatMap {
          case None => NotFound(Json.obj("error" -> Json.fromString("exercise not found")))
          case Some(exercise) =>
            shareService.getBySource("exercise", exerciseId).flatMap {
              case Some(share) if !share.createdAt.isBefore(exercise.contentUpdatedAt) =>
                val shareUrl = s"$backendBaseUrl/share/${share.id}"
                Ok(Json.obj("shareUrl" -> Json.fromString(shareUrl), "id" -> Json.fromString(share.id.toString)))
              case _ =>
                Ok(Json.obj("shareUrl" -> Json.Null))
            }
        }

      // Creates or refreshes the share image for an exercise (no auth required)
      // ?force=true skips the cache check and always creates a new image
      case req @ POST -> Root / "community" / "exercises" / UUIDVar(exerciseId) / "share" :? ForceParam(force) =>
        exerciseService.get(exerciseId).flatMap {
          case None => NotFound(Json.obj("error" -> Json.fromString("exercise not found")))
          case Some(exercise) =>
            val checkCache = if force.contains(true) then IO.pure(Option.empty[ShareImage]) else shareService.getBySource("exercise", exerciseId)
            checkCache.flatMap {
              case Some(share) if !share.createdAt.isBefore(exercise.contentUpdatedAt) =>
                val shareUrl = s"$backendBaseUrl/share/${share.id}"
                Ok(Json.obj("shareUrl" -> Json.fromString(shareUrl), "id" -> Json.fromString(share.id.toString)))
              case _ =>
                req.as[ExerciseShareRequest].flatMap { body =>
                  val imageBytes = scala.util.Try(Base64.getDecoder.decode(body.imageBase64)).toOption

                  import Validation._
                  validate(
                    imageBytes.isEmpty                       -> "imageBase64 must be valid base64",
                    imageBytes.exists(_.length > MaxImageBytes) -> s"image must be at most ${MaxImageBytes / 1000}KB",
                  ) {
                    val decoded = imageBytes.get
                    shareService.create(exercise.creatorId, "exercise", exerciseId, exercise.title.trim, exercise.description.trim, decoded).flatMap { share =>
                      val shareUrl = s"$backendBaseUrl/share/${share.id}"
                      val responseJson = share.asJson.mapObject(_.add("shareUrl", Json.fromString(shareUrl)))
                      Created(responseJson)
                    }
                  }
                }
            }
        }
    }

  def publicRoutes(shareService: ShareService, backendBaseUrl: String, frontendBaseUrl: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {

      case GET -> Root / "share" / UUIDVar(id) =>
        shareService.get(id).flatMap {
          case Some(share) =>
            val redirectPath = share.sourceType match
              case "project"  => s"/shared/${share.sourceId}"
              case "exercise" => s"/community/${share.sourceId}"
              case _          => "/"

            val escapedTitle = escapeHtml(share.title)
            val escapedDesc  = escapeHtml(share.description)
            val html = s"""<!DOCTYPE html>
<html>
<head>
  <meta property="og:title" content="$escapedTitle" />
  <meta property="og:description" content="$escapedDesc" />
  <meta property="og:image" content="${share.imageUrl}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="$backendBaseUrl/share/${share.id}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <title>$escapedTitle — Contrapunctus</title>
</head>
<body>
  <p>Redirecting...</p>
  <script>window.location.replace("$frontendBaseUrl$redirectPath");</script>
</body>
</html>"""
            Ok.apply(html)(
              implicitly[cats.Applicative[IO]],
              org.http4s.EntityEncoder.stringEncoder[IO]
            ).map(_.withContentType(`Content-Type`(MediaType.text.html)))
          case None =>
            NotFound("not found")
        }
    }

  private def escapeHtml(s: String): String =
    s.replace("&", "&amp;")
     .replace("\"", "&quot;")
     .replace("<", "&lt;")
     .replace(">", "&gt;")

  private def withAuth(req: Request[IO], jwtSecret: String)(action: UUID => IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    IO.pure {
      req.headers
        .get[Authorization]
        .collect { case Authorization(Credentials.Token(_, token)) => token }
        .flatMap(AuthService.verifyToken(_, jwtSecret))
    }.flatMap {
      case None =>
        Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
      case Some(userId) =>
        action(userId)
    }.handleErrorWith { e =>
      IO(e.printStackTrace()) *>
        InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
    }
