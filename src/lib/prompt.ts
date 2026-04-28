// Builds the curriculum-decomposition prompt sent to Claude.
// Lifted verbatim from the prototype's api.jsx — the prompt has been tuned
// through several iterations and is load-bearing.

export function buildPrompt({ topic, path }: { topic: string; path: string[] }): string {
  const pathStr =
    path.length > 1
      ? `\n\nLearning path context (root → focus):\n${path
          .map((p, i) => `${'  '.repeat(i)}${i === path.length - 1 ? '▸' : '·'} ${p}`)
          .join(
            '\n',
          )}\n\nThe FOCUS is "${topic}". Decompose IT specifically — interpret it through the lens of this full path. Sub-skills should be appropriate to the depth: more specific, more concrete, more granular than the parent levels.`
      : `\n\nThe topic is "${topic}". This is a top-level decomposition.`;

  return `You are a curriculum designer breaking down a topic into the sub-skills required to learn it. Respond with ONLY valid JSON, no preamble, no markdown fences.

Schema:
{
  "mains": ["...", "...", "...", "...", "...", "...", "...", "..."],
  "subs": [
    ["...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "..."],
    ["...", "...", "...", "...", "...", "...", "...", "..."]
  ]
}

"mains" = exactly 8 main sub-skills required to learn the focus topic. Together they should cover the topic comprehensively without overlap. Order them roughly from foundational to advanced.

"subs" = exactly 8 arrays, one per main sub-skill (in the same order). Each contains exactly 8 sub-sub-skills — concrete, granular components of that main sub-skill.

CONSTRAINTS:
- Each label: 1–2 words MAX. Tight. Concrete nouns/noun-phrases. No verbs like "Learn" or "Understand". Aim for 8–14 characters; never exceed 18.
- Avoid generic filler ("Fundamentals", "Basics", "Advanced topics"). Be specific to the actual subject.
- No numbering, no bullets, no colons.
- No duplicates across mains; no duplicates within any subs row.
${pathStr}

Output JSON only.`;
}
