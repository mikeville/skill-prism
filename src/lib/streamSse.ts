// Endpoint-agnostic SSE consumer for the /api/* completion proxies.
// Prefers SSE (Anthropic's streaming format passed through by the proxy) —
// invoking onText after every text delta — but transparently falls back to
// the non-streaming `{ completion }` JSON envelope when the server doesn't
// stream (rare; both proxies do stream now, but the fallback keeps callers
// functional everywhere). The fallback only loses the progressive partial-
// render UX; the final text is the same.

export async function streamCompletion(
  endpoint: string,
  body: Record<string, unknown>,
  onText: (accumulated: string) => void,
): Promise<string> {
  const r = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!r.ok || !r.body) {
    const errBody = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(errBody.error || `API error (${r.status})`);
  }

  // Decide ahead of time which path to take. text/event-stream is the only
  // signal that SSE parsing will actually find events; anything else (most
  // commonly application/json) means we should treat the body as a complete
  // { completion } payload.
  const isSse = (r.headers.get('content-type') || '').toLowerCase().includes('text/event-stream');

  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';
  let sseBuf = '';
  let rawBody = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (isSse) {
      sseBuf += chunk;
      // SSE events are separated by `\n\n`. Each event has one or more
      // `key: value` lines. We only care about `data: <json>`.
      let sepIdx = sseBuf.indexOf('\n\n');
      while (sepIdx >= 0) {
        const eventBlock = sseBuf.slice(0, sepIdx);
        sseBuf = sseBuf.slice(sepIdx + 2);
        for (const line of eventBlock.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.slice(6);
          try {
            const data = JSON.parse(dataStr) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            if (
              data.type === 'content_block_delta' &&
              data.delta?.type === 'text_delta' &&
              typeof data.delta.text === 'string'
            ) {
              accumulated += data.delta.text;
              onText(accumulated);
            }
          } catch {
            // Ignore non-JSON SSE lines (heartbeats, etc.)
          }
        }
        sepIdx = sseBuf.indexOf('\n\n');
      }
    } else {
      rawBody += chunk;
    }
  }

  if (isSse) return accumulated;

  // Non-streaming server. Parse the buffered body as the proxy's standard
  // `{ completion }` envelope and surface it to onText so callers still see a
  // partial before finalizing — same code path as the streaming
  // "everything arrived at once" case.
  try {
    const data = JSON.parse(rawBody) as { completion?: string; error?: string };
    if (data.error) throw new Error(data.error);
    const completion = typeof data.completion === 'string' ? data.completion : '';
    if (completion) onText(completion);
    return completion;
  } catch (e) {
    throw e instanceof Error ? e : new Error('Could not parse completion response.');
  }
}
