import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL = "gemini-1.5-flash";

/**
 * Raw LLM draft, unvalidated. Callers must run this through the figure guard
 * (see lib/validator) before showing it to a user — this function makes no
 * grounding guarantee on its own.
 */
export async function generateNarrationDraft(opts: {
  question: string;
  displays: Record<string, string>[];
  sourceNames: string[];
}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: MODEL });

  const figures = opts.displays.flatMap((d) => Object.entries(d).map(([k, v]) => `${k}: ${v}`)).join("\n");

  const prompt = [
    "You are GridPilot, narrating GB electricity grid data for a public web tool.",
    "Rules (must follow exactly):",
    "- Use UK English, a calm and factual tone, no exclamation marks.",
    "- You may ONLY cite figures that appear verbatim, digits and units included, in the FIGURES list below.",
    "- Do not invent, round differently, or restate a figure with a different unit or label than given.",
    "- Do not give trading, investment or operational advice.",
    "- Do not forecast beyond what the figures already state.",
    "- Keep it to 2-4 sentences.",
    "",
    `Question: ${opts.question}`,
    "",
    "FIGURES (the only numbers you may use, verbatim):",
    figures,
    "",
    `Sources: ${opts.sourceNames.join(", ")}`,
    "",
    "Write the narrative answer now.",
  ].join("\n");

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
