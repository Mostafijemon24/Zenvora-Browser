import { useEffect, useRef, useState } from 'react';
import { readyWebviews, webviews } from '../../lib/native';
import type { WebviewEl } from '../../lib/native';
import { useBrowser, viewTypeOf, wantsWebview, isWebLike } from '../../state/browser';
import type { PageError, Tab } from '../../state/tabs';

// Desktop build only: one Electron <webview> per tab that has been opened.
// Inactive ones stay mounted (hidden) so their pages keep their state.

function classify(code: number, desc: string): PageError {
  if (code === -105 || code === -137) return { kind: 'dns', code, desc };
  if (code <= -200 && code > -300) return { kind: 'cert', code, desc };
  return { kind: 'other', code, desc };
}

type Ev<T> = Event & T;

function TabWebview({ tab, visible, zoom }: { tab: Tab; visible: boolean; zoom: number }) {
  const { dispatch } = useBrowser();
  const ref = useRef<WebviewEl>(null);
  const initialSrc = useRef(tab.url);
  const latestUrl = useRef(tab.url);
  const latestZoom = useRef(zoom);
  /** The next full navigation was started by us, so a redirect replaces it. */
  const ownNav = useRef(true);
  latestUrl.current = tab.url;
  latestZoom.current = zoom;
  const id = tab.id;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    webviews.set(id, el);
    const on = <T,>(name: string, fn: (e: Ev<T>) => void) => {
      el.addEventListener(name, fn as EventListener);
      return () => el.removeEventListener(name, fn as EventListener);
    };
    const offs = [
      on('dom-ready', () => {
        readyWebviews.add(id);
        el.setZoomFactor(latestZoom.current / 100);
        if (el.getURL() !== latestUrl.current && !el.isLoading()) {
          ownNav.current = true;
          el.loadURL(latestUrl.current).catch(() => {});
        }
      }),
      on('did-start-loading', () => dispatch({ type: 'setLoading', id, loading: true })),
      on('did-stop-loading', () => dispatch({ type: 'setLoading', id, loading: false })),
      on<{ url: string }>('did-navigate', (e) => {
        dispatch({ type: 'webNavigated', id, url: e.url, replace: ownNav.current });
        ownNav.current = false;
      }),
      on<{ url: string; isMainFrame: boolean }>('did-navigate-in-page', (e) => {
        if (e.isMainFrame) dispatch({ type: 'webNavigated', id, url: e.url });
      }),
      on<{ title: string }>('page-title-updated', (e) => dispatch({ type: 'setTitle', id, title: e.title })),
      on<{ errorCode: number; errorDescription: string; isMainFrame: boolean }>('did-fail-load', (e) => {
        // -3 is ERR_ABORTED: the user stopped the load or navigated away.
        if (!e.isMainFrame || e.errorCode === -3) return;
        dispatch({ type: 'setError', id, error: classify(e.errorCode, e.errorDescription) });
      }),
    ];
    return () => {
      offs.forEach((f) => f());
      webviews.delete(id);
      readyWebviews.delete(id);
    };
  }, [id, dispatch]);

  // Toolbar navigation (address bar, back/forward) changes tab.url.
  useEffect(() => {
    const el = ref.current;
    if (!el || !readyWebviews.has(id)) return;
    if (el.getURL() !== tab.url) {
      ownNav.current = true;
      el.loadURL(tab.url).catch(() => {});
    }
  }, [tab.url, id]);

  useEffect(() => {
    if (readyWebviews.has(id)) ref.current?.setZoomFactor(zoom / 100);
  }, [zoom, id]);

  return (
    <webview
      ref={ref as React.Ref<HTMLElement>}
      className={visible ? 'webview on' : 'webview'}
      src={initialSrc.current}
      partition="persist:zenvora"
      allowpopups="true"
      aria-hidden={!visible}
    />
  );
}

export function NativeWebViews() {
  const b = useBrowser();
  const [opened, setOpened] = useState<Set<number>>(() => new Set([b.cur.id]));

  // Pages load the first time their tab is shown, not all at startup.
  useEffect(() => {
    setOpened((s) => (s.has(b.cur.id) ? s : new Set(s).add(b.cur.id)));
  }, [b.cur.id]);

  const live = b.tabs.tabs.filter((t) => opened.has(t.id) && wantsWebview(t));
  return (
    <div className="webviews">
      {live.map((t) => (
        <TabWebview
          key={t.id}
          tab={t}
          zoom={b.tabs.zoom[t.id] || 100}
          visible={t.id === b.cur.id && isWebLike(viewTypeOf(t))}
        />
      ))}
    </div>
  );
}
