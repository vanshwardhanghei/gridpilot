export interface SuggestedQuestion {
  question: string;
  note: string;
}

// Six suggested questions: five groundable from the Day-1 tool set, and one
// deliberate demonstration of the refusal boundary (a causal question the
// tools genuinely cannot ground). See docs/what-this-must-never-do.md.
export const SUGGESTED_QUESTIONS: SuggestedQuestion[] = [
  { question: "What's generating GB's power right now?", note: "generation mix" },
  { question: "Why is carbon intensity low right now?", note: "carbon intensity + mix" },
  { question: "What's the current system price?", note: "system price" },
  { question: "How does current demand compare with the nearest published forecast?", note: "demand + forecast" },
  { question: "How tight does the margin look over the next couple of weeks?", note: "margin forecast" },
  { question: "Why did system price spike at 17:30?", note: "refusal demo — not groundable Day 1" },
];
