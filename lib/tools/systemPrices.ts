import { buildResult, fetchJson, ToolFetchError, ToolResult } from "./shared";

export interface SystemPriceData {
  settlementDate: string;
  settlementPeriod: number;
  startTime: string;
  systemSellPrice: number;
  systemBuyPrice: number;
  netImbalanceVolume: number;
}

const SOURCE = {
  name: "Elexon Insights — balancing settlement system prices",
  url: "https://data.elexon.co.uk/bmrs/api/v1/balancing/settlement/system-prices",
};

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface RawSystemPriceRow {
  settlementDate: string;
  settlementPeriod: number;
  startTime: string;
  systemSellPrice: number;
  systemBuyPrice: number;
  netImbalanceVolume: number;
}

interface RawSystemPricesResponse {
  data?: RawSystemPriceRow[];
}

async function fetchDay(dateStr: string): Promise<RawSystemPriceRow[]> {
  const url = `${SOURCE.url}/${dateStr}?format=json`;
  const json = await fetchJson<RawSystemPricesResponse>(url);
  return Array.isArray(json?.data) ? json.data : [];
}

/**
 * Returns the most recently published system price. Settlement prices lag
 * real time by roughly one settlement period (~30-60 min) while BSC
 * reconciliation catches up, so "current" here means "most recent published",
 * not necessarily the period GB is in right now — that gap is surfaced via
 * dataTimestamp/stale rather than hidden.
 */
export async function systemPrices(period?: number): Promise<ToolResult<SystemPriceData>> {
  const now = new Date();
  const todayStr = toDateStr(now);

  let rows: RawSystemPriceRow[];
  try {
    rows = await fetchDay(todayStr);
  } catch (err) {
    throw new ToolFetchError("systemPrices", SOURCE, `Could not reach Elexon system prices: ${(err as Error).message}`);
  }

  if (rows.length === 0) {
    // Early in the day, today's settlement periods may not have published yet.
    const yesterdayStr = toDateStr(new Date(now.getTime() - 86400000));
    try {
      rows = await fetchDay(yesterdayStr);
    } catch (err) {
      throw new ToolFetchError("systemPrices", SOURCE, `Could not reach Elexon system prices: ${(err as Error).message}`);
    }
  }

  if (rows.length === 0) {
    throw new ToolFetchError("systemPrices", SOURCE, "No system price data published for today or yesterday");
  }

  let row;
  if (period) {
    row = rows.find((r) => r.settlementPeriod === period);
    if (!row) {
      throw new ToolFetchError(
        "systemPrices",
        SOURCE,
        `No system price published yet for settlement period ${period}`
      );
    }
  } else {
    row = rows.reduce((a, b) => (b.settlementPeriod > a.settlementPeriod ? b : a));
  }

  const data: SystemPriceData = {
    settlementDate: row.settlementDate,
    settlementPeriod: row.settlementPeriod,
    startTime: row.startTime,
    systemSellPrice: Number(row.systemSellPrice),
    systemBuyPrice: Number(row.systemBuyPrice),
    netImbalanceVolume: Number(row.netImbalanceVolume),
  };

  const periodLabel = `SP${data.settlementPeriod} on ${data.settlementDate} (starts ${data.startTime})`;

  return buildResult({
    tool: "systemPrices",
    data,
    display: {
      "system price": `£${data.systemSellPrice.toFixed(2)}/MWh`,
      "settlement period": periodLabel,
      "net imbalance volume": `${Math.round(data.netImbalanceVolume)} MWh`,
    },
    source: SOURCE,
    dataTimestamp: data.startTime,
    staleAfterMinutes: 120,
  });
}
