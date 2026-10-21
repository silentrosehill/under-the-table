const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('party', {
  host: online => ipcRenderer.invoke('host', online),
  join: url => ipcRenderer.invoke('join', url),
  copyInvite: () => ipcRenderer.invoke('copy-invite'),
  addresses: () => ipcRenderer.invoke('addresses'),
  onStatus: callback => ipcRenderer.on('status', (_event, status) => callback(status)),
});
