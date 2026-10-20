// Bridge to the Electron shell (see electron/preload.cjs). Undefined in a
// plain browser, where the app falls back to simulated page loading.

import type { Platform } from '../state/settings';

export interface NativeApi {
  platform: Platform;
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  setButtonPosition(x: number, y: number): void;
  allowCertHost(host: string): void;
  onCommand(cb: (name: string) => void): () => void;
  onOpenTab(cb: (url: string) => void): () => void;
}

export const native: NativeApi | undefined = (window as unknown as { zenvora?: NativeApi }).zenvora;
export const isNative = !!native;

/** Minimal shape of Electron's <webview> element that the UI uses. */
export interface WebviewEl extends HTMLElement {
  loadURL(url: string): Promise<void>;
  getURL(): string;
  reload(): void;
  stop(): void;
  isLoading(): boolean;
  setZoomFactor(f: number): void;
  findInPage(text: string, opts?: { forward?: boolean; findNext?: boolean }): number;
  stopFindInPage(action: 'clearSelection' | 'keepSelection' | 'activateSelection'): void;
  openDevTools(): void;
}

/** Live <webview> per tab id, so toolbar actions can reach the page. */
export const webviews = new Map<number, WebviewEl>();
/** Tabs whose <webview> has fired dom-ready (methods throw before that). */
export const readyWebviews = new Set<number>();

export function withWebview(id: number, fn: (wv: WebviewEl) => void): boolean {
  const wv = webviews.get(id);
  if (!wv || !readyWebviews.has(id)) return false;
  fn(wv);
  return true;
}
