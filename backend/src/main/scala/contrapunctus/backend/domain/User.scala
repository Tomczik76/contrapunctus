package contrapunctus.backend.domain

import java.time.OffsetDateTime
import java.util.UUID

import io.circe.{Decoder, Encoder}
import io.circe.generic.semiauto.{deriveDecoder, deriveEncoder}

case class User(
  id: UUID,
  email: String,
  displayName: String,
  isEducator: Boolean,
  createdAt: OffsetDateTime
)

object User:
  given Encoder[OffsetDateTime] = Encoder.encodeString.contramap(_.toString)
  given Decoder[OffsetDateTime] = Decoder.decodeString.emap { s =>
    scala.util.Try(OffsetDateTime.parse(s)).toEither.left.map(_.getMessage)
  }
  given Encoder[User] = deriveEncoder
  given Decoder[User] = deriveDecoder
