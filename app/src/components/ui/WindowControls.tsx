import { native } from '../../lib/native';
import type { Platform } from '../../state/settings';

// Window buttons drawn by the app (macOS uses native traffic lights).
// In the desktop app these call minimize/maximize/close over IPC.

export function TrafficLights({ side }: { side?: boolean }) {
  // The desktop app shows the real macOS buttons here; keep their space.
  return (
    <div className={(side ? 'traffic side' : 'traffic') + (native ? ' native' : '')} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
}

export function CaptionButtons({ platform, inToolbar }: { platform: Exclude<Platform, 'mac'>; inToolbar?: boolean }) {
  const cls = (platform === 'win' ? 'winctl' : 'linctl') + (inToolbar ? ' in-toolbar' : '');
  return (
    <div className={cls}>
      <button type="button" title="Minimize" aria-label="Minimize" onClick={() => native?.minimize()}>─</button>
      <button type="button" title="Maximize" aria-label="Maximize" onClick={() => native?.toggleMaximize()}>☐</button>
      <button type="button" title="Close" aria-label="Close window" onClick={() => native?.close()}>✕</button>
    </div>
  );
}
