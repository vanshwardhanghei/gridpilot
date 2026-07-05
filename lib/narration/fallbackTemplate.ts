import { ToolResult } from "../tools";

const TOOL_LABELS: Record<string, string> = {
  currentCarbonIntensity: "Carbon intensity",
  generationMix: "Generation mix",
  systemPrices: "System price",
  demandAndForecast: "Demand and forecast",
};

/**
 * Template narration built directly from tool display values, with no LLM
 * involved — every word traces to a fetched figure, so this always passes
 * the guard. Used when no Gemini key is configured, or when the LLM draft
 * fails validation after retry.
 */
export function buildFallbackNarration(toolResults: ToolResult<unknown>[]): string {
  const sentences = toolResults.map((r) => {
    const label = TOOL_LABELS[r.tool] ?? r.tool;
    const parts = Object.entries(r.display).map(([k, v]) => `${k} is ${v}`);
    return `${label}: ${parts.join("; ")}.`;
  });
  return sentences.join(" ");
}
