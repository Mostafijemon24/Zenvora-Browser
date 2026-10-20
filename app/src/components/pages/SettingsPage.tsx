import { useState } from 'react';
import type { ReactNode } from 'react';
import { useBrowser } from '../../state/browser';
import { ACCENTS } from '../../state/settings';
import type { Accent, Toggles } from '../../state/settings';
import { Segmented, opts } from '../ui/Segmented';
import type { SegOption } from '../ui/Segmented';
import { Toggle } from '../ui/Toggle';

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
        <Row key="cloud" label="Claude (Anthropic)" sub="Cloud model for Assistant and Tasks.">
          <div className="setting-action">
            <span>{b.services.aiProviders.cloudStatus()}</span>
            <button type="button" className="btn sm" disabled title="Keys are stored in the OS keychain by the desktop build">
              Add key
            </button>
          </div>
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
