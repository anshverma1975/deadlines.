const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApp', {
  platform:    process.platform,
  minimize:    () => ipcRenderer.send('win-minimize'),
  maximize:    () => ipcRenderer.send('win-maximize'),
  close:       () => ipcRenderer.send('win-close'),
  isMaximized: () => ipcRenderer.invoke('win-is-maximized'),
  openOAuth:   (url) => ipcRenderer.send('open-oauth', url),
  // Native OS notification — bypasses browser notification limits
  notify:      (title, body) => ipcRenderer.send('notify', { title, body }),
});
