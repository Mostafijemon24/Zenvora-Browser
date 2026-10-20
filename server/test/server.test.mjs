import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../server.mjs';

// Fake upstream that records requests and replies with whatever `reply` returns.
function fakeUpstream(reply) {
  const calls = [];
  const srv = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const call = { method: req.method, url: req.url, headers: req.headers, body: body ? JSON.parse(body) : null };
    calls.push(call);
    const [status, json] = reply(call);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(json));
  });
  return { srv, calls };
}

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${srv.address().port}`)));

let anthropic, openrouter, app, base, appNoKeys, baseNoKeys;
const claudeReply = { status: 200, json: null };

before(async () => {
  anthropic = fakeUpstream(() => [
    claudeReply.status,
    claudeReply.json ?? {
      id: 'msg_1', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
      content: [{ type: 'text', text: 'Claude says hi' }], stop_reason: 'end_turn', stop_sequence: null,
      usage: { input_tokens: 10, output_tokens: 3 },
    },
  ]);
  openrouter = fakeUpstream((call) =>
    call.headers.authorization === 'Bearer or-key'
      ? [200, { model: call.body.model, choices: [{ message: { role: 'assistant', content: 'OpenRouter says hi' }, finish_reason: 'stop' }] }]
      : [401, { error: { message: 'bad key' } }],
  );
  const aUrl = await listen(anthropic.srv);
  const oUrl = await listen(openrouter.srv);
  app = createApp({
    ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: aUrl,
    OPENROUTER_API_KEY: 'or-key', OPENROUTER_BASE_URL: oUrl,
    ZENVORA_ACCESS_TOKEN: 'secret', RATE_LIMIT_PER_MINUTE: '100',
  });
  base = await listen(app);
  appNoKeys = createApp({});
  baseNoKeys = await listen(appNoKeys);
});

after(() => [anthropic.srv, openrouter.srv, app, appNoKeys].forEach((s) => s.close()));

const auth = { Authorization: 'Bearer secret', 'Content-Type': 'application/json' };
const post = (b, body, headers = auth) => fetch(`${b}/api/assistant`, { method: 'POST', headers, body: JSON.stringify(body) });

test('health is public', async () => {
  const r = await fetch(`${base}/health`);
  assert.equal(r.status, 200);
});

test('access token is required', async () => {
  const r = await fetch(`${base}/api/providers`);
  assert.equal(r.status, 401);
});

test('lists providers and their status', async () => {
  const r = await fetch(`${base}/api/providers`, { headers: auth });
  const d = await r.json();
  assert.equal(d.defaultProvider, 'anthropic');
  assert.deepEqual(d.providers.map((p) => [p.id, p.configured]), [['anthropic', true], ['openrouter', true]]);
  assert.equal(d.providers[0].defaultModel, 'claude-opus-5-5');
});

test('asks Claude with page text, history and fallbacks', async () => {
  const r = await post(base, {
    provider: 'anthropic',
    question: 'Summarize',
    pages: [{ title: 'Pricing <x>', url: 'https://a.example/', text: 'Plans start at $14.' }],
    history: [
      { role: 'assistant', text: 'Hi, ask me anything' }, // leading assistant turn is dropped
      { role: 'user', text: 'Earlier question' },
      { role: 'assistant', text: 'Earlier answer' },
    ],
  });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.text, 'Claude says hi');
  const call = anthropic.calls.at(-1);
  assert.match(call.url, /\/v1\/messages/);
  assert.equal(call.headers['x-api-key'], 'test-key');
  assert.match(call.headers['anthropic-beta'], /server-side-fallback-2026-07-01/);
  assert.equal(call.body.fallbacks, 'default');
  assert.equal(call.body.model, 'claude-opus-5-5');
  assert.deepEqual(call.body.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  const last = call.body.messages.at(-1).content;
  assert.match(last, /Plans start at \$14\./);
  assert.match(last, /title="Pricing &lt;x&gt;"/); // attributes escaped
  assert.match(last, /Question: Summarize$/);
  assert.match(call.body.system, /untrusted/);
});

test('custom Claude model without fallback support skips fallbacks', async () => {
  await post(base, { provider: 'anthropic', model: 'claude-haiku-5-5', question: 'Hi' });
  const call = anthropic.calls.at(-1);
  assert.equal(call.body.model, 'claude-haiku-5-5');
  assert.equal(call.body.fallbacks, undefined);
});

test('reports a Claude refusal clearly', async () => {
  claudeReply.json = {
    id: 'msg_2', type: 'message', role: 'assistant', model: 'claude-opus-5-5', content: [],
    stop_reason: 'refusal', stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 },
  };
  const r = await post(base, { provider: 'anthropic', question: 'x' });
  claudeReply.json = null;
  assert.equal(r.status, 422);
  assert.equal((await r.json()).code, 'refusal');
});

test('maps a bad Claude key to an auth error', async () => {
  claudeReply.status = 401;
  claudeReply.json = { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } };
  const r = await post(base, { provider: 'anthropic', question: 'x' });
  claudeReply.status = 200;
  claudeReply.json = null;
  assert.equal(r.status, 502);
  assert.equal((await r.json()).code, 'auth');
});

test('asks OpenRouter with the chosen model', async () => {
  const r = await post(base, { provider: 'openrouter', model: 'meta-llama/llama-3.3-70b-instruct', question: 'Hello' });
  const d = await r.json();
  assert.equal(r.status, 200);
  assert.equal(d.text, 'OpenRouter says hi');
  assert.equal(d.model, 'meta-llama/llama-3.3-70b-instruct');
  const call = openrouter.calls.at(-1);
  assert.equal(call.url, '/chat/completions');
  assert.equal(call.body.messages[0].role, 'system');
  assert.equal(call.body.messages.at(-1).role, 'user');
  assert.equal(call.headers['x-title'], 'Zenvora');
});

test('OpenRouter defaults to auto routing', async () => {
  await post(base, { provider: 'openrouter', question: 'Hello' });
  assert.equal(openrouter.calls.at(-1).body.model, 'openrouter/auto');
});

test('unconfigured provider returns 503', async () => {
  const r = await post(baseNoKeys, { provider: 'openrouter', question: 'x' }, { 'Content-Type': 'application/json' });
  assert.equal(r.status, 503);
  assert.equal((await r.json()).code, 'not_configured');
});

test('rejects empty questions and unknown providers', async () => {
  assert.equal((await post(base, { question: '  ' })).status, 400);
  assert.equal((await post(base, { provider: 'nope', question: 'x' })).status, 400);
});

test('rate limit applies per client', async () => {
  const limited = createApp({ ANTHROPIC_API_KEY: 'k', ANTHROPIC_BASE_URL: 'http://127.0.0.1:9', RATE_LIMIT_PER_MINUTE: '1' });
  const b = await listen(limited);
  const h = { 'Content-Type': 'application/json' };
  await post(b, { question: '' }, h);
  const r = await post(b, { question: '' }, h);
  limited.close();
  assert.equal(r.status, 429);
});
