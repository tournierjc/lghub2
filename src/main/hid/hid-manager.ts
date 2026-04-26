import { EventEmitter } from 'events';
import HID from 'node-hid';
import { LOGITECH_VENDOR_ID, KNOWN_DEVICES } from '../../shared/hidpp-protocol';
import { HidDeviceInfo } from '../../shared/ipc-channels';

interface ConnectedDevice {
  device: HID.HID;
  notificationDevice?: HID.HID;
  path: string;
  info: HidDeviceInfo;
}

export class HidManager extends EventEmitter {
  private connectedDevices = new Map<string, ConnectedDevice>();
  private pollingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    super();
  }

  enumerate(): HidDeviceInfo[] {
    const devices = HID.devices();
    return devices
      .filter((d) => d.vendorId === LOGITECH_VENDOR_ID)
      .map((d) => ({
        path: d.path || '',
        vendorId: d.vendorId,
        productId: d.productId,
        serialNumber: d.serialNumber || '',
        manufacturer: d.manufacturer || 'Logitech',
        product: d.product || KNOWN_DEVICES[d.productId]?.name || 'Unknown Device',
        interface: d.interface,
        usagePage: d.usagePage || 0,
        usage: d.usage || 0,
      }));
  }

  connect(devicePath: string): boolean {
    if (this.connectedDevices.has(devicePath)) {
      return true;
    }

    try {
      const device = new HID.HID(devicePath);
      const info = this.enumerate().find((d) => d.path === devicePath);

      if (!info) return false;

      let notificationDevice: HID.HID | undefined;
      if (process.platform === 'linux') {
        try {
          notificationDevice = new HID.HID(devicePath);
          notificationDevice.on('data', (data: Buffer) => {
            this.emit('device-data', devicePath, Array.from(data));
          });
          notificationDevice.on('error', (err: Error) => {
            console.error(`HID notification device error [${devicePath}]:`, err.message);
            this.disconnect(devicePath);
          });
        } catch (err) {
          console.warn(`Failed to open HID notification handle [${devicePath}]:`, err);
        }
      }

      const connected: ConnectedDevice = { device, notificationDevice, path: devicePath, info };
      this.connectedDevices.set(devicePath, connected);

      device.on('error', (err: Error) => {
        console.error(`HID device error [${devicePath}]:`, err.message);
        this.disconnect(devicePath);
      });

      this.emit('device-connected', devicePath);
      return true;
    } catch (err) {
      console.error(`Failed to connect to device [${devicePath}]:`, err);
      return false;
    }
  }

  disconnect(devicePath: string): void {
    const connected = this.connectedDevices.get(devicePath);
    if (connected) {
      try {
        connected.device.close();
      } catch {
      }
      if (connected.notificationDevice) {
        try {
          connected.notificationDevice.close();
        } catch {
        }
      }
      this.connectedDevices.delete(devicePath);
      this.emit('device-disconnected', devicePath);
    }
  }

  send(devicePath: string, data: number[]): number[] | null {
    const connected = this.connectedDevices.get(devicePath);
    if (!connected) return null;

    try {
      connected.device.write(data);
      const response = connected.device.readTimeout(1000);
      return response ? Array.from(response) : null;
    } catch (err) {
      console.error(`Failed to send to device [${devicePath}]:`, err);
      return null;
    }
  }

  startPolling(intervalMs = 5000): void {
    if (this.pollingInterval) return;

    this.pollingInterval = setInterval(() => {
      const devices = this.enumerate();
      this.emit('devices-updated', devices);
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  dispose(): void {
    this.stopPolling();
    for (const [path] of this.connectedDevices) {
      this.disconnect(path);
    }
  }
}
