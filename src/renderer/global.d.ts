import type { ElectronApi, HidApi, DeviceApi, ProfileApi, StoreApi, AppDataApi } from '../preload/preload';

declare global {
  interface Window {
    electron: ElectronApi;
    hid: HidApi;
    device: DeviceApi;
    profile: ProfileApi;
    store: StoreApi;
    appData: AppDataApi;
  }
}
