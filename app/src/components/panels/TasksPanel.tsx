import { useState } from 'react';
import { useBrowser } from '../../state/browser';
import type { Automation } from '../../state/features';

const fmt = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
const stamp = (n: number) => `00:${String(n).padStart(2, '0')}`;

function auditLog(a: Automation): string[] {
  if (!a.plan) return [];
  const steps = a.plan.steps;
  const done = Math.min(a.step, steps.length);
  return [
    `00:00  request received · plan v1 (${steps.length} steps)`,
    `00:00  approved by user · scope: ${a.plan.scopeSummary}`,
    ...steps.slice(0, done).map((st, i) => `${stamp(i + 1)}  ${st.t.toLowerCase()} · ok${st.note ? ' after retry' : ''}`),
    ...(a.status === 'cancelled' ? [`${stamp(a.step + 1)}  stopped by user · no further actions`] : []),
  ];
}

export function TasksPanel() {
  const b = useBrowser();
  const a = b.automation;
  const [audit, setAudit] = useState(false);
  const steps = a.plan?.steps || [];
  const planned = a.status === 'approval';
  const active = a.status === 'running' || a.status === 'paused';

  const progress =
    a.status === 'approval'
      ? `Plan · ${steps.length} steps`
      : a.status === 'done'
        ? `All ${steps.length} steps completed`
        : a.status === 'cancelled'
          ? `Stopped at step ${a.step + 1} of ${steps.length}`
          : `Step ${Math.min(a.step + 1, steps.length)} of ${steps.length}${a.status === 'paused' ? (a.inFlight ? ' · pausing after this step' : ' · paused') : ''}`;

  const reset = () => {
    setAudit(false);
    a.reset();
  };
  const auditBtn = (
    <button type="button" className="btn sm" aria-expanded={audit} onClick={() => setAudit(!audit)}>
      {audit ? 'Hide audit trail' : 'Audit trail'}
    </button>
  );

  return (
    <div className="panel-body">
      {a.status === 'idle' && (
        <div className="stack" style={{ gap: 10 }}>
          <div className="task-intro">
            Describe a task. Zenvora writes a plan, shows exactly what it will touch, and waits for your approval.
          </div>
          <textarea
            className="task-input"
            aria-label="Task description"
            rows={4}
            value={a.request}
            onChange={(e) => a.setRequest(e.target.value)}
          />
          <button
            type="button"
            className="btn primary"
            style={{ alignSelf: 'flex-start' }}
            disabled={!a.request.trim()}
            onClick={() => {
              setAudit(false);
              void a.makePlan();
            }}
          >
            Create plan
          </button>
          <div className="caps" style={{ paddingTop: 6 }}>
            Try
          </div>
          {b.services.automation.examples.map((ex) => (
            <button key={ex} type="button" className="task-example" onClick={() => a.setRequest(ex)}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {a.status === 'planning' && (
        <div className="card task-planning" role="status">
          <strong>Planning…</strong>
          <span>Reading your request and resolving which sites and permissions are needed.</span>
        </div>
      )}

      {a.plan && !['idle', 'planning'].includes(a.status) && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="task-request">{a.plan.request}</div>
          {planned && (
            <div className="task-perms">
              <strong>This task will</strong>
              {a.plan.permissions.map((p) => (
                <div key={p}>· {p}</div>
              ))}
            </div>
          )}
          <div className="task-progress">
            <span>{progress}</span>
            <span className="mono">{planned ? '' : fmt(a.elapsed) + ' elapsed'}</span>
          </div>
          <ol className="stack" style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {steps.map((st, i) => {
              const done = !planned && i < a.step;
              const run = !planned && i === a.step && active;
              const stopped = a.status === 'cancelled' && i >= a.step;
              const lit = done || run || planned;
              return (
                <li key={i} className="step">
                  <span className={'step-mark' + (done ? ' done' : run ? ' run' : stopped ? ' stopped' : '')} aria-hidden="true">
                    {done ? '✓' : stopped ? '–' : ''}
                  </span>
                  <div className="step-text">
                    <span className={lit ? 't lit' : 't'}>{st.t}</span>
                    <span className="d">{st.d}</span>
                    {st.note && done && <span className="n">{st.note}</span>}
                  </div>
                </li>
              );
            })}
          </ol>

          {planned && (
            <div className="row-btns">
              <button type="button" className="btn primary" onClick={() => void a.approve()}>
                Approve &amp; run
              </button>
              <button type="button" className="btn" onClick={reset}>
                Edit request
              </button>
            </div>
          )}

          {active && (
            <div className="row-btns">
              <button type="button" className="btn" onClick={a.togglePause}>
                {a.status === 'paused' ? 'Resume' : 'Pause'}
              </button>
              <button type="button" className="btn danger-text" onClick={a.stop}>
                Stop task
              </button>
            </div>
          )}

          {a.status === 'done' && a.result && (
            <div className="card task-result">
              <strong>Result · {a.result.fileName}</strong>
              <div className="grid">
                <span className="h">{a.result.columns[0]}</span>
                <span className="h">{a.result.columns[1]}</span>
                <span className="h r">{a.result.columns[2]}</span>
                {a.result.rows.map(([v, p, price]) => (
                  <Row3 key={v} v={v} p={p} price={price} />
                ))}
              </div>
              <div className="note">{a.result.summary}</div>
              <div className="row-btns">
                <button type="button" className="btn sm primary" onClick={() => b.showPanel('downloads')}>
                  Open file
                </button>
                {auditBtn}
                <button type="button" className="btn sm" onClick={reset}>
                  New task
                </button>
              </div>
            </div>
          )}

          {a.status === 'cancelled' && (
            <div className="card task-result">
              <strong>Task stopped</strong>
              <p>
                {Math.max(0, a.step)} of {steps.length} steps finished before you stopped the task. No partial file was
                written. Open tabs were left as they were.
              </p>
              <div className="row-btns">
                {auditBtn}
                <button type="button" className="btn sm" onClick={reset}>
                  New task
                </button>
              </div>
            </div>
          )}

          {audit && (a.status === 'done' || a.status === 'cancelled') && (
            <div className="audit">
              {auditLog(a).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row3({ v, p, price }: { v: string; p: string; price: string }) {
  return (
    <>
      <span>{v}</span>
      <span className="p">{p}</span>
      <span className="price">{price}</span>
    </>
  );
}
