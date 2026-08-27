const { contextBridge, ipcRenderer } = require('electron');

// Expõe APIs seguras para a interface Web do Concord
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  setSelectedSourceId: (sourceId) => ipcRenderer.invoke('set-selected-source-id', sourceId),
  onUpdaterMessage: (callback) => ipcRenderer.on('updater-message', (_event, value) => callback(value))
});
