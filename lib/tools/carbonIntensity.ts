import { buildResult, fetchJson, ToolFetchError, ToolResult } from "./shared";

export interface CarbonIntensityData {
  from: string;
  to: string;
  forecast: number;
  actual: number;
  index: string;
}

const SOURCE = {
  name: "Carbon Intensity API (National Grid ESO)",
  url: "https://api.carbonintensity.org.uk/intensity",
};

interface RawIntensityEntry {
  from: string;
  to: string;
  intensity: { forecast: number; actual: number; index: string };
}

interface RawCarbonIntensityResponse {
  data?: RawIntensityEntry[];
}

export async function currentCarbonIntensity(): Promise<ToolResult<CarbonIntensityData>> {
  let json: RawCarbonIntensityResponse;
  try {
    json = await fetchJson<RawCarbonIntensityResponse>(SOURCE.url);
  } catch (err) {
    throw new ToolFetchError(
      "currentCarbonIntensity",
      SOURCE,
      `Could not reach the Carbon Intensity API: ${(err as Error).message}`
    );
  }

  const entry = json?.data?.[0];
  if (!entry || typeof entry.intensity?.actual !== "number") {
    throw new ToolFetchError("currentCarbonIntensity", SOURCE, "Carbon Intensity API returned no usable data");
  }

  const data: CarbonIntensityData = {
    from: entry.from,
    to: entry.to,
    forecast: entry.intensity.forecast,
    actual: entry.intensity.actual,
    index: entry.intensity.index,
  };

  return buildResult({
    tool: "currentCarbonIntensity",
    data,
    display: {
      "carbon intensity (actual)": `${data.actual} gCO2/kWh`,
      "carbon intensity (forecast)": `${data.forecast} gCO2/kWh`,
      "carbon intensity index": data.index,
    },
    source: SOURCE,
    dataTimestamp: data.to,
    staleAfterMinutes: 60,
  });
}
