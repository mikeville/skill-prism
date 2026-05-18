// Builds the "now what?" insight prompt sent to Claude.
//
// Resources-led hybrid: one orienting framing line, 3–5 named resources, 2–3
// concrete first actions. No URLs (avoids fake-link risk; users can search the
// named title). Tone matches the rest of the app — terse, uppercase-friendly.

export function buildInsightPrompt({ path, term }: { path: string[]; term: string }): string {
  const pathStr =
    path.length > 0
      ? `\n\nThe user reached this term by drilling through this learning path (root → focus):\n${path
          .map((p, i) => `${'  '.repeat(i)}${'·'} ${p}`)
          .join('\n')}\n  ${'  '.repeat(path.length)}▸ ${term}`
      : `\n\nThe term is "${term}".`;

  return `You are helping someone who has been exploring a fractal topic-decomposition app. They have just asked for concrete next steps on a specific term. Respond with ONLY valid JSON, no preamble, no markdown fences.

Schema:
{
  "framing": "ONE SENTENCE that orients the reader to what this term really is in practice. Must add something the sibling sub-topics (which the user can already see) do not. Frame as a stance, distinction, or non-obvious truth — not a definition.",
  "resources": [
    { "title": "...", "kind": "book" | "course" | "person" | "community" | "site", "note": "ONE LINE on why this matters for the term." }
  ],
  "actions": [
    "ONE CONCRETE first move tied to one of the resources above. Imperative voice."
  ]
}

CONSTRAINTS:
- "resources": 3–5 items. Name ONLY well-known, canonical, real resources you are confident exist. Prefer iconic books, established courses, recognized practitioners, and major communities. If you are unsure, leave the resource out — DO NOT invent titles or attribute books to authors who did not write them.
- No URLs anywhere. No publication years. Names only.
- "kind": pick the most accurate single tag. "site" only for canonical reference sites (e.g. MDN, Wikipedia categories).
- "actions": 2–3 items. Each must be concrete and doable today. Tie at least one to a named resource (e.g. "READ X" / "WATCH Y'S TALK ON Z").
- "framing": one sentence, MAX ~22 words. Do not summarize what the term is. Offer orientation — a stance, a tension, a "this is actually X not Y" frame. Tone is plain, lowercased prose (the app uppercases display text in CSS).
- No marketing voice. No "leverage", "unlock", "journey", "dive in". No emoji.
${pathStr}

Output JSON only.`;
}
