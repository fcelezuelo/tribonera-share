const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs seguras para a interface Web do Concord
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  onUpdaterMessage: (callback) => ipcRenderer.on('updater-message', (_event, value) => callback(value))
});
