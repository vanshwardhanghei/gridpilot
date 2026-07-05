import { NextRequest, NextResponse } from "next/server";
import { classifyQuestion } from "@/lib/narration/router";
import { refusalMessage } from "@/lib/narration/refusals";
import { narrate } from "@/lib/narration/narrate";
import { TOOL_REGISTRY, ToolFetchError, ToolResult } from "@/lib/tools";

export interface AskTableRow {
  tool: string;
  source: { name: string; url: string };
  dataTimestamp: string;
  fetchedAt: string;
  stale: boolean;
  display: Record<string, string>;
}

export interface AskFailure {
  tool: string;
  source: { name: string; url: string };
  message: string;
}

export interface AskResponse {
  status: "answer" | "refuse" | "error";
  question: string;
  narrative?: string;
  narrationSource?: "llm" | "fallback";
  table?: AskTableRow[];
  failedTools?: AskFailure[];
  message?: string;
  classifiedBy?: "rules" | "llm";
}

export async function POST(req: NextRequest): Promise<NextResponse<AskResponse>> {
  let question: string;
  try {
    const body = await req.json();
    question = String(body?.question ?? "").trim();
  } catch {
    return NextResponse.json({ status: "error", question: "", message: "Invalid request body" }, { status: 400 });
  }

  if (!question) {
    return NextResponse.json({ status: "error", question: "", message: "Question is required" }, { status: 400 });
  }

  const decision = classifyQuestion(question);

  if (decision.kind === "refuse") {
    return NextResponse.json({
      status: "refuse",
      question,
      message: refusalMessage(decision.reason, decision.detail),
      classifiedBy: decision.classifiedBy,
    });
  }

  const results: ToolResult<unknown>[] = [];
  const failures: AskFailure[] = [];

  for (const toolName of decision.tools) {
    try {
      const result = (await TOOL_REGISTRY[toolName].run()) as ToolResult<unknown>;
      results.push(result);
    } catch (err) {
      if (err instanceof ToolFetchError) {
        failures.push({ tool: err.tool, source: err.source, message: err.message });
      } else {
        failures.push({ tool: toolName, source: { name: toolName, url: "" }, message: (err as Error).message });
      }
    }
  }

  if (results.length === 0) {
    // Every tool needed for this question failed — surface it loudly, never fabricate.
    return NextResponse.json({
      status: "error",
      question,
      message:
        "I couldn't fetch any of the live data needed to answer that just now. This is a genuine upstream failure, not a hidden guess — please try again shortly.",
      failedTools: failures,
      classifiedBy: decision.classifiedBy,
    });
  }

  const narration = await narrate(question, results);

  const table: AskTableRow[] = results.map((r) => ({
    tool: r.tool,
    source: r.source,
    dataTimestamp: r.dataTimestamp,
    fetchedAt: r.fetchedAt,
    stale: r.stale,
    display: r.display,
  }));

  return NextResponse.json({
    status: "answer",
    question,
    narrative: narration.text,
    narrationSource: narration.source,
    table,
    failedTools: failures.length > 0 ? failures : undefined,
    classifiedBy: decision.classifiedBy,
  });
}
