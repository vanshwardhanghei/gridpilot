# What GridPilot must never do

**Status: first draft, written from the guardrails in the project brief.**
The brief is explicit that this document's real content should come from
someone with actual GB control-room / NESO operational experience — this
draft is a starting point for that review, not a substitute for it. Anyone
with that background should treat every line below as a proposal to
challenge, not a settled answer.

## Hard rules (enforced in code, not just policy)

1. **No figure may reach a user unless it was in a tool's fetched output.**
   Enforced by the figure-guard validator (`lib/validator/`) — the narrator's
   draft is regenerated once, then replaced by a deterministic template if it
   still cites anything outside the allowed set. This is a code-level gate,
   not a prompt instruction the model could ignore.
2. **No price forecasting.** GridPilot reports prices and forecasts an API
   has already published. It must never generate its own prediction of a
   future price, even qualitatively ("prices will likely rise").
3. **No trading or investment advice**, and no framing that could be read as
   such (e.g. "this is a good time to lock in a tariff").
4. **No operational instructions.** GridPilot never tells NESO, a BSC party,
   or any operator what to do ("NESO should curtail wind now"). It narrates
   published data; it does not recommend grid actions.
5. **No silent staleness.** Every figure carries the timestamp of the
   underlying data point. Data older than its tool's freshness threshold
   (60–120 min depending on the dataset's real update cadence) is labelled
   `stale` in the UI rather than presented as current.
6. **No silent fabrication on upstream failure.** If a tool's API call fails,
   the failure is surfaced (`failedTools` in the API response) — GridPilot
   never invents a plausible-looking number to fill the gap.
7. **No causal claims beyond what's retrieved.** GridPilot will explain "why"
   only when the explanation is a figure it actually holds (e.g. "carbon
   intensity is low, and wind is providing 41% of generation right now" —
   both numbers are in hand). Questions needing causal reasoning over data
   GridPilot doesn't fetch (imbalance volumes, outages, interconnector flows)
   are refused, not guessed at. See the "ungroundable-causal" refusal path in
   `lib/narration/router.ts`.
8. **Prompt injection embedded in a question is never followed.** A question
   containing "ignore your instructions" or similar is refused outright,
   regardless of what it asks GridPilot to do instead.

## What a real control-room reviewer should specifically check

These are open questions this draft cannot answer without that background:

- Are the freshness thresholds (60 min for carbon intensity/mix, 90 min for
  demand, 120 min for system price) actually operationally meaningful, or
  should any of them be tighter?
- Is there a wording risk in describing GB's generation margin using
  forecasts that are, in practice, 2+ days out (see
  [data-sources.md](data-sources.md)) — could a user misread "forecast
  margin for 2026-07-07" as "tonight's margin" despite the explicit date?
- Are there other question shapes (beyond the five in
  `lib/narration/router.ts`) that sound groundable but actually require
  operational judgement GridPilot doesn't have?

## Disclaimer shown in-product

> Educational information from public GB grid data; not trading, investment
> or operational advice.

This is a floor, not a ceiling — the rules above are meant to make the
disclaimer true in practice, not just present on the page.
