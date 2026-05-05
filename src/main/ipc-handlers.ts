import { ipcMain, BrowserWindow, shell, dialog, app } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IpcChannel } from '../shared/ipc-channels';
import { HidManager } from './hid/hid-manager';
import { DeviceService } from './hid/device-service';
import { ProfileStore } from './profile-store';
import { MarketplaceService } from './marketplace-service';
import { DeviceImageStore } from './device-image-store';
import { ScreenSamplerService } from './screen-sampler-service';
import { DeviceProfile } from '../shared/device-types';
import { extractDetectionExecutables } from './app-detection';
import { mergeProfileStateWithScanned } from '../shared/profile-utils';

interface CatalogApplication {
  name: string;
  applicationId?: string;
  poster_url?: string;
  detection?: unknown;
}

interface CatalogApplicationData {
  applications: CatalogApplication[];
}

const APP_DATA_OVERRIDE_FILENAME = 'applications.json';

function resolveAppDataOverridePath(): string {
  return path.join(app.getPath('userData'), APP_DATA_OVERRIDE_FILENAME);
}

function loadCatalogData(): CatalogApplicationData {
  const overridePath = resolveAppDataOverridePath();
  try {
    if (fs.existsSync(overridePath)) {
      const raw = fs.readFileSync(overridePath, 'utf-8');
      const parsed = JSON.parse(raw) as CatalogApplicationData;
      if (parsed && Array.isArray(parsed.applications)) return parsed;
    }
  } catch {
  }

  // Fallback to bundled catalog.
  return require('../data/applications.json') as CatalogApplicationData;
}

let deviceImageStore: DeviceImageStore | null = null;

