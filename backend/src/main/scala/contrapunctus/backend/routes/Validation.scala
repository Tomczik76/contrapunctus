package contrapunctus.backend.routes

import cats.effect.IO
import io.circe.Json
import org.http4s.Response
import org.http4s.circe.CirceEntityCodec._
import org.http4s.dsl.io._

object Validation:
  private def badRequest(msg: String): IO[Response[IO]] =
    BadRequest(Json.obj("error" -> Json.fromString(msg)))

  def validate(checks: (Boolean, String)*)(action: => IO[Response[IO]]): IO[Response[IO]] =
    checks.find(_._1) match
      case Some((_, msg)) => badRequest(msg)
      case None           => action

  // Max sizes
  val MaxTextLength      = 5000
  val MaxShortText       = 200
  val MaxJsonBytes       = 500_000  // 500KB

  // Allowed enum values
  val CorrectionCategories = Set("chord_label", "nct_detection", "part_writing_error")
  val CorrectionStatuses   = Set("pending", "confirmed", "rejected", "fixed")
  val ClassStatuses         = Set("active", "archived")
  val Difficulties          = Set("beginner", "intermediate", "advanced")
  val Templates             = Set("harmonize_melody", "figured_bass", "roman_numeral_analysis", "species_counterpoint")
  val ScaleNames            = Set("major", "minor", "none")
  val VoteValues             = Set("up", "down")

  def tooLong(s: String, max: Int): Boolean = s.length > max
  def tooLong(s: Option[String], max: Int): Boolean = s.exists(_.length > max)
  def jsonTooBig(j: Json, max: Int = MaxJsonBytes): Boolean = j.noSpaces.length > max
  def notIn(s: String, allowed: Set[String]): Boolean = !allowed.contains(s)
  def outOfRange(n: Int, min: Int, max: Int): Boolean = n < min || n > max
