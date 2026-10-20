import { forwardRef, useEffect, useState } from 'react';
import { displayUrl } from '../../lib/url';
import { isNative, webviews, withWebview } from '../../lib/native';
import { useBrowser } from '../../state/browser';
import type { PanelId, ViewType } from '../../state/browser';
import { CaptionButtons } from '../ui/WindowControls';

const SECURITY: Record<ViewType, { label: string; tone: string }> = {
  web: { label: 'Secure', tone: 'var(--ok)' },
  insecure: { label: 'Not secure', tone: 'var(--danger)' },
  cert: { label: 'Not secure', tone: 'var(--danger)' },
  dns: { label: 'Offline', tone: 'var(--ink3)' },
  newtab: { label: 'Zenvora', tone: 'var(--ink3)' },
  settings: { label: 'Zenvora', tone: 'var(--ink3)' },
};

export const PANEL_TITLES: Record<PanelId, string> = {
  ai: 'Assistant',
  auto: 'Tasks',
  vpn: 'VPN',
  privacy: 'Privacy',
  seo: 'Page analysis',
  downloads: 'Downloads',
};

const TOOLBAR_PANELS: [PanelId, string][] = [
  ['ai', 'Assistant'],
  ['auto', 'Tasks'],
  ['privacy', 'Privacy'],
  ['seo', 'SEO'],
  ['downloads', '↓'],
];

function AddressBar({ compact }: { compact: boolean }) {
  const b = useBrowser();
  const { cur, view, zoom } = b;
  const [edit, setEdit] = useState<string | null>(null);
  const starred = !!b.tabs.starred[cur.id];
  // Plain http:// pages are never shown as secure.
  const sec = view === 'web' && cur.url.startsWith('http://') ? SECURITY.insecure : SECURITY[view];

  // Switching tabs or workspaces drops any half-typed address.
  useEffect(() => setEdit(null), [cur.id]);

  return (
    <div className={edit !== null ? 'addr editing' : 'addr'}>
      <button
        type="button"
        className="sec-chip"
        title="Connection & site settings"
        style={{ color: sec.tone }}
        onClick={() => b.showPanel('privacy')}
      >
        <span className="dot" />
        {!compact && <span>{sec.label}</span>}
      </button>
      <input
        ref={b.addrRef}
        className="addr-input"
        aria-label="Address and search bar"
        value={edit ?? displayUrl(cur.url)}
        placeholder="Search or enter address"
        spellCheck={false}
        autoComplete="off"
        onFocus={(e) => {
          const el = e.target;
          setEdit(view === 'newtab' ? '' : cur.url);
          setTimeout(() => el.select(), 0);
        }}
        onChange={(e) => setEdit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') b.navigate(e.currentTarget.value);
          if (e.key === 'Escape') {
            setEdit(null);
            e.currentTarget.blur();
          }
        }}
        onBlur={() => setEdit(null)}
      />
      {zoom !== 100 && (
        <button
          type="button"
          className="zoom-chip"
          title="Reset zoom"
          onClick={() => b.dispatch({ type: 'setZoom', id: cur.id, zoom: 100 })}
        >
          {zoom}%
        </button>
      )}
      <button
        type="button"
        className={starred ? 'star-btn on' : 'star-btn'}
        title="Bookmark this tab"
        aria-pressed={starred}
        onClick={() => b.dispatch({ type: 'toggleStar', id: cur.id })}
      >
        {starred ? '★' : '☆'}
      </button>
    </div>
  );
}

export function vpnShortLabel(status: string, regionName: string) {
  return status === 'on' ? 'VPN · ' + regionName : status === 'connecting' ? 'Connecting…' : 'VPN off';
}

export function vpnTone(status: string) {
  return status === 'on' ? 'var(--ok)' : status === 'connecting' ? 'var(--warn)' : 'var(--ink3)';
}

