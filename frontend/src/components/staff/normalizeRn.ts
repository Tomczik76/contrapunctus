/** Normalize an RN string for comparison: trim, collapse spaces, convert Unicode super/subscript digits to ASCII, normalize quality symbols. */
export function normalizeRn(rn: string): string {
  return rn
    .trim()
    .replace(/\s+/g, "")
    // Normalize quality symbols: "o" → "°", "0" (zero) → "ø"
    .replace(/°/g, "°")  // keep degree sign as-is
    .replace(/([iIvV])(o)(?=\d|$)/g, "$1°")  // letter-o after RN → diminished °
    .replace(/([iIvV])(0)(?=\d|$)/g, "$1ø")  // zero after RN → half-diminished ø
    // Unicode superscript digits → ASCII
    .replace(/⁰/g, "0").replace(/¹/g, "1").replace(/²/g, "2").replace(/³/g, "3")
    .replace(/⁴/g, "4").replace(/⁵/g, "5").replace(/⁶/g, "6").replace(/⁷/g, "7")
    .replace(/⁸/g, "8").replace(/⁹/g, "9")
    // Unicode subscript digits → ASCII
    .replace(/₀/g, "0").replace(/₁/g, "1").replace(/₂/g, "2").replace(/₃/g, "3")
    .replace(/₄/g, "4").replace(/₅/g, "5").replace(/₆/g, "6").replace(/₇/g, "7")
    .replace(/₈/g, "8").replace(/₉/g, "9");
}
