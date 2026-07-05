export { currentCarbonIntensity } from "./carbonIntensity";
export type { CarbonIntensityData } from "./carbonIntensity";
export { generationMix } from "./generationMix";
export type { GenerationMixData, FuelShare } from "./generationMix";
export { systemPrices } from "./systemPrices";
export type { SystemPriceData } from "./systemPrices";
export { demandAndForecast } from "./demandAndForecast";
export type { DemandAndForecastData } from "./demandAndForecast";
export { ToolFetchError } from "./shared";
export type { ToolResult, SourceInfo } from "./shared";

import { currentCarbonIntensity } from "./carbonIntensity";
import { generationMix } from "./generationMix";
import { systemPrices } from "./systemPrices";
import { demandAndForecast } from "./demandAndForecast";

export type ToolName = "currentCarbonIntensity" | "generationMix" | "systemPrices" | "demandAndForecast";

export const TOOL_REGISTRY: Record<ToolName, { description: string; run: (args?: Record<string, unknown>) => Promise<unknown> }> = {
  currentCarbonIntensity: {
    description: "Current GB carbon intensity (gCO2/kWh) and index (very low/low/moderate/high/very high).",
    run: () => currentCarbonIntensity(),
  },
  generationMix: {
    description: "Current GB electricity generation mix by fuel type (% share), including renewable share.",
    run: () => generationMix(),
  },
  systemPrices: {
    description: "Most recently published GB balancing system price (£/MWh) and net imbalance volume, for a settlement period.",
    run: (args) => systemPrices(args?.period as number | undefined),
  },
  demandAndForecast: {
    description:
      "Current GB electricity demand (MW), plus the nearest published national demand forecast and generation margin forecast (typically 2+ days ahead, not tonight).",
    run: () => demandAndForecast(),
  },
};
