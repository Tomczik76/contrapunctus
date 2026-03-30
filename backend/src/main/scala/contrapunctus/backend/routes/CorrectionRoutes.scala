package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Json}
import io.circe.generic.semiauto.deriveDecoder
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.Authorization
import org.http4s.Credentials
import contrapunctus.backend.domain.AnalysisCorrection
import contrapunctus.backend.services.{AuthService, CorrectionService}

import java.util.UUID

case class CorrectionRequest(
  category: String,
  measure: Int,
  beat: Int,
  voice: Option[String],
  currentAnalysis: Json,
  suggestedCorrection: Json,
  description: Option[String],
  stateSnapshot: Json
)

object CorrectionRequest:
  given Decoder[CorrectionRequest] = deriveDecoder

case class VoteRequest(vote: String)

object VoteRequest:
  given Decoder[VoteRequest] = deriveDecoder

object CorrectionRoutes:
  def routes(correctionService: CorrectionService, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {
      case req @ POST -> Root / "corrections" =>
        extractUserId(req, jwtSecret).flatMap {
          case None =>
            Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
          case Some(userId) =>
            req.as[CorrectionRequest].flatMap { body =>
              import Validation._
              validate(
                notIn(body.category, CorrectionCategories) -> s"category must be one of: ${CorrectionCategories.mkString(", ")}",
                outOfRange(body.measure, 1, 1000)          -> "measure must be between 1 and 1000",
                outOfRange(body.beat, 1, 100)              -> "beat must be between 1 and 100",
                tooLong(body.voice, MaxShortText)           -> s"voice must be at most $MaxShortText characters",
                tooLong(body.description, MaxTextLength)    -> s"description must be at most $MaxTextLength characters",
                jsonTooBig(body.currentAnalysis)            -> "currentAnalysis too large",
                jsonTooBig(body.suggestedCorrection)        -> "suggestedCorrection too large",
                jsonTooBig(body.stateSnapshot)              -> "stateSnapshot too large",
              ) {
                correctionService
                  .submit(userId, body.category, body.measure, body.beat,
                    body.voice, body.currentAnalysis, body.suggestedCorrection,
                    body.description, body.stateSnapshot)
                  .flatMap(correction => Created(correction.asJson))
              }
            }
        }.handleErrorWith { e =>
          IO(e.printStackTrace()) *>
            InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
        }

      case req @ GET -> Root / "corrections" :? StatusParam(status) +& CategoryParam(category) =>
        import Validation._
        validate(
          status.exists(notIn(_, CorrectionStatuses))     -> s"status must be one of: ${CorrectionStatuses.mkString(", ")}",
          category.exists(notIn(_, CorrectionCategories)) -> s"category must be one of: ${CorrectionCategories.mkString(", ")}",
        ) {
          correctionService.list(status, category)
            .flatMap(corrections => Ok(corrections.asJson))
        }

      case GET -> Root / "corrections" / UUIDVar(id) =>
        correctionService.get(id).flatMap {
          case Some(c) => Ok(c.asJson)
          case None    => NotFound(Json.obj("error" -> Json.fromString("not found")))
        }

      case req @ POST -> Root / "corrections" / UUIDVar(id) / "vote" =>
        extractUserId(req, jwtSecret).flatMap {
          case None =>
            Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
          case Some(userId) =>
            req.as[VoteRequest].flatMap { body =>
              if body.vote != "up" && body.vote != "down" then
                BadRequest(Json.obj("error" -> Json.fromString("vote must be 'up' or 'down'")))
              else
                correctionService.vote(id, userId, body.vote) *>
                  Ok(Json.obj("ok" -> Json.fromBoolean(true)))
            }
        }.handleErrorWith { e =>
          IO(e.printStackTrace()) *>
            InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
        }
    }

  private object StatusParam extends OptionalQueryParamDecoderMatcher[String]("status")
  private object CategoryParam extends OptionalQueryParamDecoderMatcher[String]("category")

  private def extractUserId(req: Request[IO], jwtSecret: String): IO[Option[UUID]] =
    IO.pure {
      req.headers
        .get[Authorization]
        .collect { case Authorization(Credentials.Token(_, token)) => token }
        .flatMap(AuthService.verifyToken(_, jwtSecret))
    }
