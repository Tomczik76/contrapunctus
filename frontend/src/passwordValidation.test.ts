import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { passwordStrength, isPasswordValid } from "./passwordValidation";

describe("passwordStrength", () => {
  it("rejects short passwords", () => {
    expect(passwordStrength("Ab1!").length).toBe(false);
  });

  it("requires a digit", () => {
    expect(passwordStrength("abcdefgh!").number).toBe(false);
    expect(passwordStrength("abcdefg1!").number).toBe(true);
  });

  it("requires a special character", () => {
    expect(passwordStrength("abcdefg1").special).toBe(false);
    expect(passwordStrength("abcdefg1!").special).toBe(true);
  });

  it("accepts valid passwords", () => {
    const s = passwordStrength("MyP@ss1!");
    expect(s.length).toBe(true);
    expect(s.number).toBe(true);
    expect(s.special).toBe(true);
  });
});

describe("isPasswordValid", () => {
  it("rejects passwords missing requirements", () => {
    expect(isPasswordValid("short1!")).toBe(false);     // too short
    expect(isPasswordValid("longpassword!")).toBe(false); // no digit
    expect(isPasswordValid("longpassword1")).toBe(false); // no special
  });

  it("accepts passwords meeting all requirements", () => {
    expect(isPasswordValid("MyP@ssw0rd")).toBe(true);
  });

  it("property: any 8+ char string with digit and special is valid", () => {
    const validPw = fc.tuple(
      fc.string({ minLength: 5, maxLength: 10 }),
      fc.constantFrom("0", "1", "2", "9"),
      fc.constantFrom("!", "@", "#", "$"),
    ).map(([base, digit, special]) => base + digit + special);

    fc.assert(fc.property(validPw, (pw) => {
      if (pw.length >= 8 && /\d/.test(pw) && /[^a-zA-Z0-9]/.test(pw)) {
        expect(isPasswordValid(pw)).toBe(true);
      }
    }), { numRuns: 20 });
  });
});
