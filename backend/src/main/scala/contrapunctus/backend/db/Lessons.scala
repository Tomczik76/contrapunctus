package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.Lesson

object Lessons:
  private val lessonCodec =
    uuid *: text *: text *: text *: text *: int4 *: text *: int4 *: int4 *: circeJsonb *: int4 *: timestamptz

  private def toLessonMap(t: (java.util.UUID, String, String, String, String, Int, String, Int, Int, Json, Int, java.time.OffsetDateTime)): Lesson =
    val (id, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, sortOrder, createdAt) = t
    Lesson(id, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, sortOrder, createdAt)

  val allOrdered: Query[skunk.Void, Lesson] =
    sql"""
      SELECT id, title, description, difficulty, template, tonic_idx, scale_name,
             ts_top, ts_bottom, soprano_beats, sort_order, created_at
      FROM lessons
      ORDER BY sort_order, created_at
    """.query(lessonCodec).map(toLessonMap)

  val findById: Query[java.util.UUID, Lesson] =
    sql"""
      SELECT id, title, description, difficulty, template, tonic_idx, scale_name,
             ts_top, ts_bottom, soprano_beats, sort_order, created_at
      FROM lessons
      WHERE id = $uuid
    """.query(lessonCodec).map(toLessonMap)

  val insert: Query[(String, String, String, String, Int, String, Int, Int, Json, Int), Lesson] =
    sql"""
      INSERT INTO lessons (title, description, difficulty, template, tonic_idx, scale_name,
                           ts_top, ts_bottom, soprano_beats, sort_order)
      VALUES ($text, $text, $text, $text, $int4, $text, $int4, $int4, $circeJsonb, $int4)
      RETURNING id, title, description, difficulty, template, tonic_idx, scale_name,
                ts_top, ts_bottom, soprano_beats, sort_order, created_at
    """.query(lessonCodec).map(toLessonMap)

  val update: Query[(String, String, String, String, Int, String, Int, Int, Json, Int, java.util.UUID), Lesson] =
    sql"""
      UPDATE lessons
      SET title = $text, description = $text, difficulty = $text, template = $text,
          tonic_idx = $int4, scale_name = $text, ts_top = $int4, ts_bottom = $int4,
          soprano_beats = $circeJsonb, sort_order = $int4
      WHERE id = $uuid
      RETURNING id, title, description, difficulty, template, tonic_idx, scale_name,
                ts_top, ts_bottom, soprano_beats, sort_order, created_at
    """.query(lessonCodec).map(toLessonMap)

  val delete: Command[java.util.UUID] =
    sql"DELETE FROM lessons WHERE id = $uuid".command
