// Assistant backed by the Zenvora Assistant server (../../../server), which
// holds the Claude / OpenRouter keys. The app only knows the server URL and an
// optional access token for that server.

import type { AssistantService, ChatTurn, SharedPage } from './types';

export type AiProvider = 'anthropic' | 'openrouter';

export interface AiConfig {
  serverUrl: string;
  token: string;
  provider: AiProvider;
  /** Empty = the server's default model for the provider. */
  model: string;
}

export interface ProviderInfo {
  id: AiProvider;
  label: string;
  configured: boolean;
  defaultModel: string;
}

export const PROVIDER_LABELS: Record<AiProvider, string> = {
  anthropic: 'Claude (Anthropic)',
  openrouter: 'OpenRouter',
};

const TIMEOUT_MS = 120_000;

function endpoint(cfg: AiConfig, path: string): string {
  const base = cfg.serverUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(base)) throw new Error('The server address must start with http:// or https://');
  return base + path;
}

function headers(cfg: AiConfig): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.token.trim()) h.Authorization = `Bearer ${cfg.token.trim()}`;
  return h;
}

async function readError(r: Response): Promise<string> {
  const data = (await r.json().catch(() => null)) as { error?: string } | null;
  if (r.status === 401) return 'The server rejected the access token. Check it in Settings → AI.';
  return data?.error || `Server error (HTTP ${r.status}).`;
}

/** Asks the server which providers it has keys for. */
export async function fetchProviders(cfg: AiConfig, signal?: AbortSignal): Promise<{ defaultProvider: AiProvider; providers: ProviderInfo[] }> {
  const url = endpoint(cfg, '/api/providers');
  let r: Response;
  try {
    r = await fetch(url, { headers: headers(cfg), signal });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error("Can't reach the server. Check the address and that the server is running.");
  }
  if (!r.ok) throw new Error(await readError(r));
  return r.json();
}

export function createHttpAssistant(cfg: AiConfig): AssistantService {
  return {
    providerLabel: PROVIDER_LABELS[cfg.provider] + (cfg.model ? ` · ${cfg.model}` : ''),
    async ask(question: string, pages: SharedPage[], signal?: AbortSignal, history: ChatTurn[] = []) {
      const url = endpoint(cfg, '/api/assistant');
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      signal?.addEventListener('abort', () => ctl.abort(), { once: true });
      let r: Response;
      try {
        r = await fetch(url, {
          method: 'POST',
          headers: headers(cfg),
          signal: ctl.signal,
          body: JSON.stringify({ provider: cfg.provider, model: cfg.model.trim() || undefined, question, pages, history }),
        });
      } catch (e) {
        if (signal?.aborted) throw e;
        throw new Error(ctl.signal.aborted ? 'The assistant took too long to answer.' : "Can't reach the assistant server.");
      } finally {
        clearTimeout(timer);
      }
      if (!r.ok) throw new Error(await readError(r));
      const data = (await r.json()) as { text: string; truncated?: boolean };
      return data.text + (data.truncated ? '\n\n(Answer was cut short.)' : '');
    },
  };
}

/** Used in the desktop app when no server is set up: says so instead of inventing an answer. */
export const notConnectedAssistant: AssistantService = {
  providerLabel: 'not connected',
  async ask() {
    throw new Error('The assistant is not connected yet. Open Settings → AI & automation and add your assistant server.');
  },
};
