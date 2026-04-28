// API client — generates the 9x9 breakdown for a topic given the breadcrumb path.
// Returns { mains: [8 strings], subs: { [blockIdx]: [8 strings] } }
// blockIdx in 0..8 except 4. The mainIdx<->blockIdx mapping: mainIdx 0->block 0, 1->block 1, 2->block 2,
// 3->block 3, 4->block 5, 5->block 6, 6->block 7, 7->block 8.

const MAIN_TO_BLOCK = [0, 1, 2, 3, 5, 6, 7, 8];

async function generateBreakdown({ topic, path }) {
  // path: array of strings from root to current focus, INCLUDING current topic
  // Example: ['Linear Algebra', 'Eigenvalues', 'Diagonalization'] - current focus is Diagonalization

  const pathStr = path.length > 1
    ? `\n\nLearning path context (root → focus):\n${path.map((p, i) => `${'  '.repeat(i)}${i === path.length - 1 ? '▸' : '·'} ${p}`).join('\n')}\n\nThe FOCUS is "${topic}". Decompose IT specifically — interpret it through the lens of this full path. Sub-skills should be appropriate to the depth: more specific, more concrete, more granular than the parent levels.`
    : `\n\nThe topic is "${topic}". This is a top-level decomposition.`;

  const prompt = `You are a curriculum designer breaking down a topic into the sub-skills required to learn it. Respond with ONLY valid JSON, no preamble, no markdown fences.

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

  const raw = await window.claude.complete(prompt);

  // Strip code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  // Find first { and last }
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) cleaned = cleaned.slice(start, end + 1);

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    console.error('parse fail', raw);
    throw new Error('Could not parse model output as JSON.');
  }

  const mains = Array.isArray(parsed.mains) ? parsed.mains.slice(0, 8) : [];
  while (mains.length < 8) mains.push('');

  const subs = {};
  if (Array.isArray(parsed.subs)) {
    for (let i = 0; i < 8; i++) {
      const blockIdx = MAIN_TO_BLOCK[i];
      const row = Array.isArray(parsed.subs[i]) ? parsed.subs[i].slice(0, 8) : [];
      while (row.length < 8) row.push('');
      subs[blockIdx] = row;
    }
  }

  return { mains, subs };
}

window.generateBreakdown = generateBreakdown;
window.MAIN_TO_BLOCK = MAIN_TO_BLOCK;
