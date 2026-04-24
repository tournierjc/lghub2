import { v4 as uuidv4 } from 'uuid';
import { HidManager } from './hid-manager';
import { HidppService } from './hidpp-service';
import { HidDeviceInfo } from '../../shared/ipc-channels';
import {
  Device,
  DeviceType,
  ConnectionType,
  LightingCapability,
  DeviceProfile,
  DpiConfig,
  RGBColor,
} from '../../shared/device-types';
import { LOGITECH_VENDOR_ID, KNOWN_DEVICES, DEVICE_INDEX } from '../../shared/hidpp-protocol';

export class DeviceService {
  private hidManager: HidManager;
  private hidppService: HidppService;
  private managedDevices = new Map<string, Device>();

  constructor(hidManager: HidManager) {
    this.hidManager = hidManager;
    this.hidppService = new HidppService(hidManager);
  }

  async scanAndConnect(): Promise<Device[]> {
    const hidDevices = this.hidManager.enumerate();

    const logitechDevices = hidDevices.filter(
      (d) => d.vendorId === LOGITECH_VENDOR_ID
    );

    const bestPerDevice = this.pickBestInterfacePerDevice(logitechDevices);
    const newDevices: Device[] = [];

    for (const hidDevice of bestPerDevice) {
      const existing = this.findManagedByProduct(hidDevice.vendorId, hidDevice.productId);
      if (existing) {
        newDevices.push(existing);
        continue;
      }

      const connected = this.hidManager.connect(hidDevice.path);
      if (!connected) {
        const basicDevice = this.buildBasicDevice(hidDevice);
        this.managedDevices.set(hidDevice.path, basicDevice);
        newDevices.push(basicDevice);
        continue;
      }

      try {
        const connectionType = this.inferConnectionType(hidDevice);
        // HID++ 2.0: wired USB devices use device index 0xFF; wireless slots use 0x01+
        const deviceIndex = connectionType === ConnectionType.USB ? 0xff : DEVICE_INDEX.WIRELESS_1;
        const proto = await this.hidppService.discoverFeatures(hidDevice.path, deviceIndex);
        const device = this.buildDeviceFromProtocol(hidDevice, proto);
        this.managedDevices.set(hidDevice.path, device);
        newDevices.push(device);
      } catch {
        const basicDevice = this.buildBasicDevice(hidDevice);
        this.managedDevices.set(hidDevice.path, basicDevice);
        newDevices.push(basicDevice);
      }
    }

    return newDevices;
  }

  private findManagedByProduct(vendorId: number, productId: number): Device | undefined {
    for (const device of this.managedDevices.values()) {
      if (device.modelId === productId.toString(16).padStart(4, '0')) return device;
    }
    return undefined;
  }

  private pickBestInterfacePerDevice(devices: HidDeviceInfo[]): HidDeviceInfo[] {
    const groups = new Map<string, HidDeviceInfo[]>();

    for (const d of devices) {
      const key = `${d.vendorId}:${d.productId}`;
      const group = groups.get(key) || [];
      group.push(d);
      groups.set(key, group);
    }

    const best: HidDeviceInfo[] = [];
    for (const group of groups.values()) {
      // Prefer vendor-defined HID++ interface (0xFF00), then interface 2, then anything
      const sorted = group.sort((a, b) => {
        const scoreA = a.usagePage === 0xff00 ? 0 : a.interface === 2 ? 1 : 2;
        const scoreB = b.usagePage === 0xff00 ? 0 : b.interface === 2 ? 1 : 2;
        return scoreA - scoreB;
      });
      best.push(sorted[0]);
    }

    return best;
  }

  private isValidHidppInterface(device: HidDeviceInfo): boolean {
    // HID++ uses usage page 0xFF00 (vendor-defined) or specific interface numbers
    if (device.usagePage === 0xff00) return true;
    if (device.usagePage === 0x0001 && device.usage === 0x0002) return true; // mouse
    if (device.usagePage === 0x0001 && device.usage === 0x0006) return true; // keyboard
    // Fallback: interface 2 is commonly the HID++ interface on receivers
    if (device.interface === 2) return true;
    return false;
  }

