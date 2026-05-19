// Builds the scope-trap classifier prompt sent to Claude.
//
// Given a topic, the classifier returns two lists of scope-trap areas:
//   1. sub_disciplines — narrower practice areas WITHIN the topic.
//   2. adjacent_disciplines — sibling/neighboring fields whose canonical
//      resources commonly get recommended for this topic, even though their
//      primary subject is something else.
//
// Both are injected back into the main insight prompt as scope anti-targets.
// Generalizes the "named scope traps" mechanism: the model generates the
// per-topic anti-target lists instead of us maintaining them.

export function buildSubDisciplinePrompt({ term }: { term: string }): string {
  return `You are helping identify SCOPE TRAPS for a learning topic — areas whose canonical resources commonly get mistakenly recommended for this topic, when those resources are actually scoped to something else. Two kinds of scope traps matter:

1. SUB-DISCIPLINES: narrower practice areas WITHIN the topic. Resources scoped to a sub-discipline are TOO NARROW for the broader topic.
2. ADJACENT DISCIPLINES: sibling or neighboring fields at a similar level of specificity (or broader), whose canonical resources frequently get recommended for THIS topic because the fields share methods, vocabulary, or audience.

Respond with ONLY valid JSON, no preamble, no markdown fences.

The topic is "${term}".

Schema:
{
  "sub_disciplines": ["name", "name", ...],
  "adjacent_disciplines": ["name", "name", ...]
}

GUIDANCE for sub_disciplines:
- A sub-discipline is a NAMED practice area WITHIN the topic, not a skill, technique, or tool. Test: would a practitioner introduce themselves as practicing the sub-discipline INSTEAD OF the parent topic? If yes, it's a sub-discipline. "Typography" passes this test for graphic design (typographers identify as such). "Kerning" does not (no one calls themselves a kerner).
- Include 3–7 entries when the topic is a broad meta-discipline with named specializations. Return [] when the topic is already narrow enough that practitioners don't specialize further within it.

GUIDANCE for adjacent_disciplines:
- An adjacent discipline is a sibling or related field whose canonical resources frequently get recommended for THIS topic in practice, even though their primary subject is the adjacent field, not this topic.
- ONLY include adjacent disciplines whose canonical resources are KNOWN to get commonly mistaken for this topic's own resources. Do not list everything related.
- Cap at 0–3 entries. Be selective — this list catches a narrower class of failures than sub-disciplines.
- Examples of the pattern this list catches:
  - For "editorial design": "typography" is adjacent — typography books like type-and-letterforms references commonly get recommended for editorial design even though their primary subject is typography, not editorial design.
  - For "frontend engineering": "JavaScript" (the language) is adjacent — JS language books commonly get recommended for frontend engineering even though frontend engineering is the broader discipline.

Use the names practitioners actually use. Lowercased plain prose.

Calibration examples (illustrating the task, not a closed list):
- "graphic design" → { "sub_disciplines": ["typography", "logo design", "editorial design", "brand identity", "packaging design"], "adjacent_disciplines": [] }
- "editorial design" → { "sub_disciplines": ["magazine design", "newspaper design", "book design"], "adjacent_disciplines": ["typography", "graphic design"] }
- "motion design" → { "sub_disciplines": ["traditional animation", "kinetic typography", "title sequences", "broadcast design"], "adjacent_disciplines": [] }
- "illustration" → { "sub_disciplines": ["character design", "editorial illustration", "children's book illustration", "concept art"], "adjacent_disciplines": [] }
- "color theory" → { "sub_disciplines": [], "adjacent_disciplines": [] }
- "kerning" → { "sub_disciplines": [], "adjacent_disciplines": ["typography"] }

Output JSON only.`;
}
