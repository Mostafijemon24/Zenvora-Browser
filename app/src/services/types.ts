// Service interfaces. The UI only talks to these, so each mock in this
// folder can be replaced by a real implementation (Claude API, WireGuard
// helper, automation runtime, OS download manager…) without UI changes.

import type { PageType } from '../lib/url';

// ---- Assistant -------------------------------------------------------------

export interface SharedPage {
  title: string;
  url: string;
  /** Visible text of the page (desktop app). Never form values or cookies. */
  text?: string;
}

/** Earlier turns of the conversation, oldest first. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AssistantService {
  /** Shown under the chat input, e.g. "Claude (Anthropic)". */
  providerLabel: string;
  ask(question: string, pages: SharedPage[], signal?: AbortSignal, history?: ChatTurn[]): Promise<string>;
}

// ---- VPN -------------------------------------------------------------------

export interface VpnRegion {
  code: string;
  name: string;
  latencyMs: number;
}

export interface VpnTunnelInfo {
  handshake: string;
  exitIp: string;
}

export interface LeakCheck {
  name: string;
  result: string;
  ok: boolean;
}

export interface VpnService {
  regions: VpnRegion[];
  /** Resolves once the tunnel is up. Rejects with AbortError if cancelled. */
  connect(region: string, opts: { signal: AbortSignal; reconnect?: boolean }): Promise<VpnTunnelInfo>;
  disconnect(): Promise<void>;
  leakChecks(): LeakCheck[];
}

// ---- Automation ------------------------------------------------------------

export interface TaskStep {
  t: string;
  d: string;
  /** Recovery note shown once the step has finished. */
  note?: string;
}

export interface TaskPlan {
  request: string;
  steps: TaskStep[];
  permissions: string[];
  scopeSummary: string;
}

export interface TaskResult {
  fileName: string;
  columns: [string, string, string];
  rows: [string, string, string][];
  summary: string;
  sizeLabel: string;
}

export interface AutomationService {
  examples: string[];
  defaultRequest: string;
  plan(request: string, signal: AbortSignal): Promise<TaskPlan>;
  runStep(plan: TaskPlan, index: number, signal: AbortSignal): Promise<void>;
  result(plan: TaskPlan): TaskResult;
}

// ---- Downloads -------------------------------------------------------------

export type DownloadState = 'active' | 'paused' | 'done' | 'held' | 'kept' | 'failed' | 'cancelled';

export interface Download {
  id: string;
  name: string;
  ext: string;
  sizeMb: number;
  receivedMb: number;
  state: DownloadState;
  /** Extra status text, e.g. why it failed or that a task created it. */
  note?: string;
}

export interface DownloadsService {
  list(): Download[];
  subscribe(fn: () => void): () => void;
  pause(id: string): void;
  resume(id: string): void;
  cancel(id: string): void;
  retry(id: string): void;
  remove(id: string): void;
  keep(id: string): void;
  open(id: string): void;
  reveal(id: string): void;
  addFile(file: { name: string; ext: string; sizeMb: number; note: string }): void;
}

// ---- Page analysis & site info ---------------------------------------------

export type Level = 'ok' | 'warn' | 'bad';

export interface SeoRow {
  key: string;
  value: string;
  meta: string;
  level: Level;
}

export interface PageAnalysisService {
  analyze(page: { url: string; title: string }): SeoRow[];
}

export interface ConnRow {
  key: string;
  value: string;
  tone: 'ok' | 'danger' | 'ink' | 'ink2';
}

export interface SiteInfoService {
  connection(url: string, type: PageType | 'insecure'): ConnRow[];
  trackersBlocked(url: string): number;
  findInPage(url: string, query: string): { current: number; total: number };
}

// ---- AI provider settings --------------------------------------------------

export interface AiProvidersService {
  cloudStatus(): string;
  /** Looks for an Ollama-compatible server; returns a status line. */
  probeLocalModel(): Promise<string>;
}
