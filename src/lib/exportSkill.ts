import type { DataState } from '../types';

export function buildSkillMarkdown(path: string[], data: DataState): string {
  const focal = path[path.length - 1] ?? data.topic;
  const name = kebab(focal);
  const ancestry = path.join(' > ');
  const sections = data.mains
    .map((main, i) => {
      const subs = data.subs[i] ?? [];
      const bullets = subs.map((s) => `- ${s}`).join('\n');
      return `## ${main}\n${bullets}`;
    })
    .join('\n\n');

  return `---
name: ${name}
description: TODO — write a triggering description. Use when the user asks about ${focal}.
---

<!-- Generated from Skill Prism. Path: ${ancestry} -->

# ${focal}

${sections}
`;
}

function kebab(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}
