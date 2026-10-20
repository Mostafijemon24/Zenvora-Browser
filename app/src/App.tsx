import { DemoBar } from './components/chrome/DemoBar';
import { Window } from './components/chrome/Window';
import { isNative } from './lib/native';
import { BrowserProvider, useBrowser } from './state/browser';

/** The designer's control bar shows in the web preview unless the URL has ?demo=0. */
function demoBarEnabled() {
  if (isNative) return false;
  try {
    return new URLSearchParams(location.search).get('demo') !== '0';
  } catch {
    return true;
  }
}

function Desk() {
  const b = useBrowser();
  return (
    <div className={isNative ? 'desk native' : 'desk'} data-theme={b.themeAttr} data-accent={b.settings.accent}>
      {demoBarEnabled() && <DemoBar />}
      <Window />
    </div>
  );
}

export default function App() {
  return (
    <BrowserProvider>
      <Desk />
    </BrowserProvider>
  );
}
