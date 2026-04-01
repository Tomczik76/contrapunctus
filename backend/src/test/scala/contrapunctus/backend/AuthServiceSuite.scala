package contrapunctus.backend

import contrapunctus.backend.services.AuthService
import org.scalacheck.Prop._
import org.scalacheck.Gen

import java.util.UUID

class AuthServiceSuite extends munit.ScalaCheckSuite:

  // BCrypt is intentionally slow; reduce iterations for password tests
  override def scalaCheckTestParameters =
    super.scalaCheckTestParameters.withMinSuccessfulTests(5)

  // ── Password hashing ──

  property("hashPassword / checkPassword roundtrip") {
    // Limit password length to keep BCrypt fast in tests
    forAll(Gen.alphaNumStr.suchThat(_.length >= 1).map(_.take(30))) { password =>
      val hash = AuthService.hashPassword(password)
      assert(AuthService.checkPassword(password, hash), s"Password '$password' did not verify against its hash")
    }
  }

  property("wrong password does not verify") {
    forAll(Gen.alphaNumStr.suchThat(_.length >= 1).map(_.take(20)),
           Gen.alphaNumStr.suchThat(_.length >= 1).map(_.take(20))) { (pw1, pw2) =>
      if pw1 != pw2 then
        val hash = AuthService.hashPassword(pw1)
        assert(!AuthService.checkPassword(pw2, hash), s"'$pw2' should not verify against hash of '$pw1'")
    }
  }

  property("same password produces different hashes (salted)") {
    forAll(Gen.alphaNumStr.suchThat(_.length >= 4).map(_.take(20))) { password =>
      val h1 = AuthService.hashPassword(password)
      val h2 = AuthService.hashPassword(password)
      assertNotEquals(h1, h2, "Hashes should differ due to random salt")
    }
  }

  // ── JWT tokens ──

  val secret = "test-secret-for-property-tests"

  property("createToken / verifyToken roundtrip") {
    forAll(Gen.uuid) { userId =>
      val token = AuthService.createToken(userId, secret)
      assertEquals(AuthService.verifyToken(token, secret), Some(userId))
    }
  }

  property("verifyToken with wrong secret returns None") {
    forAll(Gen.uuid) { userId =>
      val token = AuthService.createToken(userId, secret)
      assertEquals(AuthService.verifyToken(token, "wrong-secret"), None)
    }
  }

  test("verifyToken with garbage string returns None") {
    assertEquals(AuthService.verifyToken("not.a.token", secret), None)
    assertEquals(AuthService.verifyToken("", secret), None)
  }

end AuthServiceSuite
