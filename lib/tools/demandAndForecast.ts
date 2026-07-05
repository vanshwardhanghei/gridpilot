import { buildResult, fetchJson, ToolFetchError, ToolResult } from "./shared";

export interface DemandActual {
  settlementDate: string;
  settlementPeriod: number;
  startTime: string;
  nationalDemandMW: number;
  transmissionDemandMW: number;
}

export interface DemandForecastPoint {
  forecastDate: string;
  nationalDemandMW: number;
  transmissionDemandMW: number;
}

export interface MarginForecastPoint {
  forecastDate: string;
  marginMW: number;
}

export interface DemandAndForecastData {
  actual: DemandActual;
  nearestForecast: DemandForecastPoint | null;
  nearestMargin: MarginForecastPoint | null;
}

const SOURCES = {
  outturn: {
    name: "Elexon Insights — demand outturn (INDO/ITSDO)",
    url: "https://data.elexon.co.uk/bmrs/api/v1/demand/outturn",
  },
  forecast: {
    name: "Elexon Insights — national demand forecast (NDFD/TSDFD)",
    url: "https://data.elexon.co.uk/bmrs/api/v1/forecast/demand/daily",
  },
  margin: {
    name: "Elexon Insights — forecast margin (OCNMFD2)",
    url: "https://data.elexon.co.uk/bmrs/api/v1/forecast/margin/daily",
  },
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface RawOutturnRow {
  settlementDate: string;
  settlementPeriod: number;
  startTime: string;
  initialDemandOutturn: number;
  initialTransmissionSystemDemandOutturn: number;
}
interface RawOutturnResponse {
  data?: RawOutturnRow[];
}

interface RawForecastRow {
  forecastDate: string;
  nationalDemand: number;
  transmissionSystemDemand: number;
}
interface RawForecastResponse {
  data?: RawForecastRow[];
}

interface RawMarginRow {
  forecastDate: string;
  margin: number;
}
interface RawMarginResponse {
  data?: RawMarginRow[];
}

export async function demandAndForecast(): Promise<ToolResult<DemandAndForecastData>> {
  const now = new Date();
  const todayStr = toDateStr(now);

  let outturnJson: RawOutturnResponse;
  try {
    outturnJson = await fetchJson<RawOutturnResponse>(
      `${SOURCES.outturn.url}?settlementDateFrom=${todayStr}&settlementDateTo=${todayStr}&format=json`
    );
  } catch (err) {
    throw new ToolFetchError("demandAndForecast", SOURCES.outturn, `Could not reach Elexon demand outturn: ${(err as Error).message}`);
  }
  const outturnRows: RawOutturnRow[] = Array.isArray(outturnJson?.data) ? outturnJson.data : [];
  if (outturnRows.length === 0) {
    throw new ToolFetchError("demandAndForecast", SOURCES.outturn, "No demand outturn published yet for today");
  }
  const latestOutturn = outturnRows.reduce((a, b) => (b.settlementPeriod > a.settlementPeriod ? b : a));
  const actual: DemandActual = {
    settlementDate: latestOutturn.settlementDate,
    settlementPeriod: latestOutturn.settlementPeriod,
    startTime: latestOutturn.startTime,
    nationalDemandMW: Number(latestOutturn.initialDemandOutturn),
    transmissionDemandMW: Number(latestOutturn.initialTransmissionSystemDemandOutturn),
  };

  // Elexon's "daily" forecast/margin datasets are, in practice, 2-14-days-ahead
  // indicative forecasts — today and tomorrow are not published on this
  // keyless endpoint. Rather than mislabel the nearest row as "tonight", we
  // surface whichever forecastDate is actually nearest and name it explicitly.
  // See docs/data-sources.md.
  let nearestForecast: DemandForecastPoint | null = null;
  try {
    const forecastJson = await fetchJson<RawForecastResponse>(`${SOURCES.forecast.url}?format=json`);
    const rows: RawForecastRow[] = Array.isArray(forecastJson?.data) ? forecastJson.data : [];
    if (rows.length > 0) {
      const nearest = rows.reduce((a, b) => (b.forecastDate < a.forecastDate ? b : a));
      nearestForecast = {
        forecastDate: nearest.forecastDate,
        nationalDemandMW: Number(nearest.nationalDemand),
        transmissionDemandMW: Number(nearest.transmissionSystemDemand),
      };
    }
  } catch {
    nearestForecast = null;
  }

  let nearestMargin: MarginForecastPoint | null = null;
  try {
    const marginJson = await fetchJson<RawMarginResponse>(`${SOURCES.margin.url}?format=json`);
    const rows: RawMarginRow[] = Array.isArray(marginJson?.data) ? marginJson.data : [];
    if (rows.length > 0) {
      const nearest = rows.reduce((a, b) => (b.forecastDate < a.forecastDate ? b : a));
      nearestMargin = { forecastDate: nearest.forecastDate, marginMW: Number(nearest.margin) };
    }
  } catch {
    nearestMargin = null;
  }

  const display: Record<string, string> = {
    "current demand": `${actual.nationalDemandMW.toLocaleString("en-GB")} MW`,
    "current transmission system demand": `${actual.transmissionDemandMW.toLocaleString("en-GB")} MW`,
    "demand reading settlement period": `SP${actual.settlementPeriod} on ${actual.settlementDate}`,
  };
  if (nearestForecast) {
    display[`forecast national demand for ${nearestForecast.forecastDate}`] =
      `${nearestForecast.nationalDemandMW.toLocaleString("en-GB")} MW`;
  }
  if (nearestMargin) {
    display[`forecast margin for ${nearestMargin.forecastDate}`] = `${nearestMargin.marginMW.toLocaleString("en-GB")} MW`;
  }

  return buildResult({
    tool: "demandAndForecast",
    data: { actual, nearestForecast, nearestMargin },
    display,
    source: SOURCES.outturn,
    dataTimestamp: actual.startTime,
    staleAfterMinutes: 90,
  });
}
