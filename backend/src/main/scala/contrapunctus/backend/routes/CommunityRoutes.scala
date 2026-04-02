package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.deriveDecoder
import io.circe.syntax._
import org.http4s.{HttpRoutes, Request}
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._
import org.http4s.headers.Authorization
import org.http4s.Credentials
import contrapunctus.backend.db.PointEvents
import contrapunctus.backend.domain.{CommunityExercise, ExerciseAttempt, PointEvent, Rank}
import contrapunctus.backend.services.{AuthService, ExerciseScoring, ExerciseService, PointsService}

import java.util.UUID

case class CreateExerciseRequest(
  title: String,
  description: String,
  template: String,
  tonicIdx: Int,
  scaleName: String,
  tsTop: Int,
  tsBottom: Int,
  sopranoBeats: Json,
  bassBeats: Option[Json],
  figuredBass: Option[Json],
  referenceSolution: Option[Json],
  rnAnswerKey: Option[Json],
  tags: Option[List[String]]
)
object CreateExerciseRequest:
  given Decoder[CreateExerciseRequest] = deriveDecoder

case class SaveAttemptRequest(trebleBeats: Json, bassBeats: Json, studentRomans: Json)
object SaveAttemptRequest:
  given Decoder[SaveAttemptRequest] = deriveDecoder

case class SubmitAttemptRequest(score: Option[BigDecimal], completed: Option[Boolean])
object SubmitAttemptRequest:
  given Decoder[SubmitAttemptRequest] = deriveDecoder

case class ExerciseVoteRequest(vote: String)
object ExerciseVoteRequest:
  given Decoder[ExerciseVoteRequest] = deriveDecoder

