package contrapunctus.backend.services

import com.auth0.jwt.JWT
import com.auth0.jwt.algorithms.Algorithm
import org.mindrot.jbcrypt.BCrypt

import java.time.Instant
import java.util.{Date, UUID}

object AuthService:
  def hashPassword(password: String): String =
    BCrypt.hashpw(password, BCrypt.gensalt())

  def checkPassword(password: String, hash: String): Boolean =
    BCrypt.checkpw(password, hash)

  def createToken(userId: UUID, secret: String): String =
    JWT
      .create()
      .withSubject(userId.toString)
      .withExpiresAt(Date.from(Instant.now.plusSeconds(30L * 24 * 3600)))
      .sign(Algorithm.HMAC256(secret))

  def verifyToken(token: String, secret: String): Option[UUID] =
    scala.util.Try {
      val decoded = JWT.require(Algorithm.HMAC256(secret)).build().verify(token)
      UUID.fromString(decoded.getSubject)
    }.toOption
