// Vendored from figure-guard (github.com/.../figure-guard) as of 2026-07-05,
// with one addition: ENERGY_UNIT. figure-guard's original BARE_NUMBER class
// deliberately excludes ungrouped numbers ("73", not "1,528") because in its
// financial domain those are common, low-stakes prose numbers. GridPilot's
// grid figures are frequently exactly that shape — "73 gCO2/kWh", "16.7%
// wind" — so an ungrouped-number exclusion would leave the validator blind to
// most of this domain's actual figures. ENERGY_UNIT closes that gap by
// requiring an explicit grid-data unit suffix, so it stays narrow (a bare "73"
// alone still isn't tokenised — only "73 gCO2/kWh" is). Everything else here,
// including extraction-order rules, is unchanged from the original.
//
// If figure-guard publishes to npm with a first-class extension point for
// domain units, prefer depending on it directly over maintaining this fork.

// Token patterns for every figure class figure-guard recognises. Kept in one
// place because the extraction order below is load-bearing: alternation in
// JS regex tries branches left-to-right and stops at the first one that
// matches, so more specific classes (percent, multiple, duration, energy unit
// — which all start with a bare digit, same as bareNumber) must be listed
// before bareNumber or they'd never get a chance to match their trailing unit.

// Money: £/$/€, proper thousands-grouping only (a comma not followed by
// exactly three digits ends the match here rather than swallowing trailing
// prose punctuation — this is the exact shape of the production bug this
// library was extracted to prevent: "£1,528, which is" used to over-match
// into the sentence). Abbreviated forms (£1.2m, $500k) are recognised as
// their own literal token, not converted to/from the expanded form — see
// the README "Decisions" section.
const CURRENCY = /[£$€]\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s?(?:million|billion|thousand|bn|m|k)\b)?/;

// GridPilot addition: currency-per-unit energy prices, e.g. "£129.00/MWh".
// Same shape as CURRENCY but with a mandatory unit denominator, so it must be
// tried BEFORE CURRENCY in the alternation below — otherwise CURRENCY would
// match the symbol+number and stop, leaving "/MWh" outside the token, which
// would then fail to round-trip against a display value formatted with the
// unit attached (the exact bug this addition was written to fix).
const CURRENCY_PER_UNIT = /[£$€]\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?\/(?:MWh|kWh|MW)\b/;

// Percentage, with optional thousands-grouping for consistency with money.
const PERCENT = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?%/;

// Income/ratio multiples: "4.5x".
const MULTIPLE = /\b\d+(?:\.\d+)?x\b/;

// Durations: "3 months", "30-year", "6 weeks" — space or hyphen between the
// number and the unit are treated as equivalent by normalise().
const DURATION = /\b\d+(?:\.\d+)?[\s-]?(?:day|days|week|weeks|month|months|year|years)\b/;

// GridPilot addition: grid-data units, ungrouped numbers included since these
// domain figures are rarely four digits (e.g. "73 gCO2/kWh", "20,133 MW").
const ENERGY_UNIT = /\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s?(?:gCO2\/kWh|MWh|MW|GW|p\/kWh)\b/;

// Bare large numbers: only numbers formatted WITH thousands-grouping count
// as a figure here (at least one ",DDD" group). An un-grouped small number
// like "5" or "45" is too common in ordinary prose to treat as a claim that
// needs grounding, so it is deliberately not tokenised.
const BARE_NUMBER = /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b/;

export const TOKEN_RX = new RegExp(
  [CURRENCY_PER_UNIT, CURRENCY, PERCENT, MULTIPLE, DURATION, ENERGY_UNIT, BARE_NUMBER]
    .map((r) => `(?:${r.source})`)
    .join("|"),
  "gi"
);
