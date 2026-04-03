package contrapunctus.backend.db

import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._
import contrapunctus.backend.domain.Project

import java.util.UUID

object Projects:

  private val projectCodec =
    uuid *: uuid *: varchar(200) *: circeJsonb *: circeJsonb *: int4 *: int4 *: int4 *: varchar(50) *: bool *: timestamptz *: timestamptz

  private def toProject(t: (UUID, UUID, String, Json, Json, Int, Int, Int, String, Boolean,
    java.time.OffsetDateTime, java.time.OffsetDateTime)) =
    Project(t._1, t._2, t._3, t._4, t._5, t._6, t._7, t._8, t._9, t._10, t._11, t._12)

  private val returnCols = "id, user_id, name, treble_beats, bass_beats, ts_top, ts_bottom, tonic_idx, scale_name, shared, created_at, updated_at"

  val insert: Query[(UUID, String, Json, Json, Int, Int, Int, String), Project] =
    sql"""
      INSERT INTO projects (user_id, name, treble_beats, bass_beats, ts_top, ts_bottom, tonic_idx, scale_name)
      VALUES ($uuid, $varchar, $circeJsonb, $circeJsonb, $int4, $int4, $int4, $varchar)
      RETURNING #$returnCols
    """.query(projectCodec).map(toProject)

  val update: Query[(String, Json, Json, Int, Int, Int, String, UUID, UUID), Project] =
    sql"""
      UPDATE projects SET
        name = $varchar, treble_beats = $circeJsonb, bass_beats = $circeJsonb,
        ts_top = $int4, ts_bottom = $int4, tonic_idx = $int4, scale_name = $varchar,
        updated_at = NOW()
      WHERE id = $uuid AND user_id = $uuid
      RETURNING #$returnCols
    """.query(projectCodec).map(toProject)

  val selectById: Query[(UUID, UUID), Project] =
    sql"""
      SELECT #$returnCols FROM projects
      WHERE id = $uuid AND user_id = $uuid
    """.query(projectCodec).map(toProject)

  val selectSharedById: Query[UUID, Project] =
    sql"""
      SELECT #$returnCols FROM projects
      WHERE id = $uuid AND shared = TRUE
    """.query(projectCodec).map(toProject)

  val markShared: Query[(UUID, UUID), Project] =
    sql"""
      UPDATE projects SET shared = TRUE, updated_at = NOW()
      WHERE id = $uuid AND user_id = $uuid
      RETURNING #$returnCols
    """.query(projectCodec).map(toProject)

  val listByUser: Query[UUID, Project] =
    sql"""
      SELECT #$returnCols FROM projects
      WHERE user_id = $uuid
      ORDER BY updated_at DESC
    """.query(projectCodec).map(toProject)

  val delete: Command[(UUID, UUID)] =
    sql"""
      DELETE FROM projects WHERE id = $uuid AND user_id = $uuid
    """.command
