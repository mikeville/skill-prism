// Mirrors /api/admin-* routes for `npm run dev`.
// In production these are served by Netlify Functions (netlify/functions/admin-*.ts);
// in plain `vite` dev we adapt the same Handler exports into Vite middlewares
// so the dashboard works without needing `netlify dev`.

import type { IncomingMessage } from 'node:http';
import type { Handler, HandlerEvent } from '@netlify/functions';
import { loadEnv, type Plugin } from 'vite';

import { handler as adminLogin } from '../netlify/functions/admin-login';
import { handler as adminMe } from '../netlify/functions/admin-me';
import { handler as adminEvents } from '../netlify/functions/admin-events';
import { handler as adminSessions } from '../netlify/functions/admin-sessions';
import { handler as adminStats } from '../netlify/functions/admin-stats';

const ROUTES: Record<string, Handler> = {
  '/api/admin-login': adminLogin,
  '/api/admin-me': adminMe,
  '/api/admin-events': adminEvents,
  '/api/admin-sessions': adminSessions,
  '/api/admin-stats': adminStats,
};

export function apiAdminProxy(): Plugin {
  return {
    name: 'api-admin-dev-proxy',
    apply: 'serve',
    configResolved(config) {
      // Surface env vars to the handlers (they read process.env).
      const env = loadEnv(config.mode, config.root, '');
      for (const k of [
        'SUPABASE_URL',
        'SUPABASE_SERVICE_KEY',
        'ADMIN_TOKEN',
        'CACHE_TTL_DAYS',
        'NETLIFY_DEV',
      ]) {
        if (env[k] && !process.env[k]) process.env[k] = env[k];
      }
      // Force dev-context cookie flags (drops Secure so localhost works).
      if (!process.env.NETLIFY_DEV) process.env.NETLIFY_DEV = 'true';
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        const path = url.split('?')[0];
        const handler = ROUTES[path];
        if (!handler) return next();
        try {
          const event = await synthesizeEvent(req, url);
          const result = await handler(event, makeMinimalContext());
          if (!result) {
            res.statusCode = 500;
            res.end('handler returned undefined');
            return;
          }
          res.statusCode = result.statusCode ?? 200;
          for (const [k, v] of Object.entries(result.headers ?? {})) {
            if (v !== undefined) res.setHeader(k, String(v));
          }
          for (const [k, vs] of Object.entries(result.multiValueHeaders ?? {})) {
            for (const v of vs ?? []) res.appendHeader(k, String(v));
          }
          res.end(result.body ?? '');
        } catch (e) {
          console.error(`[/api/admin-*] ${path} error`, e);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : 'Server error' }));
        }
      });
    },
  };
}

async function synthesizeEvent(req: IncomingMessage, url: string): Promise<HandlerEvent> {
  const [pathOnly, qs = ''] = url.split('?');
  const queryStringParameters: Record<string, string> = {};
  if (qs) {
    for (const pair of qs.split('&')) {
      if (!pair) continue;
      const [k, v = ''] = pair.split('=');
      queryStringParameters[decodeURIComponent(k)] = decodeURIComponent(v);
    }
  }
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  const body = req.method === 'POST' ? await readBody(req) : null;
  return {
    httpMethod: req.method ?? 'GET',
    headers,
    multiValueHeaders: {},
    path: pathOnly,
    queryStringParameters,
    multiValueQueryStringParameters: {},
    body,
    isBase64Encoded: false,
    rawUrl: url,
    rawQuery: qs,
    pathParameters: null,
    resource: '',
    stageVariables: null,
    requestContext: undefined as unknown as HandlerEvent['requestContext'],
  };
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = '';
    req.on('data', (c: Buffer) => (buf += c.toString()));
    req.on('end', () => resolve(buf));
    req.on('error', reject);
  });
}

// The admin handlers don't read from context, so a minimal stub is sufficient.
// Cast through unknown to satisfy the strict Handler signature without pulling
// in @netlify/functions' full Context type surface.
function makeMinimalContext() {
  return {
    awsRequestId: 'dev',
    callbackWaitsForEmptyEventLoop: false,
    functionName: 'dev',
    functionVersion: 'dev',
    invokedFunctionArn: 'dev',
    logGroupName: 'dev',
    logStreamName: 'dev',
    memoryLimitInMB: '0',
    getRemainingTimeInMillis: () => 0,
    done: () => undefined,
    fail: () => undefined,
    succeed: () => undefined,
  } as unknown as Parameters<Handler>[1];
}

