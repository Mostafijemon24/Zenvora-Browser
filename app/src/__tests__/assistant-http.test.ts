import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpAssistant, fetchProviders, notConnectedAssistant } from '../services/assistant-http';
import type { AiConfig } from '../services/assistant-http';

const cfg: AiConfig = { serverUrl: 'https://ai.example.com/', token: 'tok', provider: 'openrouter', model: 'openrouter/auto' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('http assistant', () => {
  it('posts question, pages, history, provider and model with the token', async () => {
    const fetchMock = vi.fn(async () => json(200, { text: 'Answer' }));
    vi.stubGlobal('fetch', fetchMock);
    const a = createHttpAssistant(cfg);
    const reply = await a.ask('Q?', [{ title: 'T', url: 'https://x/', text: 'body' }], undefined, [{ role: 'user', text: 'earlier' }]);
    expect(reply).toBe('Answer');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://ai.example.com/api/assistant');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({
      provider: 'openrouter',
      model: 'openrouter/auto',
      question: 'Q?',
      pages: [{ title: 'T', url: 'https://x/', text: 'body' }],
      history: [{ role: 'user', text: 'earlier' }],
    });
    expect(a.providerLabel).toBe('OpenRouter · openrouter/auto');
  });

  it('shows the server error message', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(429, { error: 'Too many requests.' })));
    await expect(createHttpAssistant(cfg).ask('Q', [])).rejects.toThrow('Too many requests.');
  });

  it('explains a wrong access token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(401, { error: 'x' })));
    await expect(createHttpAssistant(cfg).ask('Q', [])).rejects.toThrow(/access token/);
  });

  it('notes truncated answers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json(200, { text: 'Part', truncated: true })));
    expect(await createHttpAssistant(cfg).ask('Q', [])).toMatch(/cut short/);
  });

  it('rejects addresses without http(s)', async () => {
    await expect(createHttpAssistant({ ...cfg, serverUrl: 'ai.example.com' }).ask('Q', [])).rejects.toThrow(/http/);
  });

  it('reports an unreachable server when listing providers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(fetchProviders(cfg)).rejects.toThrow(/Can't reach the server/);
  });

  it('never invents an answer when not connected', async () => {
    await expect(notConnectedAssistant.ask('Q', [])).rejects.toThrow(/not connected/);
  });
});
