const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hermes', {
  detect: {
    os: () => ipcRenderer.invoke('detect:os'),
    wsl: () => ipcRenderer.invoke('detect:wsl'),
    hermes: () => ipcRenderer.invoke('detect:hermes'),
  },
  secrets: {
    set: (account, value) => ipcRenderer.invoke('secrets:set', account, value),
    get: (account) => ipcRenderer.invoke('secrets:get', account),
  },
  config: {
    preview: (cfg) => ipcRenderer.invoke('config:preview', cfg),
    write: (cfg) => ipcRenderer.invoke('config:write', cfg),
  },
  wsl: {
    install: () => ipcRenderer.invoke('wsl:install'),
    onLog: (cb) => {
      const handler = (_e, chunk) => cb(chunk);
      ipcRenderer.on('wsl:log', handler);
      return () => ipcRenderer.removeListener('wsl:log', handler);
    },
  },
  install: {
    checkDeps: () => ipcRenderer.invoke('install:checkDeps'),
    installDeps: (missing, password) => ipcRenderer.invoke('install:installDeps', missing, password),
    run: (payload) => ipcRenderer.invoke('install:run', payload),
    onLog: (cb) => {
      const handler = (_e, chunk) => cb(chunk);
      ipcRenderer.on('install:log', handler);
      return () => ipcRenderer.removeListener('install:log', handler);
    },
  },
});
