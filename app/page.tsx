"use client";

import { useState } from "react";
import { AnswerCard } from "@/components/AnswerCard";
import { SUGGESTED_QUESTIONS } from "@/lib/suggestedQuestions";
import type { AskResponse } from "@/app/api/ask/route";

export default function Home() {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<AskResponse | null>(null);
  const [askedQuestion, setAskedQuestion] = useState("");

  async function ask(q: string) {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setAskedQuestion(trimmed);
    setResponse(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed }),
      });
      const data: AskResponse = await res.json();
      setResponse(data);
    } catch {
      setResponse({ status: "error", question: trimmed, message: "Network error reaching GridPilot's API." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-10 sm:py-16 bg-slate-50">
      <div className="w-full max-w-2xl space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">GridPilot</h1>
          <p className="text-sm text-slate-500">
            Grounded answers about the GB electricity grid, drawn live from public data. It refuses what it can&apos;t ground.
          </p>
        </header>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about GB carbon intensity, generation mix, system price or demand..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-slate-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Asking…" : "Ask"}
          </button>
        </form>

        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((sq) => (
            <button
              key={sq.question}
              onClick={() => {
                setQuestion(sq.question);
                ask(sq.question);
              }}
              disabled={loading}
              title={sq.note}
              className="text-xs rounded-full border border-slate-300 bg-white px-3 py-1.5 text-slate-600 hover:border-slate-400 disabled:opacity-50"
            >
              {sq.question}
            </button>
          ))}
        </div>

        {askedQuestion && (
          <div className="text-sm text-slate-400">
            Q: <span className="text-slate-600">{askedQuestion}</span>
          </div>
        )}

        {loading && <div className="text-sm text-slate-400">Fetching live grid data…</div>}

        {response && <AnswerCard response={response} />}

        <footer className="text-xs text-slate-400 text-center pt-6 border-t border-slate-200">
          Educational information from public GB grid data; not trading, investment or operational advice.
          <br />
          v0.1 — built in a day, evals green, roadmap open.
        </footer>
      </div>
    </main>
  );
}
