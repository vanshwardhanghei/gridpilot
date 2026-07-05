# Data sources

All four Day-1 tools are backed by **keyless, public** endpoints — no API key
registration was required, which meant the pack's "3-tool fallback if Elexon
key registration blocks" contingency did not trigger. Probed and recorded on
2026-07-05.

## 1. Carbon Intensity API (National Grid ESO)

Base: `https://api.carbonintensity.org.uk`

| Endpoint | Used by | Notes |
|---|---|---|
| `GET /intensity` | `currentCarbonIntensity()` | Returns current 30-min settlement period: `forecast`, `actual` (gCO2/kWh), `index` (very low…very high). Updates roughly every 30 min. |
| `GET /generation` | `generationMix()` | Current generation mix by fuel, as percentages. Same cadence as above. |

Both are fully open, no key, no rate-limit headers observed. Freshness
threshold set to 60 minutes (`staleAfterMinutes: 60`) — comfortably above the
observed ~30-minute update cadence.

## 2. Elexon Insights Solution (BMRS open data)

Base: `https://data.elexon.co.uk/bmrs/api/v1`

This is the modern, keyless successor to the legacy BMRS API the pack
flagged as possibly requiring registration. Every endpoint below returned
data with no authentication:

| Endpoint | Used by | Notes |
|---|---|---|
| `GET /balancing/settlement/system-prices/{date}` | `systemPrices()` | Settlement-period system sell/buy price and net imbalance volume. Lags real time by roughly one settlement period while BSC reconciliation completes; if today has no rows yet (early in the day) the tool falls back to yesterday's last period. |
| `GET /demand/outturn` | `demandAndForecast()` | Actual national demand (INDO) and transmission system demand (ITSDO) by settlement period. |
| `GET /forecast/demand/daily` | `demandAndForecast()` | **Gap found:** despite the name, this dataset (NDFD/TSDFD) is a 2-14-days-ahead indicative forecast — today's and tomorrow's dates are never present. We do not fabricate a "tonight" figure; the tool surfaces whichever forecast date is nearest and labels it with its real date. |
| `GET /forecast/margin/daily` | `demandAndForecast()` | **Same gap:** the margin forecast dataset (OCNMFD2) also starts at roughly D+2. Handled the same way — real date, always labelled. |

We also checked `/forecast/demand/day-ahead*` and `/forecast/margin/day-ahead`
and `/forecast/availability/daily` paths looking for a genuine "tonight"
figure; all returned 404. There does not appear to be a keyless day-ahead
margin endpoint on this API as of 2026-07-05.

**Consequence for product copy:** the suggested question "How tight is
tonight's margin?" from the original pack was rephrased to "How tight does
the margin look over the next couple of weeks?" — an honest description of
what the data actually supports, rather than a mislabelled "tonight" claim.
See README → Decisions.

## 3. NESO Data Portal (CKAN)

Base: `https://api.neso.energy/api/3/action`

Probed `package_list` — works keyless, confirms the same "2-14 days ahead"
demand/margin datasets exist here too (e.g.
`2-14-days-ahead-national-demand-forecast`). Not used for Day-1: Elexon
already surfaces an equivalent margin figure, so pulling the same shape of
data from a second source would add integration cost without adding
groundability. Kept as a documented alternative in case Elexon's endpoint
changes.

## Failure behaviour

Every tool (`lib/tools/*.ts`) throws a `ToolFetchError` (never returns
fabricated data) when:
- the HTTP request fails or times out (10s timeout via `AbortController`),
- the response is missing the expected fields.

The API route (`app/api/ask/route.ts`) catches these per-tool. If a question
needs multiple tools and only some fail, the answer proceeds with what
succeeded and lists the failure under `failedTools` rather than silently
dropping it. If every tool needed for a question fails, the route returns
`status: "error"` with an explicit message — never a guess.
