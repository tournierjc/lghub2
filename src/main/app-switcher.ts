import { exec } from 'child_process';
import { promisify } from 'util';
import { BrowserWindow } from 'electron';
import { ProfileStore } from './profile-store';
import { DeviceService } from './hid/device-service';
import { IpcChannel } from '../shared/ipc-channels';

const execAsync = promisify(exec);

const POLL_INTERVAL_MS = 2000;

export class AppSwitcher {
  private interval: NodeJS.Timeout | null = null;
  private lastActiveApp: string | null = null;

  start(profileStore: ProfileStore, deviceService: DeviceService, window: BrowserWindow): void {
    if (this.interval) return;
    this.interval = setInterval(() => {
      this.checkAndSwitch(profileStore, deviceService, window).catch(() => undefined);
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async getActiveApp(): Promise<string | null> {
    try {
      if (process.platform === 'linux') {
        const { stdout: winId } = await execAsync('xdotool getactivewindow');
        const wid = winId.trim();
        if (!wid) return null;
        const { stdout: pid } = await execAsync(`xdotool getwindowpid ${wid}`);
        const pidNum = pid.trim();
        if (!pidNum) return null;
        const { stdout: exePath } = await execAsync(`readlink -f /proc/${pidNum}/exe`);
        return exePath.trim().split('/').pop() || null;
      } else if (process.platform === 'win32') {
        const ps = `(Get-Process | Where-Object {$_.MainWindowHandle -ne 0} | Sort-Object CPU -Descending | Select-Object -First 1).Name`;
        const { stdout } = await execAsync(`powershell -Command "${ps}"`);
        return stdout.trim() || null;
      }
    } catch {
    }
    return null;
  }

  private async checkAndSwitch(
    profileStore: ProfileStore,
    deviceService: DeviceService,
    window: BrowserWindow,
  ): Promise<void> {
    const activeApp = await this.getActiveApp();
    if (!activeApp || activeApp === this.lastActiveApp) return;
    this.lastActiveApp = activeApp;

    const devices = deviceService.getAllDevices();
    for (const device of devices) {
      const modelId = device.modelId;
      const profile = profileStore.findProfileForApp(modelId, activeApp);
      if (!profile) continue;
      if (device.activeProfile?.id === profile.id) continue;

      profileStore.setActiveProfile(modelId, profile.id);
      deviceService.activateProfile(device.hidPath, profile);

      if (!window.isDestroyed()) {
        window.webContents.send(IpcChannel.APP_PROFILE_SWITCHED, {
          deviceId: device.id,
          modelId,
          profileId: profile.id,
          profileName: profile.name,
          app: activeApp,
        });
      }
    }
  }
}