object CommunityRoutes:

  given Encoder[PointEvents.LeaderboardRow] = Encoder.instance { r =>
    Json.obj(
      "userId"      -> r.userId.toString.asJson,
      "displayName" -> r.displayName.asJson,
      "totalPoints" -> r.totalPoints.asJson,
      "rankTitle"   -> r.rankTitle.asJson
    )
  }

  /** Validate that the cantus firmus starts and ends on the tonic. */
  private def cfNotOnTonic(body: CreateExerciseRequest): Boolean =
    if body.template != "species_counterpoint" then false
    else
      val cfJson = if body.bassBeats.exists(_.asArray.exists(_.nonEmpty)) then body.bassBeats.get
                   else body.sopranoBeats
      val notes = ExerciseScoring.parseBeatsFlat(cfJson)
      if notes.size < 2 then true // too short is an error
      else
        val tonicValue = ExerciseScoring.tonicPitchClass(body.tonicIdx)
        notes.head.noteType.value != tonicValue || notes.last.noteType.value != tonicValue

  def routes(exerciseService: ExerciseService, pointsService: PointsService, jwtSecret: String): HttpRoutes[IO] =
    HttpRoutes.of[IO] {

      // ── Exercise CRUD ──

      case req @ POST -> Root / "community" / "exercises" =>
        withAuth(req, jwtSecret) { userId =>
          req.as[CreateExerciseRequest].flatMap { body =>
            import Validation._
            validate(
              body.title.isBlank                       -> "title is required",
              tooLong(body.title, MaxShortText)          -> s"title must be at most $MaxShortText characters",
              tooLong(body.description, MaxTextLength)   -> s"description must be at most $MaxTextLength characters",
              notIn(body.template, Set("harmonize_melody", "rn_analysis", "species_counterpoint")) -> "template must be harmonize_melody, rn_analysis, or species_counterpoint",
              outOfRange(body.tonicIdx, 0, 13)         -> "tonicIdx must be between 0 and 13",
              notIn(body.scaleName, ScaleNames)         -> s"scaleName must be one of: ${ScaleNames.mkString(", ")}",
              outOfRange(body.tsTop, 1, 12)            -> "tsTop must be between 1 and 12",
              (body.tsBottom != 2 && body.tsBottom != 4 && body.tsBottom != 8) -> "tsBottom must be 2, 4, or 8",
              jsonTooBig(body.sopranoBeats)             -> "sopranoBeats too large",
              body.bassBeats.exists(jsonTooBig(_))      -> "bassBeats too large",
              body.referenceSolution.exists(jsonTooBig(_)) -> "referenceSolution too large",
              body.rnAnswerKey.exists(jsonTooBig(_))     -> "rnAnswerKey too large",
              cfNotOnTonic(body)                         -> "cantus firmus must start and end on the tonic",
            ) {
              exerciseService.create(userId, body.title.trim, body.description.trim, body.template,
                body.tonicIdx, body.scaleName, body.tsTop, body.tsBottom,
                body.sopranoBeats, body.bassBeats, body.figuredBass,
                body.referenceSolution, body.rnAnswerKey, body.tags.getOrElse(Nil)
              ).flatMap(ex => Created(ex.asJson))
            }
          }
        }

      case req @ GET -> Root / "community" / "exercises" =>
        exerciseService.listPublished.flatMap(exercises => Ok(exercises.asJson))

      case req @ GET -> Root / "community" / "exercises" / "mine" =>
        withAuth(req, jwtSecret) { userId =>
          exerciseService.listByCreator(userId).flatMap(exercises => Ok(exercises.asJson))
        }

      case GET -> Root / "community" / "exercises" / UUIDVar(id) =>
        exerciseService.get(id).flatMap {
          case Some(ex) => Ok(ex.asJson)
          case None     => NotFound(Json.obj("error" -> Json.fromString("not found")))
        }

      case req @ PUT -> Root / "community" / "exercises" / UUIDVar(id) =>
        withAuth(req, jwtSecret) { userId =>
          req.as[CreateExerciseRequest].flatMap { body =>
            import Validation._
            validate(
              body.title.isBlank                       -> "title is required",
              tooLong(body.title, MaxShortText)          -> s"title must be at most $MaxShortText characters",
              tooLong(body.description, MaxTextLength)   -> s"description must be at most $MaxTextLength characters",
              notIn(body.template, Set("harmonize_melody", "rn_analysis", "species_counterpoint")) -> "template must be harmonize_melody, rn_analysis, or species_counterpoint",
              cfNotOnTonic(body)                         -> "cantus firmus must start and end on the tonic",
            ) {
              exerciseService.update(id, userId, body.title.trim, body.description.trim, body.template,
                body.tonicIdx, body.scaleName, body.tsTop, body.tsBottom,
                body.sopranoBeats, body.bassBeats, body.figuredBass,
                body.referenceSolution, body.rnAnswerKey, body.tags.getOrElse(Nil)
              ).flatMap {
                case Some(ex) => Ok(ex.asJson)
                case None     => NotFound(Json.obj("error" -> Json.fromString("not found or not editable")))
              }
            }
          }
        }

      case req @ POST -> Root / "community" / "exercises" / UUIDVar(id) / "publish" =>
        withAuth(req, jwtSecret) { userId =>
          exerciseService.publish(id, userId).flatMap {
            case Some(ex) => Ok(ex.asJson)
            case None     => NotFound(Json.obj("error" -> Json.fromString("not found or already published")))
          }
        }

      case req @ POST -> Root / "community" / "exercises" / UUIDVar(id) / "unpublish" =>
        withAuth(req, jwtSecret) { userId =>
          exerciseService.unpublish(id, userId).flatMap {
            case Some(ex) => Ok(ex.asJson)
            case None     => NotFound(Json.obj("error" -> Json.fromString("not found or not published")))
          }
        }

      case req @ DELETE -> Root / "community" / "exercises" / UUIDVar(id) =>
        withAuth(req, jwtSecret) { userId =>
          exerciseService.delete(id, userId) *> Ok(Json.obj("ok" -> Json.fromBoolean(true)))
        }

      // ── Voting ──

      case req @ POST -> Root / "community" / "exercises" / UUIDVar(id) / "vote" =>
        withAuth(req, jwtSecret) { userId =>
          req.as[ExerciseVoteRequest].flatMap { body =>
            import Validation._
            validate(
              notIn(body.vote, VoteValues) -> "vote must be 'up' or 'down'"
            ) {
              exerciseService.vote(id, userId, body.vote) *>
                Ok(Json.obj("ok" -> Json.fromBoolean(true)))
            }
          }
        }

      case req @ GET -> Root / "community" / "exercises" / UUIDVar(id) / "vote" =>
        withAuth(req, jwtSecret) { userId =>
          exerciseService.getUserVote(id, userId).flatMap {
            case Some(v) => Ok(Json.obj("vote" -> Json.fromString(v)))
            case None    => Ok(Json.obj("vote" -> Json.Null))
          }
        }

      // ── Attempts ──

      case req @ PUT -> Root / "community" / "exercises" / UUIDVar(id) / "attempt" =>
        withAuth(req, jwtSecret) { userId =>
          req.as[SaveAttemptRequest].flatMap { body =>
            import Validation._
            validate(
              jsonTooBig(body.trebleBeats)   -> "trebleBeats too large",
              jsonTooBig(body.bassBeats)     -> "bassBeats too large",
              jsonTooBig(body.studentRomans) -> "studentRomans too large",
            ) {
              exerciseService.saveAttempt(userId, id, body.trebleBeats, body.bassBeats, body.studentRomans).flatMap {
                case Some(a) => Ok(a.asJson)
                case None    => Conflict(Json.obj("error" -> Json.fromString("already submitted")))
              }
            }
          }
        }

      case req @ POST -> Root / "community" / "exercises" / UUIDVar(id) / "submit" =>
        withAuth(req, jwtSecret) { userId =>
          req.as[SubmitAttemptRequest].flatMap { body =>
            import Validation._
            validate(
              body.score.exists(s => s < 0 || s > 100) -> "score must be between 0 and 100"
            ) {
              exerciseService.submitAttempt(userId, id, body.score, body.completed).flatMap {
                case Some(a) => Ok(a.asJson)
                case None    => Conflict(Json.obj("error" -> Json.fromString("no draft to submit or already submitted")))
              }
            }
          }
        }

      case req @ GET -> Root / "community" / "exercises" / UUIDVar(id) / "attempt" =>
        withAuth(req, jwtSecret) { userId =>
          exerciseService.getAttempt(userId, id).flatMap {
            case Some(a) => Ok(a.asJson)
            case None    => NotFound(Json.obj("error" -> Json.fromString("no attempt found")))
          }
        }

      // ── Points & Leaderboard ──

      case req @ GET -> Root / "community" / "points" =>
        withAuth(req, jwtSecret) { userId =>
          for
            summary <- pointsService.userSummary(userId)
            (totalPoints, streak, rankTitle, displayName) = summary
            nextRank = Rank.nextThreshold(totalPoints)
            resp <- Ok(Json.obj(
              "totalPoints"  -> totalPoints.asJson,
              "streak"       -> streak.asJson,
              "rankTitle"    -> rankTitle.asJson,
              "displayName"  -> displayName.asJson,
              "nextRank"     -> nextRank.map(_._2).asJson,
              "nextThreshold" -> nextRank.map(_._1).asJson,
            ))
          yield resp
        }

      case req @ GET -> Root / "community" / "points" / "history" =>
        withAuth(req, jwtSecret) { userId =>
          pointsService.recentEvents(userId).flatMap(events => Ok(events.asJson))
        }

      case req @ GET -> Root / "community" / "leaderboard" :? TimeframeParam(timeframe) =>
        val tf = timeframe.getOrElse("alltime")
        val query = if tf == "weekly" then pointsService.weeklyLeaderboard else pointsService.allTimeLeaderboard
        query.flatMap(rows => Ok(rows.asJson))
    }

  private object TimeframeParam extends OptionalQueryParamDecoderMatcher[String]("timeframe")

  private def withAuth(req: Request[IO], jwtSecret: String)(action: UUID => IO[org.http4s.Response[IO]]): IO[org.http4s.Response[IO]] =
    extractUserId(req, jwtSecret).flatMap {
      case None =>
        Forbidden(Json.obj("error" -> Json.fromString("invalid or missing token")))
      case Some(userId) =>
        action(userId)
    }.handleErrorWith { e =>
      IO(e.printStackTrace()) *>
        InternalServerError(Json.obj("error" -> Json.fromString("internal server error")))
    }

  private def extractUserId(req: Request[IO], jwtSecret: String): IO[Option[UUID]] =
    IO.pure {
      req.headers
        .get[Authorization]
        .collect { case Authorization(Credentials.Token(_, token)) => token }
        .flatMap(AuthService.verifyToken(_, jwtSecret))
    }