  private buildBasicDevice(hidDevice: HidDeviceInfo): Device {
    const knownInfo = KNOWN_DEVICES[hidDevice.productId];
    const deviceName = hidDevice.product || knownInfo?.name || `Device ${hidDevice.productId.toString(16).padStart(4, '0')}`;
    const deviceType = this.inferDeviceType(knownInfo?.type, hidDevice);
    const defaultProfile: DeviceProfile = {
      id: uuidv4(),
      name: 'Default',
      isDefault: true,
    };
    return {
      id: uuidv4(),
      name: deviceName,
      type: deviceType,
      modelId: hidDevice.productId.toString(16).padStart(4, '0'),
      unitId: hidDevice.serialNumber || '',
      connectionType: this.inferConnectionType(hidDevice),
      connected: true,
      hidPath: hidDevice.path,
      lightingCapability: LightingCapability.NONE,
      hasDpi: false,
      hasEq: false,
      hasMacros: false,
      hasBattery: false,
      serialNumber: hidDevice.serialNumber || undefined,
      activeProfile: defaultProfile,
      profiles: [defaultProfile],
    };
  }

  private buildDeviceFromProtocol(hidDevice: HidDeviceInfo, proto: any): Device {
    const knownInfo = KNOWN_DEVICES[hidDevice.productId];
    const deviceName = this.hidppService.getDeviceName(hidDevice.path) || hidDevice.product || knownInfo?.name || 'Unknown Device';
    const deviceType = this.inferDeviceType(knownInfo?.type, hidDevice);
    const firmware = this.hidppService.getFirmwareVersion(hidDevice.path);
    const battery = this.hidppService.getBatteryStatus(hidDevice.path);
    const dpiInfo = this.hidppService.getDpiInfo(hidDevice.path);
    const rgbInfo = this.hidppService.getRgbEffectInfo(hidDevice.path);
    const keysInfo = this.hidppService.getSpecialKeys(hidDevice.path);

    const defaultProfile: DeviceProfile = {
      id: uuidv4(),
      name: 'Default',
      isDefault: true,
      dpi: dpiInfo ? {
        levels: dpiInfo.levels.length > 0
          ? dpiInfo.levels.map((dpi, idx) => ({
              dpi,
              color: this.dpiLevelColor(idx),
              isActive: dpi === dpiInfo.current,
            }))
          : [{ dpi: dpiInfo.current, color: { r: 0, g: 212, b: 255 }, isActive: true }],
        activeLevelIndex: dpiInfo.levels.indexOf(dpiInfo.current),
        defaultDpi: dpiInfo.current,
      } : undefined,
    };

    return {
      id: uuidv4(),
      name: deviceName,
      type: deviceType,
      modelId: hidDevice.productId.toString(16).padStart(4, '0'),
      unitId: hidDevice.serialNumber || '',
      connectionType: this.inferConnectionType(hidDevice),
      connected: true,
      hidPath: hidDevice.path,
      lightingCapability: rgbInfo ? this.inferLightingCapability(deviceType, rgbInfo.zoneCount) : LightingCapability.NONE,
      hasDpi: dpiInfo !== null,
      hasEq: false,
      hasMacros: keysInfo !== null && keysInfo.buttons.some((b) => b.remappable),
      hasBattery: battery !== null,
      battery: battery ? { percentage: battery.percentage, charging: battery.charging } : undefined,
      firmware: firmware?.fw || undefined,
      serialNumber: hidDevice.serialNumber || undefined,
      activeProfile: defaultProfile,
      profiles: [defaultProfile],
      lightingZones: rgbInfo ? Array.from({ length: rgbInfo.zoneCount }, (_, i) => ({
        id: `zone-${i}`,
        name: `Zone ${i + 1}`,
        ledCount: 1,
      })) : undefined,
    };
  }

  private inferDeviceType(knownType: string | undefined, hidDevice: HidDeviceInfo): DeviceType {
    if (knownType) {
      const mapping: Record<string, DeviceType> = {
        mouse: DeviceType.MOUSE,
        keyboard: DeviceType.KEYBOARD,
        headset: DeviceType.HEADSET,
        speaker: DeviceType.SPEAKER,
        webcam: DeviceType.WEBCAM,
        mousepad: DeviceType.MOUSEPAD,
        microphone: DeviceType.MICROPHONE,
      };
      return mapping[knownType] || DeviceType.MOUSE;
    }

    if (hidDevice.usagePage === 0x0001 && hidDevice.usage === 0x0002) return DeviceType.MOUSE;
    if (hidDevice.usagePage === 0x0001 && hidDevice.usage === 0x0006) return DeviceType.KEYBOARD;
    if (hidDevice.product.toLowerCase().includes('mouse')) return DeviceType.MOUSE;
    if (hidDevice.product.toLowerCase().includes('keyboard')) return DeviceType.KEYBOARD;
    if (hidDevice.product.toLowerCase().includes('headset')) return DeviceType.HEADSET;

    return DeviceType.MOUSE;
  }

