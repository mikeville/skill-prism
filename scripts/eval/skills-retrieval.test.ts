// Unit tests for the skills retrieval scorer. Run with:
//   npx tsx --test scripts/eval/skills-retrieval.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreCandidates, type CatalogSkill } from '../../netlify/lib/skillsRetrieval';

const CATALOG: CatalogSkill[] = [
  {
    slug: 'anthropics/skills@pdf',
    display_name: 'pdf',
    description: 'Extract text, tables, and images from PDF files; manipulate, merge, split, and OCR.',
    install_count: 50_000,
    skills_sh_url: 'https://skills.sh/anthropics/skills/pdf',
    install_command: 'npx skills add anthropics/skills@pdf',
  },
  {
    slug: 'vercel-labs/skills@find-skills',
    display_name: 'find-skills',
    description: 'Discover and install agent skills from the open ecosystem.',
    install_count: 2_000_000,
    skills_sh_url: 'https://skills.sh/vercel-labs/skills/find-skills',
    install_command: 'npx skills add vercel-labs/skills@find-skills',
  },
  {
    slug: 'anthropics/skills@frontend-design',
    display_name: 'frontend-design',
    description: 'Generate frontend designs and React components.',
    install_count: 100_000,
    skills_sh_url: 'https://skills.sh/anthropics/skills/frontend-design',
    install_command: 'npx skills add anthropics/skills@frontend-design',
  },
];

test('matches on description tokens', () => {
  const result = scoreCandidates({ term: 'PDF Parsing', path: [], catalog: CATALOG });
  assert.equal(result[0]?.slug, 'anthropics/skills@pdf');
});

test('matches on breadcrumb path tokens', () => {
  const result = scoreCandidates({
    term: 'Form Automation',
    path: ['Document Workflows', 'PDF'],
    catalog: CATALOG,
  });
  assert.equal(result[0]?.slug, 'anthropics/skills@pdf');
});

test('returns empty when no tokens overlap', () => {
  const result = scoreCandidates({
    term: 'Stoicism',
    path: ['Philosophy'],
    catalog: CATALOG,
  });
  assert.deepEqual(result, []);
});

test('title hits weighted higher than description hits', () => {
  // Title match (1 hit × 3 = 3) should beat description-only match (1 hit
  // × 1 = 1), even though the description-match skill is more popular.
  const titleHitSkill: CatalogSkill = {
    slug: 'a/b@react-helpers',
    display_name: 'react-helpers',
    description: 'Small utilities.',
    install_count: 1_000,
    skills_sh_url: 'x',
    install_command: 'x',
  };
  const descHitSkill: CatalogSkill = {
    slug: 'c/d@frontend',
    display_name: 'frontend',
    description: 'For React projects.',
    install_count: 1_000_000,
    skills_sh_url: 'x',
    install_command: 'x',
  };
  const result = scoreCandidates({
    term: 'React',
    path: [],
    catalog: [titleHitSkill, descHitSkill],
  });
  assert.equal(result[0]?.slug, 'a/b@react-helpers');
});

test('caps to limit', () => {
  const many: CatalogSkill[] = Array.from({ length: 20 }, (_, i) => ({
    slug: `o/r@skill${i}`,
    display_name: `react skill ${i}`,
    description: 'React work.',
    install_count: 1_000 + i,
    skills_sh_url: 'x',
    install_command: 'x',
  }));
  const result = scoreCandidates({ term: 'React', path: [], catalog: many, limit: 5 });
  assert.equal(result.length, 5);
});

test('stopwords are ignored', () => {
  // "The" / "a" / "and" should not match. Only "design" should.
  const skill: CatalogSkill = {
    slug: 'a/b@x',
    display_name: 'design',
    description: 'Work.',
    install_count: 1_000,
    skills_sh_url: 'x',
    install_command: 'x',
  };
  const result = scoreCandidates({
    term: 'The Art of Design',
    path: [],
    catalog: [skill],
  });
  assert.equal(result.length, 1);
});
