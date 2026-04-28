import { createServer } from 'node:http';
import { readFile, appendFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 4321;
const API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

if (!API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY. Copy .env.example to .env and add your key.');
  process.exit(1);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.jsx':  'text/babel; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

// Haiku 4.5 list price as of 2026-04: $1/MTok input, $5/MTok output.
// Used only for a rough $ estimate in the log; check the console for canonical billing.
const PRICE_PER_MTOK = {
  'claude-haiku-4-5-20251001':       { in: 1.00, out: 5.00 },
  'claude-sonnet-4-6':               { in: 3.00, out: 15.00 },
  'claude-opus-4-7':                 { in: 15.00, out: 75.00 },
};

function logUsage(prompt, data) {
  const usage = data.usage || {};
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const topicMatch = prompt.match(/The (?:topic|FOCUS) is "([^"]+)"/);
  const topic = topicMatch ? topicMatch[1] : null;
  const price = PRICE_PER_MTOK[MODEL];
  const costUsd = price ? (inTok * price.in + outTok * price.out) / 1_000_000 : null;

  const entry = {
    ts: new Date().toISOString(),
    model: MODEL,
    topic,
    input_tokens: inTok,
    output_tokens: outTok,
    estimated_cost_usd: costUsd === null ? null : Number(costUsd.toFixed(6)),
  };
  console.log(`[usage] ${topic ?? '(no topic)'} · in=${inTok} out=${outTok}` +
              (costUsd === null ? '' : ` · ~$${costUsd.toFixed(5)}`));
  appendFile(join(ROOT, 'usage.jsonl'), JSON.stringify(entry) + '\n')
    .catch(e => console.error('usage log write failed:', e));
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/complete') {
      const { prompt } = JSON.parse(await readBody(req));
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
        res.writeHead(r.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: text }));
        return;
      }
      const data = await r.json();
      const completion = data.content?.[0]?.text ?? '';
      logUsage(prompt, data);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ completion }));
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const reqPath = url.pathname === '/' ? '/index.html' : url.pathname;
    const filePath = normalize(join(ROOT, reqPath));
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    const data = await readFile(filePath);
    res.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  } catch (e) {
    if (e.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not found');
    } else {
      console.error(e);
      res.writeHead(500);
      res.end('Server error');
    }
  }
});

server.listen(PORT, () => {
  console.log(`Ohtani running at http://localhost:${PORT}`);
});
