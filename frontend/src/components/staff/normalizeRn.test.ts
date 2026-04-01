import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { normalizeRn } from "./normalizeRn";

describe("normalizeRn", () => {
  it("trims whitespace", () => {
    expect(normalizeRn("  V  ")).toBe("V");
  });

  it("collapses internal spaces", () => {
    expect(normalizeRn("V 6 5")).toBe("V65");
  });

  it("converts letter-o to diminished °", () => {
    expect(normalizeRn("viio7")).toBe("vii°7");
  });

  it("converts zero to half-diminished ø", () => {
    expect(normalizeRn("vii07")).toBe("viiø7");
  });

  it("converts superscript digits to ASCII", () => {
    expect(normalizeRn("V⁶⁵")).toBe("V65");
    expect(normalizeRn("I⁶⁴")).toBe("I64");
  });

  it("converts subscript digits to ASCII", () => {
    expect(normalizeRn("V₄₂")).toBe("V42");
  });

  it("handles plain RN unchanged", () => {
    expect(normalizeRn("IV")).toBe("IV");
    expect(normalizeRn("vi")).toBe("vi");
  });

  it("preserves existing ° symbol", () => {
    expect(normalizeRn("vii°")).toBe("vii°");
  });

  it("property: idempotent", () => {
    const rnArb = fc.constantFrom("I", "ii", "IV", "V7", "viio7", "vii07", "V65", "V⁶⁵", "I₆₄");
    fc.assert(fc.property(rnArb, (rn) => {
      expect(normalizeRn(normalizeRn(rn))).toBe(normalizeRn(rn));
    }), { numRuns: 20 });
  });

  it("property: result never contains whitespace", () => {
    const rnArb = fc.constantFrom(
      "I", " V 7", "  ii  ", "V 6 5", "viio 7", "I ⁶⁴", " vii07 ",
      "III+", "bII 6", " #IV ", "V ₄₂",
    );
    fc.assert(fc.property(rnArb, (rn) => {
      expect(normalizeRn(rn)).not.toMatch(/\s/);
    }), { numRuns: 20 });
  });
});
