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

  return `You are an EDITOR auditing 3 recommended resources for someone learning a specific topic. Your only job: catch and fix ONE failure mode — a recommendation whose primary subject is actually a sub-discipline of the topic, or an adjacent/related field, NOT the topic itself.

The author may rationalize a wrong-scope pick as "foundational" or "principles transfer." Reject those rationalizations.

Topic: "${term}".${trapsBlock}

Recommendations to audit:
${candidateBlock}

For each recommendation, three quick checks: (a) Would a practitioner of any scope-trap area use this as their primary reference? If yes, FAIL. (b) Does the title contain a trap-area word or near-synonym? If yes, FAIL. (c) Can you name what aspect of THIS topic the resource covers, not a trap area? If not, FAIL.

For each FAIL, replace with a real, named, scope-matched alternative. Match the kind when possible. Do not invent titles.

Respond with ONLY valid JSON, no preamble, no markdown fences:
{
  "framing": "${candidate.framing.replace(/"/g, '\\"')}",
  "moves": [
    { "kind": "book" | "course" | "person" | "site", "title": "...", "action": "ONE TERSE SENTENCE — max 15 words — imperative voice, sentence case.", "url": "OPTIONAL — see url rules below" },
    { "kind": "book" | "course" | "person" | "site", "title": "...", "action": "...", "url": "..." },
    { "kind": "book" | "course" | "person" | "site", "title": "...", "action": "...", "url": "..." }
  ]
}

URL field rules (apply to passing AND replacement moves):
- "site": canonical URL of the site. Include when confident.
- "person": link to wherever the person is most active (X, personal site, Substack, podcast, studio bio). Pick ONE.
- "course": URL of course landing page.
- "book": OMIT url. Client constructs a Goodreads search link from title.
- ACCURACY OVER COVERAGE: if you're guessing at a URL, OMIT the field. A missing url is fine; a wrong url is a broken link.

Keep framing exactly as given. Keep passing moves unchanged (preserve their url if present, omit if not). Replace failures with scope-matched alternatives and supply url per the rules above. Exactly 3 moves. Actions: 15 words MAX.

Output JSON only.`;
}
