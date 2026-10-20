import { useBrowser } from '../../state/browser';
import type { Download } from '../../services';

const mb = (n: number) => n.toFixed(1);

interface View {
  status: string;
  tone: string;
  bar: boolean;
  warn: boolean;
  actions: { label: string; tone?: string; run: () => void }[];
}

export function DownloadsPanel() {
  const b = useBrowser();
  const svc = b.services.downloads;

  const view = (d: Download): View => {
    const openReveal = [
      { label: 'Open', run: () => svc.open(d.id) },
      { label: 'Show in folder', run: () => svc.reveal(d.id) },
    ];
    switch (d.state) {
      case 'active':
        return {
          status: `${d.receivedMb} of ${mb(d.sizeMb)} MB · 1.0 MB/s · ${Math.ceil(d.sizeMb - d.receivedMb)} s left`,
          tone: 'c-ink3',
          bar: true,
          warn: false,
          actions: [
            { label: 'Pause', run: () => svc.pause(d.id) },
            { label: 'Cancel', tone: 'c-danger', run: () => svc.cancel(d.id) },
          ],
        };
      case 'paused':
        return {
          status: `Paused · ${d.receivedMb} of ${mb(d.sizeMb)} MB`,
          tone: 'c-ink3',
          bar: true,
          warn: false,
          actions: [
            { label: 'Resume', run: () => svc.resume(d.id) },
            { label: 'Cancel', tone: 'c-danger', run: () => svc.cancel(d.id) },
          ],
        };
      case 'done':
        return {
          status: d.note || `${mb(d.sizeMb)} MB · Completed`,
          tone: d.note ? 'c-ok' : 'c-ink3',
          bar: false,
          warn: false,
          actions: openReveal,
        };
      case 'held':
        return {
          status: 'Held · executable from an unverified publisher',
          tone: 'c-warn',
          bar: false,
          warn: true,
          actions: [
            { label: 'Delete', tone: 'c-danger', run: () => svc.remove(d.id) },
            { label: 'Keep anyway', run: () => svc.keep(d.id) },
          ],
        };
      case 'kept':
        return {
          status: `${mb(d.sizeMb)} MB · Kept · not opened`,
          tone: 'c-ink3',
          bar: false,
          warn: false,
          actions: [{ label: 'Show in folder', run: () => svc.reveal(d.id) }],
        };
      case 'failed':
      case 'cancelled':
        return {
          status: d.state === 'failed' ? `Failed · ${d.note || 'download error'}` : `Cancelled · ${d.receivedMb} of ${mb(d.sizeMb)} MB`,
          tone: d.state === 'failed' ? 'c-danger' : 'c-ink3',
          bar: false,
          warn: false,
          actions: [
            { label: 'Retry', run: () => svc.retry(d.id) },
            { label: 'Remove', tone: 'c-ink2', run: () => svc.remove(d.id) },
          ],
        };
    }
  };

  return (
    <div className="panel-body dl">
      {b.downloads.map((d) => {
        const v = view(d);
        return (
          <div key={d.id} className={v.warn ? 'card dl-item warn' : 'card dl-item'}>
            <div className="head">
              <span className="ext">{d.ext}</span>
              <div className="info">
                <span className="name">{d.name}</span>
                <span className={'status ' + v.tone}>{v.status}</span>
              </div>
            </div>
            {v.bar && (
              <div
                className="dl-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((d.receivedMb / d.sizeMb) * 100)}
              >
                <div style={{ width: ((d.receivedMb / d.sizeMb) * 100).toFixed(1) + '%' }} />
              </div>
            )}
            <div className="actions">
              {v.actions.map((a) => (
                <button key={a.label} type="button" className={'btn xs ' + (a.tone || 'c-ink')} onClick={a.run}>
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
      <div className="dl-foot">Saving to ~/Downloads · files are never opened automatically</div>
    </div>
  );
}
