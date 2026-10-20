import { isNative } from '../../lib/native';
import { isWebLike, useBrowser } from '../../state/browser';
import { PANEL_TITLES } from '../chrome/Toolbar';
import { vpnTone } from '../chrome/Toolbar';
import { AssistantPanel } from './AssistantPanel';
import { DownloadsPanel } from './DownloadsPanel';
import { PrivacyPanel } from './PrivacyPanel';
import { SeoPanel } from './SeoPanel';
import { TasksPanel } from './TasksPanel';
import { VpnPanel } from './VpnPanel';

const TASK_LABELS = {
  idle: 'Ready',
  planning: 'Planning',
  approval: 'Awaiting approval',
  running: 'Running',
  paused: 'Paused',
  done: 'Completed',
  cancelled: 'Cancelled',
};

function useChip(): { text: string; bg?: string; fg?: string } {
  const b = useBrowser();
  switch (b.panel) {
    case 'auto': {
      const st = b.automation.status;
      if (st === 'running') return { text: TASK_LABELS[st], bg: 'var(--accent-soft)', fg: 'var(--accent)' };
      if (st === 'done') return { text: TASK_LABELS[st], fg: 'var(--ok)' };
      return { text: TASK_LABELS[st] };
    }
    case 'ai':
      return { text: b.sharedTabs.length + ' shared' };
    case 'vpn':
      return { text: b.vpn.status === 'on' ? 'Protected' : b.vpn.status === 'connecting' ? 'Connecting' : 'Off', fg: vpnTone(b.vpn.status) };
    case 'privacy':
      if (b.view === 'cert' || b.view === 'insecure') return { text: 'At risk', fg: 'var(--danger)' };
      return { text: isWebLike(b.view) ? `${b.services.siteInfo.trackersBlocked(b.cur.url)} trackers blocked` : '—' };
    case 'seo':
      return { text: 'Current page' };
    case 'downloads': {
      const n = b.downloads.filter((d) => d.state === 'active' || d.state === 'paused').length;
      return { text: n ? `${n} active` : 'Idle' };
    }
    default:
      return { text: '' };
  }
}

export function SidePanel() {
  const b = useBrowser();
  const chip = useChip();
  if (!b.panel) return null;
  return (
    <aside className="panel" aria-label={PANEL_TITLES[b.panel]}>
      <div className="panel-head">
        <h2>{PANEL_TITLES[b.panel]}</h2>
        <span className="panel-chip" style={{ background: chip.bg, color: chip.fg }}>
          {chip.text}
        </span>
        <button type="button" className="panel-close" title="Close panel" aria-label="Close panel" onClick={() => b.showPanel(null)}>
          ×
        </button>
      </div>
      {isNative && !(b.panel === 'ai' && b.aiConnected) && (
        <div className="demo-notice" role="note">
          {b.panel === 'ai'
            ? 'The assistant isn\'t connected yet. Add your assistant server in Settings → AI & automation.'
            : 'Preview: this panel shows sample data. It isn\'t connected to a real service yet.'}
        </div>
      )}
      {b.panel === 'ai' && <AssistantPanel />}
      {b.panel === 'auto' && <TasksPanel />}
      {b.panel === 'vpn' && <VpnPanel />}
      {b.panel === 'privacy' && <PrivacyPanel />}
      {b.panel === 'seo' && <SeoPanel />}
      {b.panel === 'downloads' && <DownloadsPanel />}
    </aside>
  );
}
