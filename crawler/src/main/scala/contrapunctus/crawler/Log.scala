package contrapunctus.crawler

import cats.effect.{IO, Ref}

/** Buffered logger that collects lines and flushes them atomically. */
class Log private (buffer: Ref[IO, List[String]]):
  def println(msg: String): IO[Unit] = buffer.update(_ :+ msg)

  def flush: IO[Unit] =
    buffer.getAndSet(Nil).flatMap { lines =>
      IO.println(lines.mkString("\n"))
    }

object Log:
  def apply(): IO[Log] = Ref.of[IO, List[String]](Nil).map(new Log(_))
