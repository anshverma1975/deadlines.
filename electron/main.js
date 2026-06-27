const { app, BrowserWindow, shell, Menu, nativeTheme, ipcMain, Notification } = require('electron');
const path = require('path');

let win;

// ── Single instance + custom protocol ────────────────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('deadlines', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('deadlines');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  // Windows: second instance launched with deadlines:// URL as argument
  app.on('second-instance', (event, argv) => {
    const url = argv.find(arg => arg.startsWith('deadlines://'));
    if (url) handleOAuthRedirect(url);
    if (win) { win.show(); win.focus(); }
  });
}

function handleOAuthRedirect(url) {
  win?.webContents.executeJavaScript(
    `window.handleOAuthRedirect(${JSON.stringify(url)})`
  );
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  nativeTheme.themeSource = 'dark';

  win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 780,
    minHeight: 520,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: false,
    backgroundColor: '#080c0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
  });

  win.once('ready-to-show', () => win.show());
  win.loadURL('https://deadlines-ruby.vercel.app');

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  buildMenu();
}

// ── Native notifications via Electron ────────────────────────────────────────
ipcMain.on('notify', (event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({
      title,
      body,
      icon: path.join(__dirname, '../assets/icon.png'),
      silent: false,
    }).show();
  }
});

// ── Window controls ───────────────────────────────────────────────────────────
ipcMain.on('win-minimize',  () => win?.minimize());
ipcMain.on('win-maximize',  () => win?.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('win-close',     () => win?.close());
ipcMain.handle('win-is-maximized', () => win?.isMaximized() ?? false);

// ── OAuth: open sign-in in system browser ─────────────────────────────────────
ipcMain.on('open-oauth', (event, url) => shell.openExternal(url));

// ── Menu ──────────────────────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [
      { role: 'about' }, { type: 'separator' },
      { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
      { type: 'separator' }, { role: 'quit' },
    ]}] : []),
    { label: 'Edit', submenu: [
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    ]},
    { label: 'View', submenu: [
      { role: 'reload' }, { type: 'separator' },
      { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
      { type: 'separator' }, { role: 'togglefullscreen' },
      ...(process.env.NODE_ENV === 'development'
        ? [{ type: 'separator' }, { role: 'toggleDevTools' }] : []),
    ]},
    { label: 'Window', submenu: [
      { role: 'minimize' }, { role: 'zoom' },
      ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [{ role: 'close' }]),
    ]},
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
