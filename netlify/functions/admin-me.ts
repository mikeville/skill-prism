// GET /api/admin-me — does the caller's cookie authenticate them?
// The dashboard hits this on mount to decide between login form vs. data view.
import type { Handler } from '@netlify/functions';
import { verifyAdminCookie } from '../lib/auth';

export const handler: Handler = async (event) => {
  const cookie =
    (event.headers.cookie as string | undefined) ??
    (event.headers.Cookie as string | undefined) ??
    null;
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ authenticated: verifyAdminCookie(cookie) }),
  };
};
