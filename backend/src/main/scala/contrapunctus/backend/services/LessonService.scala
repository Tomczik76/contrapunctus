package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import io.circe.Json
import skunk.Session
import contrapunctus.backend.db.Lessons
import contrapunctus.backend.domain.Lesson

import java.util.UUID

trait LessonService:
  def list: IO[List[Lesson]]
  def get(id: UUID): IO[Option[Lesson]]
  def create(title: String, description: String, difficulty: String, template: String,
             tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
             sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json], sortOrder: Int): IO[Lesson]
  def update(id: UUID, title: String, description: String, difficulty: String, template: String,
             tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
             sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json], sortOrder: Int): IO[Lesson]
  def delete(id: UUID): IO[Unit]

object LessonService:
  def make(pool: Resource[IO, Session[IO]]): LessonService =
    new LessonService:
      def list: IO[List[Lesson]] =
        pool.use(_.execute(Lessons.allOrdered))

      def get(id: UUID): IO[Option[Lesson]] =
        pool.use(_.option(Lessons.findById)(id))

      def create(title: String, description: String, difficulty: String, template: String,
                 tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
                 sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json], sortOrder: Int): IO[Lesson] =
        pool.use(_.unique(Lessons.insert)((title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, sortOrder)))

      def update(id: UUID, title: String, description: String, difficulty: String, template: String,
                 tonicIdx: Int, scaleName: String, tsTop: Int, tsBottom: Int,
                 sopranoBeats: Json, bassBeats: Option[Json], figuredBass: Option[Json], sortOrder: Int): IO[Lesson] =
        pool.use(_.unique(Lessons.update)((title, description, difficulty, template, tonicIdx, scaleName, tsTop, tsBottom, sopranoBeats, bassBeats, figuredBass, sortOrder, id)))

      def delete(id: UUID): IO[Unit] =
        pool.use(_.execute(Lessons.delete)(id)).void
