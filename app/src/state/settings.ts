// User settings: appearance, search, startup and privacy toggles.
// Saved to localStorage when available; the app works without it.

import { useCallback, useEffect, useState } from 'react';
import type { SearchEngine } from '../lib/url';
import type { AiConfig } from '../services/assistant-http';
import { native } from '../lib/native';

export type Theme = 'light' | 'dark' | 'system';
export type Accent = 'blue' | 'teal' | 'ember' | 'violet';
export type Platform = 'mac' | 'win' | 'linux';
export type TabLayout = 'top' | 'side';
export type Tracking = 'basic' | 'balanced' | 'strict';

export const ACCENTS: Record<Accent, string> = {
  blue: '#4F6BED',
  teal: '#2E9E83',
  ember: '#D9653B',
  violet: '#8B5CF6',
};

export interface Toggles {
  suggest: boolean;
  askShare: boolean;
  incog: boolean;
  suspAudio: boolean;
  prefetch: boolean;
  local: boolean;
}

export interface Settings {
  theme: Theme;
  accent: Accent;
  platform: Platform;
  layout: TabLayout;
  tracking: Tracking;
  engine: SearchEngine;
  startup: 'restore' | 'newtab';
  suspend: '15' | '30' | 'never';
  tg: Toggles;
  /** Assistant server connection (keys stay on the server). */
  ai: AiConfig;
}

const STORAGE_KEY = 'zenvora.settings.v1';

function detectPlatform(): Platform {
  const p = (typeof navigator !== 'undefined' && (navigator.platform || navigator.userAgent)) || '';
  if (/win/i.test(p)) return 'win';
  if (/linux|x11/i.test(p) && !/android/i.test(p)) return 'linux';
  return 'mac';
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  accent: 'blue',
  platform: 'mac',
  layout: 'top',
  tracking: 'balanced',
  engine: 'DuckDuckGo',
  startup: 'restore',
  suspend: '30',
  tg: { suggest: true, askShare: true, incog: true, suspAudio: true, prefetch: false, local: false },
  ai: { serverUrl: '', token: '', provider: 'anthropic', model: '' },
};

const pick = <T extends string>(v: string | null, opts: readonly T[]): T | undefined =>
  v && (opts as readonly string[]).includes(v) ? (v as T) : undefined;

/** Query-string overrides, e.g. ?platform=win&theme=dark&layout=side&accent=teal */
function fromQuery(): Partial<Settings> {
  if (typeof location === 'undefined') return {};
  const q = new URLSearchParams(location.search);
  const out: Partial<Settings> = {};
  const theme = pick(q.get('theme'), ['light', 'dark', 'system'] as const);
  const accent = pick(q.get('accent'), ['blue', 'teal', 'ember', 'violet'] as const);
  const platform = pick(q.get('platform'), ['mac', 'win', 'linux'] as const);
  const layout = pick(q.get('layout'), ['top', 'side'] as const);
  if (theme) out.theme = theme;
  if (accent) out.accent = accent;
  if (platform) out.platform = platform;
  if (layout) out.layout = layout;
  return out;
}

function load(): Settings {
  let stored: Partial<Settings> = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) stored = JSON.parse(raw);
  } catch {
    // Storage blocked or corrupted: fall back to defaults.
  }
  return {
    ...DEFAULT_SETTINGS,
    platform: detectPlatform(),
    ...stored,
    tg: { ...DEFAULT_SETTINGS.tg, ...(stored.tg || {}) },
    ai: { ...DEFAULT_SETTINGS.ai, ...(stored.ai || {}) },
    ...fromQuery(),
    // The desktop app always uses the real OS's window controls.
    ...(native ? { platform: native.platform } : {}),
  };
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Not fatal; settings just won't survive a reload.
    }
  }, [settings]);

  const update = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), []);
  const toggle = useCallback(
    (k: keyof Toggles) => setSettings((s) => ({ ...s, tg: { ...s.tg, [k]: !s.tg[k] } })),
    [],
  );

  return { settings, update, toggle };
}

/** Resolves 'system' to light or dark and follows OS changes live. */
export function useResolvedTheme(theme: Theme): 'light' | 'dark' {
  const query = '(prefers-color-scheme: dark)';
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(query).matches,
  );
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia(query);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}
