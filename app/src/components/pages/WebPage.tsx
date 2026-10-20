import { hostOf } from '../../lib/url';
import { useBrowser } from '../../state/browser';

/**
 * Stand-in for rendered web content. In the desktop build this area hosts
 * the engine's view (e.g. an Electron WebContentsView) at the tab's zoom.
 */
export function WebPage() {
  const b = useBrowser();
  return (
    <div className="web-ph">
      <div>
        <span>web content · {hostOf(b.cur.url)}</span>
        <span>zoom {b.zoom}%</span>
        {b.view === 'insecure' && <span className="unsafe">loaded despite certificate error</span>}
      </div>
    </div>
  );
}
