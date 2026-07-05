import { vi } from "vitest";
import carbonIntensity from "./fixtures/carbon-intensity.json";
import carbonIntensityStale from "./fixtures/carbon-intensity-stale.json";
import generationMix from "./fixtures/generation-mix.json";
import systemPrices from "./fixtures/system-prices.json";
import demandOutturn from "./fixtures/demand-outturn.json";
import demandForecastDaily from "./fixtures/demand-forecast-daily.json";
import marginForecastDaily from "./fixtures/margin-forecast-daily.json";

export type FixtureOverrides = {
  carbonIntensity?: unknown;
};

/**
 * Installs a fixture-backed global.fetch so tool code runs unmodified
 * against fixed, recorded response shapes rather than the live network.
 * Matches by URL substring, mirroring the real endpoints each tool calls.
 */
export function installFixtureFetch(overrides: FixtureOverrides = {}) {
  const fixtureFetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    let body: unknown;
    if (url.includes("/intensity")) body = overrides.carbonIntensity ?? carbonIntensity;
    else if (url.includes("/generation")) body = generationMix;
    else if (url.includes("/balancing/settlement/system-prices")) body = systemPrices;
    else if (url.includes("/demand/outturn")) body = demandOutturn;
    else if (url.includes("/forecast/demand/daily")) body = demandForecastDaily;
    else if (url.includes("/forecast/margin/daily")) body = marginForecastDaily;
    else throw new Error(`installFixtureFetch: no fixture registered for URL: ${url}`);

    return {
      ok: true,
      status: 200,
      json: async () => body,
    } as Response;
  });

  vi.stubGlobal("fetch", fixtureFetch);
  return fixtureFetch;
}

export function installStaleCarbonIntensityFetch() {
  return installFixtureFetch({ carbonIntensity: carbonIntensityStale });
}
