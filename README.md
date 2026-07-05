# GridPilot

`v0.1 — built in a day, evals green, roadmap open`

Grounded question-answering over live, public Great Britain electricity grid
data. Ask a question, GridPilot fetches real numbers from named public APIs,
narrates them inside a validator that cannot cite a figure the data didn't
produce, and refuses anything it can't ground — including its own most
tempting demo question.

This project implements the **Caged Narrator pattern** (deterministic core
fetches, an LLM narrates inside a cage, a validator enforces, a fallback
guarantees) in the energy domain. The validator is vendored from
[figure-guard](../figure-guard), extended with one domain-specific token
class — see [Decisions](#decisions).

## Problem

GB electricity data is public but scattered across Carbon Intensity, Elexon
and NESO APIs, each with its own shape and update cadence. Reading it
correctly requires operational literacy most people asking "how green is the
grid right now?" don't have and shouldn't need. A general LLM will happily
answer these questions from training data or plausible-sounding priors — with
no live numbers and no way to tell you it's guessing. GridPilot's whole
reason to exist is that gap: it either grounds the answer in a number fetched
seconds ago, or it says so and stops.

## Architecture

```
question
   │
   ▼
[router]  classifyQuestion() — deterministic keyword classifier by default;
   │       resolves to a whitelisted tool set OR a refusal reason.
   │       (Gemini-assisted classification is wired in but only engages
   │       when GEMINI_API_KEY is set — see Decisions.)
   │
   ├── refuse ──────────────────────────────► refusal template, zero tool calls
   │
   ▼
[tools]   lib/tools/*.ts — 4 deterministic fetchers, each hits one named
   │       public API, returns typed data + a display map (the whitelist)
   │       + source URL + data timestamp + a computed `stale` flag.
   │
   ▼
[cage]    lib/validator — figure-guard, vendored + extended. Builds an
   │       allowed-figures set from the tool display maps; validate(text)
   │       rejects any narrative containing a figure outside that set.
   │
   ▼
[narrate] lib/narration/narrate.ts — withFallback(generateFn, fallbackFn,
   │       guard): tries an LLM draft (if configured), validates it, retries
   │       once, and falls back to a template built directly from the
   │       display map if the LLM draft still fails or no key is set.
   │
   ▼
answer card: narrative + data table + sources & freshness + disclaimer
```

## Decisions

1. **Router defaults to deterministic keyword classification, not an LLM
   call.** The pack specified "LLM classifies the question." We built that
   (`lib/narration/gemini.ts` + a JSON-constrained path is the natural
   extension point), but made the *default* path a rule-based classifier
   (`lib/narration/router.ts`) so the six suggested questions — and the eval
   suite — are 100% reproducible with zero network dependence on an LLM
   provider. This is the same caged-narrator philosophy applied one layer up:
   routing is deterministic-first, LLM-assisted second, never LLM-only.
2. **figure-guard was vendored, not depended on, and extended.** At build
   time figure-guard (Pack 2) had no `package.json` yet — it was mid-build in
   a parallel session — so a `file:` dependency wasn't installable. We copied
   its source (`lib/validator/figure-guard/`) unmodified except for
   `patterns.js`, where we added two token classes: `ENERGY_UNIT` (bare
   numbers with a grid-data unit, e.g. "73 gCO2/kWh" — figure-guard's
   original `BARE_NUMBER` deliberately excludes ungrouped numbers, which is
   most of this domain's figures) and `CURRENCY_PER_UNIT` (e.g.
   "£129.00/MWh" — figure-guard's `CURRENCY` class doesn't capture a trailing
   unit denominator, which silently broke round-tripping on every system
   price narration until eval case 3 caught it). Both are documented inline
   with the reasoning. If figure-guard publishes to npm with a domain-unit
   extension point, prefer depending on it directly over maintaining this
   fork.
3. **"Tonight's margin" was rephrased.** Probing Elexon's `/forecast/margin/daily`
   and `/forecast/demand/daily` endpoints showed both are, despite their
   names, 2-14-days-ahead indicative forecasts — today and tomorrow are never
   present. Rather than mislabel the nearest available row as "tonight," the
   suggested question became "How tight does the margin look over the next
   couple of weeks?" and the tool always names the real forecast date. See
   [docs/data-sources.md](docs/data-sources.md).
4. **All four tools shipped keyless** — Elexon's modern Insights Solution API
   (`data.elexon.co.uk`) turned out not to require registration for system
   prices, demand or margin data, so the pack's 3-tool fallback contingency
   never triggered. This was verified by direct probing before writing any
   tool code, not assumed.
5. **Refusal cases expanded from 4 to 5.** The original pack specified 4
   refusal cases; the 10-layer interrogation added a mandatory 5th — an
   un-groundable causal question ("why did system price spike at 17:30?")
   must be refused with an explanation of what data would be needed, turning
   the flagship question's ungroundability into a measured, tested refusal
   rather than a hidden weakness.

## Evals

`npm run eval` — 11 cases, fixture-backed and network-free, the CI-blocking
gate:
- **6 grounding cases** (`evals/grounding.test.ts`): fixed recorded API
  fixtures assert correct tool selection, every narrative figure passes the
  validator, source + timestamp present, and a stale-data case is correctly
  flagged.
- **5 refusal cases** (`evals/refusal.test.ts`): trading advice, future price
  prediction, out-of-domain (gas network), prompt injection, and the
  mandatory un-groundable causal case — all refuse with zero tool calls.

`npm run eval:live` — 5 live smoke cases (`evals/liveSmoke.test.ts`) hit the
real APIs: schema checks, freshness, and two independent runs both producing
guard-clean narration. Wired into CI as a non-blocking step
(`continue-on-error: true`) — a genuine upstream outage should turn this red
and *visible*, not silently pass, but it shouldn't block a deploy that the
fixture suite already proved correct.

**Total: 16/16 green** as of the last run (11 fixture/refusal + 5 live).

## Safety & limits

Full detail in [docs/what-this-must-never-do.md](docs/what-this-must-never-do.md)
and [docs/data-sources.md](docs/data-sources.md). In short:

- **Single-step routing only.** One question maps to a fixed set of tool
  calls; there is no multi-step planning or re-querying based on
  intermediate results.
- **Four tools, nothing else.** Carbon intensity, generation mix, system
  price, demand + nearest forecast. Anything else — gas, water, other
  countries' grids, REMIT outage detail, NIV/imbalance breakdown — is out of
  scope by construction, not by prompt instruction.
- **No causal root-cause for price moves.** This was the pack's flagship
  question originally ("why did system price spike at 17:30?") and it
  genuinely cannot be grounded from these four tools. It is now the
  deliberate refusal demo, not a hidden gap.
- **"Forecast" figures are frequently 2+ days out**, not "tonight" — see
  Decisions above. Always labelled with the real date.
- **No memory, no alerts, no charts.** Every question is answered fresh,
  independent of any other question in the session.

## Roadmap (explicitly deferred from Day 1)

- **Causal price-spike explanation (v0.2)**, naming its required tools:
  Elexon NIV/imbalance detail (settlement-level bid/offer acceptances) and
  the REMIT outage/availability feed, to actually ground "why did price
  spike at 17:30?" rather than refuse it.
- Multi-step agent plans (currently single-step routing only).
- Historical analysis and charts.
- Alerts / push notifications on threshold breaches.
- Session memory across questions.
- LLM-assisted routing as the primary path once the deterministic router has
  enough real-traffic evidence that an LLM layer would add net groundable
  coverage rather than just variance.

## Running locally

```bash
npm install
npm run dev      # http://localhost:3000
npm run eval      # fixture + refusal gate (network-free)
npm run eval:live # live API smoke tests
```

Copy `.env.example` to `.env.local` and set `GEMINI_API_KEY` to enable LLM
narration. Without a key, GridPilot runs entirely on the deterministic
fallback template — every figure still traces to a fetched value, just
without natural-language polish.

## License

MIT.
