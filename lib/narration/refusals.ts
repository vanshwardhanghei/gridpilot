export const CAPABILITY_SUMMARY =
  "I can answer questions grounded in four live GB electricity datasets: " +
  "current carbon intensity, the current generation mix by fuel, the most recently " +
  "published system (balancing) price, and current demand alongside the nearest " +
  "published demand and margin forecasts.";

export type RefusalReason = "out-of-scope" | "ungroundable-causal" | "unclear" | "prompt-injection";

export function refusalMessage(reason: RefusalReason, detail?: string): string {
  switch (reason) {
    case "prompt-injection":
      return (
        "I won't follow instructions embedded inside a question — I only answer from the four " +
        `grid datasets below, regardless of what the question asks me to ignore. ${CAPABILITY_SUMMARY}`
      );
    case "ungroundable-causal":
      return (
        `I can't ground a causal explanation for that with today's tools. ${detail ?? ""} ` +
        "That would need imbalance/NIV detail and outage data (REMIT), which are on the roadmap but not fetched yet. " +
        `${CAPABILITY_SUMMARY}`
      );
    case "out-of-scope":
      return (
        `That's outside what GridPilot is grounded to answer. ${detail ?? ""} ` +
        "GridPilot gives educational information from public GB electricity data; it is not trading, " +
        `investment or operational advice. ${CAPABILITY_SUMMARY}`
      );
    case "unclear":
    default:
      return `I'm not confident I can ground an answer to that from GridPilot's data. ${CAPABILITY_SUMMARY}`;
  }
}
