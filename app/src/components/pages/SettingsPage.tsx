import { useState } from 'react';
import type { ReactNode } from 'react';
import { useBrowser } from '../../state/browser';
import { ACCENTS } from '../../state/settings';
import type { Accent, Toggles } from '../../state/settings';
import { Segmented, opts } from '../ui/Segmented';
import type { SegOption } from '../ui/Segmented';
import { Toggle } from '../ui/Toggle';
import { PROVIDER_LABELS, fetchProviders } from '../../services/assistant-http';
import type { AiConfig, AiProvider, ProviderInfo } from '../../services/assistant-http';

type Section = 'appearance' | 'search' | 'ai' | 'sessions';

const NAV: [Section, string][] = [
  ['appearance', 'Appearance'],
  ['search', 'Search'],
  ['ai', 'AI & automation'],
  ['sessions', 'Startup & tabs'],
];

function Row({ label, sub, children }: { label: string; sub: string; children: ReactNode }) {
  return (
    <div className="setting-row">
      <div className="text">
        <span className="label">{label}</span>
        <span className="sub">{sub}</span>
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const b = useBrowser();
  const s = b.settings;
  const set = b.updateSettings;
  const [section, setSection] = useState<Section>('appearance');
  const [localStatus, setLocalStatus] = useState('Not detected at localhost:11434');
  const [providers, setProviders] = useState<ProviderInfo[] | null>(null);
  const [conn, setConn] = useState<{ text: string; tone: string; busy: boolean }>({
    text: s.ai.serverUrl.trim() ? 'Not checked yet' : 'No server set',
    tone: 'c-ink3',
    busy: false,
  });
  const setAi = (p: Partial<AiConfig>) => set({ ai: { ...s.ai, ...p } });
  const testConnection = async () => {
    setConn({ text: 'Checking…', tone: 'c-ink3', busy: true });
    try {
      const info = await fetchProviders(s.ai);
      setProviders(info.providers);
      const ready = info.providers.filter((p) => p.configured).map((p) => PROVIDER_LABELS[p.id]);
      setConn({
        text: ready.length ? `Connected · ${ready.join(' and ')} ready` : 'Connected, but the server has no API keys set',
        tone: ready.length ? 'c-ok' : 'c-warn',
        busy: false,
      });
    } catch (e) {
      setProviders(null);
      setConn({ text: (e as Error).message, tone: 'c-danger', busy: false });
    }
  };
  const [probing, setProbing] = useState(false);

  const toggleRow = (k: keyof Toggles, label: string, sub: string) => (
    <Row key={k} label={label} sub={sub}>
      <Toggle on={s.tg[k]} label={label} onClick={() => b.toggleSetting(k)} />
    </Row>
  );
  function choiceRow<T extends string>(label: string, sub: string, o: SegOption<T>[], value: T, onChange: (v: T) => void) {
    return (
      <Row key={label} label={label} sub={sub}>
        <Segmented variant="choice" label={label} options={o} value={value} onChange={onChange} />
      </Row>
    );
  }

  const sections: Record<Section, [string, ReactNode[]]> = {
    appearance: [
      'Appearance',
      [
        choiceRow('Theme', 'System follows your OS light/dark setting.', opts([['light', 'Light'], ['dark', 'Dark'], ['system', 'System']]), s.theme, (theme) => set({ theme })),
        <Row key="accent" label="Accent color" sub="Used for focus, selection and primary actions.">
          <div className="swatches" role="radiogroup" aria-label="Accent color">
            {(Object.keys(ACCENTS) as Accent[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={s.accent === k}
                title={k}
                aria-label={k}
                style={{ background: ACCENTS[k], boxShadow: s.accent === k ? `0 0 0 2px ${ACCENTS[k]}` : undefined }}
                onClick={() => set({ accent: k })}
              />
            ))}
          </div>
        </Row>,
        choiceRow('Tab layout', 'Vertical tabs fit long titles and many tabs.', opts([['top', 'Horizontal'], ['side', 'Vertical']]), s.layout, (layout) => set({ layout })),
        toggleRow('suggest', 'Show tab previews on hover', 'A thumbnail appears after a short delay.'),
      ],
    ],
    search: [
      'Search',
      [
        choiceRow('Default search engine', 'Used for queries typed in the address bar.', opts([['DuckDuckGo', 'DuckDuckGo'], ['Google', 'Google'], ['Bing', 'Bing'], ['Brave', 'Brave']]), s.engine, (engine) => set({ engine })),
        toggleRow('prefetch', 'Preload likely pages', 'Faster navigation; sends some requests before you click. Off by default.'),
      ],
    ],
    ai: [
      'AI & automation',
      [
        <Row key="server" label="Assistant server" sub="Address of your Zenvora Assistant server. Your Claude and OpenRouter API keys stay on that server, never in this app.">
          <input
            className="setting-input"
            type="url"
            inputMode="url"
            spellCheck={false}
            placeholder="https://assistant.example.com"
            aria-label="Assistant server address"
            value={s.ai.serverUrl}
            onChange={(e) => setAi({ serverUrl: e.target.value })}
          />
        </Row>,
        <Row key="token" label="Access token" sub="The ZENVORA_ACCESS_TOKEN configured on the server. Leave empty if the server doesn't use one. Saved on this device.">
          <input
            className="setting-input"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder="Access token"
            aria-label="Access token"
            value={s.ai.token}
            onChange={(e) => setAi({ token: e.target.value })}
          />
        </Row>,
        <Row key="test" label="Connection" sub="Checks the server and which providers have API keys.">
          <div className="setting-action">
            <span aria-live="polite" className={conn.tone}>{conn.text}</span>
            <button type="button" className="btn sm" disabled={!s.ai.serverUrl.trim() || conn.busy} onClick={testConnection}>
              Test connection
            </button>
          </div>
        </Row>,
        <Row key="provider" label="Provider" sub="Which AI answers in the Assistant panel.">
          <Segmented
            variant="choice"
            label="Provider"
            options={(['anthropic', 'openrouter'] as AiProvider[]).map((id) => ({
              value: id,
              label: PROVIDER_LABELS[id] + (providers && !providers.find((p) => p.id === id)?.configured ? ' (no key)' : ''),
            }))}
            value={s.ai.provider}
            onChange={(provider) => setAi({ provider, model: '' })}
          />
        </Row>,
        <Row
          key="model"
          label="Model"
          sub={
            s.ai.provider === 'anthropic'
              ? 'Leave empty for the server default. Examples: claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5.'
              : 'Leave empty for the server default. Use any model ID from openrouter.ai/models, e.g. openrouter/auto.'
          }
        >
          <input
            className="setting-input"
            spellCheck={false}
            placeholder={providers?.find((p) => p.id === s.ai.provider)?.defaultModel || 'Server default'}
            aria-label="Model"
            value={s.ai.model}
            onChange={(e) => setAi({ model: e.target.value })}
          />
        </Row>,
        <Row key="local" label="Local model" sub="Runs on this computer via an Ollama-compatible server.">
          <div className="setting-action">
            <span aria-live="polite">{probing ? 'Checking…' : localStatus}</span>
            <button
              type="button"
              className="btn sm"
              disabled={probing}
              onClick={async () => {
                setProbing(true);
                setLocalStatus(await b.services.aiProviders.probeLocalModel());
                setProbing(false);
              }}
            >
              Retry
            </button>
          </div>
        </Row>,
        toggleRow('askShare', 'Ask before sharing a page', 'Each new page must be explicitly shared with Assistant.'),
        toggleRow('incog', 'Disable AI in private windows', 'Private pages are never sent to any provider.'),
      ],
    ],
    sessions: [
      'Startup & tabs',
      [
        choiceRow('On startup', 'Restoring keeps every workspace and its tabs.', opts([['restore', 'Restore session'], ['newtab', 'New tab']]), s.startup, (startup) => set({ startup })),
        choiceRow('Suspend inactive tabs after', 'Frees memory; the page reloads when you return.', opts([['15', '15 min'], ['30', '30 min'], ['never', 'Never']]), s.suspend, (suspend) => set({ suspend })),
        toggleRow('suspAudio', 'Never suspend tabs playing audio or downloading', 'Protects media, uploads and unsaved forms.'),
      ],
    ],
  };
  const [title, rows] = sections[section];

  return (
    <div className="settings">
      <nav className="settings-nav" aria-label="Settings sections">
        <h1>Settings</h1>
        {NAV.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={section === k ? 'on' : undefined}
            aria-current={section === k ? 'page' : undefined}
            onClick={() => setSection(k)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="settings-main">
        <h2>{title}</h2>
        {rows}
      </div>
    </div>
  );
}
