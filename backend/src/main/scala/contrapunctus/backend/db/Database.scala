package contrapunctus.backend.db

import cats.effect.{IO, Resource}
import fs2.io.net.Network
import natchez.Trace.Implicits.noop
import skunk.Session
import skunk.SSL

object Database:
  def pool(
    host:     String,
    port:     Int,
    name:     String,
    user:     String,
    password: String,
    ssl:      Boolean    = true,
    maxSessions: Int     = 10
  ): Resource[IO, Resource[IO, Session[IO]]] =
    given Network[IO] = Network.forAsync[IO]
    Session.pooled[IO](
      host     = host,
      port     = port,
      user     = user,
      database = name,
      password = Some(password),
      max      = maxSessions,
      ssl      = if ssl then SSL.Trusted else SSL.None
    )
