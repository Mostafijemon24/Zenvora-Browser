// Tabs, workspaces, history, bookmarks and zoom, as a pure reducer.

import { NEW_TAB_URL, titleFor } from '../lib/url';

export const WORKSPACES = ['Research', 'Client work', 'Personal'] as const;
export type Workspace = (typeof WORKSPACES)[number];

export interface Tab {
  id: number;
  ws: Workspace;
  url: string;
  title: string;
  hist: string[];
  hi: number;
  loading: boolean;
  pinned?: boolean;
  audio?: boolean;
  muted?: boolean;
  /** Hosts the user chose to open despite a certificate error. */
  insecureOk?: string[];
  /** Set when the engine failed to load the page (desktop build). */
  error?: PageError;
}

export interface PageError {
  kind: 'dns' | 'cert' | 'other';
  code: number;
  desc: string;
}

export interface TabsState {
  ws: Workspace;
  tabs: Tab[];
  active: Record<Workspace, number>;
  closed: Tab[];
  starred: Record<number, boolean>;
  zoom: Record<number, number>;
  nextId: number;
}

export function makeTab(id: number, ws: Workspace, url: string, extra: Partial<Tab> = {}): Tab {
  return { id, ws, url, title: titleFor(url), hist: [url], hi: 0, loading: false, ...extra };
}