export function registerIpcHandlers(window: BrowserWindow, hidManager: HidManager, deviceService: DeviceService, profileStore: ProfileStore, marketplaceService: MarketplaceService): void {
  if (!deviceImageStore) {
    deviceImageStore = new DeviceImageStore();
  }

  const screenSamplerService = new ScreenSamplerService(deviceService);
  deviceService.registerScreenSamplerStop((hidPath) => screenSamplerService.stop(hidPath));

  // Window management
  ipcMain.on(IpcChannel.MINIMIZE, () => window.minimize());
  ipcMain.on(IpcChannel.MAXIMIZE, () => {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });
  // Renderer "close" should quit the app (tray provides hide/minimize behavior).
  ipcMain.on(IpcChannel.CLOSE_WINDOW, () => app.quit());
  ipcMain.on(IpcChannel.SET_WINDOW_TITLE, (_event, title: string) => window.setTitle(title));
  ipcMain.on(IpcChannel.RELAUNCH, () => {
    app.relaunch();
    app.exit();
  });

  ipcMain.on(IpcChannel.OPEN_EXTERNAL, (_event, url: string) => {
    shell.openExternal(url);
  });

  ipcMain.handle(IpcChannel.GET_OS_INFO, () => ({
    platform: process.platform,
    arch: os.arch(),
    version: os.release(),
    hostname: os.hostname(),
  }));

  ipcMain.handle(IpcChannel.OPEN_DIALOG, async (_event, options) => {
    return dialog.showOpenDialog(window, options);
  });

  ipcMain.handle(IpcChannel.SAVE_DIALOG, async (_event, options) => {
    return dialog.showSaveDialog(window, options);
  });

  // Low-level HID
  ipcMain.handle(IpcChannel.HID_ENUMERATE, () => {
    return hidManager.enumerate();
  });

  ipcMain.handle(IpcChannel.HID_CONNECT, (_event, devicePath: string) => {
    return hidManager.connect(devicePath);
  });

  ipcMain.on(IpcChannel.HID_DISCONNECT, (_event, devicePath: string) => {
    hidManager.disconnect(devicePath);
  });

  ipcMain.handle(IpcChannel.HID_SEND, async (_event, devicePath: string, data: number[]) => {
    return hidManager.send(devicePath, data);
  });

  // High-level device operations
  ipcMain.handle(IpcChannel.DEVICE_SCAN, async () => {
    const devices = await deviceService.scanAndConnect();
    return devices;
  });

  ipcMain.handle(IpcChannel.DEVICE_GET_ALL, () => {
    return deviceService.getAllDevices();
  });

  ipcMain.handle(IpcChannel.DEVICE_SET_DPI, async (_event, hidPath: string, dpi: number) => {
    return deviceService.setDeviceDpi(hidPath, dpi);
  });

  ipcMain.handle(IpcChannel.DEVICE_SET_RGB, async (_event, hidPath: string, zoneIndex: number, r: number, g: number, b: number) => {
    return deviceService.setDeviceRgb(hidPath, zoneIndex, r, g, b);
  });

  ipcMain.handle(IpcChannel.DEVICE_SET_RGB_EFFECT, async (_event, hidPath: string, zoneIndex: number, effectId: number, r: number, g: number, b: number, speed: number, brightness: number) => {
    return deviceService.setDeviceRgbEffect(hidPath, zoneIndex, effectId, r, g, b, speed, brightness);
  });

  ipcMain.handle(IpcChannel.DEVICE_REFRESH_BATTERY, async (_event, hidPath: string) => {
    await deviceService.refreshBattery(hidPath);
    return deviceService.getDevice(hidPath);
  });

  ipcMain.on(IpcChannel.DEVICE_DISCONNECT, (_event, hidPath: string) => {
    screenSamplerService.stop(hidPath);
    deviceService.disconnectDevice(hidPath);
  });

  ipcMain.handle(IpcChannel.DEVICE_REMAP_BUTTON, async (_event, hidPath: string, controlId: number, newTaskId: number) => {
    return deviceService.remapButton(hidPath, controlId, newTaskId);
  });

  ipcMain.handle(IpcChannel.DEVICE_GET_BUTTONS, (_event, hidPath: string) => {
    const device = deviceService.getDevice(hidPath);
    return device?.activeProfile.assignments || {};
  });

  ipcMain.handle(IpcChannel.DEVICE_IMAGE_GET_CUSTOM_URL, (_event, modelId: string) => {
    return deviceImageStore!.getCustomImageFileUrl(modelId);
  });

  ipcMain.handle(IpcChannel.DEVICE_IMAGE_IMPORT, (_event, modelId: string, sourcePath: string) => {
    return deviceImageStore!.importFromFile(modelId, sourcePath);
  });

  ipcMain.handle(IpcChannel.DEVICE_IMAGE_CLEAR, (_event, modelId: string) => {
    return deviceImageStore!.clear(modelId);
  });

  ipcMain.handle(IpcChannel.DEVICE_SCREEN_SAMPLER_START, (_event, hidPath: string, zoneIndexes: number[], brightnessPct: number = 100) => {
    screenSamplerService.start(hidPath, zoneIndexes, brightnessPct);
    return true;
  });

  ipcMain.handle(IpcChannel.DEVICE_SCREEN_SAMPLER_STOP, (_event, hidPath: string) => {
    screenSamplerService.stop(hidPath);
    return true;
  });

  ipcMain.handle(IpcChannel.APP_DATA_SEARCH, (_event, query: string) => {
    const data = loadCatalogData();
    const q = query.toLowerCase();
    return data.applications
      .filter((a) => a.name?.toLowerCase().includes(q))
      .slice(0, 20)
      .map((a) => ({
        id: a.applicationId,
        name: a.name,
        applicationId: a.applicationId,
        poster: a.poster_url,
        detectionExecutables: extractDetectionExecutables(a.detection),
      }));
  });

  ipcMain.handle(IpcChannel.APP_DATA_GET, (_event, appId: string) => {
    const data = loadCatalogData();
    const application = data.applications.find((a) => a.applicationId === appId);
    return application ? { ...application, detectionExecutables: extractDetectionExecutables(application.detection) } : null;
  });

  ipcMain.handle(IpcChannel.APP_DATA_IMPORT, async (_event, folderPath: string) => {
    try {
      const sourcePath = path.join(folderPath, 'applications.json');
      if (!fs.existsSync(sourcePath)) {
        return { ok: false, error: `No applications.json found in ${folderPath}` };
      }

      const raw = fs.readFileSync(sourcePath, 'utf-8');
      const parsed = JSON.parse(raw) as CatalogApplicationData;
      if (!parsed || !Array.isArray(parsed.applications)) {
        return { ok: false, error: 'Invalid applications.json format' };
      }

      const destPath = resolveAppDataOverridePath();
      fs.writeFileSync(destPath, JSON.stringify(parsed), 'utf-8');
      return { ok: true, importedCount: parsed.applications.length };
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || String(err) };
    }
  });

  // Profile management
  ipcMain.handle(IpcChannel.PROFILE_GET_ALL, (_event, modelId: string) => {
    let profiles = profileStore.getProfiles(modelId);
    const device = deviceService.getAllDevices().find((d) => d.modelId === modelId);

    if (profiles.length === 0 && device) {
      profileStore.setDefaultProfile(modelId, device.activeProfile);
      profiles = profileStore.getProfiles(modelId);
    }

    if (device && profiles.length > 0) {
      const activeId = profileStore.getActiveProfileId(modelId);
      const active =
        profiles.find((p) => p.id === activeId) ||
        profiles.find((p) => p.isDefault) ||
        profiles[0];
      const scannedDpi = device.activeProfile?.dpi;
      const scannedLighting = device.activeProfile?.lighting;
      const scannedAssignments = device.activeProfile?.assignments;
      device.activeProfile = mergeProfileStateWithScanned(active, {
        dpi: scannedDpi,
        lighting: scannedLighting,
        assignments: scannedAssignments,
      });
    }

    return profiles;
  });

  ipcMain.handle(IpcChannel.PROFILE_CREATE, (_event, modelId: string, name: string, baseProfileJson?: string) => {
    const baseProfile = baseProfileJson ? JSON.parse(baseProfileJson) as DeviceProfile : undefined;
    return profileStore.createProfile(modelId, name, baseProfile);
  });

  ipcMain.handle(IpcChannel.PROFILE_UPDATE, (_event, modelId: string, profileId: string, updatesJson: string) => {
    const updates = JSON.parse(updatesJson) as Partial<DeviceProfile>;
    const profile = profileStore.updateProfile(modelId, profileId, updates);

    if (profile && updates.dpi !== undefined) {
      const device = deviceService.getAllDevices().find((d) => d.modelId === modelId);
      if (device?.activeProfile?.id === profileId) {
        deviceService.syncActiveProfileDpiToHardware(device.hidPath, profile);
      }
    }

    if (profile && updates.assignments !== undefined) {
      const device = deviceService.getAllDevices().find((d) => d.modelId === modelId);
      if (device?.activeProfile?.id === profileId) {
        deviceService.applyProfileAssignments(device.hidPath, updates.assignments);
      }
    }

    return profile;
  });

  ipcMain.handle(IpcChannel.PROFILE_DELETE, (_event, modelId: string, profileId: string) => {
    return profileStore.deleteProfile(modelId, profileId);
  });

  ipcMain.handle(IpcChannel.PROFILE_SET_ACTIVE, (_event, modelId: string, profileId: string) => {
    const success = profileStore.setActiveProfile(modelId, profileId);
    if (!success) return false;

    const device = deviceService.getAllDevices().find((d) => d.modelId === modelId);
    const profile = profileStore.getProfiles(modelId).find((candidate) => candidate.id === profileId);

    if (device && profile) {
      deviceService.activateProfile(device.hidPath, profile);
      deviceService.syncActiveProfileDpiToHardware(device.hidPath, profile);
    }

    return true;
  });

  ipcMain.handle(IpcChannel.PROFILE_EXPORT, async (_event, modelId: string, profileId: string) => {
    const json = profileStore.exportProfile(modelId, profileId);
    if (!json) return false;

    const result = await dialog.showSaveDialog(window, {
      defaultPath: `profile-${profileId}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    });

    if (!result.canceled && result.filePath) {
      fs.writeFileSync(result.filePath, json, 'utf-8');
      return true;
    }
    return false;
  });

  ipcMain.handle(IpcChannel.PROFILE_IMPORT, async (_event, modelId: string) => {
    const result = await dialog.showOpenDialog(window, {
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (result.canceled || result.filePaths.length === 0) return null;

    const json = fs.readFileSync(result.filePaths[0], 'utf-8');
    return profileStore.importProfile(modelId, json);
  });

  // Forward HID data events to renderer
  hidManager.on('device-data', (devicePath: string, data: number[]) => {
    window.webContents.send(IpcChannel.HID_ON_DATA, devicePath, data);
  });

  hidManager.on('device-connected', (devicePath: string) => {
    window.webContents.send('hid:device-connected', devicePath);
  });

  hidManager.on('device-disconnected', (devicePath: string) => {
    window.webContents.send('hid:device-disconnected', devicePath);
  });

  // Marketplace
  ipcMain.on('IS_WINDOWS', (event) => {
    event.returnValue = process.platform === 'win32';
  });

  ipcMain.handle(IpcChannel.MARKETPLACE_PRELOAD_PATH, () => {
    return path.join(__dirname, 'marketplace-preload.js');
  });

  ipcMain.on(IpcChannel.MARKETPLACE_REQUEST_INSTALLED_ASSETS, (event) => {
    const assets = marketplaceService.getInstalledAssets();
    event.sender.send(IpcChannel.MARKETPLACE_SET_INSTALLED_ASSETS, assets);
  });

  ipcMain.on(IpcChannel.MARKETPLACE_INSTALL, async (event, assetData: Record<string, unknown>) => {
    event.sender.send(IpcChannel.MARKETPLACE_INSTALLATION_STARTED, { id: assetData.id, name: assetData.name });
    try {
      const asset = await marketplaceService.install(assetData);
      event.sender.send(IpcChannel.MARKETPLACE_INSTALLATION_FINISHED, { id: asset.id, name: asset.name, success: true });
      event.sender.send(IpcChannel.MARKETPLACE_ADD_INSTALLED_ASSET, asset);
    } catch {
      event.sender.send(IpcChannel.MARKETPLACE_INSTALLATION_FINISHED, { id: assetData.id, success: false });
    }
  });

  ipcMain.on(IpcChannel.MARKETPLACE_UNINSTALL_PLUGIN, (event, pluginId: string) => {
    event.sender.send(IpcChannel.MARKETPLACE_UNINSTALLATION_STARTED, { id: pluginId });
    const success = marketplaceService.uninstall(pluginId);
    if (success) {
      event.sender.send(IpcChannel.MARKETPLACE_REMOVE_INSTALLED_ASSET, pluginId);
    }
  });

  ipcMain.on(IpcChannel.MARKETPLACE_RELOAD, () => {});
}
