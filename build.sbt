val scala3Version = "3.5.2"

// Backend versions
val Http4sVersion     = "0.23.33"
val CirceVersion      = "0.14.14"
val MunitVersion      = "1.1.1"
val MunitCEVersion    = "2.0.0"
val TestContVersion   = "0.41.8"
val LogbackVersion    = "1.5.6"
val SkunkVersion      = "0.6.5"
val FlywayVersion     = "10.17.0"
val PostgresVersion   = "42.7.3"
val BCryptVersion     = "0.4"
val JwtVersion        = "4.4.0"
val PureConfigVersion = "0.17.8"

lazy val core = crossProject(JVMPlatform, JSPlatform)
  .in(file("."))
  .settings(
    name := "Contrapunctus",
    version := "0.1.0-SNAPSHOT",

    scalaVersion := scala3Version,

    libraryDependencies ++= Seq("org.scalameta" %%% "munit" % "1.0.0" % Test,
     "org.scalameta" %%% "munit-scalacheck" % "1.0.0" % Test,
     "org.typelevel" %%% "cats-core" % "2.12.0",
     "io.higherkindness" %%% "droste-core" % "0.10.0"
    )
  )
  .jsSettings(
    scalaJSUseMainModuleInitializer := false,
    scalaJSLinkerConfig ~= {
      _.withModuleKind(ModuleKind.ESModule)
        .withSourceMap(true)
    }
  )

lazy val crawler = (project in file("crawler"))
  .settings(
    name         := "contrapunctus-crawler",
    version      := "0.0.1-SNAPSHOT",
    scalaVersion := scala3Version,
    organization := "io.github.tomczik76",
    libraryDependencies ++= Seq(
      "org.http4s"           %% "http4s-ember-client" % Http4sVersion,
      "org.http4s"           %% "http4s-circe"        % Http4sVersion,
      "io.circe"             %% "circe-generic"       % CirceVersion,
      "io.circe"             %% "circe-parser"        % CirceVersion,
      "org.jsoup"            %  "jsoup"               % "1.18.1",
      "software.amazon.awssdk" % "bedrockruntime"     % "2.31.1",
      "com.github.pureconfig" %% "pureconfig-core"    % PureConfigVersion,
      "org.tpolecat"         %% "skunk-core"          % SkunkVersion,
      "ch.qos.logback"       %  "logback-classic"     % LogbackVersion,
      "org.scalameta"        %% "munit"               % MunitVersion % Test,
    ),
    testFrameworks += new TestFramework("munit.Framework"),
    assembly / mainClass := Some("contrapunctus.crawler.Main"),
    assembly / assemblyJarName := "crawler.jar",
    assembly / assemblyMergeStrategy := {
      case PathList("META-INF", "services", _*) => MergeStrategy.concat
      case PathList("META-INF", _*)             => MergeStrategy.discard
      case "reference.conf"                     => MergeStrategy.concat
      case _                                    => MergeStrategy.first
    }
  )

lazy val backend = (project in file("backend"))
  .dependsOn(core.jvm)
  .settings(
    name         := "contrapunctus-backend",
    version      := "0.0.1-SNAPSHOT",
    scalaVersion := scala3Version,
    organization := "io.github.tomczik76",
    libraryDependencies ++= Seq(
      "org.http4s"     %% "http4s-ember-server" % Http4sVersion,
      "org.http4s"     %% "http4s-circe"        % Http4sVersion,
      "org.http4s"     %% "http4s-dsl"          % Http4sVersion,
      "io.circe"       %% "circe-generic"       % CirceVersion,
      "io.circe"       %% "circe-parser"        % CirceVersion,
      "org.scalameta"  %% "munit"               % MunitVersion % Test,
      "org.scalameta"  %% "munit-scalacheck"    % "1.0.0" % Test,
      "org.typelevel"  %% "munit-cats-effect"   % MunitCEVersion % Test,
      "com.dimafeng"   %% "testcontainers-scala-munit" % TestContVersion % Test,
      "com.dimafeng"   %% "testcontainers-scala-postgresql" % TestContVersion % Test,
      "ch.qos.logback" %  "logback-classic"     % LogbackVersion,
      "org.tpolecat"   %% "skunk-core"          % SkunkVersion,
      "org.tpolecat"   %% "skunk-circe"         % SkunkVersion,
      "org.flywaydb"   %  "flyway-core"         % FlywayVersion,
      "org.flywaydb"   %  "flyway-database-postgresql" % FlywayVersion,
      "org.postgresql"  %  "postgresql"          % PostgresVersion,
      "org.mindrot"    %  "jbcrypt"              % BCryptVersion,
      "com.auth0"      %  "java-jwt"             % JwtVersion,
      "com.github.pureconfig" %% "pureconfig-core" % PureConfigVersion,
      "org.http4s"     %% "http4s-ember-client" % Http4sVersion,
      "software.amazon.awssdk" % "ses"           % "2.31.1",
    ),
    testFrameworks += new TestFramework("munit.Framework"),
    assembly / mainClass := Some("contrapunctus.backend.Main"),
    assembly / assemblyJarName := "backend.jar",
    assembly / assemblyMergeStrategy := {
      case PathList("META-INF", "services", _*) => MergeStrategy.concat
      case PathList("META-INF", _*)             => MergeStrategy.discard
      case "reference.conf"                     => MergeStrategy.concat
      case _                                    => MergeStrategy.first
    }
  )
