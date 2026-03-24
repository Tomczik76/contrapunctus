package contrapunctus.backend.db

import java.time.OffsetDateTime
import java.util.UUID
import io.circe.Json
import skunk._
import skunk.codec.all._
import skunk.circe.codec.all.{jsonb => circeJsonb}
import skunk.implicits._

object Classes:
  case class ClassRow(
    id: UUID,
    educatorId: UUID,
    name: String,
    inviteCode: UUID,
    status: String,
    studentCount: Long,
    createdAt: OffsetDateTime
  )

  case class ClassInfo(
    id: UUID,
    name: String,
    status: String,
    educatorId: UUID,
    educatorName: String
  )

  val listByEducator: Query[UUID, ClassRow] =
    sql"""
      SELECT c.id, c.educator_id, c.name, c.invite_code, c.status,
             COUNT(ce.id)::bigint, c.created_at
      FROM classes c
      LEFT JOIN class_enrollments ce ON ce.class_id = c.id
      WHERE c.educator_id = $uuid
      GROUP BY c.id
      ORDER BY c.created_at DESC
    """.query(uuid *: uuid *: text *: uuid *: text *: int8 *: timestamptz)
      .map { case (id, educatorId, name, inviteCode, status, count, createdAt) =>
        ClassRow(id, educatorId, name, inviteCode, status, count, createdAt)
      }

  val insert: Query[(UUID, String), ClassRow] =
    sql"""
      WITH new_class AS (
        INSERT INTO classes (educator_id, name)
        VALUES ($uuid, $text)
        RETURNING id, educator_id, name, invite_code, status, created_at
      )
      SELECT nc.id, nc.educator_id, nc.name, nc.invite_code, nc.status,
             0::bigint, nc.created_at
      FROM new_class nc
    """.query(uuid *: uuid *: text *: uuid *: text *: int8 *: timestamptz)
      .map { case (id, educatorId, name, inviteCode, status, count, createdAt) =>
        ClassRow(id, educatorId, name, inviteCode, status, count, createdAt)
      }

  val findByInviteCode: Query[UUID, ClassInfo] =
    sql"""
      SELECT c.id, c.name, c.status, c.educator_id, u.display_name
      FROM classes c
      JOIN users u ON u.id = c.educator_id
      WHERE c.invite_code = $uuid
    """.query(uuid *: text *: text *: uuid *: text)
      .map { case (id, name, status, educatorId, educatorName) =>
        ClassInfo(id, name, status, educatorId, educatorName)
      }

  val regenerateInviteCode: Query[(UUID, UUID), ClassRow] =
    sql"""
      WITH updated AS (
        UPDATE classes SET invite_code = gen_random_uuid()
        WHERE id = $uuid AND educator_id = $uuid
        RETURNING id, educator_id, name, invite_code, status, created_at
      )
      SELECT u.id, u.educator_id, u.name, u.invite_code, u.status,
             (SELECT COUNT(*)::bigint FROM class_enrollments WHERE class_id = u.id),
             u.created_at
      FROM updated u
    """.query(uuid *: uuid *: text *: uuid *: text *: int8 *: timestamptz)
      .map { case (id, educatorId, name, inviteCode, status, count, createdAt) =>
        ClassRow(id, educatorId, name, inviteCode, status, count, createdAt)
      }

  val enroll: Command[(UUID, UUID)] =
    sql"""
      INSERT INTO class_enrollments (class_id, student_id)
      VALUES ($uuid, $uuid)
      ON CONFLICT (class_id, student_id) DO NOTHING
    """.command

  val isEnrolled: Query[(UUID, UUID), Boolean] =
    sql"""
      SELECT EXISTS(
        SELECT 1 FROM class_enrollments
        WHERE class_id = $uuid AND student_id = $uuid
      )
    """.query(bool)

  val findByIdForEducator: Query[(UUID, UUID), ClassRow] =
    sql"""
      SELECT c.id, c.educator_id, c.name, c.invite_code, c.status,
             (SELECT COUNT(*)::bigint FROM class_enrollments WHERE class_id = c.id),
             c.created_at
      FROM classes c
      WHERE c.id = $uuid AND c.educator_id = $uuid
    """.query(uuid *: uuid *: text *: uuid *: text *: int8 *: timestamptz)
      .map { case (id, educatorId, name, inviteCode, status, count, createdAt) =>
        ClassRow(id, educatorId, name, inviteCode, status, count, createdAt)
      }

  val updateClass: Query[(String, String, UUID, UUID), ClassRow] =
    sql"""
      WITH updated AS (
        UPDATE classes SET name = $text, status = $text
        WHERE id = $uuid AND educator_id = $uuid
        RETURNING id, educator_id, name, invite_code, status, created_at
      )
      SELECT u.id, u.educator_id, u.name, u.invite_code, u.status,
             (SELECT COUNT(*)::bigint FROM class_enrollments WHERE class_id = u.id),
             u.created_at
      FROM updated u
    """.query(uuid *: uuid *: text *: uuid *: text *: int8 *: timestamptz)
      .map { case (id, educatorId, name, inviteCode, status, count, createdAt) =>
        ClassRow(id, educatorId, name, inviteCode, status, count, createdAt)
      }

  case class StudentRow(
    id: UUID,
    displayName: String,
    email: String,
    enrolledAt: OffsetDateTime,
    lessonsCompleted: Long,
    lastActiveAt: Option[OffsetDateTime]
  )

  val listStudents: Query[UUID, StudentRow] =
    sql"""
      SELECT u.id, u.display_name, u.email, ce.enrolled_at,
             (SELECT COUNT(DISTINCT slw.lesson_id)::bigint
              FROM student_lesson_work slw
              WHERE slw.student_id = u.id AND slw.class_id = ce.class_id AND slw.status = 'submitted'
             ),
             (SELECT MAX(slw.submitted_at)
              FROM student_lesson_work slw
              WHERE slw.student_id = u.id AND slw.class_id = ce.class_id
             )
      FROM class_enrollments ce
      JOIN users u ON u.id = ce.student_id
      WHERE ce.class_id = $uuid
      ORDER BY ce.enrolled_at DESC
    """.query(uuid *: text *: text *: timestamptz *: int8 *: timestamptz.opt)
      .map { case (id, displayName, email, enrolledAt, completed, lastActive) =>
        StudentRow(id, displayName, email, enrolledAt, completed, lastActive)
      }

  val removeStudent: Command[(UUID, UUID)] =
    sql"""
      DELETE FROM class_enrollments
      WHERE class_id = $uuid AND student_id = $uuid
    """.command

  case class ClassLessonRow(
    id: UUID,
    title: String,
    difficulty: String,
    template: String,
    sortOrder: Int,
    studentsCompleted: Long,
    avgScore: Option[BigDecimal]
  )

  val listClassLessons: Query[UUID, ClassLessonRow] =
    sql"""
      SELECT el.id, el.title, el.difficulty, el.template, cla.sort_order,
             (SELECT COUNT(DISTINCT slw.student_id)::bigint
              FROM student_lesson_work slw
              WHERE slw.lesson_id = el.id AND slw.class_id = cla.class_id AND slw.status = 'submitted'
             ),
             (SELECT AVG(slw.score)
              FROM student_lesson_work slw
              WHERE slw.lesson_id = el.id AND slw.class_id = cla.class_id AND slw.status = 'submitted' AND slw.score IS NOT NULL
             )
      FROM class_lesson_assignments cla
      JOIN educator_lessons el ON el.id = cla.lesson_id
      WHERE cla.class_id = $uuid
      ORDER BY cla.sort_order, cla.assigned_at
    """.query(uuid *: text *: text *: text *: int4 *: int8 *: numeric.opt)
      .map { case (id, title, difficulty, template, sortOrder, completed, avgScore) =>
        ClassLessonRow(id, title, difficulty, template, sortOrder, completed, avgScore)
      }

  val assignLesson: Query[(UUID, UUID, Int), ClassLessonRow] =
    sql"""
      WITH inserted AS (
        INSERT INTO class_lesson_assignments (class_id, lesson_id, sort_order)
        VALUES ($uuid, $uuid, $int4)
        ON CONFLICT (class_id, lesson_id) DO NOTHING
        RETURNING class_id, lesson_id, sort_order
      )
      SELECT el.id, el.title, el.difficulty, el.template, i.sort_order,
             0::bigint, NULL::numeric
      FROM inserted i
      JOIN educator_lessons el ON el.id = i.lesson_id
    """.query(uuid *: text *: text *: text *: int4 *: int8 *: numeric.opt)
      .map { case (id, title, difficulty, template, sortOrder, completed, avgScore) =>
        ClassLessonRow(id, title, difficulty, template, sortOrder, completed, avgScore)
      }

  val unassignLesson: Command[(UUID, UUID)] =
    sql"""
      DELETE FROM class_lesson_assignments
      WHERE class_id = $uuid AND lesson_id = $uuid
    """.command

  val maxSortOrder: Query[UUID, Int] =
    sql"""
      SELECT COALESCE(MAX(sort_order), -1)
      FROM class_lesson_assignments
      WHERE class_id = $uuid
    """.query(int4)

  val updateLessonOrder: Command[(Int, UUID, UUID)] =
    sql"""
      UPDATE class_lesson_assignments
      SET sort_order = $int4
      WHERE class_id = $uuid AND lesson_id = $uuid
    """.command

  // ── Student-facing queries ──────────────────────────────────────────

  case class EnrolledClassRow(
    id: UUID,
    name: String,
    educatorName: String,
    totalLessons: Long,
    completedLessons: Long
  )

  val listEnrolledClasses: Query[UUID, EnrolledClassRow] =
    sql"""
      SELECT c.id, c.name, u.display_name,
             (SELECT COUNT(*)::bigint FROM class_lesson_assignments WHERE class_id = c.id),
             (SELECT COUNT(DISTINCT slw.lesson_id)::bigint
              FROM student_lesson_work slw
              WHERE slw.student_id = ce.student_id AND slw.class_id = c.id AND slw.status = 'submitted'
             )
      FROM class_enrollments ce
      JOIN classes c ON c.id = ce.class_id
      JOIN users u ON u.id = c.educator_id
      WHERE ce.student_id = $uuid AND c.status = 'active'
      ORDER BY ce.enrolled_at DESC
    """.query(uuid *: text *: text *: int8 *: int8)
      .map { case (id, name, educatorName, totalLessons, completedLessons) =>
        EnrolledClassRow(id, name, educatorName, totalLessons, completedLessons)
      }

  case class StudentLessonRow(
    id: UUID,
    title: String,
    description: String,
    difficulty: String,
    template: String,
    sortOrder: Int,
    score: Option[BigDecimal],
    workStatus: Option[String]
  )

  val listStudentClassLessons: Query[(UUID, UUID), StudentLessonRow] =
    sql"""
      SELECT el.id, el.title, el.description, el.difficulty, el.template, cla.sort_order,
             slw.score,
             slw.status
      FROM class_lesson_assignments cla
      JOIN educator_lessons el ON el.id = cla.lesson_id
      LEFT JOIN student_lesson_work slw
        ON slw.lesson_id = el.id AND slw.class_id = cla.class_id AND slw.student_id = $uuid
      WHERE cla.class_id = $uuid
      ORDER BY cla.sort_order, cla.assigned_at
    """.query(uuid *: text *: text *: text *: text *: int4 *: numeric.opt *: text.opt)
      .map { case (id, title, description, difficulty, template, sortOrder, score, workStatus) =>
        StudentLessonRow(id, title, description, difficulty, template, sortOrder, score, workStatus)
      }

  val insertAttempt: Command[(UUID, UUID, UUID, BigDecimal, Boolean)] =
    sql"""
      INSERT INTO student_lesson_attempts (student_id, lesson_id, class_id, score, completed)
      VALUES ($uuid, $uuid, $uuid, $numeric, $bool)
    """.command

  // ── Student lesson work (save/submit) ─────────────────────────────

  case class StudentWork(
    trebleBeats: Json,
    bassBeats: Json,
    studentRomans: Json,
    score: Option[BigDecimal],
    status: String
  )

  val upsertWork: Query[(UUID, UUID, UUID, Json, Json, Json), StudentWork] =
    sql"""
      INSERT INTO student_lesson_work (student_id, lesson_id, class_id, treble_beats, bass_beats, student_romans, saved_at)
      VALUES ($uuid, $uuid, $uuid, $circeJsonb, $circeJsonb, $circeJsonb, now())
      ON CONFLICT (student_id, lesson_id, class_id)
        DO UPDATE SET treble_beats = EXCLUDED.treble_beats,
                      bass_beats = EXCLUDED.bass_beats,
                      student_romans = EXCLUDED.student_romans,
                      saved_at = now()
        WHERE student_lesson_work.status = 'draft'
      RETURNING treble_beats, bass_beats, student_romans, score, status
    """.query(circeJsonb *: circeJsonb *: circeJsonb *: numeric.opt *: text)
      .map { case (tb, bb, sr, score, status) =>
        StudentWork(tb, bb, sr, score, status)
      }

  val submitWork: Query[(UUID, UUID, UUID), StudentWork] =
    sql"""
      UPDATE student_lesson_work
      SET status = 'submitted', submitted_at = now()
      WHERE student_id = $uuid AND lesson_id = $uuid AND class_id = $uuid
        AND status = 'draft'
      RETURNING treble_beats, bass_beats, student_romans, score, status
    """.query(circeJsonb *: circeJsonb *: circeJsonb *: numeric.opt *: text)
      .map { case (tb, bb, sr, score, status) =>
        StudentWork(tb, bb, sr, score, status)
      }

  val gradeWork: Query[(BigDecimal, UUID, UUID, UUID), StudentWork] =
    sql"""
      UPDATE student_lesson_work
      SET score = $numeric
      WHERE student_id = $uuid AND lesson_id = $uuid AND class_id = $uuid
        AND status = 'submitted'
      RETURNING treble_beats, bass_beats, student_romans, score, status
    """.query(circeJsonb *: circeJsonb *: circeJsonb *: numeric.opt *: text)
      .map { case (tb, bb, sr, score, status) =>
        StudentWork(tb, bb, sr, score, status)
      }

  // Educator: get all student work for a class (for gradebook)
  case class GradeRow(
    studentId: UUID,
    studentName: String,
    lessonId: UUID,
    score: Option[BigDecimal],
    status: Option[String]
  )

  val classGrades: Query[UUID, GradeRow] =
    sql"""
      SELECT ce.student_id, u.display_name, cla.lesson_id,
             slw.score, slw.status
      FROM class_enrollments ce
      JOIN users u ON u.id = ce.student_id
      CROSS JOIN class_lesson_assignments cla
      LEFT JOIN student_lesson_work slw
        ON slw.student_id = ce.student_id
        AND slw.lesson_id = cla.lesson_id
        AND slw.class_id = cla.class_id
      WHERE ce.class_id = $uuid AND cla.class_id = ce.class_id
      ORDER BY u.display_name, cla.sort_order
    """.query(uuid *: text *: uuid *: numeric.opt *: text.opt)
      .map { case (studentId, studentName, lessonId, score, status) =>
        GradeRow(studentId, studentName, lessonId, score, status)
      }

  // Educator: view a student's submitted work
  val getStudentWork: Query[(UUID, UUID, UUID), StudentWork] =
    sql"""
      SELECT treble_beats, bass_beats, student_romans, score, status
      FROM student_lesson_work
      WHERE student_id = $uuid AND lesson_id = $uuid AND class_id = $uuid
    """.query(circeJsonb *: circeJsonb *: circeJsonb *: numeric.opt *: text)
      .map { case (tb, bb, sr, score, status) =>
        StudentWork(tb, bb, sr, score, status)
      }

  val getWork: Query[(UUID, UUID, UUID), StudentWork] =
    sql"""
      SELECT treble_beats, bass_beats, student_romans, score, status
      FROM student_lesson_work
      WHERE student_id = $uuid AND lesson_id = $uuid AND class_id = $uuid
    """.query(circeJsonb *: circeJsonb *: circeJsonb *: numeric.opt *: text)
      .map { case (tb, bb, sr, score, status) =>
        StudentWork(tb, bb, sr, score, status)
      }
