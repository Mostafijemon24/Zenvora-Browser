import { titleFor } from '../../lib/url';
import { useBrowser } from '../../state/browser';
import { WORKSPACES, wsTabs } from '../../state/tabs';
import { Favicon } from '../ui/Favicon';

const SHORTCUTS: [string, string][] = [
  ['github.com/zenvora', 'GitHub'],
  ['figma.com', 'Figma'],
  ['news.ycombinator.com', 'HN'],
  ['wordpress.org', 'WordPress'],
  ['mail.proton.me', 'Mail'],
  ['developer.mozilla.org', 'MDN'],
];

// Demo history. A real build reads this from the history store.
const RECENT: [string, string][] = [
  ['https://stripe.com/pricing', '2 min'],
  ['https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API', '14 min'],
  ['https://dhakadental.example/', '1 h'],
  ['https://wordpress.org/plugins/', 'Yesterday'],
];

const TRACKING_LABEL = { basic: 'Basic', balanced: 'Balanced', strict: 'Strict' };

export function NewTabPage({ vpnLabel }: { vpnLabel: string }) {
  const b = useBrowser();
  const ask = () => {
    b.showPanel('ai');
    if (b.ntq.trim()) void b.ask(b.ntq);
  };
  return (
    <div className="ntp">
      <div className="ntp-inner">
        <div className="ntp-hero">
          <div className="ntp-logo">Zenvora</div>
          <div className="ntp-search">
            <input
              aria-label="Search the web or type a URL"
              value={b.ntq}
              placeholder="Search the web or type a URL"
              onChange={(e) => b.setNtq(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && b.navigate(e.currentTarget.value)}
            />
            <button type="button" onClick={ask}>
              Ask Assistant
            </button>
          </div>
        </div>

        <div className="ntp-shortcuts">
          {SHORTCUTS.map(([u, label]) => (
            <button key={u} type="button" className="ntp-shortcut" onClick={() => b.navigate(u)}>
              <Favicon url={'https://' + u} large />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="ntp-cols">
          <div className="ntp-col">
            <div className="caps">Workspaces</div>
            {WORKSPACES.map((w) => (
              <button
                key={w}
                type="button"
                className={w === b.tabs.ws ? 'ws-card on' : 'ws-card'}
                onClick={() => b.setWorkspace(w)}
              >
                <i />
                <span className="name">{w}</span>
                <span className="count">{wsTabs(b.tabs, w).length} tabs</span>
              </button>
            ))}
          </div>
          <div className="ntp-col">
            <div className="caps">Recently visited</div>
            {RECENT.map(([u, when]) => (
              <button key={u} type="button" className="recent-row" onClick={() => b.navigate(u)}>
                <Favicon url={u} />
                <span className="t">{titleFor(u)}</span>
                <span className="w">{when}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="ntp-foot">
          <span>Tracking protection · {TRACKING_LABEL[b.settings.tracking]}</span>
          <span>VPN · {vpnLabel}</span>
          <button type="button" className="link-btn" onClick={b.openSettings}>
            Customize this page
          </button>
        </div>
      </div>
    </div>
  );
}
