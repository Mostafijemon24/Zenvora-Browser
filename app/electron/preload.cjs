// Exposes a small, fixed API to the UI. Web pages never get this preload.
const { contextBridge, ipcRenderer } = require('electron');

const PLATFORMS = { darwin: 'mac', win32: 'win' };

function on(channel, cb) {
  const fn = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, fn);
  return () => ipcRenderer.removeListener(channel, fn);
}

contextBridge.exposeInMainWorld('zenvora', {
  platform: PLATFORMS[process.platform] || 'linux',
  minimize: () => ipcRenderer.send('win:minimize'),
  toggleMaximize: () => ipcRenderer.send('win:toggleMaximize'),
  close: () => ipcRenderer.send('win:close'),
  setButtonPosition: (x, y) => ipcRenderer.send('win:buttonPosition', { x, y }),
  allowCertHost: (host) => ipcRenderer.send('cert:allow', String(host)),
  onCommand: (cb) => on('cmd', (name) => cb(String(name))),
  onOpenTab: (cb) => on('tab:open', (url) => cb(String(url))),
});
