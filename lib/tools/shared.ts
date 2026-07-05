export interface SourceInfo {
  name: string;
  url: string;
}

export interface ToolResult<T> {
  tool: string;
  data: T;
  /** Formatted figures whitelist — the only strings the narrator is allowed to quote. */
  display: Record<string, string>;
  source: SourceInfo;
  /** ISO timestamp of the underlying data point (not the fetch time). */
  dataTimestamp: string;
  fetchedAt: string;
  staleAfterMinutes: number;
  stale: boolean;
}

export class ToolFetchError extends Error {
  tool: string;
  source: SourceInfo;
  constructor(tool: string, source: SourceInfo, message: string) {
    super(message);
    this.name = "ToolFetchError";
    this.tool = tool;
    this.source = source;
  }
}

export async function fetchJson<T = unknown>(url: string, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export function computeStale(dataTimestamp: string, staleAfterMinutes: number, now = new Date()): boolean {
  const dataTime = new Date(dataTimestamp).getTime();
  if (Number.isNaN(dataTime)) return true;
  const ageMinutes = (now.getTime() - dataTime) / 60000;
  return ageMinutes > staleAfterMinutes;
}

export function buildResult<T>(opts: {
  tool: string;
  data: T;
  display: Record<string, string>;
  source: SourceInfo;
  dataTimestamp: string;
  staleAfterMinutes?: number;
}): ToolResult<T> {
  const staleAfterMinutes = opts.staleAfterMinutes ?? 120;
  return {
    tool: opts.tool,
    data: opts.data,
    display: opts.display,
    source: opts.source,
    dataTimestamp: opts.dataTimestamp,
    fetchedAt: new Date().toISOString(),
    staleAfterMinutes,
    stale: computeStale(opts.dataTimestamp, staleAfterMinutes),
  };
}
