// Demo implementations of every service, used for the preview experience.
// Nothing here talks to a real network, model or
// VPN; swap these out in services/index.ts when real backends exist.

import { hostOf } from '../lib/url';
import type {
  AiProvidersService,
  AssistantService,
  AutomationService,
  Download,
  DownloadsService,
  PageAnalysisService,
  SiteInfoService,
  TaskPlan,
  VpnService,
} from './types';

/** setTimeout as a promise that rejects with AbortError when aborted. */
export function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

// ---- Assistant -------------------------------------------------------------

export const mockAssistant: AssistantService = {
  providerLabel: 'Claude (Anthropic)',
  async ask(q, pages, signal) {
    await wait(1100, signal);
    if (!pages.length) return 'No pages are shared yet. Tap a page above to let me read it.';
    const names = pages.map((p) => p.title).join(', ');
    const first = pages[0];
    if (/compare/i.test(q)) {
      return `Comparing ${pages.length} pages (${names}):\n\n• Both lead with a free or low-cost entry tier and charge per transaction above it.\n• One lists volume discounts publicly; the other routes large customers to sales.\n• Tax handling differs: one includes it, one bills it separately.\n\nWant this as a table?`;
    }
    if (/explain|code/i.test(q)) {
      return `On “${first.title}”: the main example calls fetch(), awaits the Response, then parses JSON. Errors only reject on network failure — a 404 still resolves, so check response.ok before parsing.`;
    }
    if (/translat/i.test(q)) {
      return "Select some text on the page first, then choose Translate — I'll translate just the selection.";
    }
    const host = hostOf(first.url);
    return `Summary of “${first.title}”:\n\n• What it is: ${host} — the page's main topic and offer.\n• Key points: three sections, a comparison table and an FAQ.\n• Worth checking: fine print at the bottom changes the headline numbers.\n\nSource: ${host}`;
  },
};

// ---- VPN -------------------------------------------------------------------

export const mockVpn: VpnService = {
  regions: [
    { code: 'DE', name: 'Frankfurt', latencyMs: 24 },
    { code: 'NL', name: 'Amsterdam', latencyMs: 31 },
    { code: 'SG', name: 'Singapore', latencyMs: 58 },
    { code: 'IN', name: 'Mumbai', latencyMs: 41 },
    { code: 'US', name: 'New York', latencyMs: 112 },
  ],
  async connect(_region, { signal, reconnect }) {
    await wait(reconnect ? 1200 : 1600, signal);
    return { handshake: '4 s ago', exitIp: '185.213.xx.xx' };
  },
  async disconnect() {},
  leakChecks() {
    return [
      { name: 'DNS', result: 'Through tunnel', ok: true },
      { name: 'IPv6', result: 'Blocked', ok: true },
      { name: 'WebRTC', result: 'Local IPs hidden', ok: true },
    ];
  },
};

// ---- Automation ------------------------------------------------------------

const DEMO_STEPS = [
  { t: 'Open vendor-a.example/pricing', d: 'Read visible page text' },
  { t: 'Open vendor-b.example/pricing', d: 'Read visible page text' },
  { t: 'Open vendor-c.example/pricing', d: 'Read visible page text' },
  {
    t: 'Open vendor-d.example/pricing',
    d: 'Read visible page text',
    note: 'Cookie dialog covered the plan table · dismissed and retried (1 of 2)',
  },
  { t: 'Open vendor-e.example/pricing', d: 'Read visible page text' },
  { t: 'Extract plan names and listed prices', d: 'DOM tables + accessible names' },
  { t: 'Validate results', d: 'Every site must return at least one plan' },
  { t: 'Write pricing-comparison.csv', d: 'Downloads folder · 1 new file' },
];

export const mockAutomation: AutomationService = {
  defaultRequest: 'Open these five vendor pricing pages, compare their entry plans and prepare a CSV report.',
  examples: [
    'Collect every link on this page and group them by topic.',
    'Find the official setup docs for this API and summarize the steps.',
    'Check these client pages for missing meta descriptions.',
  ],
  async plan(request, signal): Promise<TaskPlan> {
    await wait(1300, signal);
    return {
      request,
      steps: DEMO_STEPS,
      permissions: [
        'Open and read 5 pages (vendor-a … vendor-e.example)',
        'Create 1 file in Downloads',
        'No logins, form submissions or purchases',
      ],
      scopeSummary: '5 sites, read-only, 1 file',
    };
  },
  async runStep(_plan, _index, signal) {
    await wait(1000, signal);
  },
  result() {
    return {
      fileName: 'pricing-comparison.csv',
      columns: ['Vendor', 'Entry plan', 'Listed'],
      rows: [
        ['Vendor A', 'Starter', '$0 + 2.9%'],
        ['Vendor B', 'Basic', '$19/mo'],
        ['Vendor C', 'Launch', '$29/mo'],
        ['Vendor D', 'Growth', '$49/mo'],
        ['Vendor E', 'Core', '$25/mo'],
      ],
      summary: 'Sample data · 5 of 5 sites returned a plan · 1 recovered step',
      sizeLabel: '4 KB',
    };
  },
};

// ---- Downloads -------------------------------------------------------------

const TICK_MS = 700;
const TICK_MB = 0.7;

