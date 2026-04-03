package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import io.circe.Json
import skunk.Session
import contrapunctus.backend.db.Projects
import contrapunctus.backend.domain.Project

import java.util.UUID

trait ProjectService:
  def create(userId: UUID, name: String, trebleBeats: Json, bassBeats: Json,
    tsTop: Int, tsBottom: Int, tonicIdx: Int, scaleName: String): IO[Project]
  def update(id: UUID, userId: UUID, name: String, trebleBeats: Json, bassBeats: Json,
    tsTop: Int, tsBottom: Int, tonicIdx: Int, scaleName: String): IO[Option[Project]]
  def get(id: UUID, userId: UUID): IO[Option[Project]]
  def listByUser(userId: UUID): IO[List[Project]]
  def delete(id: UUID, userId: UUID): IO[Unit]

object ProjectService:
  def make(pool: Resource[IO, Session[IO]]): ProjectService =
    new ProjectService:
      def create(userId: UUID, name: String, trebleBeats: Json, bassBeats: Json,
        tsTop: Int, tsBottom: Int, tonicIdx: Int, scaleName: String): IO[Project] =
        pool.use(_.unique(Projects.insert)((userId, name, trebleBeats, bassBeats, tsTop, tsBottom, tonicIdx, scaleName)))

      def update(id: UUID, userId: UUID, name: String, trebleBeats: Json, bassBeats: Json,
        tsTop: Int, tsBottom: Int, tonicIdx: Int, scaleName: String): IO[Option[Project]] =
        pool.use(_.option(Projects.update)((name, trebleBeats, bassBeats, tsTop, tsBottom, tonicIdx, scaleName, id, userId)))

      def get(id: UUID, userId: UUID): IO[Option[Project]] =
        pool.use(_.option(Projects.selectById)((id, userId)))

      def listByUser(userId: UUID): IO[List[Project]] =
        pool.use(_.execute(Projects.listByUser)(userId))

      def delete(id: UUID, userId: UUID): IO[Unit] =
        pool.use(_.execute(Projects.delete)((id, userId))).void
