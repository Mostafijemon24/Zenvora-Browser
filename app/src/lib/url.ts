// URL helpers shared by the address bar, tabs and pages.

export type PageType = 'newtab' | 'settings' | 'dns' | 'cert' | 'web';

export const NEW_TAB_URL = 'zenvora://newtab';
export const SETTINGS_URL = 'zenvora://settings';

export type SearchEngine = 'DuckDuckGo' | 'Google' | 'Bing' | 'Brave';

export const SEARCH_ENGINES: Record<SearchEngine, { host: string; base: string }> = {
  DuckDuckGo: { host: 'duckduckgo.com', base: 'https://duckduckgo.com/?q=' },
  Google: { host: 'google.com', base: 'https://www.google.com/search?q=' },
  Bing: { host: 'bing.com', base: 'https://www.bing.com/search?q=' },
  Brave: { host: 'search.brave.com', base: 'https://search.brave.com/search?q=' },
};

// Friendly titles for the demo sites. Real pages report their own <title>.
const KNOWN_TITLES: Record<string, string> = {
  'stripe.com': 'Pricing · Stripe',
  'paddle.com': 'Pricing — Paddle',
  'developer.mozilla.org': 'Fetch API — MDN',
  'dhakadental.example': 'Dhaka Dental Care',
  'youtube.com': 'Lo-fi beats to code to',
  'github.com': 'zenvora/browser · GitHub',
  'news.ycombinator.com': 'Hacker News',
  'figma.com': 'Figma',
  'mail.proton.me': 'Inbox · Proton Mail',
  'wordpress.org': 'WordPress.org',
};

/** Stable 0–359 hue derived from a string, used for letter favicons. */
export function hue(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function typeOf(url: string): PageType {
  if (url === NEW_TAB_URL) return 'newtab';
  if (url.startsWith(SETTINGS_URL)) return 'settings';
  const h = hostOf(url);
  // Demo rules: these stand in for real DNS and TLS failures.
  if (h.endsWith('.invalid') || h.includes('doesnotexist')) return 'dns';
  if (h.startsWith('expired.')) return 'cert';
  return 'web';
}

export function isInternal(url: string): boolean {
  const t = typeOf(url);
  return t === 'newtab' || t === 'settings';
}

/**
 * Turns address-bar input into a URL: keeps full URLs, adds https:// to
 * bare domains, and sends everything else to the search engine.
 */
export function normalize(input: string, engine: SearchEngine = 'DuckDuckGo'): string | null {
  const s = (input || '').trim();
  if (!s) return null;
  if (/^zenvora:\/\//i.test(s) || /^https?:\/\//i.test(s)) return s;
  if (!/\s/.test(s) && (/^[\w-]+(\.[\w-]+)+(:\d+)?(\/.*)?$/.test(s) || /^localhost(:\d+)?/.test(s))) {
    return 'https://' + s;
  }
  return SEARCH_ENGINES[engine].base + encodeURIComponent(s);
}

function searchQuery(url: string): string | null {
  const h = hostOf(url);
  if (!Object.values(SEARCH_ENGINES).some((e) => e.host === h)) return null;
  try {
    return new URL(url).searchParams.get('q');
  } catch {
    return null;
  }
}

export function titleFor(url: string): string {
  const t = typeOf(url);
  if (t === 'newtab') return 'New Tab';
  if (t === 'settings') return 'Settings';
  const q = searchQuery(url);
  if (q) return q + ' — Search';
  const h = hostOf(url);
  return KNOWN_TITLES[h] || h;
}

/** Address-bar text when the field is not being edited. */
export function displayUrl(url: string): string {
  return typeOf(url) === 'newtab' ? '' : url.replace(/^https:\/\//, '');
}

export interface FaviconInfo {
  color: string;
  letter: string;
}

export function faviconFor(url: string): FaviconInfo {
  if (isInternal(url)) return { color: 'var(--accent)', letter: 'Z' };
  const h = hostOf(url);
  return { color: `oklch(0.6 0.11 ${hue(h)})`, letter: (h[0] || '?').toUpperCase() };
}
