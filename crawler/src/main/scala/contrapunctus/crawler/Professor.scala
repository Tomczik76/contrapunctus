package contrapunctus.crawler

import io.circe.{Encoder, Decoder}
import io.circe.generic.semiauto.*

case class Professor(
    name: String,
    email: Option[String],
    title: Option[String],
    university: String,
    departmentUrl: String
)

object Professor:
  given Encoder[Professor] = deriveEncoder
  given Decoder[Professor] = deriveDecoder