  private inferConnectionType(hidDevice: HidDeviceInfo): ConnectionType {
    const name = hidDevice.product.toLowerCase();
    if (name.includes('lightspeed') || name.includes('receiver')) return ConnectionType.LIGHTSPEED;
    if (name.includes('bluetooth') || name.includes('bt')) return ConnectionType.BLUETOOTH;
    return ConnectionType.USB;
  }

  private inferLightingCapability(deviceType: DeviceType, zoneCount: number): LightingCapability {
    if (zoneCount === 0) return LightingCapability.NONE;

    switch (deviceType) {
      case DeviceType.MOUSE:
        return zoneCount > 1 ? LightingCapability.MOUSE_RGB_ZONAL : LightingCapability.MOUSE_RGB_ZONAL;
      case DeviceType.KEYBOARD:
        return zoneCount > 5 ? LightingCapability.KEYBOARD_RGB_PER_KEY : LightingCapability.KEYBOARD_RGB_ZONAL;
      case DeviceType.HEADSET:
        return LightingCapability.HEADSET_RGB_ZONAL;
      case DeviceType.MOUSEPAD:
        return LightingCapability.MOUSEPAD_RGB_ZONAL;
      default:
        return LightingCapability.MOUSE_RGB_ZONAL;
    }
  }

  private dpiLevelColor(index: number): RGBColor {
    const colors: RGBColor[] = [
      { r: 0, g: 212, b: 255 },
      { r: 255, g: 165, b: 0 },
      { r: 0, g: 255, b: 100 },
      { r: 255, g: 50, b: 50 },
      { r: 180, g: 0, b: 255 },
    ];
    return colors[index % colors.length];
  }

  getDevice(hidPath: string): Device | undefined {
    return this.managedDevices.get(hidPath);
  }

  getAllDevices(): Device[] {
    return Array.from(this.managedDevices.values());
  }

  async setDeviceDpi(hidPath: string, dpi: number): Promise<boolean> {
    const success = this.hidppService.setDpi(hidPath, dpi);
    if (success) {
      const device = this.managedDevices.get(hidPath);
      if (device?.activeProfile.dpi) {
        device.activeProfile.dpi.levels.forEach((l) => {
          l.isActive = false;
        });
        const level = device.activeProfile.dpi.levels.find((l) => l.dpi === dpi);
        if (level) level.isActive = true;
      }
    }
    return success;
  }

  async setDeviceRgb(hidPath: string, zoneIndex: number, r: number, g: number, b: number): Promise<boolean> {
    return this.hidppService.setRgbZoneColor(hidPath, zoneIndex, r, g, b);
  }

  async setDeviceRgbEffect(
    hidPath: string,
    zoneIndex: number,
    effectId: number,
    r: number,
    g: number,
    b: number,
    speed: number,
    brightness: number
  ): Promise<boolean> {
    return this.hidppService.setRgbEffect(hidPath, zoneIndex, effectId, r, g, b, speed, brightness);
  }

  remapButton(hidPath: string, controlId: number, newTaskId: number): boolean {
    const success = this.hidppService.remapButton(hidPath, controlId, newTaskId);
    if (success) {
      const device = this.managedDevices.get(hidPath);
      if (device) {
        const hexKey = controlId.toString(16).padStart(4, '0');
        if (!device.activeProfile.assignments) device.activeProfile.assignments = {};
        device.activeProfile.assignments[hexKey] = {
          buttonId: hexKey,
          action: { type: 'system', value: newTaskId },
        };
      }
    }
    return success;
  }

  applyProfileAssignments(hidPath: string, assignments: Record<string, import('../../shared/device-types').ButtonAssignment>): void {
    const device = this.managedDevices.get(hidPath);
    if (!device) return;
    device.activeProfile.assignments = { ...assignments };
  }

  activateProfile(hidPath: string, profile: import('../../shared/device-types').DeviceProfile): void {
    const device = this.managedDevices.get(hidPath);
    if (!device) return;
    device.activeProfile = { ...profile };
  }

  async refreshBattery(hidPath: string): Promise<void> {
    const battery = this.hidppService.getBatteryStatus(hidPath);
    const device = this.managedDevices.get(hidPath);
    if (device && battery) {
      device.battery = { percentage: battery.percentage, charging: battery.charging };
    }
  }

  disconnectDevice(hidPath: string): void {
    this.hidppService.disposeDevice(hidPath);
    this.managedDevices.delete(hidPath);
    this.hidManager.disconnect(hidPath);
  }

  dispose(): void {
    for (const [path] of this.managedDevices) {
      this.disconnectDevice(path);
    }
    this.hidppService.dispose();
  }
}
