package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.ExerciseAttempt

import java.util.UUID

object ExerciseAttempts:

  private val attemptCodec =
    uuid *: uuid *: uuid *: circeJsonb *: circeJsonb *: circeJsonb *:
    numeric.opt *: bool *: text *: timestamptz *: timestamptz.opt

  private def toAttempt(t: (UUID, UUID, UUID, Json, Json, Json,
    Option[BigDecimal], Boolean, String, java.time.OffsetDateTime, Option[java.time.OffsetDateTime])) =
    ExerciseAttempt(t._1, t._2, t._3, t._4, t._5, t._6, t._7, t._8, t._9, t._10, t._11)

  private val returnCols = "id, user_id, exercise_id, treble_beats, bass_beats, student_romans, score, completed, status, saved_at, submitted_at"

  val upsert: Query[(UUID, UUID, Json, Json, Json), ExerciseAttempt] =
    sql"""
      INSERT INTO exercise_attempts (user_id, exercise_id, treble_beats, bass_beats, student_romans)
      VALUES ($uuid, $uuid, $circeJsonb, $circeJsonb, $circeJsonb)
      ON CONFLICT (user_id, exercise_id) DO UPDATE SET
        treble_beats = EXCLUDED.treble_beats,
        bass_beats = EXCLUDED.bass_beats,
        student_romans = EXCLUDED.student_romans,
        saved_at = NOW()
      WHERE exercise_attempts.status = 'draft'
      RETURNING #$returnCols
    """.query(attemptCodec).map(toAttempt)

  val findByUserAndExercise: Query[(UUID, UUID), ExerciseAttempt] =
    sql"""
      SELECT #$returnCols FROM exercise_attempts
      WHERE user_id = $uuid AND exercise_id = $uuid
    """.query(attemptCodec).map(toAttempt)

  val submit: Query[(BigDecimal, Boolean, UUID, UUID), ExerciseAttempt] =
    sql"""
      UPDATE exercise_attempts SET
        score = $numeric, completed = $bool, status = 'submitted', submitted_at = NOW()
      WHERE user_id = $uuid AND exercise_id = $uuid AND status = 'draft'
      RETURNING #$returnCols
    """.query(attemptCodec).map(toAttempt)

  val listByUser: Query[UUID, ExerciseAttempt] =
    sql"""
      SELECT #$returnCols FROM exercise_attempts
      WHERE user_id = $uuid
      ORDER BY saved_at DESC
    """.query(attemptCodec).map(toAttempt)
