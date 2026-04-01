package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._

import java.util.UUID

object AuthProviders:

  val findByProvider: Query[(String, String), UUID] =
    sql"""
      SELECT user_id FROM auth_providers
      WHERE provider = $text AND provider_id = $text
    """.query(uuid)

  val insert: Command[(UUID, String, String)] =
    sql"""
      INSERT INTO auth_providers (user_id, provider, provider_id)
      VALUES ($uuid, $text, $text)
    """.command
