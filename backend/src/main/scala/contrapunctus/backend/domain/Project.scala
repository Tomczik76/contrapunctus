package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.{Encoder, Json}
import io.circe.generic.semiauto.deriveEncoder

case class Project(
  id: UUID,
  userId: UUID,
  name: String,
  trebleBeats: Json,
  bassBeats: Json,
  tsTop: Int,
  tsBottom: Int,
  tonicIdx: Int,
  scaleName: String,
  createdAt: OffsetDateTime,
  updatedAt: OffsetDateTime
)

object Project:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Encoder[Project] = deriveEncoder
