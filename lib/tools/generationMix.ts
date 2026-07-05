import { buildResult, fetchJson, ToolFetchError, ToolResult } from "./shared";

export interface FuelShare {
  fuel: string;
  perc: number;
}

export interface GenerationMixData {
  from: string;
  to: string;
  mix: FuelShare[];
  topFuel: FuelShare;
  renewableShare: number;
}

const RENEWABLE_FUELS = new Set(["wind", "solar", "hydro", "biomass"]);

const SOURCE = {
  name: "Carbon Intensity API — generation mix (National Grid ESO)",
  url: "https://api.carbonintensity.org.uk/generation",
};

interface RawFuelShare {
  fuel: string;
  perc: number;
}

interface RawGenerationMixResponse {
  data?: {
    from: string;
    to: string;
    generationmix: RawFuelShare[];
  };
}

export async function generationMix(): Promise<ToolResult<GenerationMixData>> {
  let json: RawGenerationMixResponse;
  try {
    json = await fetchJson<RawGenerationMixResponse>(SOURCE.url);
  } catch (err) {
    throw new ToolFetchError(
      "generationMix",
      SOURCE,
      `Could not reach the Carbon Intensity generation-mix API: ${(err as Error).message}`
    );
  }

  const entry = json?.data;
  const rawMix = entry?.generationmix;
  if (!entry || !Array.isArray(rawMix) || rawMix.length === 0) {
    throw new ToolFetchError("generationMix", SOURCE, "Generation mix API returned no usable data");
  }

  const mix: FuelShare[] = rawMix.map((m) => ({ fuel: String(m.fuel), perc: Number(m.perc) }));
  const topFuel = mix.reduce((a, b) => (b.perc > a.perc ? b : a));
  const renewableShare = Math.round(
    mix.filter((m) => RENEWABLE_FUELS.has(m.fuel)).reduce((sum, m) => sum + m.perc, 0) * 10
  ) / 10;

  const display: Record<string, string> = {};
  for (const m of mix) {
    display[`${m.fuel} share`] = `${m.perc}%`;
  }
  display["largest source"] = `${topFuel.fuel} (${topFuel.perc}%)`;
  display["renewable share (wind+solar+hydro+biomass)"] = `${renewableShare}%`;

  return buildResult({
    tool: "generationMix",
    data: { from: entry.from, to: entry.to, mix, topFuel, renewableShare },
    display,
    source: SOURCE,
    dataTimestamp: entry.to,
    staleAfterMinutes: 60,
  });
}
