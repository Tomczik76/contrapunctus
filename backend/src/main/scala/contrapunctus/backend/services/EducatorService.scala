package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import cats.syntax.traverse._
import cats.syntax.foldable._
import io.circe.Json
import skunk.Session
import contrapunctus.backend.db.{Classes, EducatorLessons}

import java.util.UUID

trait EducatorService:
  def listClasses(educatorId: UUID): IO[List[Classes.ClassRow]]
  def createClass(educatorId: UUID, name: String): IO[Classes.ClassRow]
  def regenerateInviteCode(classId: UUID, educatorId: UUID): IO[Option[Classes.ClassRow]]
  def listLessons(educatorId: UUID): IO[List[EducatorLessons.EducatorLessonRow]]
  def getLesson(lessonId: UUID, educatorId: UUID): IO[Option[EducatorLessons.EducatorLessonDetail]]
  def createLesson(educatorId: UUID, title: String, description: String, difficulty: String, template: String, tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int, sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json]): IO[EducatorLessons.EducatorLessonDetail]
  def updateLesson(lessonId: UUID, educatorId: UUID, title: String, description: String, difficulty: String, template: String, tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int, sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json]): IO[Option[EducatorLessons.EducatorLessonDetail]]
  def deleteLesson(lessonId: UUID, educatorId: UUID): IO[Unit]
  def duplicateLesson(lessonId: UUID, educatorId: UUID): IO[Option[EducatorLessons.EducatorLessonDetail]]
  def getClassByInviteCode(inviteCode: UUID): IO[Option[Classes.ClassInfo]]
  def enrollStudent(classId: UUID, studentId: UUID): IO[Unit]
  def isEnrolled(classId: UUID, studentId: UUID): IO[Boolean]
  def getClassDetail(classId: UUID, educatorId: UUID): IO[Option[Classes.ClassRow]]
  def updateClass(classId: UUID, educatorId: UUID, name: String, status: String): IO[Option[Classes.ClassRow]]
  def listStudents(classId: UUID): IO[List[Classes.StudentRow]]
  def removeStudent(classId: UUID, studentId: UUID): IO[Unit]
  def listClassLessons(classId: UUID): IO[List[Classes.ClassLessonRow]]
  def assignLesson(classId: UUID, lessonId: UUID): IO[Option[Classes.ClassLessonRow]]
  def unassignLesson(classId: UUID, lessonId: UUID): IO[Unit]
  def reorderLessons(classId: UUID, lessonIds: List[UUID]): IO[Unit]
  def listEnrolledClasses(studentId: UUID): IO[List[Classes.EnrolledClassRow]]
  def listStudentClassLessons(classId: UUID, studentId: UUID): IO[List[Classes.StudentLessonRow]]
  def getStudentLesson(lessonId: UUID, classId: UUID, studentId: UUID): IO[Option[EducatorLessons.EducatorLessonDetail]]
  def saveWork(studentId: UUID, lessonId: UUID, classId: UUID, trebleBeats: Json, bassBeats: Json, studentRomans: Json): IO[Option[Classes.StudentWork]]
  def submitWork(studentId: UUID, lessonId: UUID, classId: UUID): IO[Option[Classes.StudentWork]]
  def gradeWork(studentId: UUID, lessonId: UUID, classId: UUID, score: BigDecimal): IO[Option[Classes.StudentWork]]
  def getWork(studentId: UUID, lessonId: UUID, classId: UUID): IO[Option[Classes.StudentWork]]
  def classGrades(classId: UUID): IO[List[Classes.GradeRow]]
  def getStudentWork(studentId: UUID, lessonId: UUID, classId: UUID): IO[Option[Classes.StudentWork]]

