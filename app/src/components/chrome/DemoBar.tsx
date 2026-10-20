import { useBrowser, useShortcutLabels } from '../../state/browser';
import { Segmented, opts } from '../ui/Segmented';

/** Designer controls for previewing platforms, layouts, themes and error pages. */
export function DemoBar() {
  const b = useBrowser();
  const { mod } = useShortcutLabels();
  const s = b.settings;
  return (
    <div className="demo-bar">
      <div className="demo-brand">
        <i />
        Zenvora · preview
      </div>
      <div className="demo-group">
        Platform
        <Segmented
          variant="demo"
          label="Platform"
          options={opts([['mac', 'macOS'], ['win', 'Windows'], ['linux', 'Linux']])}
          value={s.platform}
          onChange={(platform) => b.updateSettings({ platform })}
        />
      </div>
      <div className="demo-group">
        Tabs
        <Segmented
          variant="demo"
          label="Tab layout"
          options={opts([['top', 'Horizontal'], ['side', 'Vertical']])}
          value={s.layout}
          onChange={(layout) => b.updateSettings({ layout })}
        />
      </div>
      <div className="demo-group">
        Theme
        <Segmented
          variant="demo"
          label="Theme"
          options={opts([['light', 'Light'], ['dark', 'Dark']])}
          value={b.themeAttr}
          onChange={(theme) => b.updateSettings({ theme })}
        />
      </div>
      <div className="demo-group">
        Error pages
        <button type="button" className="outline-btn" onClick={() => b.navigate('https://zenvora-docs.invalid/')}>
          DNS
        </button>
        <button type="button" className="outline-btn" onClick={() => b.navigate('https://expired.badssl.com/')}>
          Certificate
        </button>
      </div>
      <div className="demo-keys">
        {mod}T new · {mod}W close · {mod}L address · {mod}K tabs · {mod}F find
      </div>
    </div>
  );
}
