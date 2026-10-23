const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('party', {
  host: online => ipcRenderer.invoke('host', online),
  join: url => ipcRenderer.invoke('join', url),
  copyInvite: () => ipcRenderer.invoke('copy-invite'),
  addresses: () => ipcRenderer.invoke('addresses'),
  version: () => ipcRenderer.invoke('app-version'),
  checkUpdate: () => ipcRenderer.invoke('check-update', true),
  openRelease: () => ipcRenderer.invoke('open-release'),
  onUpdate: callback => ipcRenderer.on('update', (_event, result) => callback(result)),
  onStatus: callback => ipcRenderer.on('status', (_event, status) => callback(status)),
});
