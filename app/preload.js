const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectSavePath: () => ipcRenderer.invoke('select-save-path'),
  generatePPT: (opts) => ipcRenderer.invoke('generate-ppt', opts),
  onProgress: (callback) => {
    ipcRenderer.on('progress', (_event, data) => callback(data));
  },
});
