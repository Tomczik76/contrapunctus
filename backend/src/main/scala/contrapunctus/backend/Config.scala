package contrapunctus.backend

import pureconfig.ConfigReader

case class AppConfig(
  dbHost:     String,
  dbPort:     Int,
  dbName:     String,
  dbUser:     String,
  dbPassword: String,
  dbJdbcUrl:  String,
  jwtSecret:  String,
  dbSsl:      Boolean = true
) derives ConfigReader
