package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.{Encoder}
import io.circe.generic.semiauto.deriveEncoder

case class FeatureRequest(
  id: UUID,
  userId: UUID,
  description: String,
  createdAt: OffsetDateTime
)

object FeatureRequest:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[FeatureRequest] = deriveEncoder
