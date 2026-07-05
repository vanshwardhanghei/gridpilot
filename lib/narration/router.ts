import { ToolName } from "../tools";
import { RefusalReason } from "./refusals";

export type RouteDecision =
  | { kind: "answer"; tools: ToolName[]; classifiedBy: "rules" | "llm" }
  | { kind: "refuse"; reason: RefusalReason; detail?: string; classifiedBy: "rules" | "llm" };

const PROMPT_INJECTION_RX =
  /\b(ignore|disregard|forget)\b[^.?!]{0,40}\b(previous|prior|above|your|all)\b[^.?!]{0,40}\b(instructions|rules|prompt|system)\b/i;

const TRADING_RX = /\b(buy|sell|invest(ing|ment)?|short|long|trade|trading|portfolio|stocks?|shares?)\b/i;

const FUTURE_PRICE_RX = /\b(will|going to|gonna)\b[^.?!]{0,40}\bprice/i;

const FORECAST_PRICE_RX = /\b(tomorrow|next week|next month|future)\b[^.?!]{0,40}\bprice/i;

const OTHER_DOMAIN_RX = /\b(gas network|gas grid|water (network|supply|grid)|(?<!national )grid in (france|germany|ireland|spain|us|usa)|french|german|irish|american grid)\b/i;

const CAUSAL_PRICE_SPIKE_RX = /\bwhy\b[^.?!]*\b(price|prices)\b[^.?!]*\b(spike|spiked|jump|jumped|surge|surged|drop|dropped|crash|crashed|fell|fall|rise|rose|change|changed|high|low)\b/i;
const CAUSAL_PRICE_SPIKE_RX2 = /\b(price|prices)\b[^.?!]*\bwhy\b/i;

const CARBON_RX = /\b(carbon|clean|green|greener|dirty|intensity|co2)\b/i;
const MIX_RX = /\b(generat(e|ing|ion)|mix|fuel|source|power come from|what.?s powering|running on)\b/i;
const PRICE_RX = /\b(system price|balancing price|imbalance price|settlement price|price per mwh|current price|£\/mwh)\b/i;
const DEMAND_RX = /\b(demand|margin|tight|tightness|headroom|forecast|capacity)\b/i;

export function classifyQuestion(question: string): RouteDecision {
  const q = question.trim();

  if (PROMPT_INJECTION_RX.test(q)) {
    return { kind: "refuse", reason: "prompt-injection", classifiedBy: "rules" };
  }

  if (TRADING_RX.test(q)) {
    return {
      kind: "refuse",
      reason: "out-of-scope",
      detail: "GridPilot doesn't give financial or trading advice.",
      classifiedBy: "rules",
    };
  }

  if ((FUTURE_PRICE_RX.test(q) || FORECAST_PRICE_RX.test(q)) && /price/i.test(q)) {
    return {
      kind: "refuse",
      reason: "out-of-scope",
      detail: "GridPilot only reports prices and forecasts an API has already published; it doesn't predict future prices.",
      classifiedBy: "rules",
    };
  }

  if (OTHER_DOMAIN_RX.test(q)) {
    return {
      kind: "refuse",
      reason: "out-of-scope",
      detail: "GridPilot only covers the Great Britain electricity system.",
      classifiedBy: "rules",
    };
  }

  if (CAUSAL_PRICE_SPIKE_RX.test(q) || CAUSAL_PRICE_SPIKE_RX2.test(q)) {
    return {
      kind: "refuse",
      reason: "ungroundable-causal",
      detail: "A specific price move needs causal reasoning over imbalance volumes, outages and interconnector flows.",
      classifiedBy: "rules",
    };
  }

  const tools = new Set<ToolName>();
  if (CARBON_RX.test(q)) {
    tools.add("currentCarbonIntensity");
    tools.add("generationMix");
  }
  if (MIX_RX.test(q)) {
    tools.add("generationMix");
  }
  if (PRICE_RX.test(q)) {
    tools.add("systemPrices");
  }
  if (DEMAND_RX.test(q)) {
    tools.add("demandAndForecast");
  }

  if (tools.size > 0) {
    return { kind: "answer", tools: Array.from(tools), classifiedBy: "rules" };
  }

  return { kind: "refuse", reason: "unclear", classifiedBy: "rules" };
}
