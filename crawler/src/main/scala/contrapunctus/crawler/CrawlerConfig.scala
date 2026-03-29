package contrapunctus.crawler

import pureconfig.*
import pureconfig.generic.derivation.default.*

case class CrawlerConfig(
    searchApiKey: String = "",
    bedrockModelId: String = "us.anthropic.claude-3-5-haiku-20241022-v1:0",
    bedrockRegion: String = "us-east-1",
    seedsFile: String = "crawler/universities.txt",
    outputFile: String = "crawler/results.json",
    maxDepth: Int = 5,
    parallelism: Int = 1,
    requestDelayMs: Long = 500,
    httpTimeoutSeconds: Int = 15,
    maxFollowRedirects: Int = 10,
    // DB config — leave dbHost empty for local file mode
    dbHost: String = "",
    dbPort: Int = 5432,
    dbName: String = "contrapunctus",
    dbUser: String = "contrapunctus",
    dbPassword: String = ""
) derives ConfigReader
