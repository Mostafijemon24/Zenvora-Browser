import { hostOf, isInternal } from '../../lib/url';
import { useBrowser } from '../../state/browser';
import type { PermValue } from '../../state/browser';
import { Segmented, opts } from '../ui/Segmented';

const NEXT: Record<PermValue, PermValue> = { Ask: 'Allow', Allow: 'Block', Block: 'Ask' };
const TONE: Record<PermValue, string> = { Ask: 'var(--ink2)', Allow: 'var(--ok)', Block: 'var(--danger)' };
const TRACK_NOTE = {
  basic: 'Blocks known malware and cryptominers only.',
  balanced: 'Blocks cross-site trackers and third-party cookies. Recommended.',
  strict: 'Also blocks fingerprinting scripts. Some sites may break — you can relax it per site.',
};
const TONE_CLASS = { ok: 'c-ok', danger: 'c-danger', ink: 'c-ink', ink2: 'c-ink2' };

export function PrivacyPanel() {
  const b = useBrowser();
  const host = isInternal(b.cur.url) ? 'Zenvora page' : hostOf(b.cur.url);
  const rows = b.services.siteInfo.connection(b.cur.url, b.view);
  const perms = b.permsFor(host);

  return (
    <div className="panel-body">
      <div className="card site-card">
        <strong>{host}</strong>
        {rows.map((r) => (
          <div key={r.key} className="row">
            <span>{r.key}</span>
            <span className={TONE_CLASS[r.tone]}>{r.value}</span>
          </div>
        ))}
      </div>
      <div className="stack" style={{ gap: 2 }}>
        <div className="caps" style={{ paddingBottom: 6 }}>
          Permissions for this site
        </div>
        {Object.entries(perms).map(([k, v]) => (
          <div key={k} className="perm-row">
            <span>{k}</span>
            <button
              type="button"
              title="Change"
              aria-label={`${k}: ${v}. Change`}
              style={{ color: TONE[v] }}
              onClick={() => b.setPerm(host, k, NEXT[v])}
            >
              {v}
            </button>
          </div>
        ))}
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <div className="caps">Tracking protection</div>
        <Segmented
          variant="fill"
          label="Tracking protection"
          options={opts([['basic', 'Basic'], ['balanced', 'Balanced'], ['strict', 'Strict']])}
          value={b.settings.tracking}
          onChange={(tracking) => b.updateSettings({ tracking })}
        />
        <div className="track-note">{TRACK_NOTE[b.settings.tracking]}</div>
      </div>
      <div className="row-btns">
        <button type="button" className="btn md" onClick={() => b.clearSiteData(host)}>
          Clear site data
        </button>
        <button type="button" className="btn md" onClick={b.openSettings}>
          Clear browsing data…
        </button>
      </div>
    </div>
  );
}
