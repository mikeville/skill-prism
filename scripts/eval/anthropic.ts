// Thin wrapper around Anthropic's Messages API for the eval harness.
//
// Bypasses the Netlify proxy (no caching/DB writes/usage.jsonl side effects);
// the eval owns its own cost ledger via the returned `usage` field.
//
// Reads ANTHROPIC_API_KEY from .env at the project root. No dotenv dep — we
// just parse the file ourselves.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRICE_PER_MTOK } from '../../src/lib/anthropicPricing';

let cachedKey: string | null = null;

function loadApiKey(): string {
  if (cachedKey) return cachedKey;
  if (process.env.ANTHROPIC_API_KEY) {
    cachedKey = process.env.ANTHROPIC_API_KEY;
    return cachedKey;
  }
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const k = trimmed.slice(0, eq).trim();
      const v = trimmed.slice(eq + 1).trim();
      if (k === 'ANTHROPIC_API_KEY') {
        cachedKey = v;
        return cachedKey;
      }
    }
  }
  throw new Error('ANTHROPIC_API_KEY not set (checked env and .env at project root).');
}

export type Usage = {
  inputTokens: number;
  outputTokens: number;
  // null when model isn't in the pricing table.
  costUsd: number | null;
};

export type CallResult = {
  text: string;
  usage: Usage;
  latencyMs: number;
};

export async function callAnthropic({
  model,
  prompt,
  maxTokens = 4096,
}: {
  model: string;
  prompt: string;
  maxTokens?: number;
}): Promise<CallResult> {
  const apiKey = loadApiKey();
  const start = Date.now();
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  const latencyMs = Date.now() - start;
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Anthropic ${model} ${r.status}: ${text}`);
  }
  const data = (await r.json()) as {
    content?: Array<{ text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const text = data.content?.[0]?.text ?? '';
  const inputTokens = data.usage?.input_tokens ?? 0;
  const outputTokens = data.usage?.output_tokens ?? 0;
  const price = PRICE_PER_MTOK[model];
  const costUsd = price
    ? (inputTokens * price.in + outputTokens * price.out) / 1_000_000
    : null;
  return {
    text,
    usage: { inputTokens, outputTokens, costUsd },
    latencyMs,
  };
}

// Sum a list of usage records — used to aggregate per-pipeline cost.
export function sumUsage(usages: Usage[]): Usage {
  const inputTokens = usages.reduce((s, u) => s + u.inputTokens, 0);
  const outputTokens = usages.reduce((s, u) => s + u.outputTokens, 0);
  const costs = usages.map((u) => u.costUsd).filter((c): c is number => c !== null);
  const costUsd = costs.length === usages.length ? costs.reduce((s, c) => s + c, 0) : null;
  return { inputTokens, outputTokens, costUsd };
}