export function createMockDownloads(): DownloadsService {
  let items: Download[] = [
    { id: 'zip', name: 'zenvora-design-tokens.zip', ext: 'ZIP', sizeMb: 42, receivedMb: 18.4, state: 'active' },
    { id: 'exe', name: 'setup-tool.exe', ext: 'EXE', sizeMb: 3.2, receivedMb: 3.2, state: 'held' },
    {
      id: 'pdf',
      name: 'annual-report-2025.pdf',
      ext: 'PDF',
      sizeMb: 8.6,
      receivedMb: 5.2,
      state: 'failed',
      note: 'network interrupted at 61%',
    },
  ];
  const subs = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  let seq = 0;

  const emit = () => subs.forEach((f) => f());
  const set = (fn: (d: Download[]) => Download[]) => {
    items = fn(items);
    emit();
  };
  const update = (id: string, p: Partial<Download>) => set((d) => d.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const tick = () => {
    if (!items.some((d) => d.state === 'active')) return;
    set((d) =>
      d.map((x) => {
        if (x.state !== 'active') return x;
        const receivedMb = Math.min(x.sizeMb, +(x.receivedMb + TICK_MB).toFixed(1));
        return { ...x, receivedMb, state: receivedMb >= x.sizeMb ? 'done' : 'active' };
      }),
    );
  };

  return {
    list: () => items,
    subscribe(fn) {
      subs.add(fn);
      if (!timer) timer = setInterval(tick, TICK_MS);
      return () => {
        subs.delete(fn);
        if (!subs.size && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
    pause: (id) => update(id, { state: 'paused' }),
    resume: (id) => update(id, { state: 'active' }),
    cancel: (id) => update(id, { state: 'cancelled' }),
    retry: (id) => update(id, { state: 'active', receivedMb: 0, note: undefined }),
    remove: (id) => set((d) => d.filter((x) => x.id !== id)),
    keep: (id) => update(id, { state: 'kept' }),
    // A web page can't open local files; the desktop shell implements these.
    open: () => {},
    reveal: () => {},
    addFile: (f) =>
      set((d) => [{ id: 'file-' + ++seq, receivedMb: f.sizeMb, state: 'done' as const, ...f }, ...d]),
  };
}

// ---- Page analysis & site info ---------------------------------------------

export const mockPageAnalysis: PageAnalysisService = {
  analyze({ url, title }) {
    return [
      { key: 'Title', value: title, meta: title.length + ' chars', level: 'ok' },
      {
        key: 'Meta description',
        value: 'Simple, transparent pricing with no hidden fees. Compare plans and start free.',
        meta: '78 chars',
        level: 'warn',
      },
      { key: 'Canonical', value: url, meta: 'self', level: 'ok' },
      { key: 'Robots', value: 'index, follow', meta: 'meta', level: 'ok' },
      { key: 'Headings', value: '1 × H1 · 6 × H2 · 14 × H3', meta: '', level: 'ok' },
      { key: 'Images', value: '3 of 24 missing alt text', meta: '', level: 'warn' },
      { key: 'Links', value: '86 internal · 19 external · 0 broken (checked on page)', meta: '', level: 'ok' },
      { key: 'Structured data', value: 'Organization, Product, FAQPage', meta: 'JSON-LD', level: 'ok' },
      { key: 'Open Graph', value: 'og:title, og:image 1200×630 · og:description missing', meta: '', level: 'warn' },
      { key: 'Timing', value: 'TTFB 142 ms · FCP 0.48 s · LCP 0.91 s', meta: 'this load', level: 'ok' },
    ];
  },
};

export const mockSiteInfo: SiteInfoService = {
  connection(_url, type) {
    if (type === 'cert' || type === 'insecure') {
      return [
        { key: 'Connection', value: 'Not secure — certificate expired', tone: 'danger' },
        { key: 'Certificate', value: 'Expired Apr 12, 2015', tone: 'danger' },
      ];
    }
    if (type === 'web') {
      return [
        { key: 'Connection', value: 'Secure · TLS 1.3 · HTTP/3', tone: 'ok' },
        { key: 'Certificate', value: "Valid until Jan 14, 2027 · issued by Let's Encrypt", tone: 'ink' },
        { key: 'Cookies', value: '6 in use · 3rd-party blocked', tone: 'ink' },
      ];
    }
    return [
      {
        key: 'Connection',
        value: type === 'dns' ? 'No connection made' : 'Built-in page · nothing loaded from the network',
        tone: 'ink2',
      },
    ];
  },
  trackersBlocked: () => 14,
  findInPage: (_url, q) => (q ? { current: 1, total: 4 } : { current: 0, total: 0 }),
};

// ---- AI providers ----------------------------------------------------------

export const aiProviders: AiProvidersService = {
  cloudStatus: () => 'API key not set',
  // This one is real: it checks for a local Ollama-compatible server.
  async probeLocalModel() {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1500);
    try {
      const r = await fetch('http://localhost:11434/api/tags', { signal: ctl.signal });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as { models?: unknown[] };
      const n = data.models?.length ?? 0;
      return `Detected · ${n} model${n === 1 ? '' : 's'}`;
    } catch {
      return 'Not detected at localhost:11434';
    } finally {
      clearTimeout(t);
    }
  },
};
