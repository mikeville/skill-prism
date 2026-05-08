// Netlify Function — proxies /api/complete to Anthropic.
// Runs in dev (via `netlify dev`) and in production. The function holds the API key;
// browsers never see it.

import type { Handler } from '@netlify/functions';
import { appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  buildUsageEntry,
  formatUsageLine,
  type AnthropicMessage,
} from '../../src/lib/anthropicPricing';

const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

function logUsage(prompt: string, data: AnthropicMessage) {
  const entry = buildUsageEntry(prompt, data, MODEL);

  // Always log: in prod this lands in Netlify function logs (queryable), in dev in the terminal.
  console.log(formatUsageLine(entry));
  console.log(JSON.stringify(entry));

  // Append to usage.jsonl only when running locally via `netlify dev`.
  // (Serverless filesystems are ephemeral; production logs live in the Netlify dashboard.)
  if (process.env.CONTEXT === 'dev') {
    appendFile(join(process.cwd(), 'usage.jsonl'), JSON.stringify(entry) + '\n').catch((e) =>
      console.error('usage log write failed:', e),
    );
  }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }
  if (!API_KEY) {
    return jsonResponse(500, {
      error:
        'Missing ANTHROPIC_API_KEY on the server. Set it in .env (dev) or Netlify env vars (prod).',
    });
  }

  let body: { prompt?: unknown };
  try {
    body = JSON.parse(event.body ?? '{}') as { prompt?: unknown };
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) {
    return jsonResponse(400, { error: 'Missing prompt' });
  }
  const prompt = body.prompt;

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!r.ok) {
      const text = await r.text();
      return jsonResponse(r.status, { error: text });
    }
    const data = (await r.json()) as AnthropicMessage;
    const completion = data.content?.[0]?.text ?? '';
    logUsage(prompt, data);
    return jsonResponse(200, { completion });
  } catch (e) {
    console.error('handler error', e);
    return jsonResponse(500, { error: e instanceof Error ? e.message : 'Server error' });
  }
};

function jsonResponse(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
