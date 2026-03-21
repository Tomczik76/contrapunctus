package contrapunctus.backend.db

import cats.effect.IO
import java.sql.DriverManager

object Bootstrap:
  /** Connect to the default `postgres` database as an admin user and create
    * the application database and role if they don't already exist.
    */
  def ensureDatabase(
    host: String,
    port: Int,
    dbName: String,
    dbUser: String,
    dbPassword: String,
    adminUser: String,
    adminPassword: String,
    ssl: Boolean
  ): IO[Unit] = IO {
    val sslParam = if ssl then "?sslmode=require" else ""
    val adminUrl = s"jdbc:postgresql://$host:$port/postgres$sslParam"
    val conn = DriverManager.getConnection(adminUrl, adminUser, adminPassword)
    try
      conn.setAutoCommit(true)
      val stmt = conn.createStatement()

      // Create role if not exists
      val roleCheck = conn.prepareStatement(
        "SELECT 1 FROM pg_roles WHERE rolname = ?"
      )
      roleCheck.setString(1, dbUser)
      val roleExists = roleCheck.executeQuery().next()
      roleCheck.close()
      if !roleExists then
        stmt.execute(s"""CREATE ROLE "$dbUser" WITH LOGIN PASSWORD '$dbPassword'""")

      // Create database if not exists
      val dbCheck = conn.prepareStatement(
        "SELECT 1 FROM pg_database WHERE datname = ?"
      )
      dbCheck.setString(1, dbName)
      val dbExists = dbCheck.executeQuery().next()
      dbCheck.close()
      if !dbExists then
        stmt.execute(s"""CREATE DATABASE "$dbName" OWNER "$dbUser"""")

      stmt.close()
    finally
      conn.close()
  }
