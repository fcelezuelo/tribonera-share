const { contextBridge, ipcRenderer } = require('electron');
 
// Expõe APIs seguras para a interface Web do Concord
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
  selectDesktopSource: (sourceId) => ipcRenderer.invoke('select-desktop-source', sourceId),
  getSelectedDesktopSource: () => ipcRenderer.invoke('get-selected-desktop-source'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  reloadApp: () => ipcRenderer.invoke('reload-app'),
  quitAndInstall: () => ipcRenderer.invoke('quit-and-install'),
  onUpdaterMessage: (callback) => ipcRenderer.on('updater-message', (_event, value) => callback(value))
});
