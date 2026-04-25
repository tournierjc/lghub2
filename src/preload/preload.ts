import { contextBridge, ipcRenderer } from 'electron';
import { IpcChannel } from '../shared/ipc-channels';

export interface AppDataEntry {
  id?: string;
  name: string;
  applicationId?: string;
  poster?: string;
  detectionExecutables?: string[];
}

const electronApi = {
  minimize: () => ipcRenderer.send(IpcChannel.MINIMIZE),
  maximize: () => ipcRenderer.send(IpcChannel.MAXIMIZE),
  close: () => ipcRenderer.send(IpcChannel.CLOSE_WINDOW),
  setTitle: (title: string) => ipcRenderer.send(IpcChannel.SET_WINDOW_TITLE, title),
  relaunch: () => ipcRenderer.send(IpcChannel.RELAUNCH),
  openExternal: (url: string) => ipcRenderer.send(IpcChannel.OPEN_EXTERNAL, url),
  getOsInfo: () => ipcRenderer.invoke(IpcChannel.GET_OS_INFO),
  openDialog: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke(IpcChannel.OPEN_DIALOG, options),
  saveDialog: (options: Electron.SaveDialogOptions) => ipcRenderer.invoke(IpcChannel.SAVE_DIALOG, options),
  getMarketplacePreloadPath: () => ipcRenderer.invoke(IpcChannel.MARKETPLACE_PRELOAD_PATH) as Promise<string>,
};

const hidApi = {
  enumerate: () => ipcRenderer.invoke(IpcChannel.HID_ENUMERATE),
  connect: (path: string) => ipcRenderer.invoke(IpcChannel.HID_CONNECT, path),
  disconnect: (path: string) => ipcRenderer.send(IpcChannel.HID_DISCONNECT, path),
  send: (path: string, data: number[]) => ipcRenderer.invoke(IpcChannel.HID_SEND, path, data),
  onData: (callback: (path: string, data: number[]) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string, data: number[]) => callback(path, data);
    ipcRenderer.on(IpcChannel.HID_ON_DATA, handler);
    return () => ipcRenderer.removeListener(IpcChannel.HID_ON_DATA, handler);
  },
  onDeviceConnected: (callback: (path: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('hid:device-connected', handler);
    return () => ipcRenderer.removeListener('hid:device-connected', handler);
  },
  onDeviceDisconnected: (callback: (path: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, path: string) => callback(path);
    ipcRenderer.on('hid:device-disconnected', handler);
    return () => ipcRenderer.removeListener('hid:device-disconnected', handler);
  },
};

const deviceApi = {
  scan: () => ipcRenderer.invoke(IpcChannel.DEVICE_SCAN),
  getAll: () => ipcRenderer.invoke(IpcChannel.DEVICE_GET_ALL),
  setDpi: (hidPath: string, dpi: number) => ipcRenderer.invoke(IpcChannel.DEVICE_SET_DPI, hidPath, dpi),
  setRgb: (hidPath: string, zoneIndex: number, r: number, g: number, b: number) =>
    ipcRenderer.invoke(IpcChannel.DEVICE_SET_RGB, hidPath, zoneIndex, r, g, b),
  setRgbEffect: (hidPath: string, zoneIndex: number, effectId: number, r: number, g: number, b: number, speed: number, brightness: number) =>
    ipcRenderer.invoke(IpcChannel.DEVICE_SET_RGB_EFFECT, hidPath, zoneIndex, effectId, r, g, b, speed, brightness),
  refreshBattery: (hidPath: string) => ipcRenderer.invoke(IpcChannel.DEVICE_REFRESH_BATTERY, hidPath),
  disconnect: (hidPath: string) => ipcRenderer.send(IpcChannel.DEVICE_DISCONNECT, hidPath),
  getButtons: (hidPath: string) => ipcRenderer.invoke(IpcChannel.DEVICE_GET_BUTTONS, hidPath),
  remapButton: (hidPath: string, controlId: number, newTaskId: number) =>
    ipcRenderer.invoke(IpcChannel.DEVICE_REMAP_BUTTON, hidPath, controlId, newTaskId),
};

const profileApi = {
  getAll: (modelId: string) => ipcRenderer.invoke(IpcChannel.PROFILE_GET_ALL, modelId),
  create: (modelId: string, name: string, baseProfile?: unknown) =>
    ipcRenderer.invoke(IpcChannel.PROFILE_CREATE, modelId, name, baseProfile ? JSON.stringify(baseProfile) : undefined),
  update: (modelId: string, profileId: string, updates: unknown) =>
    ipcRenderer.invoke(IpcChannel.PROFILE_UPDATE, modelId, profileId, JSON.stringify(updates)),
  delete: (modelId: string, profileId: string) =>
    ipcRenderer.invoke(IpcChannel.PROFILE_DELETE, modelId, profileId),
  setActive: (modelId: string, profileId: string) =>
    ipcRenderer.invoke(IpcChannel.PROFILE_SET_ACTIVE, modelId, profileId),
  export: (modelId: string, profileId: string) =>
    ipcRenderer.invoke(IpcChannel.PROFILE_EXPORT, modelId, profileId),
  import: (modelId: string) =>
    ipcRenderer.invoke(IpcChannel.PROFILE_IMPORT, modelId),
  onProfileSwitched: (callback: (modelId: string, profileId: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: { modelId: string; profileId: string }) =>
      callback(payload.modelId, payload.profileId);
    ipcRenderer.on(IpcChannel.APP_PROFILE_SWITCHED, handler);
    return () => ipcRenderer.removeListener(IpcChannel.APP_PROFILE_SWITCHED, handler);
  },
};

const storeApi = {
  get: <T>(key: string): Promise<T | undefined> => ipcRenderer.invoke(IpcChannel.GET_STORAGE, key),
  set: <T>(key: string, value: T): Promise<void> => ipcRenderer.invoke(IpcChannel.SET_STORE, key, value),
};

const appDataApi = {
  search: (query: string) => ipcRenderer.invoke(IpcChannel.APP_DATA_SEARCH, query) as Promise<AppDataEntry[]>,
  get: (appId: string) => ipcRenderer.invoke(IpcChannel.APP_DATA_GET, appId) as Promise<(AppDataEntry & Record<string, unknown>) | null>,
};

contextBridge.exposeInMainWorld('electron', electronApi);
contextBridge.exposeInMainWorld('hid', hidApi);
contextBridge.exposeInMainWorld('device', deviceApi);
contextBridge.exposeInMainWorld('profile', profileApi);
contextBridge.exposeInMainWorld('store', storeApi);
contextBridge.exposeInMainWorld('appData', appDataApi);

export type ElectronApi = typeof electronApi;
export type HidApi = typeof hidApi;
export type DeviceApi = typeof deviceApi;
export type ProfileApi = typeof profileApi;
export type StoreApi = typeof storeApi;
export type AppDataApi = typeof appDataApi;
