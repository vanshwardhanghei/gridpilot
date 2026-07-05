import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { installFixtureFetch, installStaleCarbonIntensityFetch } from "./mockFetch";
import { classifyQuestion } from "../lib/narration/router";
import { TOOL_REGISTRY, ToolResult } from "../lib/tools";
import { buildGuardFromDisplays } from "../lib/validator";
import { buildFallbackNarration } from "../lib/narration/fallbackTemplate";

// 6 grounding cases against fixed, recorded fixtures (no live network): assert
// correct tool selection, every narrative figure passes the guard, and a
// source line is present. Narration uses the deterministic fallback template
// directly (no GEMINI_API_KEY in the eval environment) so these cases are
// fully reproducible — see docs/data-sources.md and README "Evals".

async function runTools(toolNames: (keyof typeof TOOL_REGISTRY)[]): Promise<ToolResult<unknown>[]> {
  const results: ToolResult<unknown>[] = [];
  for (const name of toolNames) {
    results.push((await TOOL_REGISTRY[name].run()) as ToolResult<unknown>);
  }
  return results;
}

beforeEach(() => {
  installFixtureFetch();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("grounding: fixture-backed cases", () => {
  it("1. carbon intensity question selects currentCarbonIntensity and grounds every figure", async () => {
    const decision = classifyQuestion("What is the carbon intensity right now?");
    expect(decision.kind).toBe("answer");
    if (decision.kind !== "answer") return;
    expect(decision.tools).toContain("currentCarbonIntensity");

    const results = await runTools(decision.tools);
    const guard = buildGuardFromDisplays(results.map((r) => r.display));
    const narrative = buildFallbackNarration(results);

    expect(guard.validate(narrative).ok).toBe(true);
    expect(results[0].source.url).toBeTruthy();
    expect(results[0].dataTimestamp).toBeTruthy();
  });

  it("2. 'what's generating GB's power' selects generationMix and grounds every figure", async () => {
    const decision = classifyQuestion("What's generating GB's power right now?");
    expect(decision.kind).toBe("answer");
    if (decision.kind !== "answer") return;
    expect(decision.tools).toContain("generationMix");

    const results = await runTools(decision.tools);
    const guard = buildGuardFromDisplays(results.map((r) => r.display));
    const narrative = buildFallbackNarration(results);

    expect(guard.validate(narrative).ok).toBe(true);
    expect(results.every((r) => r.source.name && r.source.url)).toBe(true);
  });

  it("3. system price question selects systemPrices and grounds every figure", async () => {
    const decision = classifyQuestion("What's the current system price?");
    expect(decision.kind).toBe("answer");
    if (decision.kind !== "answer") return;
    expect(decision.tools).toEqual(["systemPrices"]);

    const results = await runTools(decision.tools);
    const guard = buildGuardFromDisplays(results.map((r) => r.display));
    const narrative = buildFallbackNarration(results);

    expect(guard.validate(narrative).ok).toBe(true);
    expect((results[0].data as { settlementPeriod: number }).settlementPeriod).toBe(24);
  });

  it("4. demand/forecast question selects demandAndForecast and grounds every figure", async () => {
    const decision = classifyQuestion("How does current demand compare with the nearest published forecast?");
    expect(decision.kind).toBe("answer");
    if (decision.kind !== "answer") return;
    expect(decision.tools).toContain("demandAndForecast");

    const results = await runTools(decision.tools);
    const guard = buildGuardFromDisplays(results.map((r) => r.display));
    const narrative = buildFallbackNarration(results);

    expect(guard.validate(narrative).ok).toBe(true);
    // The nearest forecast date must be named explicitly, never mislabelled as "tonight".
    expect(Object.keys(results[0].display).some((k) => k.includes("forecast national demand for 2026-07-06"))).toBe(
      true
    );
  });

  it("5. 'why is carbon intensity low' selects BOTH carbon intensity and mix (causal-lite, grounded)", async () => {
    const decision = classifyQuestion("Why is carbon intensity low right now?");
    expect(decision.kind).toBe("answer");
    if (decision.kind !== "answer") return;
    expect(decision.tools).toEqual(expect.arrayContaining(["currentCarbonIntensity", "generationMix"]));

    const results = await runTools(decision.tools);
    const guard = buildGuardFromDisplays(results.map((r) => r.display));
    const narrative = buildFallbackNarration(results);

    expect(guard.validate(narrative).ok).toBe(true);
    // The causal-lite claim must be groundable in the actually-retrieved mix data.
    expect(narrative).toMatch(/wind share is 18\.1%|solar share is 34\.2%/);
  });

  it("6. stale carbon-intensity fixture is labelled stale, never silently presented as fresh", async () => {
    installStaleCarbonIntensityFetch();
    const result = (await TOOL_REGISTRY.currentCarbonIntensity.run()) as ToolResult<unknown>;
    expect(result.stale).toBe(true);
  });
});
