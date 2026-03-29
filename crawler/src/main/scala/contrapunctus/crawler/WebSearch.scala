package contrapunctus.crawler

import cats.effect.{IO, Ref}
import cats.syntax.all.*
import org.http4s.{Request, Uri, Header}
import org.http4s.client.Client
import org.typelevel.ci.CIString
import io.circe.parser.*
import java.net.URLEncoder

/** Brave Search API wrapper with cost tracking. */
class WebSearch private (apiKey: String, requestCount: Ref[IO, Int]):

  private val Endpoint = "https://api.search.brave.com/res/v1/web/search"
  private val CostPerRequest = 0.005 // $5 per 1000 queries

  def search(httpClient: Client[IO], query: String, numResults: Int = 10): IO[List[String]] =
    doSearch(httpClient, query, numResults)

  private def doSearch(httpClient: Client[IO], query: String, numResults: Int): IO[List[String]] =
    val encodedQuery = URLEncoder.encode(query, "UTF-8")
    val url = s"$Endpoint?q=$encodedQuery&count=$numResults"

    Uri.fromString(url) match
      case Left(_) => IO.pure(Nil)
      case Right(uri) =>
        val req = Request[IO](uri = uri)
          .withHeaders(
            Header.Raw(CIString("Accept"), "application/json"),
            Header.Raw(CIString("X-Subscription-Token"), apiKey)
          )
        httpClient.run(req).use { resp =>
          resp.as[String].map { body =>
            if resp.status.isSuccess then WebSearch.parseResults(body)
            else Nil
          }
        }.flatTap(_ => requestCount.update(_ + 1))
          .handleErrorWith(_ => IO.pure(Nil))

  def costSoFar: IO[Double] =
    requestCount.get.map(_ * CostPerRequest)

  def costString: IO[String] =
    requestCount.get.map { count =>
      f"$$${count * CostPerRequest}%.2f ($count requests)"
    }

object WebSearch:

  def apply(apiKey: String): IO[WebSearch] =
    Ref.of[IO, Int](0).map(new WebSearch(apiKey, _))

  private def parseResults(json: String): List[String] =
    parse(json).toOption.flatMap { doc =>
      doc.hcursor.downField("web").downField("results").as[List[io.circe.Json]].toOption.map { results =>
        results.flatMap(_.hcursor.downField("url").as[String].toOption)
      }
    }.getOrElse(Nil)
