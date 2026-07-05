import { buildGuardFromDisplays } from "../validator";
import { withFallback } from "../validator/figure-guard/index.js";
import { generateNarrationDraft } from "./gemini";
import { buildFallbackNarration } from "./fallbackTemplate";
import { ToolResult } from "../tools";

export interface NarrationResult {
  text: string;
  source: "llm" | "fallback";
  attempts: number;
  violations?: { token: string; index: number }[];
}

export async function narrate(question: string, toolResults: ToolResult<unknown>[]): Promise<NarrationResult> {
  const displays = toolResults.map((r) => r.display);
  const guard = buildGuardFromDisplays(displays);
  const sourceNames = Array.from(new Set(toolResults.map((r) => r.source.name)));

  const generateFn = () => generateNarrationDraft({ question, displays, sourceNames });
  const fallbackFn = () => buildFallbackNarration(toolResults);

  const result = await withFallback(generateFn, fallbackFn, guard, { retries: 1 });
  return result as NarrationResult;
}