export function initialTabs(): TabsState {
  return {
    ws: 'Research',
    tabs: [
      makeTab(1, 'Research', 'https://stripe.com/pricing', { pinned: true }),
      makeTab(2, 'Research', 'https://paddle.com/pricing'),
      makeTab(3, 'Research', 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API'),
      makeTab(4, 'Research', NEW_TAB_URL),
      makeTab(5, 'Client work', 'https://dhakadental.example/'),
      makeTab(6, 'Client work', 'https://wordpress.org/plugins/'),
      makeTab(7, 'Personal', 'https://youtube.com/watch?v=lofi', { audio: true }),
      makeTab(8, 'Personal', 'https://mail.proton.me/inbox'),
    ],
    active: { Research: 4, 'Client work': 5, Personal: 7 },
    closed: [],
    starred: { 3: true },
    zoom: {},
    nextId: 21,
  };
}

export type TabsAction =
  | { type: 'navigate'; url: string }
  | { type: 'go'; delta: number }
  | { type: 'newTab'; url?: string }
  | { type: 'close'; id: number }
  | { type: 'reopen' }
  | { type: 'restoreClosed'; id: number }
  | { type: 'activate'; id: number }
  | { type: 'setWorkspace'; ws: Workspace }
  | { type: 'setLoading'; id: number; loading: boolean }
  | { type: 'toggleMute'; id: number }
  | { type: 'toggleStar'; id: number }
  | { type: 'setZoom'; id: number; zoom: number }
  | { type: 'allowInsecure'; id: number; host: string }
  | { type: 'webNavigated'; id: number; url: string; replace?: boolean }
  | { type: 'setTitle'; id: number; title: string }
  | { type: 'setError'; id: number; error: PageError | undefined };

export const MAX_CLOSED = 10;
export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;

export function wsTabs(s: TabsState, ws: Workspace = s.ws): Tab[] {
  return s.tabs.filter((t) => t.ws === ws);
}

export function currentTab(s: TabsState): Tab {
  return s.tabs.find((t) => t.id === s.active[s.ws]) || wsTabs(s)[0];
}

function patch(s: TabsState, id: number, fn: (t: Tab) => Partial<Tab>): TabsState {
  return { ...s, tabs: s.tabs.map((t) => (t.id === id ? { ...t, ...fn(t) } : t)) };
}

export function tabsReducer(s: TabsState, a: TabsAction): TabsState {
  switch (a.type) {
    case 'navigate': {
      const c = currentTab(s);
      return patch(s, c.id, (t) => {
        const hist = t.hist.slice(0, t.hi + 1).concat(a.url);
        return { url: a.url, title: titleFor(a.url), hist, hi: hist.length - 1, error: undefined };
      });
    }
    case 'go': {
      const c = currentTab(s);
      const hi = c.hi + a.delta;
      if (hi < 0 || hi >= c.hist.length) return s;
      const url = c.hist[hi];
      return patch(s, c.id, () => ({ hi, url, title: titleFor(url), error: undefined }));
    }
    case 'newTab': {
      const id = s.nextId;
      return {
        ...s,
        nextId: id + 1,
        tabs: s.tabs.concat(makeTab(id, s.ws, a.url || NEW_TAB_URL)),
        active: { ...s.active, [s.ws]: id },
      };
    }
    case 'close': {
      const t = s.tabs.find((x) => x.id === a.id);
      if (!t) return s;
      const list = wsTabs(s, t.ws);
      const i = list.findIndex((x) => x.id === a.id);
      let tabs = s.tabs.filter((x) => x.id !== a.id);
      const active = { ...s.active };
      let nextId = s.nextId;
      if (list.length === 1) {
        // A workspace never goes empty: closing its last tab leaves a new tab.
        const nid = nextId++;
        tabs = tabs.concat(makeTab(nid, t.ws, NEW_TAB_URL));
        active[t.ws] = nid;
      } else if (active[t.ws] === a.id) {
        active[t.ws] = (list[i + 1] || list[i - 1]).id;
      }
      return { ...s, tabs, active, nextId, closed: s.closed.concat({ ...t, loading: false }).slice(-MAX_CLOSED) };
    }
    case 'reopen': {
      const t = s.closed[s.closed.length - 1];
      if (!t) return s;
      return {
        ...s,
        tabs: s.tabs.concat(t),
        closed: s.closed.slice(0, -1),
        ws: t.ws,
        active: { ...s.active, [t.ws]: t.id },
      };
    }
    case 'restoreClosed': {
      const t = s.closed.find((x) => x.id === a.id);
      if (!t) return s;
      return {
        ...s,
        tabs: s.tabs.concat(t),
        closed: s.closed.filter((x) => x.id !== a.id),
        ws: t.ws,
        active: { ...s.active, [t.ws]: t.id },
      };
    }
    case 'activate': {
      const t = s.tabs.find((x) => x.id === a.id);
      if (!t) return s;
      return { ...s, ws: t.ws, active: { ...s.active, [t.ws]: a.id } };
    }
    case 'setWorkspace':
      return { ...s, ws: a.ws };
    case 'setLoading':
      return patch(s, a.id, () => ({ loading: a.loading }));
    case 'toggleMute':
      return patch(s, a.id, (t) => ({ muted: !t.muted }));
    case 'toggleStar':
      return { ...s, starred: { ...s.starred, [a.id]: !s.starred[a.id] } };
    case 'setZoom':
      return { ...s, zoom: { ...s.zoom, [a.id]: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, a.zoom)) } };
    case 'allowInsecure':
      return patch(s, a.id, (t) => ({ insecureOk: (t.insecureOk || []).concat(a.host), error: undefined }));
    case 'webNavigated':
      // The page navigated by itself (link click, redirect, in-page route).
      return patch(s, a.id, (t) => {
        if (t.url === a.url) return {};
        if (a.replace) {
          // Redirect of a load we started: rewrite the entry, don't add one.
          const hist = t.hist.slice();
          hist[t.hi] = a.url;
          return { url: a.url, hist };
        }
        if (t.hist[t.hi - 1] === a.url) return { url: a.url, hi: t.hi - 1 };
        if (t.hist[t.hi + 1] === a.url) return { url: a.url, hi: t.hi + 1 };
        const hist = t.hist.slice(0, t.hi + 1).concat(a.url);
        return { url: a.url, title: titleFor(a.url), hist, hi: hist.length - 1 };
      });
    case 'setTitle':
      return patch(s, a.id, () => (a.title ? { title: a.title } : {}));
    case 'setError':
      return patch(s, a.id, () => ({ error: a.error }));
  }
}
