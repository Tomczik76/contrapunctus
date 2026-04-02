package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import io.circe.Json
import skunk.Session
import contrapunctus.backend.db.{CommunityExercises, ExerciseAttempts}
import contrapunctus.backend.domain.{CommunityExercise, ExerciseAttempt, Rank}

import java.util.UUID

trait ExerciseService:
  def create(creatorId: UUID, title: String, description: String, template: String,
    tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
    sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json],
    referenceSolution: Option[Json], rnAnswerKey: Option[Json], tags: List[String]): IO[CommunityExercise]
  def get(id: UUID): IO[Option[CommunityExercise]]
  def listPublished: IO[List[CommunityExercise]]
  def listByCreator(creatorId: UUID): IO[List[CommunityExercise]]
  def update(id: UUID, creatorId: UUID, title: String, description: String, template: String,
    tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
    sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json],
    referenceSolution: Option[Json], rnAnswerKey: Option[Json], tags: List[String]): IO[Option[CommunityExercise]]
  def publish(id: UUID, creatorId: UUID): IO[Option[CommunityExercise]]
  def unpublish(id: UUID, creatorId: UUID): IO[Option[CommunityExercise]]
  def delete(id: UUID, creatorId: UUID): IO[Unit]
  def vote(exerciseId: UUID, userId: UUID, vote: String): IO[Unit]
  def getUserVote(exerciseId: UUID, userId: UUID): IO[Option[String]]
  def saveAttempt(userId: UUID, exerciseId: UUID, trebleBeats: Json, bassBeats: Json, studentRomans: Json): IO[Option[ExerciseAttempt]]
  def submitAttempt(userId: UUID, exerciseId: UUID, clientScore: Option[BigDecimal], clientCompleted: Option[Boolean]): IO[Option[ExerciseAttempt]]
  def getAttempt(userId: UUID, exerciseId: UUID): IO[Option[ExerciseAttempt]]

