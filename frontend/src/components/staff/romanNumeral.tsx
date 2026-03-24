import { useState, useRef, useEffect } from "react";

/**
 * Parse a roman numeral string into its base label and figured bass figures.
 * E.g. "V65" -> { base: "V", figures: ["6","5"] }
 *      "viio7" -> { base: "vii°", figures: ["7"] }
 *      "I64" -> { base: "I", figures: ["6","4"] }
 *      "IV" -> { base: "IV", figures: [] }
 */
export function parseRomanNumeral(raw: string): { base: string; figures: string[] } {
  const s = raw.trim();
  if (!s) return { base: "", figures: [] };

  // Match the roman numeral part (possibly lowercase), optional quality markers (o, °, +, ø, 0 for half-dim)
  const rnMatch = s.match(/^([iIvV]+)(o|°|\+|ø|0)?/);
  if (!rnMatch) return { base: s, figures: [] };

  let base = rnMatch[1];
  const quality = rnMatch[2] || "";
  if (quality === "o") base += "\u00B0";
  else if (quality === "0") base += "\u00F8"; // 0 (zero) → ø (half-diminished)
  else if (quality) base += quality;

  const rest = s.slice(rnMatch[0].length);

  // The rest should be digits representing figured bass: "7", "6", "64", "65", "43", "42"
  if (!rest || !/^\d+$/.test(rest)) {
    // If rest has non-digit content, just append it
    return { base: base + rest, figures: [] };
  }

  // Split digits into figure pairs based on common figured bass patterns
  const figures: string[] = [];
  if (rest.length === 1) {
    figures.push(rest); // "7" or "6"
  } else if (rest.length === 2) {
    figures.push(rest[0], rest[1]); // "64" -> ["6","4"], "65" -> ["6","5"]
  } else if (rest.length === 3) {
    figures.push(rest[0], rest[1], rest[2]); // "642" -> ["6","4","2"]
  } else {
    figures.push(rest);
  }

  return { base, figures };
}

/** Check if a roman numeral string is a valid RN label. */
export function isValidRomanNumeral(raw: string): boolean {
  const s = raw.trim();
  if (!s) return true; // empty is not invalid, just incomplete
  // Match: optional accidental (b, #, N), roman numeral, optional quality, optional figures
  return /^([b#]?)(N6|Ger6|Fr6|It6|[iIvV]+)(o|°|\+|ø|0)?(7|6|64|65|43|42)?$/.test(s);
}

/** Render formatted figured bass as React elements. */
export function FormattedRn({ text, dark, invalid }: { text: string; dark: boolean; invalid?: boolean }) {
  const { base, figures } = parseRomanNumeral(text);
  if (!base && figures.length === 0) return null;

  const color = invalid ? "#dc2626" : (dark ? "#e0ddd8" : "#1a1a1a");

  if (figures.length === 0) {
    return (
      <span style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 13, color }}>
        {base}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", color }}>
      <span style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 13 }}>
        {base}
      </span>
      <span style={{
        display: "inline-flex", flexDirection: "column", alignItems: "center",
        fontFamily: "serif", fontStyle: "italic", fontSize: 9, lineHeight: 1.1,
        marginLeft: 1, position: "relative", top: figures.length > 1 ? -1 : -2,
      }}>
        {figures.map((f, i) => <span key={i}>{f}</span>)}
      </span>
    </span>
  );
}

/** Figured bass edit input — stores raw text while typing, validates on blur. */
export function FbEditInput({ value, onChange, dark }: { value: string[]; onChange: (figures: string[]) => void; dark: boolean }) {
  const [raw, setRaw] = useState(value.join(","));
  const [focused, setFocused] = useState(false);

  // Sync from parent when not focused
  useEffect(() => {
    if (!focused) setRaw(value.join(","));
  }, [value, focused]);

  function commit(text: string) {
    const parts = text.split(",").map(s => s.trim()).filter(Boolean);
    const valid = parts.filter(f => {
      const n = parseInt(f, 10);
      return !isNaN(n) && n >= 1 && n <= 13;
    });
    onChange(valid);
    setRaw(valid.join(","));
  }

  return (
    <input
      type="text"
      value={raw}
      onChange={(e) => {
        // Allow digits and commas while typing
        const cleaned = e.target.value.replace(/[^0-9,]/g, "");
        setRaw(cleaned);
      }}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        setFocused(false);
        commit(e.target.value);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit(raw);
          (e.target as HTMLInputElement).blur();
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      placeholder=""
      style={{
        width: "100%", boxSizing: "border-box",
        padding: "2px 4px", fontSize: 11, textAlign: "center",
        border: `1px solid ${focused ? (dark ? "#888" : "#666") : (dark ? "#555" : "#ccc")}`,
        borderRadius: 3,
        background: dark ? "#2a2a30" : "#fff",
        color: dark ? "#c8b8a0" : "#8b7355",
        fontFamily: "serif", fontStyle: "italic",
        outline: "none",
      }}
    />
  );
}

