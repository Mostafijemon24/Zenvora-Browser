import { hostOf } from '../../lib/url';
import { saveTextFile, toCsv } from '../../lib/saveFile';
import { isWebLike, useBrowser } from '../../state/browser';
import type { Level } from '../../services';

const DOT: Record<Level, string> = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-danger' };

export function SeoPanel() {
  const b = useBrowser();
  const host = hostOf(b.cur.url);
  const available = isWebLike(b.view);
  const rows = available ? b.services.pageAnalysis.analyze({ url: b.cur.url, title: b.cur.title }) : [];
  const base = `page-analysis-${host}`;

  return (
    <div className="panel-body" style={{ gap: 12 }}>
      <div className="note" style={{ fontSize: 12 }}>
        Inspected: this page only ({host}). Not a site crawl.
      </div>
      {available ? (
        <>
          <div className="stack">
            {rows.map((r) => (
              <div key={r.key} className="seo-row">
                <span className={'dot ' + DOT[r.level]} />
                <div className="body">
                  <div className="top">
                    <span className="k">{r.key}</span>
                    <span className="meta">{r.meta}</span>
                  </div>
                  <span className="v">{r.value}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="row-btns">
            <button
              type="button"
              className="btn md primary"
              onClick={() => saveTextFile(base + '.json', JSON.stringify({ url: b.cur.url, rows }, null, 2), 'application/json')}
            >
              Export JSON
            </button>
            <button
              type="button"
              className="btn md"
              onClick={() =>
                saveTextFile(base + '.csv', toCsv([['check', 'value', 'detail', 'level'], ...rows.map((r) => [r.key, r.value, r.meta, r.level])]), 'text/csv')
              }
            >
              Export CSV
            </button>
          </div>
        </>
      ) : (
        <div className="card empty-card">
          Open a web page to analyze it. Internal and error pages have nothing to inspect.
        </div>
      )}
    </div>
  );
}