object ExerciseService:
  def make(pool: Resource[IO, Session[IO]], pointsService: PointsService): ExerciseService =
    new ExerciseService:
      def create(creatorId: UUID, title: String, description: String, template: String,
        tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
        sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json],
        referenceSolution: Option[Json], rnAnswerKey: Option[Json], tags: List[String]): IO[CommunityExercise] =
        pool.use { session =>
          session.unique(CommunityExercises.insert)(
            (creatorId, title, description, template, tonicIdx, scaleName, tsTop, tsBottom,
             sopranoBeats, bassBeats, figuredBass, referenceSolution, rnAnswerKey, tags))
        }

      def get(id: UUID): IO[Option[CommunityExercise]] =
        pool.use(_.option(CommunityExercises.selectById)(id))

      def listPublished: IO[List[CommunityExercise]] =
        pool.use(_.execute(CommunityExercises.selectPublished))

      def listByCreator(creatorId: UUID): IO[List[CommunityExercise]] =
        pool.use(_.execute(CommunityExercises.selectByCreator)(creatorId))

      def update(id: UUID, creatorId: UUID, title: String, description: String, template: String,
        tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
        sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json],
        referenceSolution: Option[Json], rnAnswerKey: Option[Json], tags: List[String]): IO[Option[CommunityExercise]] =
        pool.use { session =>
          session.option(CommunityExercises.update)(
            (title, description, template, tonicIdx, scaleName, tsTop, tsBottom,
             sopranoBeats, bassBeats, figuredBass, referenceSolution, rnAnswerKey, tags, id, creatorId))
        }

      def publish(id: UUID, creatorId: UUID): IO[Option[CommunityExercise]] =
        pool.use { session =>
          session.option(CommunityExercises.publish)((id, creatorId))
        }.flatMap {
          case Some(ex) =>
            pointsService.awardPoints(creatorId, "exercise_created", 5, Some(id)) *>
            pointsService.updateStreak(creatorId) *>
            IO.pure(Some(ex))
          case None => IO.pure(None)
        }

      def unpublish(id: UUID, creatorId: UUID): IO[Option[CommunityExercise]] =
        pool.use(_.option(CommunityExercises.unpublish)((id, creatorId)))

      def delete(id: UUID, creatorId: UUID): IO[Unit] =
        pool.use(_.execute(CommunityExercises.softDelete)((id, creatorId))).void

      def vote(exerciseId: UUID, userId: UUID, vote: String): IO[Unit] =
        pool.use { session =>
          for
            existingVote <- session.option(CommunityExercises.getUserVote)((exerciseId, userId))
            _ <- existingVote match
              case Some(existing) if existing == vote =>
                // Toggle off: remove vote
                session.execute(CommunityExercises.deleteVote)((exerciseId, userId))
              case _ =>
                // New vote or change vote
                session.execute(CommunityExercises.upsertVote)((exerciseId, userId, vote))
            _ <- session.execute(CommunityExercises.refreshVoteCounts)(exerciseId)
          yield ()
        }.flatMap { _ =>
          // Award points to the exercise creator
          pool.use(_.option(CommunityExercises.selectById)(exerciseId)).flatMap {
            case Some(ex) if ex.creatorId != userId =>
              val creatorPoints = if vote == "up" then 3 else -1
              pointsService.awardPoints(ex.creatorId, if vote == "up" then "upvote_received" else "downvote_received", creatorPoints, Some(exerciseId)) *>
              pointsService.awardPoints(userId, "vote_cast", 1, Some(exerciseId)) *>
              pointsService.updateStreak(userId)
            case _ => IO.unit
          }
        }

      def getUserVote(exerciseId: UUID, userId: UUID): IO[Option[String]] =
        pool.use(_.option(CommunityExercises.getUserVote)((exerciseId, userId)))

      def saveAttempt(userId: UUID, exerciseId: UUID, trebleBeats: Json, bassBeats: Json, studentRomans: Json): IO[Option[ExerciseAttempt]] =
        pool.use { session =>
          session.option(ExerciseAttempts.upsert)((userId, exerciseId, trebleBeats, bassBeats, studentRomans))
        }

      def submitAttempt(userId: UUID, exerciseId: UUID, clientScore: Option[BigDecimal], clientCompleted: Option[Boolean]): IO[Option[ExerciseAttempt]] =
        // Compute score server-side
        val scoreIO: IO[(BigDecimal, Boolean)] = for
          exerciseOpt <- get(exerciseId)
          attemptOpt  <- getAttempt(userId, exerciseId)
        yield (exerciseOpt, attemptOpt) match
          case (Some(ex), Some(att)) =>
            ExerciseScoring.score(ex, att)
          case _ =>
            (clientScore.getOrElse(BigDecimal(0)), clientCompleted.getOrElse(false))

        scoreIO.flatMap { case (score, wasCompleted) =>
          pool.use { session =>
            session.option(ExerciseAttempts.submit)((score, wasCompleted, userId, exerciseId))
          }.flatMap {
          case Some(attempt) =>
            // Refresh stats (attempt_count, completion_count, completion_rate) from actual data
            val updateStats =
              pool.use(_.execute(CommunityExercises.refreshStats)(exerciseId)).void *>
              (if wasCompleted then
                pool.use(_.option(CommunityExercises.selectById)(exerciseId)).flatMap {
                  case Some(ex) if ex.creatorId != userId =>
                    for
                      alreadyAwarded <- pointsService.hasCompletionEvent(userId, exerciseId)
                      _ <- if alreadyAwarded then IO.unit
                           else
                             val pts = Rank.difficultyPoints(ex.inferredDifficulty)
                             pointsService.awardPoints(userId, "exercise_completed", pts, Some(exerciseId)) *>
                             pointsService.updateStreak(userId) *>
                             (if ex.attemptCount >= 5 then
                                val newDiff = Rank.inferDifficulty(ex.completionRate, ex.attemptCount)
                                pool.use(_.execute(CommunityExercises.updateDifficulty)((newDiff, exerciseId))).void
                              else IO.unit)
                    yield ()
                  case _ => IO.unit
                }
              else IO.unit)
            updateStats *> IO.pure(Some(attempt))
          case None => IO.pure(None)
          }
        }

      def getAttempt(userId: UUID, exerciseId: UUID): IO[Option[ExerciseAttempt]] =
        pool.use(_.option(ExerciseAttempts.findByUserAndExercise)((userId, exerciseId)))
