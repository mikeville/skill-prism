// Admin cookie auth. Cookie value is an HMAC of a fixed payload, keyed by the
// secret ADMIN_TOKEN. The server can verify it without DB lookup; an attacker
// would need the token (which only the operator knows) to forge a valid cookie.
//
// The cookie is httpOnly+SameSite=Strict in prod, and drops the Secure flag in
// `netlify dev` so localhost over http still works.

import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'sp_admin';
const COOKIE_MAX_AGE_S = 30 * 86_400; // 30 days
const SIGNING_SEED = 'skill-prism-admin-v1';

function makeCookieValue(): string | null {
  const t = process.env.ADMIN_TOKEN;
  if (!t) return null;
  return createHmac('sha256', `${t}:${SIGNING_SEED}`).update('ok').digest('hex');
}

export function adminTokenConfigured(): boolean {
  return Boolean(process.env.ADMIN_TOKEN);
}

export function verifySubmittedToken(submitted: unknown): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || typeof submitted !== 'string') return false;
  const a = Buffer.from(submitted);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function verifyAdminCookie(cookieHeader: string | undefined | null): boolean {
  if (!cookieHeader) return false;
  const expected = makeCookieValue();
  if (!expected) return false;
  for (const part of cookieHeader.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq) !== COOKIE_NAME) continue;
    const got = part.slice(eq + 1);
    if (got.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
    } catch {
      return false;
    }
  }
  return false;
}

function isDevContext(): boolean {
  return process.env.NETLIFY_DEV === 'true' || process.env.CONTEXT === 'dev';
}

export function makeAdminSetCookieHeader(): string | null {
  const v = makeCookieValue();
  if (!v) return null;
  const flags = [`${COOKIE_NAME}=${v}`, 'Path=/', `Max-Age=${COOKIE_MAX_AGE_S}`, 'HttpOnly'];
  if (isDevContext()) {
    flags.push('SameSite=Lax');
  } else {
    flags.push('Secure', 'SameSite=Strict');
  }
  return flags.join('; ');
}

export function makeAdminClearCookieHeader(): string {
  const flags = [`${COOKIE_NAME}=`, 'Path=/', 'Max-Age=0', 'HttpOnly'];
  if (!isDevContext()) flags.push('Secure', 'SameSite=Strict');
  return flags.join('; ');
}
