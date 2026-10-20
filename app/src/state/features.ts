// Feature state machines (VPN, tasks, assistant, downloads) on top of services.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type {
  AssistantService,
  ChatTurn,
  AutomationService,
  DownloadsService,
  SharedPage,
  TaskPlan,
  TaskResult,
  VpnService,
  VpnTunnelInfo,
} from '../services';

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

// ---- VPN -------------------------------------------------------------------

export type VpnStatus = 'off' | 'connecting' | 'on';

export function useVpn(svc: VpnService) {
  const [status, setStatus] = useState<VpnStatus>('off');
  const [region, setRegionState] = useState('DE');
  const [scope, setScope] = useState<'browser' | 'device'>('browser');
  const [tunnel, setTunnel] = useState<VpnTunnelInfo | null>(null);
  const ctl = useRef<AbortController | null>(null);

  const connect = useCallback(
    (code: string, reconnect = false) => {
      ctl.current?.abort();
      const c = new AbortController();
      ctl.current = c;
      setStatus('connecting');
      svc.connect(code, { signal: c.signal, reconnect }).then(
        (info) => {
          if (c.signal.aborted) return;
          setTunnel(info);
          setStatus('on');
        },
        (e) => {
          if (!isAbort(e)) setStatus('off');
        },
      );
    },
    [svc],
  );

  const toggle = useCallback(() => {
    if (status === 'off') connect(region);
    else {
      ctl.current?.abort();
      setTunnel(null);
      setStatus('off');
      void svc.disconnect();
    }
  }, [status, region, connect, svc]);

  const setRegion = useCallback(
    (code: string) => {
      setRegionState(code);
      if (status === 'on') connect(code, true);
    },
    [status, connect],
  );

  useEffect(() => () => ctl.current?.abort(), []);

  const regionName = (svc.regions.find((r) => r.code === region) || svc.regions[0]).name;
  return { status, region, regionName, scope, tunnel, toggle, setRegion, setScope };
}

// ---- Automation tasks ------------------------------------------------------

export type TaskStatus = 'idle' | 'planning' | 'approval' | 'running' | 'paused' | 'done' | 'cancelled';

export function useAutomation(svc: AutomationService, onFileCreated: (r: TaskResult) => void) {
  const [status, setStatus] = useState<TaskStatus>('idle');
  const [request, setRequest] = useState(svc.defaultRequest);
  const [plan, setPlan] = useState<TaskPlan | null>(null);
  /** Index of the step in progress; steps before it are finished. */
  const [step, setStep] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<TaskResult | null>(null);
  /** True while a step is executing; a pause takes effect once it finishes. */
  const [inFlight, setInFlight] = useState(false);
  const ctl = useRef<AbortController | null>(null);
  const paused = useRef(false);
  const resumeWaiters = useRef<(() => void)[]>([]);
  const onFile = useRef(onFileCreated);
  onFile.current = onFileCreated;

  // Elapsed time only counts while running, so pausing freezes the clock.
  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [status]);

  useEffect(() => () => ctl.current?.abort(), []);

  const makePlan = useCallback(async () => {
    ctl.current?.abort();
    const c = new AbortController();
    ctl.current = c;
    setStatus('planning');
    try {
      const p = await svc.plan(request, c.signal);
      setPlan(p);
      setStep(-1);
      setStatus('approval');
    } catch (e) {
      if (!isAbort(e)) setStatus('idle');
    }
  }, [svc, request]);

  const untilResumed = () =>
    paused.current ? new Promise<void>((r) => resumeWaiters.current.push(r)) : Promise.resolve();

  const approve = useCallback(async () => {
    if (!plan) return;
    const c = new AbortController();
    ctl.current = c;
    paused.current = false;
    setElapsed(0);
    setResult(null);
    setStep(0);
    setStatus('running');
    try {
      for (let i = 0; i < plan.steps.length; i++) {
        await untilResumed();
        if (c.signal.aborted) return;
        setStep(i);
        setInFlight(true);
        try {
          await svc.runStep(plan, i, c.signal);
        } finally {
          setInFlight(false);
        }
        setStep(i + 1);
      }
      const r = svc.result(plan);
      setResult(r);
      setStatus('done');
      onFile.current(r);
    } catch (e) {
      if (!isAbort(e)) setStatus('cancelled');
    }
  }, [plan, svc]);

  const togglePause = useCallback(() => {
    if (status === 'running') {
      paused.current = true;
      setStatus('paused');
    } else if (status === 'paused') {
      paused.current = false;
      setStatus('running');
      resumeWaiters.current.splice(0).forEach((r) => r());
    }
  }, [status]);

  const stop = useCallback(() => {
    ctl.current?.abort();
    paused.current = false;
    resumeWaiters.current.splice(0).forEach((r) => r());
    setStatus('cancelled');
  }, []);

  const reset = useCallback(() => {
    ctl.current?.abort();
    paused.current = false;
    resumeWaiters.current.splice(0).forEach((r) => r());
    setStatus('idle');
    setStep(-1);
  }, []);

  return { status, request, setRequest, plan, step, elapsed, result, inFlight, makePlan, approve, togglePause, stop, reset };
}

export type Automation = ReturnType<typeof useAutomation>;

// ---- Assistant chat --------------------------------------------------------

export interface ChatMessage {
  role: 'ai' | 'user';
  text: string;
  /** Error notes are shown but not sent back as conversation history. */
  error?: boolean;
}

export function useAssistant() {
  const [chat, setChat] = useState<ChatMessage[]>([
    { role: 'ai', text: 'Hi — I can summarize, compare or explain the pages you share with me. Pick pages above, or ask a question.' },
  ]);
  const [thinking, setThinking] = useState(false);
  const busy = useRef(false);

  const chatRef = useRef(chat);
  chatRef.current = chat;

  /** `getPages` runs after the question is shown, so reading page text doesn't delay the UI. */
  const send = useCallback(async (text: string, svc: AssistantService, getPages: () => Promise<SharedPage[]>) => {
    const q = (text || '').trim();
    if (!q || busy.current) return false;
    busy.current = true;
    // Earlier turns, without the canned greeting and error notes.
    const history: ChatTurn[] = chatRef.current
      .slice(1)
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));
    setChat((c) => c.concat({ role: 'user', text: q }));
    setThinking(true);
    try {
      const reply = await svc.ask(q, await getPages(), undefined, history);
      setChat((c) => c.concat({ role: 'ai', text: reply || '(The assistant returned an empty answer.)' }));
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : "The assistant couldn't answer. Check your connection and try again.";
      setChat((c) => c.concat({ role: 'ai', text: msg, error: true }));
    } finally {
      busy.current = false;
      setThinking(false);
    }
    return true;
  }, []);

  return { chat, thinking, send };
}

// ---- Downloads -------------------------------------------------------------

export function useDownloads(svc: DownloadsService) {
  return useSyncExternalStore(svc.subscribe, svc.list);
}