object EducatorService:
  def make(pool: Resource[IO, Session[IO]]): EducatorService =
    new EducatorService:
      def listClasses(educatorId: UUID): IO[List[Classes.ClassRow]] =
        pool.use { session =>
          session.execute(Classes.listByEducator)(educatorId)
        }

      def createClass(educatorId: UUID, name: String): IO[Classes.ClassRow] =
        pool.use { session =>
          session.unique(Classes.insert)((educatorId, name))
        }

      def regenerateInviteCode(classId: UUID, educatorId: UUID): IO[Option[Classes.ClassRow]] =
        pool.use { session =>
          session.option(Classes.regenerateInviteCode)((classId, educatorId))
        }

      def listLessons(educatorId: UUID): IO[List[EducatorLessons.EducatorLessonRow]] =
        pool.use { session =>
          session.execute(EducatorLessons.listByEducator)(educatorId)
        }

      def getLesson(lessonId: UUID, educatorId: UUID): IO[Option[EducatorLessons.EducatorLessonDetail]] =
        pool.use { session =>
          session.option(EducatorLessons.findById)((lessonId, educatorId))
        }

      def createLesson(educatorId: UUID, title: String, description: String, difficulty: String, template: String, tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int, sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json]): IO[EducatorLessons.EducatorLessonDetail] =
        pool.use { session =>
          session.unique(EducatorLessons.insert)((educatorId, title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass))
        }

      def updateLesson(lessonId: UUID, educatorId: UUID, title: String, description: String, difficulty: String, template: String, tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int, sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json]): IO[Option[EducatorLessons.EducatorLessonDetail]] =
        pool.use { session =>
          session.option(EducatorLessons.update)((title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, lessonId, educatorId))
        }

      def deleteLesson(lessonId: UUID, educatorId: UUID): IO[Unit] =
        pool.use { session =>
          session.execute(EducatorLessons.delete)((lessonId, educatorId)).void
        }

      def duplicateLesson(lessonId: UUID, educatorId: UUID): IO[Option[EducatorLessons.EducatorLessonDetail]] =
        pool.use { session =>
          session.option(EducatorLessons.duplicate)((lessonId, educatorId))
        }

      def getClassByInviteCode(inviteCode: UUID): IO[Option[Classes.ClassInfo]] =
        pool.use { session =>
          session.option(Classes.findByInviteCode)(inviteCode)
        }

      def enrollStudent(classId: UUID, studentId: UUID): IO[Unit] =
        pool.use { session =>
          session.execute(Classes.enroll)((classId, studentId)).void
        }

      def isEnrolled(classId: UUID, studentId: UUID): IO[Boolean] =
        pool.use { session =>
          session.unique(Classes.isEnrolled)((classId, studentId))
        }

      def getClassDetail(classId: UUID, educatorId: UUID): IO[Option[Classes.ClassRow]] =
        pool.use { session =>
          session.option(Classes.findByIdForEducator)((classId, educatorId))
        }

      def updateClass(classId: UUID, educatorId: UUID, name: String, status: String): IO[Option[Classes.ClassRow]] =
        pool.use { session =>
          session.option(Classes.updateClass)((name, status, classId, educatorId))
        }

      def listStudents(classId: UUID): IO[List[Classes.StudentRow]] =
        pool.use { session =>
          session.execute(Classes.listStudents)(classId)
        }

      def removeStudent(classId: UUID, studentId: UUID): IO[Unit] =
        pool.use { session =>
          session.execute(Classes.removeStudent)((classId, studentId)).void
        }

      def listClassLessons(classId: UUID): IO[List[Classes.ClassLessonRow]] =
        pool.use { session =>
          session.execute(Classes.listClassLessons)(classId)
        }

      def assignLesson(classId: UUID, lessonId: UUID): IO[Option[Classes.ClassLessonRow]] =
        pool.use { session =>
          val nextOrder = session.unique(Classes.maxSortOrder)(classId).map(_ + 1)
          nextOrder.flatMap { order =>
            session.option(Classes.assignLesson)((classId, lessonId, order))
          }
        }

      def unassignLesson(classId: UUID, lessonId: UUID): IO[Unit] =
        pool.use { session =>
          session.execute(Classes.unassignLesson)((classId, lessonId)).void
        }

      def reorderLessons(classId: UUID, lessonIds: List[UUID]): IO[Unit] =
        pool.use { session =>
          session.prepareR(Classes.updateLessonOrder).use { cmd =>
            lessonIds.zipWithIndex.traverse_ { case (lessonId, idx) =>
              cmd.execute((idx, classId, lessonId)).void
            }
          }
        }

      def listEnrolledClasses(studentId: UUID): IO[List[Classes.EnrolledClassRow]] =
        pool.use { session =>
          session.execute(Classes.listEnrolledClasses)(studentId)
        }

      def listStudentClassLessons(classId: UUID, studentId: UUID): IO[List[Classes.StudentLessonRow]] =
        pool.use { session =>
          session.execute(Classes.listStudentClassLessons)((studentId, classId))
        }

      def getStudentLesson(lessonId: UUID, classId: UUID, studentId: UUID): IO[Option[EducatorLessons.EducatorLessonDetail]] =
        pool.use { session =>
          session.option(EducatorLessons.findForStudent)((classId, studentId, lessonId))
        }

      def saveWork(studentId: UUID, lessonId: UUID, classId: UUID, trebleBeats: Json, bassBeats: Json, studentRomans: Json): IO[Option[Classes.StudentWork]] =
        pool.use { session =>
          session.option(Classes.upsertWork)((studentId, lessonId, classId, trebleBeats, bassBeats, studentRomans))
        }

      def submitWork(studentId: UUID, lessonId: UUID, classId: UUID): IO[Option[Classes.StudentWork]] =
        pool.use { session =>
          session.option(Classes.submitWork)((studentId, lessonId, classId))
        }

      def gradeWork(studentId: UUID, lessonId: UUID, classId: UUID, score: BigDecimal): IO[Option[Classes.StudentWork]] =
        pool.use { session =>
          session.option(Classes.gradeWork)((score, studentId, lessonId, classId))
        }

      def getWork(studentId: UUID, lessonId: UUID, classId: UUID): IO[Option[Classes.StudentWork]] =
        pool.use { session =>
          session.option(Classes.getWork)((studentId, lessonId, classId))
        }

      def classGrades(classId: UUID): IO[List[Classes.GradeRow]] =
        pool.use { session =>
          session.execute(Classes.classGrades)(classId)
        }

      def getStudentWork(studentId: UUID, lessonId: UUID, classId: UUID): IO[Option[Classes.StudentWork]] =
        pool.use { session =>
          session.option(Classes.getStudentWork)((studentId, lessonId, classId))
        }
