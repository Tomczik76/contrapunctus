package contrapunctus.crawler

import cats.effect.IO
import org.http4s.client.Client
import org.http4s.{Request, Uri, Headers, Header}
import org.typelevel.ci.CIString

/** Fetches HTML pages with polite crawling behavior. */
object PageFetcher:

  private val UserAgent = "ContrapunctusCrawler/0.1 (academic research; music theory faculty)"

  def fetch(client: Client[IO], url: String, log: Log): IO[Option[String]] =
    Uri.fromString(url) match
      case Left(_) => IO.pure(None)
      case Right(uri) =>
        val req = Request[IO](uri = uri)
          .withHeaders(
            Header.Raw(CIString("User-Agent"), UserAgent),
            Header.Raw(CIString("Accept"), "text/html")
          )
        client
          .expect[String](req)
          .map(Some(_))
          .handleErrorWith { err =>
            log.println(s"  [WARN] Failed to fetch $url: ${err.getMessage}") *>
              IO.pure(None)
          }
