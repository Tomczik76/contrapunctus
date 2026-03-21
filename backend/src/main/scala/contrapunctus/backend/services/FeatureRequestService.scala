package contrapunctus.backend.services

import cats.effect.{IO, Resource}
import skunk.Session
import contrapunctus.backend.db.FeatureRequests
import contrapunctus.backend.domain.FeatureRequest

import java.util.UUID

trait FeatureRequestService:
  def submit(userId: UUID, description: String): IO[FeatureRequest]

object FeatureRequestService:
  def make(pool: Resource[IO, Session[IO]]): FeatureRequestService =
    new FeatureRequestService:
      def submit(userId: UUID, description: String): IO[FeatureRequest] =
        pool.use(_.unique(FeatureRequests.insert, (userId, description)))
