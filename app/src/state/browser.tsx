// Combines tabs, settings, panels and features into one context the UI reads.

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';
import { SETTINGS_URL, hostOf, normalize, typeOf } from '../lib/url';
import { isNative, native, withWebview } from '../lib/native';
import type { PageType } from '../lib/url';
import { services } from '../services';
import type { SharedPage } from '../services';
import { useSettings, useResolvedTheme } from './settings';
import { currentTab, initialTabs, tabsReducer, wsTabs } from './tabs';
import type { Tab, Workspace } from './tabs';
import { useAssistant, useAutomation, useDownloads, useVpn } from './features';

export type PanelId = 'ai' | 'auto' | 'vpn' | 'privacy' | 'seo' | 'downloads';
/** Like PageType, plus a cert-error page the user chose to open anyway. */
export type ViewType = PageType | 'insecure';

export const PAGE_LOAD_MS = 700;

export type PermValue = 'Ask' | 'Allow' | 'Block';
export const DEFAULT_PERMS: Record<string, PermValue> = {
  Camera: 'Ask',
  Microphone: 'Ask',
  Location: 'Block',
  Notifications: 'Block',
  'Pop-ups': 'Block',
};

/**
 * Page type from the URL alone. The web preview fakes DNS and certificate
 * failures for demo hosts; the desktop build lets the engine decide.
 */
export function pageTypeOf(url: string): PageType {
  const t = typeOf(url);
  return isNative && (t === 'dns' || t === 'cert') ? 'web' : t;
}

export function viewTypeOf(tab: Tab): ViewType {
  const ok = tab.insecureOk?.includes(hostOf(tab.url));
  if (tab.error) return tab.error.kind === 'cert' ? (ok ? 'insecure' : 'cert') : 'dns';
  const t = pageTypeOf(tab.url);
  if (t === 'cert' && ok) return 'insecure';
  return t;
}

/** Whether a tab should have a live engine view (desktop build). */
export const wantsWebview = (tab: Tab) => pageTypeOf(tab.url) === 'web' || viewTypeOf(tab) === 'insecure';

export const isWebLike = (v: ViewType) => v === 'web' || v === 'insecure';

