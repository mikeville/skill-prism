// Supabase client + typed wrappers for the two tables.
// Used by the search-handling pipeline and the admin functions.
// The SERVICE key is required and must never reach the browser — these
// helpers live inside Netlify Functions / Vite middleware only.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type Breakdown = { mains: string[]; subs: string[][] };

export type DbBreakdown = {
  id: string;
  model: string;
  path: string[];
  result: Breakdown;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
};

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

export const dbEnabled = Boolean(url && key);

export const supabase: SupabaseClient | null = dbEnabled
  ? createClient(url!, key!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// U+241E (RECORD SEPARATOR) — extremely unlikely to appear in any user query.
const PATH_SEP = '␞';
export const pathKey = (path: string[]) => path.join(PATH_SEP);

export async function getCachedBreakdown(
  model: string,
  path: string[],
  ttlDays: number,
): Promise<DbBreakdown | null> {
  if (!supabase || ttlDays <= 0 || path.length === 0) return null;
  const sinceIso = new Date(Date.now() - ttlDays * 86_400_000).toISOString();
  const { data, error } = await supabase
    .from('breakdowns')
    .select('*')
    .eq('model', model)
    .eq('path_key', pathKey(path))
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[db] getCachedBreakdown:', error.message);
    return null;
  }
  return (data as DbBreakdown | null) ?? null;
}

// Like getCachedBreakdown but with no TTL filter — used by the log-event
// endpoint to find ANY breakdown row matching the current model + path,
// regardless of age, so localStorage cache hits can still be logged.
export async function findBreakdown(
  model: string,
  path: string[],
): Promise<DbBreakdown | null> {
  if (!supabase || path.length === 0) return null;
  const { data, error } = await supabase
    .from('breakdowns')
    .select('id, model, path, result, input_tokens, output_tokens, cost_usd, created_at')
    .eq('model', model)
    .eq('path_key', pathKey(path))
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[db] findBreakdown:', error.message);
    return null;
  }
  return (data as DbBreakdown | null) ?? null;
}

export type InsertBreakdownInput = {
  model: string;
  path: string[];
  result: Breakdown;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
};

export async function insertBreakdown(input: InsertBreakdownInput): Promise<string | null> {
  if (!supabase) return null;
  // Use upsert on (model, path_key) so a race where two simultaneous misses
  // both try to insert resolves to a single row instead of a 409.
  // path_key is set by the app (not a generated column) so we provide it here.
  const row = { ...input, path_key: pathKey(input.path) };
  const { data, error } = await supabase
    .from('breakdowns')
    .upsert(row, { onConflict: 'model,path_key' })
    .select('id')
    .single();
  if (error) {
    console.error('[db] insertBreakdown:', error.message);
    return null;
  }
  return (data?.id as string) ?? null;
}

export type SearchMeta = {
  session_id: string;
  path: string[];
  breakdown_id: string;
  cache_hit: boolean;
  ip: string | null;
  country: string | null;
  city: string | null;
  user_agent: string | null;
  referrer: string | null;
};

export async function insertSearch(input: SearchMeta): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('searches').insert({
    ...input,
    depth: input.path.length,
  });
  if (error) console.error('[db] insertSearch:', error.message);
}
