import { describe, it, expect } from "vitest";
import { currentCarbonIntensity } from "../lib/tools/carbonIntensity";
import { generationMix } from "../lib/tools/generationMix";
import { systemPrices } from "../lib/tools/systemPrices";
import { demandAndForecast } from "../lib/tools/demandAndForecast";
import { buildGuardFromDisplays } from "../lib/validator";
import { buildFallbackNarration } from "../lib/narration/fallbackTemplate";

// 5 live smoke cases: hit the real public APIs. These assert schema and
// freshness, and that two independent runs both produce guard-clean
// narration. Per the pack: these may soft-fail on a genuine upstream outage,
// but must fail LOUDLY (a clearly-labelled thrown/assertion error visible in
// CI), never silently. We do not swallow fetch errors here — an upstream
// outage should turn this suite red with an obvious cause, distinct from a
// logic regression in the fixture-backed grounding suite.

describe("live smoke: real GB grid APIs", () => {
  it("1. currentCarbonIntensity: schema + freshness < 2h", async () => {
    const result = await currentCarbonIntensity();
    expect(typeof result.data.actual).toBe("number");
    expect(["very low", "low", "moderate", "high", "very high"]).toContain(result.data.index);
    expect(result.stale).toBe(false);
  }, 15000);

  it("2. generationMix: schema + shares sum to ~100%", async () => {
    const result = await generationMix();
    const total = result.data.mix.reduce((sum, m) => sum + m.perc, 0);
    expect(total).toBeGreaterThan(95);
    expect(total).toBeLessThan(105);
    expect(result.stale).toBe(false);
  }, 15000);

  it("3. systemPrices: schema + plausible settlement period", async () => {
    const result = await systemPrices();
    expect(result.data.settlementPeriod).toBeGreaterThanOrEqual(1);
    expect(result.data.settlementPeriod).toBeLessThanOrEqual(50);
    expect(typeof result.data.systemSellPrice).toBe("number");
  }, 15000);

  it("4. demandAndForecast: schema + positive demand", async () => {
    const result = await demandAndForecast();
    expect(result.data.actual.nationalDemandMW).toBeGreaterThan(0);
  }, 15000);

  it("5. two independent runs both produce guard-clean narration (no validator violations)", async () => {
    for (let i = 0; i < 2; i++) {
      const result = await currentCarbonIntensity();
      const guard = buildGuardFromDisplays([result.display]);
      const narrative = buildFallbackNarration([result]);
      expect(guard.validate(narrative).ok).toBe(true);
    }
  }, 20000);
});
