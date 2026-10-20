// Zenvora desktop shell (Electron main process).
// The UI is the Vite build in ../dist; web pages run in sandboxed <webview>s.

const { app, BrowserWindow, Menu, ipcMain, session, shell } = require('electron');
const path = require('node:path');

const isMac = process.platform === 'darwin';
const DEV_URL = process.env.ZENVORA_DEV_URL; // e.g. http://localhost:5173 for live reload
const PARTITION = 'persist:zenvora';

// Hosts the user chose to open despite a certificate error (this run only).
const allowedCertHosts = new Set();

let win = null;

function send(channel, ...args) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, ...args);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#f2eee7',
    title: 'Zenvora',
    // macOS keeps its native traffic lights, positioned to match the design;
    // Windows and Linux use the caption buttons drawn by the UI.
    ...(isMac ? { titleBarStyle: 'hidden', trafficLightPosition: { x: 14, y: 15 } } : { frame: false }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => win.show());
  win.on('maximize', () => send('win:maximized', true));
  win.on('unmaximize', () => send('win:maximized', false));
  win.on('closed', () => (win = null));

  // The UI itself never navigates away from the app bundle.
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  if (DEV_URL) win.loadURL(DEV_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}

// ---- web content hardening ----

app.on('web-contents-created', (_e, contents) => {
  // Every <webview> gets locked-down preferences, whatever the page asked for.
  contents.on('will-attach-webview', (event, prefs, params) => {
    delete prefs.preload;
    prefs.nodeIntegration = false;
    prefs.nodeIntegrationInSubFrames = false;
    prefs.contextIsolation = true;
    prefs.sandbox = true;
    prefs.webSecurity = true;
    params.partition = PARTITION;
    if (!/^https?:\/\//i.test(params.src || '')) event.preventDefault();
  });

  if (contents.getType() === 'webview') {
    // Links that open a new window become a new tab instead.
    contents.setWindowOpenHandler(({ url }) => {
      if (/^https?:\/\//i.test(url)) send('tab:open', url);
      return { action: 'deny' };
    });
    // Non-web schemes (mailto:, tel:, zoom: …) go to the OS, never into the page.
    contents.on('will-navigate', (e, url) => {
      if (!/^(https?|about|data|blob):/i.test(url)) {
        e.preventDefault();
        if (/^(mailto|tel):/i.test(url)) shell.openExternal(url);
      }
    });
  }
});

app.on('certificate-error', (event, _contents, url, _error, _cert, callback) => {
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {}
  if (allowedCertHosts.has(host)) {
    event.preventDefault();
    callback(true);
  } else {
    callback(false); // default: block, the UI shows its certificate error page
  }
});

// ---- IPC from the UI (validated) ----

ipcMain.on('win:minimize', () => win?.minimize());
ipcMain.on('win:toggleMaximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
ipcMain.on('win:close', () => win?.close());
ipcMain.on('win:buttonPosition', (_e, pos) => {
  if (!isMac || !win) return;
  const x = Number(pos?.x);
  const y = Number(pos?.y);
  if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x < 200 && y >= 0 && y < 200) {
    win.setWindowButtonPosition({ x: Math.round(x), y: Math.round(y) });
  }
});
ipcMain.on('cert:allow', (_e, host) => {
  if (typeof host === 'string' && /^[a-z0-9.-]{1,253}$/i.test(host)) allowedCertHosts.add(host.toLowerCase());
});

// ---- menu: standard editing roles + browser commands ----
// Accelerators live here (not in the page) so they also work while a web page has focus.

function buildMenu() {
  const cmd = (label, accelerator, name) => ({ label, accelerator, click: () => send('cmd', name) });
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        cmd('New Tab', 'CmdOrCtrl+T', 'newTab'),
        cmd('Reopen Closed Tab', 'CmdOrCtrl+Shift+T', 'reopen'),
        cmd('Close Tab', 'CmdOrCtrl+W', 'closeTab'),
        { type: 'separator' },
        cmd('Open Location…', 'CmdOrCtrl+L', 'focusAddress'),
        cmd('Search Tabs…', 'CmdOrCtrl+K', 'searchTabs'),
        cmd('Settings', 'CmdOrCtrl+,', 'settings'),
        ...(isMac ? [] : [{ type: 'separator' }, { role: 'quit' }]),
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        cmd('Find in Page', 'CmdOrCtrl+F', 'find'),
        cmd('Reload', 'CmdOrCtrl+R', 'reload'),
        cmd('Back', isMac ? 'Cmd+[' : 'Alt+Left', 'back'),
        cmd('Forward', isMac ? 'Cmd+]' : 'Alt+Right', 'forward'),
        { type: 'separator' },
        cmd('Zoom In', 'CmdOrCtrl+=', 'zoomIn'),
        cmd('Zoom Out', 'CmdOrCtrl+-', 'zoomOut'),
        cmd('Actual Size', 'CmdOrCtrl+0', 'zoomReset'),
        { type: 'separator' },
        cmd('Developer Tools for Page', isMac ? 'Alt+Cmd+I' : 'Ctrl+Shift+I', 'devtools'),
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---- lifecycle ----

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    // No site gets camera, mic, location etc. silently; the UI's permission
    // controls are not wired to the engine yet, so everything is denied.
    session.fromPartition(PARTITION).setPermissionRequestHandler((_wc, permission, cb) => {
      cb(permission === 'fullscreen' || permission === 'clipboard-sanitized-write');
    });
    buildMenu();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
