import { TOKEN_RX } from "./patterns.js";

const SUPPORTED_LOCALES = new Set(["en-GB", "en-US"]);

// Zero-width characters that produce no visible glyph but split an otherwise
// contiguous number when inserted between digits: ZWSP, ZWNJ, ZWJ, BOM.
const ZERO_WIDTH_RX = new RegExp("[" + String.fromCharCode(0x200b, 0x200c, 0x200d, 0xfeff) + "]", "g");

// Markdown emphasis/code markers stripped before matching, so a figure
// interrupted by formatting ("£1,**528**") is still recognised as one token
// rather than silently passing detection because the regex no longer sees a
// contiguous number.
const MARKDOWN_RX = /[*_`]/g;

// "1 , 528" style spacing tricks: collapse whitespace that appears BEFORE a
// comma between two digits. Deliberately narrower than "any whitespace
// around the comma" — a space before a comma is never valid English
// punctuation, so it's a safe signal of a split-digit trick. Space only
// AFTER the comma is ordinary prose/list punctuation ("£603,000, 474 more")
// and must be left alone, or two independent adjacent numbers would fuse
// into one bigger grouped number.
const SPACED_COMMA_RX = /(\d)\s+,\s*(\d)/g;

function preprocess(text) {
  return String(text)
    .replace(ZERO_WIDTH_RX, "")
    .replace(MARKDOWN_RX, "")
    .replace(SPACED_COMMA_RX, "$1,$2");
}

/**
 * Canonical form of a figure token used both to build the allowed set and to
 * compare extracted tokens against it: lower-cased, zero-width characters
 * removed, and whitespace/hyphens collapsed out (so "30-year", "30 year" and
 * "30year" are one and the same token).
 */
export function normalise(token) {
  return String(token)
    .toLowerCase()
    .replace(ZERO_WIDTH_RX, "")
    .replace(/[\s-]+/g, "");
}

function extractFigures(text) {
  const out = [];
  TOKEN_RX.lastIndex = 0;
  let m;
  while ((m = TOKEN_RX.exec(text))) {
    out.push({ token: m[0], index: m.index });
    if (TOKEN_RX.lastIndex === m.index) TOKEN_RX.lastIndex++; // guard against zero-length matches
  }
  return out;
}

/**
 * Build a guard that validates that every figure-shaped token in a piece of
 * text is a member of an allowed set.
 *
 * @param {object} opts
 * @param {string[] | Record<string, string>} opts.allowed - the exact figure
 *   strings the text is permitted to contain (record form: pass the values
 *   object your engine already produces, e.g. `engine.metrics.display`).
 * @param {'en-GB'|'en-US'} [opts.locale] - accepted for forward-compat with a
 *   future locale that swaps separator conventions; en-GB and en-US both use
 *   comma-thousands/period-decimal so today they behave identically (see
 *   README Decisions).
 */
export function createGuard({ allowed, locale = "en-GB" } = {}) {
  if (!allowed) {
    throw new Error("createGuard requires `allowed` (a string[] or Record<string,string>)");
  }
  if (!SUPPORTED_LOCALES.has(locale)) {
    throw new Error(`createGuard: unsupported locale "${locale}" (supported: en-GB, en-US)`);
  }

  const list = Array.isArray(allowed) ? allowed : Object.values(allowed);
  const allowedSet = new Set(list.map(normalise));

  return {
    locale,
    normalise,
    validate(text) {
      const pre = preprocess(text);
      const violations = [];
      for (const { token, index } of extractFigures(pre)) {
        if (!allowedSet.has(normalise(token))) {
          violations.push({ token, index });
        }
      }
      return { ok: violations.length === 0, violations };
    },
  };
}
