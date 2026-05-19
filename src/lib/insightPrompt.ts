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

  return `You are helping someone working toward mastery of a specific topic. They're exploring it in a fractal topic-decomposition app and have asked for a concrete path forward. Answer the way a thoughtful practitioner would if a curious smart friend asked them where to start with this topic — not the most-cited resources from a textbook, but the ones the practitioner would genuinely recommend after thinking about it. Respond with ONLY valid JSON, no preamble, no markdown fences.

Schema:
{
  "framing": "ONE SENTENCE naming what mastery of this term actually requires you to grasp — a stance, distinction, or non-obvious truth that frames the WHY behind the moves that follow. Plain lowercased prose. Not a definition.",
  "moves": [
    {
      "kind": "book" | "course" | "person" | "site",
      "title": "Name of the resource the move pivots around.",
      "action": "ONE SENTENCE, imperative voice (read / watch / follow / build / join / practice), describing what to do with this resource and the payoff. Plain lowercased prose."
    }
  ]
}

MOVES:
- EXACTLY 3 items. Each cites one real, named resource. Do not invent titles or misattribute authorship. Do not repeat a resource across moves.
- Pick the 3 resources that would genuinely serve a curious smart friend starting on this topic, drawn from the four available kinds (book, course, person, site). No kind is privileged — pick the strongest real answers for THIS topic, regardless of type.
- BIAS toward a mix of kinds when the field offers strong real answers across multiple kinds. A book + course + person is often a strong shape — but only when each is genuinely the right answer here. Do not force a third kind in just to satisfy diversity.
- Repeating a kind is acceptable when the duplicates are genuinely complementary — e.g. two living practitioners whose work represents different, complementary perspectives on this topic. Avoid duplication that's just two takes on the same lane.
- Never include a weak resource just to hit 3 moves across 3 different kinds — drop the weak slot for a stronger one of a kind you've already used.

QUALITY BARS (each move must clear all of these):

1. SCOPE MATCH (apply as an explicit test, not just a guideline). For each candidate resource, ask: "What is this resource's primary subject?" If that primary subject is a NAMED SUB-DISCIPLINE of the topic — not the topic itself — reject the candidate and pick something broader. Worked examples of sub-discipline relationships to watch for: typography is a sub-discipline of graphic design; traditional/hand-drawn animation is a sub-discipline of motion design; character design is a sub-discipline of illustration; logo design is a sub-discipline of brand identity; React is a sub-discipline of frontend engineering. Be especially strict when the topic is itself a broad meta-discipline (graphic design, motion design, illustration, web design, frontend engineering) — the most-famous resource is often scoped to one sub-discipline, and that is exactly the failure to avoid.

2. FIELD PRIMACY, NOT DISCOURSE PRIMACY. The work or person must be primarily of THIS discipline, not adjacent to it. Avoid people who get cited inside this topic's discourse mainly because their adjacent field shares venues with it. Example to avoid: recommending a primarily-type-designer for the topic "graphic design" — type design and graphic design share venues, but the person's primary practice is type, not graphic design. Apply the same test across fields (e.g., do not recommend a primarily-UX-researcher for "product design").

3. CURRENCY (criteria DIFFER by kind — apply the right test for each):
   - "book": still in working practice today. This can be a recent book OR a longstanding classic that remains in genuine use (e.g., a textbook in its 20th edition, a foundational work current practice still builds on). The test is "would a working practitioner still reach for this today?" — not "was it published recently?" Reject a classic only when it has been superseded in working practice.
   - "course": lean toward recent or actively maintained. Courses go stale faster than books — tools change, examples date, embedded references break. Avoid courses more than ~5 years old unless they remain widely cited as still excellent.
   - "person": LIVING and actively publishing thought leadership.
   - "site": currently maintained, working links, not abandoned.

4. DOORWAY, NOT DEAD-END. Each move should open more doors than it closes. Avoid resources that lock the learner into a single school of thought, sub-discipline, or guru's worldview. The field has more than one valid path through it.

KIND GUIDANCE:
- "book": the book that gives someone a foundational, scope-matched grasp of THIS topic, that current practitioners still reach for. If the most-famous book in this area fails any quality bar, pick a different one.
- "course": HIGH-VALUE BUT OPTIONAL. A truly great course is one of the most powerful resources you can recommend — but quality courses are rare for most topics. ONLY include a course when you can confidently name a real one that's genuinely strong for THIS topic. The course must verifiably exist — do not invent course names. Strong preference for recent, free, and video-based (YouTube series, free MOOCs, free university lectures), though those are preferences, not hard requirements; paid courses (Domestika, School of Motion, Coursera specializations, etc.) are fine when meaningfully better. If no great course exists for this topic, omit the kind and pick a stronger move of a different kind instead.
- "person": a LIVING person actively publishing thought leadership (talks, books, newsletters, podcasts, social posts) whose primary practice is THIS topic — not an adjacent field. Pick the person you'd actually tell a curious learner to follow today, not the most-cited authority. If two living practitioners with COMPLEMENTARY perspectives both genuinely belong, picking both is acceptable.
- "site": EQUAL FIRST-CLASS OPTION (not a fallback). Canonical evergreen sites, blogs, newsletters, or podcasts that a working practitioner of THIS topic genuinely uses. Not landing pages, not generic homepages. When a great site exists for this topic, include it on its merits — no preference for book/course/person over site.

FRAMING:
- MAX ~22 words. Plain lowercased prose. Not a summary of what the term is. Tell the reader what mastery of this topic asks them to see, accept, or hold in tension.

TONE:
- Direct and unfussy. No marketing voice. No "leverage", "unlock", "journey", "dive in". No emoji. No URLs anywhere. No publication years.

BEFORE EMITTING: for each move, silently ask "would a thoughtful practitioner actually hand this to a smart curious friend asking where to start with this topic, or is this the most-cited reflexive answer?" If the latter, replace it.
${pathStr}

Output JSON only.`;
}
