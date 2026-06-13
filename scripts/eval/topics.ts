// Seed topics for the prompt eval. ~20 entries, balanced across the three
// failure-mode buckets:
//
//   1. broad — broad meta-disciplines that have strong scope-trap priors
//      (e.g., "graphic design" pulls typography canon when the model isn't
//      careful).
//   2. narrow — already-narrow practice areas where the classifier should
//      mostly return empty lists.
//   3. cross — non-design / generality topics. The Insight pipeline should
//      hold up outside design too.
//
// Each entry pairs a breakdown topic with a representative click cell so we
// can test both surfaces with one fixed flow per topic. The clickTerm is the
// term the Insight pipeline runs on; clickPath is [topic, clickTerm] to
// simulate the user having drilled in one level from the top-level grid.

export type Topic = {
  id: string;
  bucket: 'broad' | 'narrow' | 'cross';
  topic: string;
  clickTerm: string;
};

export const TOPICS: Topic[] = [
  // BROAD — high scope-trap risk
  { id: 'graphic-design',   bucket: 'broad', topic: 'graphic design',   clickTerm: 'composition' },
  { id: 'motion-design',    bucket: 'broad', topic: 'motion design',    clickTerm: 'timing' },
  { id: 'product-design',   bucket: 'broad', topic: 'product design',   clickTerm: 'user research' },
  { id: 'software-eng',     bucket: 'broad', topic: 'software engineering', clickTerm: 'system design' },
  { id: 'photography',      bucket: 'broad', topic: 'photography',      clickTerm: 'lighting' },
  { id: 'illustration',     bucket: 'broad', topic: 'illustration',     clickTerm: 'character design' },
  { id: 'public-speaking',  bucket: 'broad', topic: 'public speaking',  clickTerm: 'stage presence' },

  // NARROW — already-narrow practice areas
  { id: 'kerning',          bucket: 'narrow', topic: 'kerning',          clickTerm: 'optical spacing' },
  { id: 'ts-generics',      bucket: 'narrow', topic: 'TypeScript generics', clickTerm: 'conditional types' },
  { id: 'css-grid',         bucket: 'narrow', topic: 'CSS grid',         clickTerm: 'auto-placement' },
  { id: 'color-theory',     bucket: 'narrow', topic: 'color theory',     clickTerm: 'value contrast' },
  { id: 'copywriting',      bucket: 'narrow', topic: 'copywriting',      clickTerm: 'headlines' },
  { id: 'sourdough',        bucket: 'narrow', topic: 'sourdough baking', clickTerm: 'starter maintenance' },
  { id: 'espresso',         bucket: 'narrow', topic: 'espresso brewing', clickTerm: 'extraction balance' },

  // CROSS — non-design, generality check
  { id: 'personal-finance', bucket: 'cross', topic: 'personal finance', clickTerm: 'asset allocation' },
  { id: 'cooking',          bucket: 'cross', topic: 'cooking',          clickTerm: 'knife skills' },
  { id: 'parenting',        bucket: 'cross', topic: 'parenting',        clickTerm: 'sleep training' },
  { id: 'language',         bucket: 'cross', topic: 'learning a language', clickTerm: 'comprehensible input' },
  { id: 'woodworking',      bucket: 'cross', topic: 'woodworking',      clickTerm: 'joinery' },
  { id: 'marathon',         bucket: 'cross', topic: 'running a marathon', clickTerm: 'pacing strategy' },
];
