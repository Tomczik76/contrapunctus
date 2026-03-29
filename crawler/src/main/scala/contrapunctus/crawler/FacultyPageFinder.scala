package contrapunctus.crawler

import cats.effect.IO
import cats.syntax.all.*
import org.http4s.client.Client
import org.jsoup.Jsoup
import scala.jdk.CollectionConverters.*

/**
 * Searches for the university's music faculty page(s) and fetches them.
 * Uses search results directly — only navigates from homepage when search fails.
 */
object FacultyPageFinder:

  private def normalizeUrl(url: String): String =
    url.trim
      .replaceFirst("^http://", "https://")
      .replaceFirst("://www\\.", "://")
      .stripSuffix("/")
      .toLowerCase

  /** URL path/host keywords that are clearly NOT faculty pages */
  private val excludePathKeywords = Set(
    "news", "blog", "event", "board", "trustee", "tuition",
    "admission", "cashier", "program", "degree", "calendar",
    "library", "apply", "financial", "login", "portal"
  )

  /** Subdomains that never contain useful faculty listings */
  private val excludeSubdomains = Set(
    "catalog", "bulletin", "etd", "libguides", "digitalarchives",
    "aumnicat", "scholarworks", "repository", "ir", "ojs"
  )

  private def isRelevantUrl(url: String): Boolean =
    val lower = url.toLowerCase
    val sub = subdomain(url).split("\\.").headOption.getOrElse("")
    !excludePathKeywords.exists(lower.contains) &&
      !excludeSubdomains.contains(sub) &&
      !lower.endsWith(".pdf")

  /** Extract the host from a URL (e.g. "uaa.alaska.edu" from "https://www.uaa.alaska.edu/...") */
  private def subdomain(url: String): String =
    url.replaceFirst("^https?://", "")
      .replaceFirst("^www\\.", "")
      .takeWhile(_ != '/')
      .toLowerCase

  private def fetchBestPerSubdomain(
      httpClient: Client[IO],
      results: List[String],
      log: Log
  ): IO[List[(String, String)]] =
    val bestPerSubdomain = results
      .groupBy(subdomain)
      .values
      .map(_.head)
      .toList
      .sortBy(url => results.indexOf(url))
      .take(5)
    log.println(s"  Fetching ${bestPerSubdomain.length} result(s) from ${bestPerSubdomain.map(subdomain).mkString(", ")}") *>
      bestPerSubdomain.traverseFilter { url =>
        PageFetcher.fetch(httpClient, url, log).map(_.map(html => (url, html)))
      }

  def findFacultyPages(
      httpClient: Client[IO],
      llm: LlmClient,
      search: WebSearch,
      config: CrawlerConfig,
      seed: UniversitySeed,
      log: Log
  ): IO[List[(String, String)]] =
    val domain = seed.baseUrl
      .replaceFirst("^https?://", "")
      .replaceFirst("^www\\.", "")
      .stripSuffix("/")

    // Try progressively broader searches
    val queries = List(
      s"site:$domain music theory faculty",
      s"site:$domain music faculty",
      s"site:$domain music department people"
    )

    def tryQueries(remaining: List[String]): IO[List[(String, String)]] =
      remaining match
        case Nil =>
          log.println(s"  No search results, falling back to homepage") *>
            navigateFromHomepage(httpClient, llm, config, seed, log)
        case query :: rest =>
          log.println(s"  Searching: $query") *>
            search.search(httpClient, query).flatMap { results =>
              val relevant = results.filter(isRelevantUrl)
              if relevant.isEmpty then tryQueries(rest)
              else fetchBestPerSubdomain(httpClient, relevant, log)
            }

    tryQueries(queries)

  /** When search returns nothing, navigate from homepage using LLM. */
  private def navigateFromHomepage(
      httpClient: Client[IO],
      llm: LlmClient,
      config: CrawlerConfig,
      seed: UniversitySeed,
      log: Log
  ): IO[List[(String, String)]] =
    val startUrl = seed.baseUrl.stripSuffix("/")
    fetchAndNavigate(httpClient, llm, config, seed, startUrl, Set.empty, 0, log)

  private def fetchAndNavigate(
      httpClient: Client[IO],
      llm: LlmClient,
      config: CrawlerConfig,
      seed: UniversitySeed,
      url: String,
      visited: Set[String],
      depth: Int,
      log: Log
  ): IO[List[(String, String)]] =
    PageFetcher.fetch(httpClient, url, log).flatMap {
      case None =>
        log.println(s"  Could not fetch $url") *> IO.pure(Nil)
      case Some(html) =>
        navigate(httpClient, llm, config, seed, url, html, visited + normalizeUrl(url), depth, log)
    }

  private def navigate(
      httpClient: Client[IO],
      llm: LlmClient,
      config: CrawlerConfig,
      seed: UniversitySeed,
      url: String,
      html: String,
      visited: Set[String],
      depth: Int,
      log: Log
  ): IO[List[(String, String)]] =
    if depth >= config.maxDepth then IO.pure(Nil)
    else
      val doc = Jsoup.parse(html, url)
      val pageText = doc.text().take(4000)
      val links = doc.select("a[href]").asScala.toList
        .map(a => (a.text().trim, a.attr("abs:href")))
        .filter { case (text, href) =>
          href.startsWith("http") &&
            !href.contains("#") &&
            !visited.contains(normalizeUrl(href)) &&
            href.length < 300 &&
            text.nonEmpty &&
            isRelevantUrl(href)
        }
        .distinctBy { case (_, href) => normalizeUrl(href) }
        .take(50)

      val linkList = if links.nonEmpty then
        links.zipWithIndex
          .map { case ((text, href), i) => s"${i + 1}. [$text] -> $href" }
          .mkString("\n")
      else "(no links)"

      val prompt = s"""I need to find music theory professors at ${seed.name}. Help me navigate their website.

Current page: $url
Page content preview: ${pageText.take(3000)}

Links on this page:
$linkList

Question 1: Does this page list music faculty/professors with their names? Answer YES or NO.

Question 2: Which single link leads to a music faculty or people page? Pick the ONE best link number, or NONE if nothing is relevant. NEVER pick links to social media, admissions, tuition, or general university pages.

Format your answer EXACTLY like this (no extra text):
PAGE_HAS_FACULTY: YES or NO
FOLLOW: 5 or NONE"""

      for
        response <- llm.ask(prompt, maxTokens = 150)
        _        <- log.println(s"    [depth=$depth] $url")
        _        <- log.println(s"      LLM: ${response.replace("\n", " ").take(120)}")
        cost     <- llm.costString
        _        <- log.println(s"      Cost: $cost")
        pageRelevant = response.toUpperCase.contains("PAGE_HAS_FACULTY: YES")
        currentResults = if pageRelevant then List((url, html)) else Nil
        followNums = extractFollowNumbers(response)
        linksToFollow = followNums.flatMap(n => links.lift(n - 1).map(_._2)).take(1)
        _        <- linksToFollow.traverse_(u => log.println(s"      -> $u"))
        newVisited = visited + normalizeUrl(url)
        childResults <- linksToFollow.foldLeft(IO.pure((List.empty[(String, String)], newVisited))) {
          case (accIO, nextUrl) =>
            accIO.flatMap { case (pages, vis) =>
              val norm = normalizeUrl(nextUrl)
              if vis.contains(norm) || pages.length + currentResults.length >= 5 then
                IO.pure((pages, vis))
              else
                PageFetcher.fetch(httpClient, nextUrl, log).flatMap {
                  case None => IO.pure((pages, vis + norm))
                  case Some(nextHtml) =>
                    navigate(httpClient, llm, config, seed, nextUrl, nextHtml, vis + norm, depth + 1, log)
                      .map(newPages => (pages ++ newPages, vis + norm ++ newPages.map(p => normalizeUrl(p._1)).toSet))
                }
            }
        }
      yield currentResults ++ childResults._1

  private def extractFollowNumbers(response: String): List[Int] =
    val followLine = response.linesIterator
      .map(_.trim.toUpperCase)
      .find(_.startsWith("FOLLOW:"))
      .getOrElse("")
    if followLine.contains("NONE") then Nil
    else
      followLine
        .stripPrefix("FOLLOW:")
        .trim
        .split("[,\\s]+")
        .flatMap(s => scala.util.Try(s.trim.toInt).toOption)
        .toList