interface ToolbarProps {
  compact: boolean;
  tiny: boolean;
}

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(function Toolbar({ compact, tiny }, ref) {
  const b = useBrowser();
  const { cur, settings } = b;
  const side = settings.layout === 'side';
  const canBack = cur.hi > 0;
  const canFwd = cur.hi < cur.hist.length - 1;
  const panels = compact ? TOOLBAR_PANELS.slice(0, 1) : TOOLBAR_PANELS;

  return (
    <div className="toolbar" ref={ref}>
      <button type="button" className="nav-btn" title="Back" aria-label="Back" disabled={!canBack} onClick={() => b.go(-1)}>
        ←
      </button>
      <button type="button" className="nav-btn" title="Forward" aria-label="Forward" disabled={!canFwd} onClick={() => b.go(1)}>
        →
      </button>
      <button
        type="button"
        className="nav-btn reload"
        title={cur.loading ? 'Stop' : 'Reload'}
        aria-label={cur.loading ? 'Stop' : 'Reload'}
        onClick={b.reload}
      >
        {cur.loading ? '✕' : '↻'}
      </button>
      <AddressBar compact={compact} />
      <button type="button" className="vpn-pill" title="VPN" onClick={() => b.setPanel('vpn')}>
        <span className="dot" style={{ background: vpnTone(b.vpn.status) }} />
        {!tiny && <span>{vpnShortLabel(b.vpn.status, b.vpn.regionName)}</span>}
      </button>
      <div className="panel-btns">
        {panels.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={b.panel === k ? 'panel-btn on' : 'panel-btn'}
            title={PANEL_TITLES[k]}
            aria-label={PANEL_TITLES[k]}
            aria-pressed={b.panel === k}
            onClick={() => b.setPanel(k)}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="menu-btn"
        title="Menu"
        aria-label="Menu"
        aria-haspopup="menu"
        aria-expanded={b.menuOpen}
        onClick={() => b.setMenuOpen(!b.menuOpen)}
      >
        ⋯
      </button>
      {side && settings.platform !== 'mac' && <CaptionButtons platform={settings.platform} inToolbar />}
    </div>
  );
});

/** Real find-in-page through the engine (desktop build). */
function useNativeFind(tabId: number, q: string) {
  const [res, setRes] = useState({ current: 0, total: 0 });
  useEffect(() => {
    const wv = webviews.get(tabId);
    if (!wv) return;
    const onFound = (e: Event) => {
      const r = (e as Event & { result: { activeMatchOrdinal: number; matches: number; finalUpdate: boolean } }).result;
      setRes({ current: r.activeMatchOrdinal, total: r.matches });
    };
    wv.addEventListener('found-in-page', onFound);
    return () => {
      wv.removeEventListener('found-in-page', onFound);
      withWebview(tabId, (w) => w.stopFindInPage('clearSelection'));
    };
  }, [tabId]);
  useEffect(() => {
    if (!q) setRes({ current: 0, total: 0 });
    withWebview(tabId, (w) => (q ? w.findInPage(q) : w.stopFindInPage('clearSelection')));
  }, [tabId, q]);
  const next = (forward: boolean) => q && withWebview(tabId, (w) => w.findInPage(q, { forward, findNext: true }));
  return { res, next };
}

export function FindBar() {
  const b = useBrowser();
  const nativeFind = useNativeFind(b.cur.id, isNative ? b.findq : '');
  const r = isNative ? nativeFind.res : b.services.siteInfo.findInPage(b.cur.url, b.findq);
  const count = b.findq ? (b.view === 'web' || b.view === 'insecure' ? `${r.current} of ${r.total}` : '0 of 0') : '';
  return (
    <div className="find-bar">
      <input
        autoFocus
        aria-label="Find in page"
        value={b.findq}
        placeholder="Find in page"
        onChange={(e) => b.setFindq(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && nativeFind.next(!e.shiftKey)}
      />
      <span className="count" aria-live="polite">{count}</span>
      <button type="button" className="close" aria-label="Close find bar" onClick={b.closeFind}>
        ×
      </button>
    </div>
  );
}
