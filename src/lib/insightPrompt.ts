// Builds the "to master [term]" insight prompt sent to Claude.
//
// Single-section structure: a one-sentence framing line that names what
// mastery of this topic actually requires you to grasp, followed by exactly
// three "first moves" — each one citing one typed resource (book, course,
// person, community, or site) the move pivots around. No separate resource
// list, no redundancy.

export function buildInsightPrompt({ path, term }: { path: string[]; term: string }): string {
  const pathStr =
    path.length > 0
      ? `\n\nThe user reached this term by drilling through this learning path (root → focus):\n${path
          .map((p, i) => `${'  '.repeat(i)}${'·'} ${p}`)
          .join('\n')}\n${'  '.repeat(path.length)}▸ ${term}`
      : `\n\nThe term is "${term}".`;

  return `You are helping someone working toward mastery of a specific topic. They're exploring it in a fractal topic-decomposition app and have asked for a concrete path forward. Respond with ONLY valid JSON, no preamble, no markdown fences.

Schema:
{
  "framing": "ONE SENTENCE naming what mastery of this term actually requires you to grasp — a stance, distinction, or non-obvious truth that frames the WHY behind the moves that follow. Plain lowercased prose. Not a definition.",
  "moves": [
    {
      "kind": "book" | "course" | "person" | "community" | "site",
      "title": "Name of the resource the move pivots around.",
      "action": "ONE SENTENCE, imperative voice (read / watch / follow / build / join / practice), describing what to do with this resource and the payoff. Plain lowercased prose."
    }
  ]
}

CONSTRAINTS:
- "moves": EXACTLY 3 items. Each must cite exactly one named resource. Do not repeat a resource across moves.
- A move's resource must be REAL, well-known, and genuinely canonical for pursuing mastery of this topic. If you are not confident a resource exists, pick a different one. Do not invent titles or misattribute authorship.
- "kind": pick the most accurate single tag. Mix kinds where natural — do not force coverage across categories.
  - "person" REQUIRES the person to be alive AND actively publishing thought leadership (talks, books, newsletters, podcasts, social posts). Do not cite deceased authorities or people who have stopped publishing.
  - "site" is for canonical evergreen sites/blogs/newsletters/podcasts only — not landing pages or generic homepages.
- "framing": MAX ~22 words. Plain lowercased prose. Not a summary of what the term is. Tell the reader what mastery of this topic asks them to see, accept, or hold in tension.
- Tone is direct and unfussy. No marketing voice. No "leverage", "unlock", "journey", "dive in". No emoji. No URLs anywhere. No publication years.
${pathStr}

Output JSON only.`;
}
