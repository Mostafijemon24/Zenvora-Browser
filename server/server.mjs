// Zenvora Assistant server.
// Receives a question plus the text of the pages the user shared, asks the
// chosen AI provider and returns the reply. Run: node server.mjs

import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { ProviderError, anthropicProvider, openRouterProvider } from './providers.mjs';

const MAX_BODY = 1_000_000; // bytes
const MAX_PAGES = 6;
const MAX_PAGE_CHARS = 20_000;
const MAX_HISTORY = 12;
const MAX_QUESTION = 4_000;

export function createApp(env = process.env) {
  const providers = [anthropicProvider(env), openRouterProvider(env)];
  const byId = Object.fromEntries(providers.map((p) => [p.id, p]));
  const fallbackDefault = providers.find((p) => p.configured)?.id || 'anthropic';
  const defaultProvider = byId[env.DEFAULT_PROVIDER] ? env.DEFAULT_PROVIDER : fallbackDefault;
  const token = env.ZENVORA_ACCESS_TOKEN || '';
  const origins = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const perMinute = Number(env.RATE_LIMIT_PER_MINUTE || 30);
  const hits = new Map();

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origins.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
    else if (origin && origins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }

  function send(res, status, body) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end(JSON.stringify(body));
  }

  function authorized(req) {
    if (!token) return true;
    return req.headers.authorization === `Bearer ${token}`;
  }

  function rateLimited(req) {
    const ip = req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
    recent.push(now);
    hits.set(ip, recent);
    return recent.length > perMinute;
  }

  async function readJson(req) {
    let size = 0;
    const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > MAX_BODY) throw new ProviderError('Request too large.', 413, 'too_large');
      chunks.push(chunk);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      throw new ProviderError('Body must be JSON.', 400, 'bad_json');
    }
  }

  /** Builds an alternating user/assistant transcript ending with the new question. */
  function buildMessages({ question, pages, history }) {
    const esc = (s) => String(s ?? '').replace(/[<>"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const shared = (Array.isArray(pages) ? pages : []).slice(0, MAX_PAGES).map((p, i) => {
      const text = String(p?.text ?? '').slice(0, MAX_PAGE_CHARS);
      return `<page index="${i + 1}" title="${esc(p?.title)}" url="${esc(p?.url)}">\n${text || '(page text not available)'}\n</page>`;
    });
    const latest = `${shared.length ? shared.join('\n\n') : '(No pages are shared.)'}\n\nQuestion: ${question}`;

    const msgs = [];
    for (const m of (Array.isArray(history) ? history : []).slice(-MAX_HISTORY)) {
      const role = m?.role === 'user' ? 'user' : m?.role === 'assistant' ? 'assistant' : null;
      const content = String(m?.text ?? '').slice(0, 8_000);
      if (!role || !content) continue;
      if (!msgs.length && role !== 'user') continue; // must start with the user
      const last = msgs[msgs.length - 1];
      if (last && last.role === role) last.content += `\n\n${content}`;
      else msgs.push({ role, content });
    }
    if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.pop(); // keep alternation before the new turn
    msgs.push({ role: 'user', content: latest });
    return msgs;
  }

  return http.createServer(async (req, res) => {
    cors(req, res);
    if (req.method === 'OPTIONS') return res.end();
    const url = new URL(req.url, 'http://localhost');

    try {
      if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });

      if (!authorized(req)) return send(res, 401, { error: 'Missing or wrong access token.', code: 'unauthorized' });

      if (req.method === 'GET' && url.pathname === '/api/providers') {
        return send(res, 200, {
          defaultProvider,
          providers: providers.map(({ id, label, configured, defaultModel }) => ({ id, label, configured, defaultModel })),
        });
      }

      if (req.method === 'POST' && url.pathname === '/api/assistant') {
        if (rateLimited(req)) return send(res, 429, { error: 'Too many requests. Wait a minute and try again.', code: 'rate_limited' });
        const body = await readJson(req);
        const question = String(body.question ?? '').trim().slice(0, MAX_QUESTION);
        if (!question) return send(res, 400, { error: 'Question is empty.', code: 'bad_request' });
        const provider = byId[body.provider || defaultProvider];
        if (!provider) return send(res, 400, { error: `Unknown provider "${body.provider}".`, code: 'bad_request' });
        const model = typeof body.model === 'string' && body.model.trim() ? body.model.trim().slice(0, 200) : undefined;

        const ctl = new AbortController();
        res.on('close', () => !res.writableEnded && ctl.abort());
        const out = await provider.complete({ messages: buildMessages({ question, pages: body.pages, history: body.history }), model }, ctl.signal);
        return send(res, 200, { text: out.text, provider: provider.id, model: out.model, truncated: out.truncated });
      }

      return send(res, 404, { error: 'Not found.', code: 'not_found' });
    } catch (err) {
      if (err?.name === 'AbortError') return;
      if (err instanceof ProviderError) return send(res, err.status, { error: err.message, code: err.code });
      console.error(err);
      return send(res, 500, { error: 'Internal server error.', code: 'internal' });
    }
  });
}

// Start when run directly (not when imported by tests).
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const port = Number(process.env.PORT || 8787);
  const host = process.env.HOST || '0.0.0.0';
  const app = createApp();
  app.listen(port, host, () => {
    const list = [anthropicProvider(process.env), openRouterProvider(process.env)]
      .map((p) => `${p.label}: ${p.configured ? 'ready' : 'not configured'}`)
      .join(' · ');
    console.log(`Zenvora Assistant server on http://${host}:${port}  (${list})`);
    if (!process.env.ZENVORA_ACCESS_TOKEN) console.warn('Warning: ZENVORA_ACCESS_TOKEN is not set; anyone who can reach this server can use your AI credits.');
  });
}
