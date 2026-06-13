// Keyword-based candidate scoring for the skills catalog.
// Pure function — no Supabase, no network — so it's directly unit-testable.
// The Netlify function fetches the catalog and hands it to scoreCandidates.
//
// Why keyword rather than embeddings: a few hundred skills + short topic
// queries means token overlap is a strong-enough signal for v0, and it
// keeps the candidate-retrieval round-trip well under a second. Embeddings
// are the v1 upgrade path if relevance turns out to be the bottleneck.

export type CatalogSkill = {
  slug: string;
  display_name: string;
  description: string;
  install_count: number;
  skills_sh_url: string;
  install_command: string;
};

export type SkillCandidate = CatalogSkill & {
  score: number;
};

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with',
  'by', 'from', 'is', 'are', 'be', 'as', 'at', 'it', 'this', 'that',
  'how', 'what', 'why', 'when', 'where',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function countHits(haystack: string, needles: Set<string>): number {
  if (needles.size === 0) return 0;
  let hits = 0;
  for (const token of tokenize(haystack)) {
    if (needles.has(token)) hits++;
  }
  return hits;
}

export function scoreCandidates({
  term,
  path,
  catalog,
  limit = 8,
}: {
  term: string;
  path: string[];
  catalog: CatalogSkill[];
  limit?: number;
}): SkillCandidate[] {
  // Build a query token set from the term + breadcrumb path. Path words
  // contribute additional context — e.g. "Document Workflows" + "PDF
  // Parsing" lets a PDF-extraction skill match on either signal.
  const queryTokens = new Set<string>();
  for (const token of tokenize(term)) queryTokens.add(token);
  for (const segment of path) {
    for (const token of tokenize(segment)) queryTokens.add(token);
  }
  if (queryTokens.size === 0) return [];

  const scored: SkillCandidate[] = [];
  for (const skill of catalog) {
    const titleHits = countHits(skill.display_name, queryTokens);
    const descHits = countHits(skill.description, queryTokens);
    const rawScore = titleHits * 3 + descHits;
    if (rawScore === 0) continue;
    // Install count is a popularity prior — multiply by log(installs + 10)
    // so a popular skill with a weak match doesn't eclipse a niche skill
    // with a strong match, but install count still breaks ties.
    const popularity = Math.log10((skill.install_count || 0) + 10);
    const score = rawScore * popularity;
    scored.push({ ...skill, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
