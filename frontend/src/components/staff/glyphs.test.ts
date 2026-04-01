import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { vexOutlineToSvgPath } from "./glyphs";

describe("vexOutlineToSvgPath", () => {
  it("converts move command", () => {
    expect(vexOutlineToSvgPath("m 10 20")).toBe("M 10 20");
  });

  it("converts line command", () => {
    expect(vexOutlineToSvgPath("l 30 40")).toBe("L 30 40");
  });

  it("converts quadratic bezier with reordered args", () => {
    // VexFlow: q endX endY cpX cpY → SVG: Q cpX cpY endX endY
    expect(vexOutlineToSvgPath("q 10 20 30 40")).toBe("Q 30 40 10 20");
  });

  it("converts cubic bezier with reordered args", () => {
    // VexFlow: b endX endY cp1X cp1Y cp2X cp2Y → SVG: C cp1X cp1Y cp2X cp2Y endX endY
    expect(vexOutlineToSvgPath("b 10 20 30 40 50 60")).toBe("C 30 40 50 60 10 20");
  });

  it("converts close path", () => {
    expect(vexOutlineToSvgPath("z")).toBe("Z");
  });

  it("handles multi-command sequences", () => {
    expect(vexOutlineToSvgPath("m 0 0 l 10 10 z")).toBe("M 0 0 L 10 10 Z");
  });

  it("handles complex outline with all command types", () => {
    const input = "m 100 200 l 300 400 q 10 20 30 40 b 1 2 3 4 5 6 z";
    const expected = "M 100 200 L 300 400 Q 30 40 10 20 C 3 4 5 6 1 2 Z";
    expect(vexOutlineToSvgPath(input)).toBe(expected);
  });

  it("returns empty string for empty input", () => {
    expect(vexOutlineToSvgPath("")).toBe("");
  });

  it("property: output never contains lowercase vexflow commands", () => {
    const outlineArb = fc.constantFrom(
      "m 0 0", "l 1 2", "q 1 2 3 4", "b 1 2 3 4 5 6", "z",
      "m 0 0 l 10 20 z",
      "m 5 5 q 10 20 30 40 l 50 60 z",
      "m 0 0 b 1 2 3 4 5 6 z",
    );
    fc.assert(fc.property(outlineArb, (outline) => {
      const result = vexOutlineToSvgPath(outline);
      // Should only contain uppercase SVG commands (M, L, Q, C, Z) not lowercase vexflow (m, l, q, b)
      expect(result).not.toMatch(/\b[mlqb]\b/);
    }), { numRuns: 20 });
  });

  it("property: move and line preserve coordinates", () => {
    const coordArb = fc.tuple(fc.integer({ min: -999, max: 999 }), fc.integer({ min: -999, max: 999 }));
    fc.assert(fc.property(coordArb, ([x, y]) => {
      expect(vexOutlineToSvgPath(`m ${x} ${y}`)).toBe(`M ${x} ${y}`);
      expect(vexOutlineToSvgPath(`l ${x} ${y}`)).toBe(`L ${x} ${y}`);
    }), { numRuns: 20 });
  });

  it("property: quadratic swaps endpoint and control point", () => {
    const arb = fc.tuple(
      fc.integer({ min: -99, max: 99 }), fc.integer({ min: -99, max: 99 }),
      fc.integer({ min: -99, max: 99 }), fc.integer({ min: -99, max: 99 }),
    );
    fc.assert(fc.property(arb, ([ex, ey, cx, cy]) => {
      expect(vexOutlineToSvgPath(`q ${ex} ${ey} ${cx} ${cy}`)).toBe(`Q ${cx} ${cy} ${ex} ${ey}`);
    }), { numRuns: 20 });
  });

  it("property: cubic reorders endpoint after control points", () => {
    const arb = fc.tuple(
      fc.integer({ min: -99, max: 99 }), fc.integer({ min: -99, max: 99 }),
      fc.integer({ min: -99, max: 99 }), fc.integer({ min: -99, max: 99 }),
      fc.integer({ min: -99, max: 99 }), fc.integer({ min: -99, max: 99 }),
    );
    fc.assert(fc.property(arb, ([ex, ey, c1x, c1y, c2x, c2y]) => {
      expect(vexOutlineToSvgPath(`b ${ex} ${ey} ${c1x} ${c1y} ${c2x} ${c2y}`))
        .toBe(`C ${c1x} ${c1y} ${c2x} ${c2y} ${ex} ${ey}`);
    }), { numRuns: 20 });
  });
});
