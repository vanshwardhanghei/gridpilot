/**
 * The fallback contract: try `generateFn` up to `retries + 1` times, keeping
 * only a result that passes `guard`; if none does (or every attempt throws),
 * fall back to `fallbackFn`.
 *
 * `fallbackFn` is trusted, not re-validated at runtime — the contract is
 * that you have already proven offline (in your own test suite, the way
 * Threshold proves it against its golden cases) that your fallback always
 * passes its own guard. Re-validating it here would just mean the product
 * has no safe text left to show if that assumption is ever wrong; the
 * intent of the pattern is that the product never blocks on the LLM.
 *
 * @param {() => (string | Promise<string>)} generateFn
 * @param {() => (string | Promise<string>)} fallbackFn
 * @param {{ validate(text: string): { ok: boolean, violations: {token:string,index:number}[] } }} guard
 * @param {{ retries?: number }} [options]
 * @returns {Promise<{ text: string, source: 'llm' | 'fallback', attempts: number, violations?: {token:string,index:number}[] }>}
 */
export async function withFallback(generateFn, fallbackFn, guard, { retries = 1 } = {}) {
  let lastViolations;
  const maxAttempts = retries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const draft = await generateFn();
      const text = String(draft);
      const result = guard.validate(text);
      if (result.ok) {
        return { text, source: "llm", attempts: attempt };
      }
      lastViolations = result.violations;
    } catch {
      // generation error — treated the same as a failed validation: retry, then fall back
    }
  }

  const text = String(await fallbackFn());
  return { text, source: "fallback", attempts: maxAttempts, violations: lastViolations };
}
