package contrapunctus.backend.db

import skunk._
import skunk.codec.all._
import skunk.implicits._
import contrapunctus.backend.domain.User

object Users:
  val insert: Query[(String, String, String), User] =
    sql"""
      INSERT INTO users (email, display_name, password_hash)
      VALUES ($text, $text, $text)
      RETURNING id, email, display_name, created_at
    """.query(uuid *: text *: text *: timestamptz)
      .map { case (id, email, displayName, createdAt) =>
        User(id, email, displayName, createdAt)
      }

  val findByEmail: Query[String, (User, String)] =
    sql"""
      SELECT id, email, display_name, created_at, password_hash
      FROM users
      WHERE email = $text
    """.query(uuid *: text *: text *: timestamptz *: text)
      .map { case (id, email, displayName, createdAt, hash) =>
        (User(id, email, displayName, createdAt), hash)
      }
