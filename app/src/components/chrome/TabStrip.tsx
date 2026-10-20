import { useBrowser } from '../../state/browser';
import { WORKSPACES, wsTabs } from '../../state/tabs';
import { Segmented } from '../ui/Segmented';
import type { Tab } from '../../state/tabs';
import { Favicon } from '../ui/Favicon';
import { CaptionButtons, TrafficLights } from '../ui/WindowControls';

function TabButtons({ tab, compact }: { tab: Tab; compact: boolean }) {
  const b = useBrowser();
  return (
    <>
      {tab.audio && (
        <button
          type="button"
          className="tab-audio"
          title={tab.muted ? 'Unmute tab' : 'Mute tab'}
          aria-label={tab.muted ? 'Unmute tab' : 'Mute tab'}
          onClick={(e) => {
            e.stopPropagation();
            b.dispatch({ type: 'toggleMute', id: tab.id });
          }}
        >
          {tab.muted ? '♪̸' : '♪'}
        </button>
      )}
      {!compact && (
        <button
          type="button"
          className="tab-close"
          title="Close tab"
          aria-label={`Close ${tab.title}`}
          onClick={(e) => {
            e.stopPropagation();
            b.closeTab(tab.id);
          }}
        >
          ×
        </button>
      )}
    </>
  );
}

/** Horizontal title bar: window controls, workspace switch and tabs. */
export function TabStrip() {
  const b = useBrowser();
  const p = b.settings.platform;
  return (
    <div className="titlebar">
      {p === 'mac' && <TrafficLights />}
      <button type="button" className="ws-btn" title="Workspaces & tab search" onClick={b.openSearch}>
        <i />
        {b.tabs.ws}
      </button>
      <div className="tabstrip" role="tablist" aria-label="Tabs">
        {wsTabs(b.tabs).map((t) => {
          const active = t.id === b.cur.id;
          return (
            <div
              key={t.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              title={t.title}
              className={'tab' + (active ? ' active' : '') + (t.pinned ? ' pinned' : '')}
              onClick={() => b.activate(t.id)}
              onKeyDown={(e) => e.key === 'Enter' && b.activate(t.id)}
              onAuxClick={(e) => e.button === 1 && b.closeTab(t.id)}
            >
              <Favicon url={t.url} />
              {!t.pinned && <span className="tab-title">{t.title}</span>}
              {t.loading && <span className="tab-loading" />}
              <TabButtons tab={t} compact={!!t.pinned} />
            </div>
          );
        })}
        <button type="button" className="newtab-btn" title="New tab" aria-label="New tab" onClick={() => b.newTab()}>
          +
        </button>
      </div>
      {p !== 'mac' && <CaptionButtons platform={p} />}
    </div>
  );
}

/** Vertical tabs sidebar. */
export function Sidebar() {
  const b = useBrowser();
  const mod = b.settings.platform === 'mac' ? '⌘' : 'Ctrl+';
  return (
    <div className="sidebar">
      {b.settings.platform === 'mac' && <TrafficLights side />}
      <WorkspaceSeg />
      <button type="button" className="side-search" onClick={b.openSearch}>
        Search tabs<kbd>{mod}K</kbd>
      </button>
      <div className="side-list" role="tablist" aria-orientation="vertical" aria-label="Tabs">
        {wsTabs(b.tabs).map((t) => {
          const active = t.id === b.cur.id;
          return (
            <div
              key={t.id}
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              className={'side-tab' + (active ? ' active' : '')}
              onClick={() => b.activate(t.id)}
              onKeyDown={(e) => e.key === 'Enter' && b.activate(t.id)}
              onAuxClick={(e) => e.button === 1 && b.closeTab(t.id)}
            >
              <Favicon url={t.url} />
              <span className="tab-title">{t.title}</span>
              <TabButtons tab={t} compact={false} />
            </div>
          );
        })}
      </div>
      <button type="button" className="side-new" onClick={() => b.newTab()}>
        <span>+</span>New tab
      </button>
    </div>
  );
}


export function WorkspaceSeg() {
  const b = useBrowser();
  return (
    <Segmented
      variant="ws"
      label="Workspace"
      options={WORKSPACES.map((w) => ({ value: w, label: w }))}
      value={b.tabs.ws}
      onChange={b.setWorkspace}
    />
  );
}
