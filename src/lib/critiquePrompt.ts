// Builds the critique prompt for the second pass of the two-stage pipeline.
//
// The generation pass (insightPrompt) often rationalizes wrong-scope picks
// as "foundational" or "broader than its subject suggests" — especially on
// broad meta-disciplines where the model has a strong canonical-resource
// prior. The critique pass uses an ADVERSARIAL editor frame: it audits the
// generation's output specifically for scope-trap violations and replaces
// any that fail.
//
// Different framing → different prior. The critique focuses on ONE failure
// mode (scope mismatch), not on redoing the full quality bars.

import type { Insight } from './insightApi';

export function buildCritiquePrompt({
  term,
  subDisciplines,
  adjacentDisciplines,
  candidate,
}: {
  term: string;
  subDisciplines: string[];
  adjacentDisciplines: string[];
  candidate: Insight;
}): string {
  const subLine =
    subDisciplines.length > 0
      ? `\n- SUB-DISCIPLINES (resources scoped here belong to the sub-discipline, NOT the broader topic): ${subDisciplines.join(', ')}.`
      : '';
  const adjLine =
    adjacentDisciplines.length > 0
      ? `\n- ADJACENT DISCIPLINES (resources scoped here belong to a sibling field, NOT this topic): ${adjacentDisciplines.join(', ')}.`
      : '';
  const trapsBlock =
    subDisciplines.length > 0 || adjacentDisciplines.length > 0
      ? `\n\nScope traps for this topic:${subLine}${adjLine}`
      : '';

  const candidateBlock = candidate.moves
    .map(
      (m, i) =>
        `${i + 1}. [${m.kind}] ${m.title}\n   action: ${m.action}`,
    )
    .join('\n');

  return `You are an EDITOR auditing a set of 3 recommended resources for someone learning a specific topic. Your only job is to catch and fix ONE failure mode: a recommendation whose primary subject is actually a sub-discipline of the topic, or an adjacent/related field — NOT the topic itself.

The author who drafted these recommendations is reflexively reaching for famous canonical resources from the topic's discourse. They may rationalize a wrong-scope pick as "foundational" or "the principles transfer to this topic" or "practitioners of this topic use it." Reject those rationalizations — they are the exact failure mode you exist to catch.

The topic is "${term}".${trapsBlock}

The author's 3 recommendations:
${candidateBlock}

Apply this audit to EACH of the 3 recommendations:

(a) BIDIRECTIONAL TEST. For each scope-trap area above, ask: "Would a working practitioner of THAT area use this resource as their PRIMARY reference for day-to-day practice in that area?" If yes for any area, the resource is scoped to that area — NOT to the topic. FAIL.

(b) TITLE-SIGNAL TEST. Does the resource's title contain the name of a scope-trap area, or a clear near-synonym (e.g., "type" / "typographic" → typography; "logo" → logo design; "animation" / "animator" → traditional animation)? If yes, FAIL unless you have specific knowledge contradicting the title.

(c) POSITIVE FRAMING TEST. Can you articulate what aspect of THIS topic specifically — not a scope-trap area — the resource covers? If you can only describe it as "covers principles that apply to design generally" or similar, that is rationalization. FAIL.

For each FAIL, replace the recommendation with a real, named resource whose primary subject IS the topic itself. The replacement must:
- Be a verifiably real resource (book, course, person, or site) — do not invent
- Be scoped to the topic, not a scope-trap area
- Match the kind of the original when possible (replace a book with a book, a person with a person), unless no scope-matched candidate of that kind exists — in which case use the strongest scope-matched alternative of any kind

Respond with ONLY valid JSON, no preamble, no markdown fences:
{
  "framing": "${candidate.framing.replace(/"/g, '\\"')}",
  "moves": [
    { "kind": "book" | "course" | "person" | "site", "title": "...", "action": "..." },
    { "kind": "book" | "course" | "person" | "site", "title": "...", "action": "..." },
    { "kind": "book" | "course" | "person" | "site", "title": "...", "action": "..." }
  ]
}

Keep the framing exactly as given. Keep moves that pass all tests unchanged (same kind, title, and action). Replace moves that fail with corrected ones. The output must have exactly 3 moves.

Output JSON only.`;
}
