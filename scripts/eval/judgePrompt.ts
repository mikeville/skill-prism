// Slimmed judge prompts. After the local-checks split, the LLM judge only
// answers the questions that require world knowledge or holistic judgment:
//   - scope match (would a typography resource pass for "graphic design"?)
//   - field primacy (is the recommended person actually a practitioner of THIS field?)
//   - currency (is this book/site/person still in working use?)
//   - coverage / specificity / doorway / diversity / overall (subjective rubrics)
//   - holistic voice read (regex-detectable AI tells are scored locally)
//
// Mechanical checks (JSON validity, label terseness %, structural counts,
// AI-tell vocabulary hits, em-dash in framing, etc.) are computed in
// localChecks.ts at no API cost.

export function buildBreakdownJudgePrompt({
  topic,
  breakdownJson,
}: {
  topic: string;
  breakdownJson: string;
}): string {
  return `You are evaluating a topic-decomposition output. The producer was asked to break down the topic "${topic}" into a 9×9 grid: 8 main sub-skills that cover the topic comprehensively, with 8 sub-sub-skills under each main.

Mechanical checks (label length, filler words, duplicates, fully-filled, JSON validity) are run separately — DO NOT score those. Focus only on the judgment items below.

OUTPUT TO EVALUATE:
\`\`\`
${breakdownJson}
\`\`\`

Respond with ONLY valid JSON, no preamble.

Schema:
{
  "coverage_score": 0-5,     // do the 8 mains cover the topic comprehensively, without big gaps a domain expert would notice?
  "specificity_score": 0-5,  // is the granularity right — specific and concrete, not generic?
  "overall_quality": 0-5,    // overall — would a domain expert endorse this as a learning starting map?
  "notes": "ONE SENTENCE — the single biggest issue, or 'clean'."
}

Scoring: 5 = "this is what a domain expert would draw." 3 = "usable, noticeable issues." 1 = "obviously wrong."

Output JSON only.`;
}

export function buildInsightJudgePrompt({
  topic,
  insightJson,
}: {
  topic: string;
  insightJson: string;
}): string {
  return `You are evaluating a learning-recommendation output. Someone wants to start mastering "${topic}". The producer returned a one-sentence framing plus exactly 3 first moves (book, course, person, or site).

Mechanical checks (JSON validity, structure, action word count, imperative voice, framing length, AI-tell vocabulary, em-dash usage, negative-parallelism patterns) are run separately — DO NOT score those. Focus only on the judgment items below, which require knowing the field.

OUTPUT TO EVALUATE:
\`\`\`
${insightJson}
\`\`\`

Key failure modes to watch for:
- SCOPE: each resource's primary subject must be THIS topic, not a sub-discipline (e.g., a typography-focused book recommended for "graphic design") or an adjacent field (e.g., a UX researcher recommended for "product design").
- FIELD PRIMACY: a "person" must be a primary practitioner of THIS topic, not adjacent.
- CURRENCY: books still in working use today (recent OR living classic); courses ≤~5 years old unless still widely cited; persons living and actively publishing; sites maintained.
- DOORWAY: each move should open more doors than it closes — avoid single-guru worldviews or single-school orthodoxy.

Respond with ONLY valid JSON, no preamble.

Schema:
{
  "scope_violations": 0-3,      // count of the 3 moves whose primary subject is NOT this topic
  "field_primacy_score": 0-5,   // are the recommended persons/works primarily of THIS field?
  "currency_score": 0-5,        // do resources meet currency rules for their kind?
  "doorway_score": 0-5,         // do moves open doors rather than narrow into one school?
  "diversity_score": 0-5,       // are the 3 kinds (book/course/person/site) well-chosen for this topic?
  "framing_voice_holistic": 0-5,// holistic read — does framing sound like a thoughtful practitioner? (vocabulary tells are scored locally; you score the harder-to-detect cases)
  "overall_quality": 0-5,       // overall — would a thoughtful practitioner endorse these as "where to start"?
  "notes": "ONE SENTENCE — the single biggest issue, or 'clean'."
}

Scoring: 5 = "I'd hand this to a curious friend." 3 = "usable, a few picks feel reflexive." 1 = "would mislead a beginner."

Output JSON only.`;
}
