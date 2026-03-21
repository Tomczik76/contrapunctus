package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

case class BugReport(
  id: UUID,
  userId: UUID,
  description: String,
  stateJson: Json,
  createdAt: OffsetDateTime
)

object BugReport:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[BugReport] = deriveEncoder
