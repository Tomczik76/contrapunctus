package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import io.circe.Json
import skunk.Session
import contrapunctus.backend.db.BugReports
import contrapunctus.backend.domain.BugReport

import java.util.UUID

trait BugReportService:
  def submit(userId: UUID, description: String, stateJson: Json): IO[BugReport]

object BugReportService:
  def make(pool: Resource[IO, Session[IO]]): BugReportService =
    new BugReportService:
      def submit(userId: UUID, description: String, stateJson: Json): IO[BugReport] =
        pool.use { session =>
          session.unique(BugReports.insert)((userId, description, stateJson))
        }
