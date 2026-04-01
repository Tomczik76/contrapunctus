import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseRomanNumeral, isValidRomanNumeral } from "./romanNumeral";

// ── parseRomanNumeral ───────────────────────────────────────────────

describe("parseRomanNumeral", () => {
  it("parses simple major RN", () => {
    expect(parseRomanNumeral("I")).toEqual({ base: "I", figures: [] });
    expect(parseRomanNumeral("IV")).toEqual({ base: "IV", figures: [] });
    expect(parseRomanNumeral("V")).toEqual({ base: "V", figures: [] });
  });

  it("parses simple minor RN", () => {
    expect(parseRomanNumeral("ii")).toEqual({ base: "ii", figures: [] });
    expect(parseRomanNumeral("vi")).toEqual({ base: "vi", figures: [] });
  });

  it("parses 7th chord", () => {
    expect(parseRomanNumeral("V7")).toEqual({ base: "V", figures: ["7"] });
  });

  it("parses inversions", () => {
    expect(parseRomanNumeral("I6")).toEqual({ base: "I", figures: ["6"] });
    expect(parseRomanNumeral("I64")).toEqual({ base: "I", figures: ["6", "4"] });
    expect(parseRomanNumeral("V65")).toEqual({ base: "V", figures: ["6", "5"] });
    expect(parseRomanNumeral("V43")).toEqual({ base: "V", figures: ["4", "3"] });
    expect(parseRomanNumeral("V42")).toEqual({ base: "V", figures: ["4", "2"] });
  });

  it("parses diminished with 'o'", () => {
    const result = parseRomanNumeral("viio");
    expect(result.base).toBe("vii\u00B0"); // ° symbol
    expect(result.figures).toEqual([]);
  });

  it("parses diminished seventh", () => {
    const result = parseRomanNumeral("viio7");
    expect(result.base).toBe("vii\u00B0");
    expect(result.figures).toEqual(["7"]);
  });

  it("parses half-diminished with '0'", () => {
    const result = parseRomanNumeral("vii07");
    expect(result.base).toBe("vii\u00F8"); // ø symbol
    expect(result.figures).toEqual(["7"]);
  });

  it("parses augmented with '+'", () => {
    const result = parseRomanNumeral("III+");
    expect(result.base).toBe("III+");
    expect(result.figures).toEqual([]);
  });

  it("returns empty for empty string", () => {
    expect(parseRomanNumeral("")).toEqual({ base: "", figures: [] });
    expect(parseRomanNumeral("  ")).toEqual({ base: "", figures: [] });
  });

  it("handles 3-digit figures", () => {
    const result = parseRomanNumeral("V642");
    expect(result.figures).toEqual(["6", "4", "2"]);
  });

  it("property: base always contains original RN letters", () => {
    const rnArb = fc.constantFrom("I", "II", "III", "IV", "V", "VI", "VII", "i", "ii", "iii", "iv", "v", "vi", "vii");
    fc.assert(
      fc.property(rnArb, (rn) => {
        const { base } = parseRomanNumeral(rn);
        expect(base).toContain(rn);
      })
    );
  });

  it("property: figures are always single digits for 1-3 digit suffixes", () => {
    const rnArb = fc.constantFrom("I", "V", "ii", "vi");
    const figArb = fc.constantFrom("6", "64", "65", "43", "42", "7");
    fc.assert(
      fc.property(rnArb, figArb, (rn, fig) => {
        const { figures } = parseRomanNumeral(rn + fig);
        for (const f of figures) {
          expect(f.length).toBe(1);
        }
      })
    );
  });
});

// ── isValidRomanNumeral ─────────────────────────────────────────────

describe("isValidRomanNumeral", () => {
  it("accepts empty string", () => {
    expect(isValidRomanNumeral("")).toBe(true);
  });

  it("accepts simple RNs", () => {
    expect(isValidRomanNumeral("I")).toBe(true);
    expect(isValidRomanNumeral("ii")).toBe(true);
    expect(isValidRomanNumeral("IV")).toBe(true);
    expect(isValidRomanNumeral("V")).toBe(true);
    expect(isValidRomanNumeral("vi")).toBe(true);
    expect(isValidRomanNumeral("VII")).toBe(true);
  });

  it("accepts RNs with inversions", () => {
    expect(isValidRomanNumeral("I6")).toBe(true);
    expect(isValidRomanNumeral("I64")).toBe(true);
    expect(isValidRomanNumeral("V7")).toBe(true);
    expect(isValidRomanNumeral("V65")).toBe(true);
    expect(isValidRomanNumeral("V43")).toBe(true);
    expect(isValidRomanNumeral("V42")).toBe(true);
  });

  it("accepts quality markers", () => {
    expect(isValidRomanNumeral("viio")).toBe(true);
    expect(isValidRomanNumeral("viio7")).toBe(true);
    expect(isValidRomanNumeral("vii07")).toBe(true);
    expect(isValidRomanNumeral("III+")).toBe(true);
  });

  it("accepts accidentals", () => {
    expect(isValidRomanNumeral("bII")).toBe(true);
    expect(isValidRomanNumeral("#IV")).toBe(true);
    expect(isValidRomanNumeral("bVII")).toBe(true);
  });

  it("accepts special chords", () => {
    expect(isValidRomanNumeral("N6")).toBe(true);
    expect(isValidRomanNumeral("Ger6")).toBe(true);
    expect(isValidRomanNumeral("Fr6")).toBe(true);
    expect(isValidRomanNumeral("It6")).toBe(true);
  });

  it("rejects invalid input", () => {
    expect(isValidRomanNumeral("X")).toBe(false);
    expect(isValidRomanNumeral("123")).toBe(false);
    expect(isValidRomanNumeral("hello")).toBe(false);
    expect(isValidRomanNumeral("Vabc")).toBe(false);
  });

  it("rejects invalid figure combinations", () => {
    expect(isValidRomanNumeral("V99")).toBe(false);
    expect(isValidRomanNumeral("I11")).toBe(false);
    expect(isValidRomanNumeral("V00")).toBe(false);
  });

  it("property: all valid RNs with standard figures are accepted", () => {
    const rnArb = fc.constantFrom("I", "II", "III", "IV", "V", "VI", "VII", "i", "ii", "iii", "iv", "v", "vi", "vii");
    const figArb = fc.constantFrom("", "6", "64", "65", "43", "42", "7");
    fc.assert(
      fc.property(rnArb, figArb, (rn, fig) => {
        expect(isValidRomanNumeral(rn + fig)).toBe(true);
      })
    );
  });

  it("property: valid RNs with quality markers are accepted", () => {
    const rnArb = fc.constantFrom("vii", "VII", "iii", "III");
    const qualArb = fc.constantFrom("o", "+", "0");
    const figArb = fc.constantFrom("", "7", "65", "43", "42");
    fc.assert(
      fc.property(rnArb, qualArb, figArb, (rn, qual, fig) => {
        expect(isValidRomanNumeral(rn + qual + fig)).toBe(true);
      })
    );
  });
});
