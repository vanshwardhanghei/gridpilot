import { AskResponse } from "@/app/api/ask/route";

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function AnswerCard({ response }: { response: AskResponse }) {
  if (response.status === "refuse") {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-5 text-amber-900">
        <p className="font-medium mb-1">GridPilot can&apos;t ground that one</p>
        <p className="text-sm leading-relaxed">{response.message}</p>
      </div>
    );
  }

  if (response.status === "error") {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-5 text-red-900">
        <p className="font-medium mb-1">Data fetch failed</p>
        <p className="text-sm leading-relaxed">{response.message}</p>
        {response.failedTools && response.failedTools.length > 0 && (
          <ul className="mt-2 text-xs text-red-800 list-disc list-inside">
            {response.failedTools.map((f, i) => (
              <li key={i}>
                {f.tool}: {f.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <p className="text-slate-900 leading-relaxed">{response.narrative}</p>

      {response.table && response.table.length > 0 && (
        <div className="space-y-3">
          {response.table.map((row, i) => (
            <div key={i} className="border border-slate-100 rounded-md overflow-hidden">
              <div className="bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 flex items-center justify-between">
                <span>{row.tool}</span>
                {row.stale && (
                  <span className="text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide">
                    stale
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(row.display).map(([k, v]) => (
                    <tr key={k} className="border-t border-slate-100">
                      <td className="px-3 py-1 text-slate-500">{k}</td>
                      <td className="px-3 py-1 text-slate-900 font-mono text-right">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {response.failedTools && response.failedTools.length > 0 && (
        <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2">
          Some data couldn&apos;t be fetched and was left out rather than guessed:{" "}
          {response.failedTools.map((f) => f.tool).join(", ")}.
        </div>
      )}

      {response.table && response.table.length > 0 && (
        <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 space-y-1">
          <p className="font-medium text-slate-600">Sources &amp; freshness</p>
          {response.table.map((row, i) => (
            <p key={i}>
              <a href={row.source.url} target="_blank" rel="noreferrer" className="underline hover:text-slate-700">
                {row.source.name}
              </a>{" "}
              — data as of {formatTimestamp(row.dataTimestamp)}, fetched {formatTimestamp(row.fetchedAt)}
            </p>
          ))}
          <p className="pt-1 text-slate-400">
            Narration: {response.narrationSource === "llm" ? "LLM (validated against fetched figures)" : "deterministic template (no LLM configured or LLM draft failed validation)"}
          </p>
        </div>
      )}
    </div>
  );
}
