import { useEffect, useRef, useState } from 'react';
import { isNative, native } from '../../lib/native';
import { NativeWebViews } from '../pages/NativeWebViews';
import { useBrowser } from '../../state/browser';
import { CertErrorPage, DnsErrorPage } from '../pages/ErrorPages';
import { NewTabPage } from '../pages/NewTabPage';
import { SettingsPage } from '../pages/SettingsPage';
import { WebPage } from '../pages/WebPage';
import { SidePanel } from '../panels/SidePanel';
import { AppMenu, TabSearch } from './Overlays';
import { Sidebar, TabStrip } from './TabStrip';
import { FindBar, Toolbar, vpnShortLabel } from './Toolbar';

// Toolbar widths below which secondary controls fold into the menu.
const COMPACT_W = 780;
const TINY_W = 600;

/** Measures an element's width and re-renders only on meaningful changes. */
function useWidth<T extends HTMLElement>(initial: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW((prev) => (Math.abs(el.clientWidth - prev) > 4 ? el.clientWidth : prev)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Window() {
  const b = useBrowser();
  const { platform, layout } = b.settings;
  const side = layout === 'side';
  const [toolbarRef, tbW] = useWidth<HTMLDivElement>(1200);

  // In vertical mode the Windows/Linux caption buttons live inside the
  // toolbar, so their width doesn't count toward the space for controls.
  const captionW = side && platform !== 'mac' ? (platform === 'win' ? 140 : 110) : 0;
  const avail = tbW - captionW;
  const compact = avail < COMPACT_W;
  const tiny = avail < TINY_W;
  const vpnLabel = vpnShortLabel(b.vpn.status, b.vpn.regionName);

  // macOS: move the native traffic lights to where each layout draws them.
  useEffect(() => {
    if (platform === 'mac') native?.setButtonPosition(side ? 16 : 14, side ? 16 : 15);
  }, [platform, side]);

  return (
    <div className={platform === 'win' ? 'window win' : 'window'}>
      {!side && <TabStrip />}
      <div className="body-row">
        {side && <Sidebar />}
        <main className={side ? 'main side' : 'main'}>
          <Toolbar ref={toolbarRef} compact={compact} tiny={tiny} />
          {b.cur.loading && <div className="load-bar" role="progressbar" aria-label="Loading page" />}
          {b.findOpen && <FindBar />}
          <div className="content-row">
            <div className="page">
              {b.view === 'newtab' && <NewTabPage vpnLabel={vpnLabel} />}
              {(b.view === 'web' || b.view === 'insecure') && !isNative && <WebPage />}
              {isNative && <NativeWebViews />}
              {b.view === 'dns' && <DnsErrorPage />}
              {b.view === 'cert' && <CertErrorPage />}
              {b.view === 'settings' && <SettingsPage />}
            </div>
            <SidePanel />
          </div>
        </main>
      </div>
      {b.menuOpen && <AppMenu compact={compact} />}
      {b.searchOpen && <TabSearch />}
    </div>
  );
}
