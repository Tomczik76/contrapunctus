package contrapunctus.backend.db

import java.time.OffsetDateTime
import java.util.UUID
import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._

object EducatorLessons:
  case class EducatorLessonRow(
    id: UUID,
    educatorId: UUID,
    title: String,
    description: String,
    difficulty: String,
    template: String,
    createdAt: OffsetDateTime,
    assignedClasses: Json
  )

  case class EducatorLessonDetail(
    id: UUID,
    educatorId: UUID,
    title: String,
    description: String,
    difficulty: String,
    template: String,
    tonicIdx: Int,
    scaleName: String,
    tsTop: Int,
    tsBottom: Int,
    sopranoBeats: Json,
    bassBeats: Option[Json],
    figuredBass: Option[Json],
    createdAt: OffsetDateTime
  )

  val listByEducator: Query[UUID, EducatorLessonRow] =
    sql"""
      SELECT el.id, el.educator_id, el.title, el.description, el.difficulty,
             el.template, el.created_at,
             COALESCE(
               json_agg(json_build_object('id', c.id, 'name', c.name))
               FILTER (WHERE c.id IS NOT NULL),
               '[]'::json
             )::jsonb
      FROM educator_lessons el
      LEFT JOIN class_lesson_assignments cla ON cla.lesson_id = el.id
      LEFT JOIN classes c ON c.id = cla.class_id
      WHERE el.educator_id = $uuid
      GROUP BY el.id
      ORDER BY el.created_at DESC
    """.query(uuid *: uuid *: text *: text *: text *: text *: timestamptz *: circeJsonb)
      .map { case (id, educatorId, title, description, difficulty, template, createdAt, assignedClasses) =>
        EducatorLessonRow(id, educatorId, title, description, difficulty, template, createdAt, assignedClasses)
      }

  val findById: Query[(UUID, UUID), EducatorLessonDetail] =
    sql"""
      SELECT id, educator_id, title, description, difficulty, template,
             tonic_idx, scale_name, ts_top, ts_bottom,
             soprano_beats, bass_beats, figured_bass, created_at
      FROM educator_lessons
      WHERE id = $uuid AND educator_id = $uuid
    """.query(uuid *: uuid *: text *: text *: text *: text *: int4 *: text *: int4 *: int4 *: circeJsonb *: circeJsonb.opt *: circeJsonb.opt *: timestamptz)
      .map { case (id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt) =>
        EducatorLessonDetail(id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt)
      }

  val insert: Query[(UUID, String, String, String, String, Int, String, Int, Int, Json, Option[Json], Option[Json]), EducatorLessonDetail] =
    sql"""
      INSERT INTO educator_lessons (educator_id, title, description, difficulty, template,
                                    tonic_idx, scale_name, ts_top, ts_bottom,
                                    soprano_beats, bass_beats, figured_bass)
      VALUES ($uuid, $text, $text, $text, $text, $int4, $text, $int4, $int4, $circeJsonb, ${circeJsonb.opt}, ${circeJsonb.opt})
      RETURNING id, educator_id, title, description, difficulty, template,
                tonic_idx, scale_name, ts_top, ts_bottom,
                soprano_beats, bass_beats, figured_bass, created_at
    """.query(uuid *: uuid *: text *: text *: text *: text *: int4 *: text *: int4 *: int4 *: circeJsonb *: circeJsonb.opt *: circeJsonb.opt *: timestamptz)
      .map { case (id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt) =>
        EducatorLessonDetail(id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt)
      }

  val update: Query[(String, String, String, String, Int, String, Int, Int, Json, Option[Json], Option[Json], UUID, UUID), EducatorLessonDetail] =
    sql"""
      UPDATE educator_lessons
      SET title = $text, description = $text, difficulty = $text, template = $text,
          tonic_idx = $int4, scale_name = $text, ts_top = $int4, ts_bottom = $int4,
          soprano_beats = $circeJsonb, bass_beats = ${circeJsonb.opt}, figured_bass = ${circeJsonb.opt}
      WHERE id = $uuid AND educator_id = $uuid
      RETURNING id, educator_id, title, description, difficulty, template,
                tonic_idx, scale_name, ts_top, ts_bottom,
                soprano_beats, bass_beats, figured_bass, created_at
    """.query(uuid *: uuid *: text *: text *: text *: text *: int4 *: text *: int4 *: int4 *: circeJsonb *: circeJsonb.opt *: circeJsonb.opt *: timestamptz)
      .map { case (id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt) =>
        EducatorLessonDetail(id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt)
      }

  val delete: Command[(UUID, UUID)] =
    sql"""
      DELETE FROM educator_lessons
      WHERE id = $uuid AND educator_id = $uuid
    """.command

  val findForStudent: Query[(UUID, UUID, UUID), EducatorLessonDetail] =
    sql"""
      SELECT el.id, el.educator_id, el.title, el.description, el.difficulty, el.template,
             el.tonic_idx, el.scale_name, el.ts_top, el.ts_bottom,
             el.soprano_beats, el.bass_beats, el.figured_bass, el.created_at
      FROM educator_lessons el
      JOIN class_lesson_assignments cla ON cla.lesson_id = el.id AND cla.class_id = $uuid
      JOIN class_enrollments ce ON ce.class_id = cla.class_id AND ce.student_id = $uuid
      WHERE el.id = $uuid
    """.query(uuid *: uuid *: text *: text *: text *: text *: int4 *: text *: int4 *: int4 *: circeJsonb *: circeJsonb.opt *: circeJsonb.opt *: timestamptz)
      .map { case (id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt) =>
        EducatorLessonDetail(id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt)
      }

  val duplicate: Query[(UUID, UUID), EducatorLessonDetail] =
    sql"""
      INSERT INTO educator_lessons (educator_id, title, description, difficulty, template,
                                    tonic_idx, scale_name, ts_top, ts_bottom,
                                    soprano_beats, bass_beats, figured_bass)
      SELECT educator_id, title || ' (copy)', description, difficulty, template,
             tonic_idx, scale_name, ts_top, ts_bottom,
             soprano_beats, bass_beats, figured_bass
      FROM educator_lessons
      WHERE id = $uuid AND educator_id = $uuid
      RETURNING id, educator_id, title, description, difficulty, template,
                tonic_idx, scale_name, ts_top, ts_bottom,
                soprano_beats, bass_beats, figured_bass, created_at
    """.query(uuid *: uuid *: text *: text *: text *: text *: int4 *: text *: int4 *: int4 *: circeJsonb *: circeJsonb.opt *: circeJsonb.opt *: timestamptz)
      .map { case (id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt) =>
        EducatorLessonDetail(id, educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, createdAt)
      }
