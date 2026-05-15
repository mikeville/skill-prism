import { useState, type FormEvent } from 'react';

export function AdminGate({ onAuthed }: { onAuthed: () => void }) {
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await fetch('api/admin-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'same-origin',
      });
      if (r.ok) {
        onAuthed();
        return;
      }
      const body = (await r.json().catch(() => ({}))) as { error?: string };
      setError(body.error || `Login failed (${r.status}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-900 px-4 normal-case font-sans">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white border border-neutral-200 rounded-lg p-6 shadow-sm"
      >
        <h1 className="text-base font-medium mb-1">Skill Prism · Admin</h1>
        <p className="text-sm text-neutral-500 mb-4">Enter your admin token to continue.</p>
        <label className="block text-xs uppercase tracking-wide text-neutral-500 mb-1">Token</label>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="w-full border border-neutral-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-neutral-900"
        />
        {error && <div className="mt-3 text-sm text-red-600">{error}</div>}
        <button
          type="submit"
          disabled={busy || !token.trim()}
          className="mt-4 w-full bg-neutral-900 text-white rounded px-3 py-2 text-sm font-medium disabled:opacity-40 hover:bg-neutral-700 transition"
        >
          {busy ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
