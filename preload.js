const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('DigipalDesktop', {
  getSettings: () => ipcRenderer.invoke('get-settings'),
  setSetting: (key, value) => ipcRenderer.invoke('set-setting', key, value),
  forceQuit: () => ipcRenderer.invoke('force-quit'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: 'windows'
});
