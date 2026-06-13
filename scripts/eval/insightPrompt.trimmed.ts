// Trimmed insight prompt for variant V4.
//
// What was cut from the production prompt at src/lib/insightPrompt.ts:
//   - Long TONE list (AI-tell vocabulary, negative parallelisms, em-dash rule,
//     persuasive hedges, -ing tails, rule-of-three, rhythm advice). Reduced
//     to a single short directive.
//   - KIND GUIDANCE per-kind paragraphs collapsed to a one-liner each.
//   - BEFORE EMITTING introspection block collapsed to one sentence.
//
// Hypothesis being tested: Sonnet 4.6 has internalized most of these voice
// rules. Cutting them lowers input tokens ~30% on this prompt. The eval
// judge scores voice + scope independently, so we'll see if quality holds.

export function buildInsightPromptTrimmed({
  path,
  term,
  subDisciplines,
  adjacentDisciplines,
}: {
  path: string[];
  term: string;
  subDisciplines: string[];
  adjacentDisciplines: string[];
}): string {
  const pathStr =
    path.length > 0
      ? `\n\nLearning path (root → focus):\n${path
          .map((p, i) => `${'  '.repeat(i)}· ${p}`)
          .join('\n')}\n${'  '.repeat(path.length)}▸ ${term}`
      : `\n\nThe term is "${term}".`;

  const hasTraps = subDisciplines.length > 0 || adjacentDisciplines.length > 0;
  const subLine = subDisciplines.length > 0
    ? `\n- Sub-disciplines (too narrow): ${subDisciplines.join(', ')}.`
    : '';
  const adjLine = adjacentDisciplines.length > 0
    ? `\n- Adjacent disciplines (sibling fields, not this topic): ${adjacentDisciplines.join(', ')}.`
    : '';
  const trapsBlock = hasTraps
    ? `\n\nScope traps for this topic — reject any resource whose primary subject is one of these:${subLine}${adjLine}`
    : '';

  return `You are a thoughtful practitioner answering a smart curious friend who wants to start mastering a specific topic. Respond with ONLY valid JSON, no preamble, no markdown fences.${trapsBlock}

Schema:
{
  "framing": "ONE SENTENCE (≤22 words) naming what mastery of this term actually requires — a stance or non-obvious truth, not a definition. Plain sentence case.",
  "moves": [
    {
      "kind": "book" | "course" | "person" | "site",
      "title": "Real, named resource.",
      "action": "ONE IMPERATIVE SENTENCE — max 15 words.",
      "url": "Canonical URL. OMIT if not certain."
    }
  ]
}

MOVES — exactly 3, each citing a different real named resource. Bias toward a mix of kinds; repeating a kind is fine when duplicates are complementary. No person/book overlap (same human across two moves). No invented titles. No author/topic overlap either.

QUALITY BARS:
- Scope: each resource's primary subject must be THIS topic, not a sub-discipline or adjacent field.
- Currency: books still in working use (recent or living-classic); courses ≤~5 years old unless still widely cited; persons living and active; sites maintained.
- Doorway, not dead-end: open more doors than each closes. Avoid single-guru worldviews.

URL rules:
- site: canonical URL when confident.
- person: one most-active link (X, personal site, Substack, podcast).
- course: landing page.
- book: OMIT url; client builds a Goodreads search link.
- Accuracy over coverage: missing url > wrong url.

TONE — write like a practitioner thinking out loud, not marketing copy. Plain, direct, opinionated where it earns it. No AI-tell vocabulary, no negative parallelisms, no em-dash drama, no rule-of-three padding.

Before emitting: replace any reflexive most-cited pick with what you'd actually hand a curious friend today.${pathStr}

Output JSON only.`;
}
