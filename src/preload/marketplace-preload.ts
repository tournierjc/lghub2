import { contextBridge, ipcRenderer } from 'electron';

type Callback = (data: unknown) => void;
const listeners: Map<string, Callback[]> = new Map();

function addListener(channel: string, cb: Callback): void {
  let list = listeners.get(channel);
  if (!list) {
    list = [];
    listeners.set(channel, list);
    ipcRenderer.on(channel, (_event: Electron.IpcRendererEvent, data: unknown) => {
      const cbs = listeners.get(channel);
      if (cbs) cbs.forEach(fn => fn(data));
    });
  }
  list.push(cb);
}

window.addEventListener('offline', () => ipcRenderer.send('RELOAD_MARKETPLACE'));
window.addEventListener('online', () => ipcRenderer.send('RELOAD_MARKETPLACE'));

contextBridge.exposeInMainWorld('marketplaceApi', {
  requestInstalledAssets: () => {
    ipcRenderer.send('REQUEST_INSTALLED_ASSETS');
  },

  install: (assetData: unknown) => {
    ipcRenderer.send('INSTALL', assetData);
  },

  uninstallPlugin: (id: string) => {
    ipcRenderer.send('UNINSTALL_PLUGIN', id);
  },

  uninstallIconPack: (id: string) => {
    console.log('uninstallIconPack', id);
  },

  uninstallSoundPack: (id: string) => {
    console.log('uninstallSoundPack', id);
  },

  onSetInstalledAssets: (cb: Callback) => {
    addListener('SET_INSTALLED_ASSETS', cb);
  },

  onAddInstalledAsset: (cb: Callback) => {
    addListener('ADD_INSTALLED_ASSET', cb);
  },

  onRemoveInstalledAsset: (cb: Callback) => {
    addListener('REMOVE_INSTALLED_ASSET', cb);
  },

  onInstallationStarted: (cb: Callback) => {
    addListener('INSTALLATION_STARTED', cb);
  },

  onInstallationFinished: (cb: Callback) => {
    addListener('INSTALLATION_FINISHED', cb);
  },

  onUninstallationStarted: (cb: Callback) => {
    addListener('UNINSTALLATION_STARTED', cb);
  },

  removeAllListeners: () => {
    for (const channel of listeners.keys()) {
      ipcRenderer.removeAllListeners(channel);
    }
    listeners.clear();
  },

  operatingSystem: ipcRenderer.sendSync('IS_WINDOWS') ? 'Win' : 'Mac OS',
});
