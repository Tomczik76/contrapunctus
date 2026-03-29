package contrapunctus.crawler

import cats.effect.{IO, Resource, Ref}
import cats.syntax.all.*
import io.circe.syntax.*
import skunk.*
import skunk.implicits.*
import skunk.codec.all.*
import natchez.Trace.Implicits.noop
import java.nio.file.{Files, Paths}

trait ResultStore:
  def save(professor: Professor): IO[Unit]
  def saveAll(professors: List[Professor]): IO[Unit] =
    professors.traverse_(save)

object ResultStore:

  def fromConfig(config: CrawlerConfig): Resource[IO, ResultStore] =
    if config.dbHost.nonEmpty then
      IO.println("Storage: PostgreSQL").toResource *> dbStore(config).widen
    else
      IO.println("Storage: local files").toResource *> fileStore(config).widen

  /** Local file-based store — writes JSON + CSV after each save */
  def fileStore(config: CrawlerConfig): Resource[IO, ResultStore] =
    Resource.eval(Ref.of[IO, List[Professor]](Nil)).map { ref =>
      new ResultStore:
        def save(professor: Professor): IO[Unit] =
          ref.update(_ :+ professor) *> flush(ref)

        override def saveAll(professors: List[Professor]): IO[Unit] =
          ref.update(_ ++ professors) *> flush(ref)

        private def flush(ref: Ref[IO, List[Professor]]): IO[Unit] =
          ref.get.flatMap { buffer =>
            IO {
              val json = buffer.asJson.spaces2
              val csvFile = config.outputFile.replace(".json", ".csv")
              val csvContent = "Name,Email,Title,University,URL\n" +
                buffer.map { p =>
                  List(
                    csvEscape(p.name),
                    csvEscape(p.email.getOrElse("")),
                    csvEscape(p.title.getOrElse("")),
                    csvEscape(p.university),
                    csvEscape(p.departmentUrl)
                  ).mkString(",")
                }.mkString("\n")
              Files.writeString(Paths.get(config.outputFile), json)
              Files.writeString(Paths.get(csvFile), csvContent)
            }.void
          }

        private def csvEscape(s: String): String =
          if s.contains(",") || s.contains("\"") || s.contains("\n") then
            "\"" + s.replace("\"", "\"\"") + "\""
          else s
    }

  /** Postgres-backed store via Skunk */
  def dbStore(config: CrawlerConfig): Resource[IO, ResultStore] =
    Session.single[IO](
      host     = config.dbHost,
      port     = config.dbPort,
      user     = config.dbUser,
      password = Some(config.dbPassword),
      database = config.dbName
    ).map { session =>
      new ResultStore:
        private val upsert: Command[Professor] =
          sql"""
            INSERT INTO professors (name, email, title, university, department_url)
            VALUES ($text, ${text.opt}, ${text.opt}, $text, $text)
            ON CONFLICT (name, university) DO UPDATE SET
              email = EXCLUDED.email,
              title = EXCLUDED.title,
              department_url = EXCLUDED.department_url,
              crawled_at = now()
          """.command.contramap[Professor] { p =>
            p.name *: p.email *: p.title *: p.university *: p.departmentUrl *: EmptyTuple
          }

        def save(professor: Professor): IO[Unit] =
          session.execute(upsert)(professor).void
    }
