import { useEffect, useRef, useState } from 'react';
import { useBrowser, useShortcutLabels } from '../../state/browser';
import type { PanelId } from '../../state/browser';
import { WORKSPACES } from '../../state/tabs';
import { Favicon } from '../ui/Favicon';

export function AppMenu({ compact }: { compact: boolean }) {
  const b = useBrowser();
  const { mod, shiftMod } = useShortcutLabels();
  const top = b.settings.layout === 'top' ? 90 : 48;
  const close = () => b.setMenuOpen(false);
  const extraPanels: [PanelId, string][] = compact
    ? [
        ['auto', 'Tasks'],
        ['privacy', 'Privacy & security'],
        ['seo', 'Page analysis (SEO)'],
      ]
    : [];
  const items: { label: string; key: string; run: () => void }[] = [
    { label: 'New tab', key: mod + 'T', run: () => (b.newTab(), close()) },
    { label: 'Reopen closed tab', key: shiftMod + 'T', run: () => (b.reopen(), close()) },
    { label: 'Find in page', key: mod + 'F', run: b.openFind },
    { label: 'Search tabs', key: mod + 'K', run: b.openSearch },
    ...extraPanels.map(([k, label]) => ({ label, key: b.panel === k ? '●' : '', run: () => b.setPanel(k) })),
    { label: 'Downloads', key: '', run: () => b.setPanel('downloads') },
    { label: 'Settings', key: mod + ',', run: b.openSettings },
  ];
  const setZoom = (z: number) => b.dispatch({ type: 'setZoom', id: b.cur.id, zoom: z });

  return (
    <>
      <div className="scrim" onClick={close} />
      <div className="app-menu" role="menu" style={{ top }}>
        {items.map((m) => (
          <button key={m.label} type="button" role="menuitem" className="item" onClick={m.run}>
            <span>{m.label}</span>
            <span>{m.key}</span>
          </button>
        ))}
        <div className="zoom-row">
          <span>Zoom</span>
          <button type="button" aria-label="Zoom out" onClick={() => setZoom(b.zoom - 10)}>
            −
          </button>
          <span className="val">{b.zoom}%</span>
          <button type="button" aria-label="Zoom in" onClick={() => setZoom(b.zoom + 10)}>
            +
          </button>
        </div>
      </div>
    </>
  );
}

export function TabSearch() {
  const b = useBrowser();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
  }, []);

  const needle = q.toLowerCase();
  const all = b.tabs.tabs
    .map((t) => ({ t, group: t.ws as string, closed: false }))
    .concat(b.tabs.closed.map((t) => ({ t, group: 'Closed', closed: true })));
  const results = all.filter(
    (x) => !needle || x.t.title.toLowerCase().includes(needle) || x.t.url.toLowerCase().includes(needle),
  );
  const pick = (x: (typeof results)[number]) => (x.closed ? b.restoreClosed(x.t.id) : b.activate(x.t.id));

  return (
    <>
      <div className="search-scrim" onClick={() => b.setSearchOpen(false)} />
      <div className="tab-search" role="dialog" aria-label="Search tabs">
        <input
          ref={input}
          value={q}
          placeholder="Search tabs across workspaces"
          aria-label="Search tabs across workspaces"
          onChange={(e) => {
            setQ(e.target.value);
            setSel(-1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSel((i) => Math.min(results.length - 1, i + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSel((i) => Math.max(0, i - 1));
            } else if (e.key === 'Enter') {
              const x = results[Math.max(0, sel)];
              if (x) pick(x);
              else {
                b.setSearchOpen(false);
                b.navigate(q);
              }
            }
          }}
        />
        <div className="chips">
          {WORKSPACES.map((w) => (
            <button
              key={w}
              type="button"
              className={b.tabs.ws === w ? 'on' : undefined}
              onClick={() => b.setWorkspace(w)}
            >
              {w}
            </button>
          ))}
        </div>
        <div className="results">
          {results.map((x, i) => (
            <button
              key={(x.closed ? 'c' : 't') + x.t.id}
              type="button"
              className={i === sel ? 'result sel' : 'result'}
              onClick={() => pick(x)}
            >
              <Favicon url={x.t.url} />
              <span className="text">
                <span className="t">{x.t.title}</span>
                <span className="u">{x.t.url.replace(/^https:\/\//, '')}</span>
              </span>
              <span className="g">{x.group}</span>
            </button>
          ))}
          {!results.length && <div className="empty">No tabs match “{q}”. Press Enter to search the web.</div>}
        </div>
      </div>
    </>
  );
}
