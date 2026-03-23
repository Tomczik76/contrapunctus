package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.{Decoder, Encoder, Json}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

case class Lesson(
  id: UUID,
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
  sortOrder: Int,
  createdAt: OffsetDateTime
)

object Lesson:
  given Encoder[OffsetDateTime] = User.given_Encoder_OffsetDateTime
  given Decoder[OffsetDateTime] = User.given_Decoder_OffsetDateTime
  given Encoder[Lesson] = deriveEncoder
  given Decoder[Lesson] = deriveDecoder
