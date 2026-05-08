// Shared by both API surfaces that proxy /api/complete to Anthropic:
//   - netlify/functions/complete.ts  (production + `netlify dev`)
//   - vite-plugins/api-complete.ts   (`npm run dev` middleware)
//
// Holds the rough per-million-token price table, the response shape, and the
// usage-log formatter so we don't keep two copies in sync.

export type AnthropicMessage = {
  content?: { type: string; text: string }[];
  usage?: { input_tokens?: number; output_tokens?: number };
};

// Rough estimate only. Canonical billing lives in the Anthropic console.
export const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  'claude-haiku-4-5-20251001': { in: 1.0, out: 5.0 },
  'claude-sonnet-4-6': { in: 3.0, out: 15.0 },
  'claude-opus-4-7': { in: 15.0, out: 75.0 },
};

export type UsageEntry = {
  ts: string;
  model: string;
  topic: string | null;
  input_tokens: number;
  output_tokens: number;
  estimated_cost_usd: number | null;
};

export function buildUsageEntry(prompt: string, data: AnthropicMessage, model: string): UsageEntry {
  const inTok = data.usage?.input_tokens ?? 0;
  const outTok = data.usage?.output_tokens ?? 0;
  const topicMatch = prompt.match(/The (?:topic|FOCUS) is "([^"]+)"/);
  const topic = topicMatch ? topicMatch[1] : null;
  const price = PRICE_PER_MTOK[model];
  const costUsd = price ? (inTok * price.in + outTok * price.out) / 1_000_000 : null;

  return {
    ts: new Date().toISOString(),
    model,
    topic,
    input_tokens: inTok,
    output_tokens: outTok,
    estimated_cost_usd: costUsd === null ? null : Number(costUsd.toFixed(6)),
  };
}

export function formatUsageLine(entry: UsageEntry): string {
  const cost =
    entry.estimated_cost_usd === null ? '' : ` · ~$${entry.estimated_cost_usd.toFixed(5)}`;
  return `[usage] ${entry.topic ?? '(no topic)'} · in=${entry.input_tokens} out=${entry.output_tokens}${cost}`;
}
