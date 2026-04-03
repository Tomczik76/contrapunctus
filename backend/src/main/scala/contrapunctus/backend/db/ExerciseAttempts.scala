package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.{ExerciseAttempt, SharedSolution}

import java.util.UUID

object ExerciseAttempts:

  private val attemptCodec =
    uuid *: uuid *: uuid *: circeJsonb *: circeJsonb *: circeJsonb *:
    numeric.opt *: bool *: text *: timestamptz *: timestamptz.opt *: bool *: int4

  private def toAttempt(t: (UUID, UUID, UUID, Json, Json, Json,
    Option[BigDecimal], Boolean, String, java.time.OffsetDateTime, Option[java.time.OffsetDateTime],
    Boolean, Int)) =
    ExerciseAttempt(t._1, t._2, t._3, t._4, t._5, t._6, t._7, t._8, t._9, t._10, t._11, t._12, t._13)

  private val returnCols = "id, user_id, exercise_id, treble_beats, bass_beats, student_romans, score, completed, status, saved_at, submitted_at, shared, upvote_count"

  val upsert: Query[(UUID, UUID, Json, Json, Json), ExerciseAttempt] =
    sql"""
      INSERT INTO exercise_attempts (user_id, exercise_id, treble_beats, bass_beats, student_romans)
      VALUES ($uuid, $uuid, $circeJsonb, $circeJsonb, $circeJsonb)
      ON CONFLICT (user_id, exercise_id) DO UPDATE SET
        treble_beats = EXCLUDED.treble_beats,
        bass_beats = EXCLUDED.bass_beats,
        student_romans = EXCLUDED.student_romans,
        status = 'draft',
        saved_at = NOW()
      RETURNING #$returnCols
    """.query(attemptCodec).map(toAttempt)

  val findByUserAndExercise: Query[(UUID, UUID), ExerciseAttempt] =
    sql"""
      SELECT #$returnCols FROM exercise_attempts
      WHERE user_id = $uuid AND exercise_id = $uuid
    """.query(attemptCodec).map(toAttempt)

  val submit: Query[(BigDecimal, Boolean, Boolean, UUID, UUID), ExerciseAttempt] =
    sql"""
      UPDATE exercise_attempts SET
        score = $numeric, completed = $bool, shared = $bool, status = 'submitted', submitted_at = NOW()
      WHERE user_id = $uuid AND exercise_id = $uuid
      RETURNING #$returnCols
    """.query(attemptCodec).map(toAttempt)

  val listByUser: Query[UUID, ExerciseAttempt] =
    sql"""
      SELECT #$returnCols FROM exercise_attempts
      WHERE user_id = $uuid
      ORDER BY saved_at DESC
    """.query(attemptCodec).map(toAttempt)

  private val sharedSolutionCodec =
    uuid *: uuid *: text *: circeJsonb *: circeJsonb *: circeJsonb *:
    numeric.opt *: bool *: timestamptz.opt *: int4 *: bool

  private def toSharedSolution(t: (UUID, UUID, String, Json, Json, Json,
    Option[BigDecimal], Boolean, Option[java.time.OffsetDateTime], Int, Boolean)) =
    SharedSolution(t._1, t._2, t._3, t._4, t._5, t._6, t._7, t._8, t._9, t._10, t._11)

  val listSharedByExercise: Query[(UUID, UUID), SharedSolution] =
    sql"""
      SELECT ea.id, ea.user_id, u.display_name,
             ea.treble_beats, ea.bass_beats, ea.student_romans,
             ea.score, ea.completed, ea.submitted_at, ea.upvote_count,
             EXISTS(SELECT 1 FROM solution_upvotes su WHERE su.attempt_id = ea.id AND su.user_id = $uuid)
      FROM exercise_attempts ea
      JOIN users u ON u.id = ea.user_id
      WHERE ea.exercise_id = $uuid AND ea.shared = TRUE AND ea.status = 'submitted'
      ORDER BY ea.upvote_count DESC, ea.submitted_at DESC
    """.query(sharedSolutionCodec).map(toSharedSolution)

  val insertSolutionUpvote: Command[(UUID, UUID)] =
    sql"""
      INSERT INTO solution_upvotes (attempt_id, user_id) VALUES ($uuid, $uuid)
      ON CONFLICT DO NOTHING
    """.command

  val deleteSolutionUpvote: Command[(UUID, UUID)] =
    sql"""
      DELETE FROM solution_upvotes WHERE attempt_id = $uuid AND user_id = $uuid
    """.command

  val refreshSolutionUpvoteCount: Command[UUID] =
    sql"""
      UPDATE exercise_attempts SET upvote_count = (
        SELECT COUNT(*) FROM solution_upvotes WHERE attempt_id = exercise_attempts.id
      ) WHERE id = $uuid
    """.command

  val getSolutionUpvote: Query[(UUID, UUID), Boolean] =
    sql"""
      SELECT EXISTS(SELECT 1 FROM solution_upvotes WHERE attempt_id = $uuid AND user_id = $uuid)
    """.query(bool)

  val getAttemptOwner: Query[UUID, UUID] =
    sql"""
      SELECT user_id FROM exercise_attempts WHERE id = $uuid
    """.query(uuid)