function useBrowserState() {
  const { settings, update, toggle } = useSettings();
  const themeAttr = useResolvedTheme(settings.theme);
  const [tabs, dispatch] = useReducer(tabsReducer, undefined, initialTabs);
  const cur = currentTab(tabs);
  const view = viewTypeOf(cur);

  const [panel, setPanelState] = useState<PanelId | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const [findq, setFindq] = useState('');
  const [certDetails, setCertDetails] = useState(false);
  const [shared, setShared] = useState<Record<number, boolean>>({});
  const [ntq, setNtq] = useState('');
  const [sitePerms, setSitePerms] = useState<Record<string, Record<string, PermValue>>>({});
  const permsFor = useCallback((host: string) => ({ ...DEFAULT_PERMS, ...sitePerms[host] }), [sitePerms]);
  const setPerm = useCallback(
    (host: string, perm: string, v: PermValue) =>
      setSitePerms((s) => ({ ...s, [host]: { ...s[host], [perm]: v } })),
    [],
  );
  const clearSiteData = useCallback(
    (host: string) =>
      setSitePerms((s) => {
        const next = { ...s };
        delete next[host];
        return next;
      }),
    [],
  );
  const addrRef = useRef<HTMLInputElement>(null);

  // ---- page loading (simulated; a real engine reports load events) ----
  const loadTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const load = useCallback((id: number) => {
    clearTimeout(loadTimers.current.get(id));
    dispatch({ type: 'setLoading', id, loading: true });
    loadTimers.current.set(
      id,
      setTimeout(() => dispatch({ type: 'setLoading', id, loading: false }), PAGE_LOAD_MS),
    );
  }, []);
  const stop = useCallback((id: number) => {
    clearTimeout(loadTimers.current.get(id));
    dispatch({ type: 'setLoading', id, loading: false });
  }, []);
  useEffect(() => {
    const timers = loadTimers.current;
    return () => timers.forEach(clearTimeout);
  }, []);

  // ---- navigation ----
  const navigate = useCallback(
    (input: string) => {
      const url = normalize(input, settings.engine);
      if (!url) return;
      dispatch({ type: 'navigate', url });
      setCertDetails(false);
      if (typeOf(url) === 'web' && !isNative) load(cur.id);
      addrRef.current?.blur();
    },
    [settings.engine, cur.id, load],
  );

  const go = useCallback(
    (delta: number) => {
      const hi = cur.hi + delta;
      if (hi < 0 || hi >= cur.hist.length) return;
      dispatch({ type: 'go', delta });
      setCertDetails(false);
      if (typeOf(cur.hist[hi]) === 'web' && !isNative) load(cur.id);
    },
    [cur, load],
  );

  const reload = useCallback(() => {
    if (!isNative) return cur.loading ? stop(cur.id) : load(cur.id);
    if (cur.error) dispatch({ type: 'setError', id: cur.id, error: undefined });
    withWebview(cur.id, (wv) => (wv.isLoading() ? wv.stop() : wv.reload()));
  }, [cur, load, stop]);

  const allowInsecure = useCallback((id: number, host: string) => {
    native?.allowCertHost(host);
    dispatch({ type: 'allowInsecure', id, host });
    // A page that already failed retries now that the host is allowed.
    withWebview(id, (wv) => wv.reload());
  }, []);

  const newTab = useCallback((url?: string) => {
    dispatch({ type: 'newTab', url });
    setNtq('');
  }, []);
  const closeTab = useCallback((id: number) => dispatch({ type: 'close', id }), []);
  const reopen = useCallback(() => dispatch({ type: 'reopen' }), []);
  const activate = useCallback((id: number) => {
    dispatch({ type: 'activate', id });
    setSearchOpen(false);
    setCertDetails(false);
  }, []);
  const restoreClosed = useCallback((id: number) => {
    dispatch({ type: 'restoreClosed', id });
    setSearchOpen(false);
  }, []);
  const setWorkspace = useCallback((ws: Workspace) => dispatch({ type: 'setWorkspace', ws }), []);

  const focusAddr = useCallback(() => {
    const el = addrRef.current;
    if (el) {
      el.focus();
      el.select();
    }
  }, []);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setMenuOpen(false);
  }, []);

  const setPanel = useCallback((p: PanelId) => {
    setPanelState((cur) => (cur === p ? null : p));
    setMenuOpen(false);
  }, []);
  const showPanel = useCallback((p: PanelId | null) => setPanelState(p), []);

  const openSettings = useCallback(() => {
    if (typeOf(cur.url) === 'newtab') navigate(SETTINGS_URL);
    else newTab(SETTINGS_URL);
    setMenuOpen(false);
  }, [cur.url, navigate, newTab]);

  const openFind = useCallback(() => {
    setFindOpen(true);
    setMenuOpen(false);
  }, []);
  const closeFind = useCallback(() => {
    setFindOpen(false);
    setFindq('');
  }, []);

  // ---- assistant page sharing ----
  const isShared = useCallback((t: Tab) => shared[t.id] ?? t.id === cur.id, [shared, cur.id]);
  const shareable = wsTabs(tabs).filter((t) => isWebLike(viewTypeOf(t)));
  const sharedTabs = shareable.filter(isShared);
  const toggleShare = useCallback((t: Tab) => setShared((s) => ({ ...s, [t.id]: !(s[t.id] ?? t.id === cur.id) })), [cur.id]);

  // ---- features ----
  const vpn = useVpn(services.vpn);
  const assistant = useAssistant(services.assistant);
  const downloads = useDownloads(services.downloads);
  const automation = useAutomation(services.automation, (r) =>
    services.downloads.addFile({ name: r.fileName, ext: 'CSV', sizeMb: 0.004, note: `${r.sizeLabel} · Created by task just now` }),
  );

  const ask = useCallback(
    (text: string) => assistant.send(text, sharedTabs.map<SharedPage>((t) => ({ title: t.title, url: t.url }))),
    [assistant, sharedTabs],
  );

  // ---- keyboard shortcuts ----
  const zoom = tabs.zoom[cur.id] || 100;
  const keyActions = useRef({ newTab, reopen, closeTab, focusAddr, openSearch, openFind, openSettings, reload, go, zoom, curId: cur.id });
  keyActions.current = { newTab, reopen, closeTab, focusAddr, openSearch, openFind, openSettings, reload, go, zoom, curId: cur.id };

  // Desktop build: shortcuts come from the app menu, so they also work while
  // a web page has keyboard focus.
  useEffect(() => {
    if (!native) return;
    const offCmd = native.onCommand((name) => {
      const a = keyActions.current;
      const setZoom = (z: number) => dispatch({ type: 'setZoom', id: a.curId, zoom: z });
      const commands: Record<string, () => void> = {
        newTab: () => a.newTab(),
        reopen: a.reopen,
        closeTab: () => a.closeTab(a.curId),
        focusAddress: a.focusAddr,
        searchTabs: a.openSearch,
        settings: a.openSettings,
        find: a.openFind,
        reload: a.reload,
        back: () => a.go(-1),
        forward: () => a.go(1),
        zoomIn: () => setZoom(a.zoom + 10),
        zoomOut: () => setZoom(a.zoom - 10),
        zoomReset: () => setZoom(100),
        devtools: () => withWebview(a.curId, (wv) => wv.openDevTools()),
      };
      commands[name]?.();
    });
    const offTab = native.onOpenTab((url) => keyActions.current.newTab(url));
    return () => {
      offCmd();
      offTab();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const a = keyActions.current;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        setSearchOpen(false);
        setMenuOpen(false);
        setFindOpen(false);
        return;
      }
      if (isNative || !(e.metaKey || e.ctrlKey)) return;
      const run = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (k === 't' && e.shiftKey) run(a.reopen);
      else if (k === 't') run(() => a.newTab());
      else if (k === 'w') run(() => a.closeTab(a.curId));
      else if (k === 'l') run(a.focusAddr);
      else if (k === 'k') run(a.openSearch);
      else if (k === 'f') run(a.openFind);
      else if (k === ',') run(a.openSettings);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return {
    settings,
    updateSettings: update,
    toggleSetting: toggle,
    themeAttr,
    tabs,
    dispatch,
    cur,
    view,
    zoom,
    navigate,
    go,
    reload,
    allowInsecure,
    newTab,
    closeTab,
    reopen,
    activate,
    restoreClosed,
    setWorkspace,
    addrRef: addrRef as RefObject<HTMLInputElement>,
    focusAddr,
    panel,
    setPanel,
    showPanel,
    menuOpen,
    setMenuOpen,
    searchOpen,
    setSearchOpen,
    openSearch,
    findOpen,
    findq,
    setFindq,
    openFind,
    closeFind,
    certDetails,
    setCertDetails,
    ntq,
    setNtq,
    permsFor,
    setPerm,
    clearSiteData,
    openSettings,
    shareable,
    sharedTabs,
    isShared,
    toggleShare,
    ask,
    assistant,
    vpn,
    automation,
    downloads,
    services,
  };
}

export type Browser = ReturnType<typeof useBrowserState>;

const Ctx = createContext<Browser | null>(null);

export function BrowserProvider({ children }: { children: ReactNode }) {
  const b = useBrowserState();
  return <Ctx.Provider value={b}>{children}</Ctx.Provider>;
}

export function useBrowser(): Browser {
  const b = useContext(Ctx);
  if (!b) throw new Error('useBrowser must be used inside <BrowserProvider>');
  return b;
}

/** Platform-dependent shortcut labels. */
export function useShortcutLabels() {
  const { settings } = useBrowser();
  const isMac = settings.platform === 'mac';
  return useMemo(
    () => ({
      mod: isMac ? '⌘' : 'Ctrl+',
      shiftMod: isMac ? '⇧⌘' : 'Ctrl+Shift+',
    }),
    [isMac],
  );
}
