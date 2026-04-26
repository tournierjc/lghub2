import { EventEmitter } from 'node:events';
import type { DeviceProfile } from '../../shared/device-types';
import type { HidppFeature } from '../../shared/hidpp-protocol';
import type { HidManager } from './hid-manager';
import { parseHidppNotification, type DivertedButtonEvent } from './hidpp-notifications';
import type { HidppService } from './hidpp-service';
import { MacroExecutor } from './macro-executor';

interface ActiveDevice {
  devicePath: string;
  profile: DeviceProfile;
  featureIndexMap: Map<number, HidppFeature>;
}

export class MacroRuntime extends EventEmitter {
  private hidManager: HidManager;
  private hidppService: HidppService;
  private macroExecutor: MacroExecutor;
  private activeDevices = new Map<string, ActiveDevice>();
  private dataHandler: ((devicePath: string, data: number[]) => void) | null = null;

  constructor(hidManager: HidManager, hidppService: HidppService) {
    super();
    this.hidManager = hidManager;
    this.hidppService = hidppService;
    this.macroExecutor = new MacroExecutor();
    this.dataHandler = this.handleDeviceData.bind(this);
    this.hidManager.on('device-data', this.dataHandler);
  }

  activateProfile(devicePath: string, profile: DeviceProfile): void {
    const proto = this.hidppService.getProtocolInfo(devicePath);
    if (!proto) return;

    const featureIndexMap = new Map<number, HidppFeature>();
    for (const [featureId, mapping] of proto.features) {
      featureIndexMap.set(mapping.featureIndex, featureId);
    }

    this.activeDevices.set(devicePath, { devicePath, profile, featureIndexMap });

    if (profile.assignments) {
      for (const assignment of Object.values(profile.assignments)) {
        if (assignment.action.type === 'macro') {
          const controlId = parseInt(assignment.buttonId, 16);
          if (!Number.isNaN(controlId)) {
            this.hidppService.divertButton(devicePath, controlId, true, true);
          }
        }
      }
    }
  }

  deactivateDevice(devicePath: string): void {
    const active = this.activeDevices.get(devicePath);
    if (active?.profile.assignments) {
      for (const assignment of Object.values(active.profile.assignments)) {
        if (assignment.action.type === 'macro') {
          const controlId = parseInt(assignment.buttonId, 16);
          if (!Number.isNaN(controlId)) {
            this.hidppService.divertButton(devicePath, controlId, false, false);
          }
        }
      }
    }
    this.activeDevices.delete(devicePath);
  }

  private handleDeviceData(devicePath: string, data: number[]): void {
    const active = this.activeDevices.get(devicePath);
    if (!active) return;

    const notification = parseHidppNotification(devicePath, data, active.featureIndexMap);
    if (!notification) return;

    if (notification.type === 'diverted-button') {
      this.handleDivertedButton(notification, active.profile);
    }
  }

  private handleDivertedButton(event: DivertedButtonEvent, profile: DeviceProfile): void {
    if (!event.pressed) return;

    const hexKey = event.controlId.toString(16).padStart(4, '0');
    const assignment = profile.assignments?.[hexKey];
    if (!assignment || assignment.action.type !== 'macro') return;

    const macroSteps = Array.isArray(assignment.action.value) ? assignment.action.value : [];
    if (macroSteps.length === 0) return;

    this.emit('macro-triggered', event.devicePath, hexKey, macroSteps);
    this.macroExecutor.executeMacro(macroSteps).catch((err) => {
      console.error('Macro execution failed:', err);
    });
  }

  dispose(): void {
    if (this.dataHandler) {
      this.hidManager.off('device-data', this.dataHandler);
      this.dataHandler = null;
    }
    for (const devicePath of this.activeDevices.keys()) {
      this.deactivateDevice(devicePath);
    }
    this.activeDevices.clear();
  }
}
