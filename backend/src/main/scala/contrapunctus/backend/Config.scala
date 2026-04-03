package contrapunctus.backend

import pureconfig.ConfigReader

case class AppConfig(
  dbHost:          String,
  dbPort:          Int,
  dbName:          String,
  dbUser:          String,
  dbPassword:      String,
  dbJdbcUrl:       String,
  jwtSecret:       String,
  adminPassword:   String = "admin",
  dbSsl:           Boolean = true,
  dbAdminUser:     String = "yield",
  dbAdminPassword: String = "yield",
  googleClientId:  String = "",
  sesRegion:       String = "us-west-2",
  fromEmail:       String = "noreply@contrapunctus.app",
  frontendBaseUrl: String = "https://www.contrapunctus.app",
  backendBaseUrl:  String = "https://api.contrapunctus.app",
  sharesBucket:    String = "contrapunctus-shares",
  sharesRegion:    String = "us-west-2"
) derives ConfigReader
