import { createGuard, normalise } from "./figure-guard/index.js";
import { withFallback } from "./figure-guard/index.js";

export { normalise, withFallback };

export interface GuardResult {
  ok: boolean;
  violations: { token: string; index: number }[];
}

export interface Guard {
  validate(text: string): GuardResult;
}

/**
 * Builds a guard whose allowed set is the union of every display map from the
 * tool results used to answer a question. A narration may only quote figures
 * that appear in this set — see docs/what-this-must-never-do.md.
 */
export function buildGuardFromDisplays(displays: Record<string, string>[]): Guard {
  const allowed: string[] = [];
  for (const display of displays) {
    allowed.push(...Object.values(display));
  }
  return createGuard({ allowed, locale: "en-GB" }) as Guard;
}
