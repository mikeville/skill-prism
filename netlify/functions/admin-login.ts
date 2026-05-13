// POST /api/admin-login — exchange admin token for an httpOnly cookie.
import type { Handler } from '@netlify/functions';
import {
  adminTokenConfigured,
  makeAdminSetCookieHeader,
  verifySubmittedToken,
} from '../lib/auth';

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResp(405, { error: 'Method not allowed' });
  }
  if (!adminTokenConfigured()) {
    return jsonResp(500, { error: 'ADMIN_TOKEN not configured on server' });
  }
  let body: { token?: unknown };
  try {
    body = JSON.parse(event.body ?? '{}') as typeof body;
  } catch {
    return jsonResp(400, { error: 'Invalid JSON body' });
  }
  if (!verifySubmittedToken(body.token)) {
    return jsonResp(401, { error: 'Invalid token' });
  }
  const setCookie = makeAdminSetCookieHeader();
  if (!setCookie) return jsonResp(500, { error: 'Server misconfigured' });
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    multiValueHeaders: { 'Set-Cookie': [setCookie] },
    body: JSON.stringify({ ok: true }),
  };
};

function jsonResp(statusCode: number, body: object) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}