export function RnInput({ value, onChange, dark, disabled }: { value: string; onChange: (v: string) => void; dark: boolean; disabled?: boolean }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasValue = value.trim().length > 0;
  const invalid = hasValue && !isValidRomanNumeral(value);
  const borderColor = focused
    ? (dark ? "#888" : "#666")
    : invalid
      ? "#dc2626"
      : (dark ? "#555" : "#ccc");

  const containerStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    boxSizing: "border-box",
    border: `1px solid ${borderColor}`,
    borderRadius: 3,
    background: dark ? "#2a2a30" : "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: disabled ? "default" : "text",
    position: "relative",
    opacity: disabled ? 0.7 : 1,
  };

  if (disabled) {
    return (
      <div style={containerStyle}>
        {hasValue ? (
          <FormattedRn text={value} dark={dark} invalid={invalid} />
        ) : (
          <span style={{ fontFamily: "serif", fontStyle: "italic", fontSize: 13, color: dark ? "#666" : "#aaa" }}>?</span>
        )}
      </div>
    );
  }

  if (focused) {
    return (
      <div style={containerStyle}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setFocused(false)}
          autoFocus
          style={{
            width: "100%",
            height: "100%",
            boxSizing: "border-box",
            border: "none",
            background: "transparent",
            color: invalid ? "#dc2626" : (dark ? "#e0ddd8" : "#1a1a1a"),
            fontSize: 13,
            fontFamily: "serif",
            fontStyle: "italic",
            textAlign: "center",
            padding: "0 2px",
            outline: "none",
          }}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle} onClick={() => setFocused(true)}>
      {hasValue ? (
        <FormattedRn text={value} dark={dark} invalid={invalid} />
      ) : (
        <span style={{
          fontFamily: "serif", fontStyle: "italic", fontSize: 13,
          color: dark ? "#666" : "#aaa",
        }}>
          ?
        </span>
      )}
    </div>
  );
}

/** Collapsible legend for roman numeral entry. */
export function RnLegend({ dark }: { dark: boolean }) {
  const [open, setOpen] = useState(false);
  const bg = dark ? "#2a2a30" : "#f8f7f5";
  const border = dark ? "#3a3a40" : "#e0dcd8";
  const text = dark ? "#e0ddd8" : "#1a1a1a";
  const muted = dark ? "#999" : "#666";

  const examples: [string, string][] = [
    ["I", "Root position"],
    ["I6", "1st inversion"],
    ["I64", "2nd inversion"],
    ["V7", "7th chord"],
    ["V65", "7th, 1st inv."],
    ["V43", "7th, 2nd inv."],
    ["V42", "7th, 3rd inv."],
    ["viio", "Diminished"],
    ["vii07", "Half-diminished"],
    ["ii", "Minor (lowercase)"],
  ];

  return (
    <div style={{ padding: "0 16px 8px" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 12, color: muted, padding: 0,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          display: "inline-flex", alignItems: "center", gap: 4,
        }}
      >
        <span style={{ fontSize: 10, transform: open ? "rotate(90deg)" : "none", display: "inline-block", transition: "transform 0.15s" }}>&#9654;</span>
        Roman numeral guide
      </button>
      {open && (
        <div style={{
          marginTop: 6, padding: "10px 14px", background: bg,
          border: `1px solid ${border}`, borderRadius: 6, color: text,
          display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: 12,
        }}>
          {examples.map(([input, label]) => (
            <div key={input} style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 130 }}>
              <span style={{
                fontFamily: "serif", fontStyle: "italic", fontWeight: 600,
                fontSize: 13, minWidth: 32,
              }}>
                <FormattedRn text={input} dark={dark} />
              </span>
              <span style={{ color: muted, fontSize: 11 }}>
                {input} &mdash; {label}
              </span>
            </div>
          ))}
          <div style={{ width: "100%", fontSize: 11, color: muted, marginTop: 4 }}>
            Use lowercase for minor (ii, iii, vi). Add &ldquo;o&rdquo; for diminished (viio). Use &ldquo;0&rdquo; (zero) for half-diminished (vii07). Add &ldquo;+&rdquo; for augmented.
          </div>
        </div>
      )}
    </div>
  );
}
