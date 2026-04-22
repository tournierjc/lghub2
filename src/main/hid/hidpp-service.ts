import { EventEmitter } from 'events';
import { HidManager } from './hid-manager';
import {
  HidppReportType,
  HidppFeature,
  HidppError,
  HidppMessage,
  buildHidppMessage,
  parseHidppMessage,
  isHidppError,
  DEVICE_INDEX,
} from '../../shared/hidpp-protocol';

const SOFTWARE_ID = 0x07;
const FEATURE_DISCOVERY_TIMEOUT_MS = 2000;

interface FeatureMapping {
  featureId: HidppFeature;
  featureIndex: number;
  featureType: number;
}

interface DeviceProtocolInfo {
  deviceIndex: number;
  features: Map<HidppFeature, FeatureMapping>;
  protocolMajor: number;
  protocolMinor: number;
}

export class HidppService extends EventEmitter {
  private hidManager: HidManager;
  private deviceProtocols = new Map<string, DeviceProtocolInfo>();

  constructor(hidManager: HidManager) {
    super();
    this.hidManager = hidManager;
  }

  private sendRequest(
    devicePath: string,
    deviceIndex: number,
    featureIndex: number,
    functionId: number,
    params: number[] = []
  ): number[] | null {
    const msg: HidppMessage = {
      reportType: params.length <= 3 ? HidppReportType.SHORT : HidppReportType.LONG,
      deviceIndex,
      featureIndex,
      functionId,
      softwareId: SOFTWARE_ID,
      params,
    };

    const response = this.hidManager.send(devicePath, buildHidppMessage(msg));
    if (!response) return null;

    const error = isHidppError(response);
    if (error !== null && error !== HidppError.NO_ERROR) {
      throw new HidppProtocolError(error, featureIndex, functionId);
    }

    return response;
  }

  async discoverFeatures(devicePath: string, deviceIndex: number = DEVICE_INDEX.WIRELESS_1): Promise<DeviceProtocolInfo> {
    const existing = this.deviceProtocols.get(devicePath);
    if (existing) return existing;

    const info: DeviceProtocolInfo = {
      deviceIndex,
      features: new Map(),
      protocolMajor: 0,
      protocolMinor: 0,
    };

    // Ping root feature to get protocol version
    const rootResponse = this.sendRequest(devicePath, deviceIndex, 0x00, 0x01, [0x00, 0x00, 0x00]);
    if (rootResponse) {
      const parsed = parseHidppMessage(rootResponse);
      if (parsed) {
        info.protocolMajor = parsed.params[0];
        info.protocolMinor = parsed.params[1];
      }
    }

    // Discover each feature we care about
    const featuresToDiscover: HidppFeature[] = [
      HidppFeature.FEATURE_SET,
      HidppFeature.DEVICE_NAME,
      HidppFeature.DEVICE_FW_VERSION,
      HidppFeature.DEVICE_TYPE_AND_NAME,
      HidppFeature.BATTERY_UNIFIED,
      HidppFeature.UNIFIED_BATTERY,
      HidppFeature.ADJUSTABLE_DPI,
      HidppFeature.SPECIAL_KEYS_BUTTONS,
      HidppFeature.RGB_EFFECTS,
      HidppFeature.PER_KEY_LIGHTING_V2,
      HidppFeature.EQUALIZER,
      HidppFeature.SMART_SHIFT,
      HidppFeature.HIRES_SCROLL,
      HidppFeature.ONBOARD_PROFILES,
    ];

    for (const featureId of featuresToDiscover) {
      try {
        const featureIndex = this.getFeatureIndex(devicePath, deviceIndex, featureId);
        if (featureIndex !== null) {
          info.features.set(featureId, {
            featureId,
            featureIndex,
            featureType: 0,
          });
        }
      } catch {
      }
    }

    this.deviceProtocols.set(devicePath, info);
    return info;
  }

  private getFeatureIndex(devicePath: string, deviceIndex: number, featureId: HidppFeature): number | null {
    // IRoot::GetFeature (feature index 0x00, function 0x00)
    // params: featureId (2 bytes big-endian)
    const response = this.sendRequest(devicePath, deviceIndex, 0x00, 0x00, [
      (featureId >> 8) & 0xff,
      featureId & 0xff,
      0x00,
    ]);

    if (!response) return null;

    const parsed = parseHidppMessage(response);
    if (!parsed) return null;

    const index = parsed.params[0];
    return index === 0 && featureId !== HidppFeature.ROOT ? null : index;
  }

  getDeviceName(devicePath: string): string | null {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return null;

    const feature = proto.features.get(HidppFeature.DEVICE_NAME);
    if (!feature) return null;

    // GetDeviceNameCount (function 0x00)
    const countResponse = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x00);
    if (!countResponse) return null;

    const parsed = parseHidppMessage(countResponse);
    if (!parsed) return null;

    const nameLength = parsed.params[0];
    let name = '';
    let offset = 0;

    while (offset < nameLength) {
      // GetDeviceName (function 0x01)
      const nameResponse = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x01, [offset]);
      if (!nameResponse) break;

      const nameParsed = parseHidppMessage(nameResponse);
      if (!nameParsed) break;

      const chunkSize = Math.min(nameLength - offset, nameParsed.params.length);
      for (let i = 0; i < chunkSize; i++) {
        if (nameParsed.params[i] === 0) break;
        name += String.fromCharCode(nameParsed.params[i]);
      }
      offset += chunkSize;
    }

    return name || null;
  }

  getFirmwareVersion(devicePath: string): { fw: string; bl: string; hw: string } | null {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return null;

    const feature = proto.features.get(HidppFeature.DEVICE_FW_VERSION);
    if (!feature) return null;

    const versions: { fw: string; bl: string; hw: string } = { fw: '', bl: '', hw: '' };
    const typeNames = ['fw', 'bl', 'hw'] as const;

    for (let entityIdx = 0; entityIdx < 3; entityIdx++) {
      try {
        // GetFwInfo (function 0x00)
        const response = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x00, [entityIdx]);
        if (!response) continue;

        const parsed = parseHidppMessage(response);
        if (!parsed) continue;

        const prefix = String.fromCharCode(parsed.params[1], parsed.params[2], parsed.params[3]);
        const version = `${prefix}${parsed.params[4].toString(16).padStart(2, '0')}.${parsed.params[5].toString(16).padStart(2, '0')}`;
        const build = (parsed.params[6] << 8) | parsed.params[7];

        versions[typeNames[entityIdx]] = `${version}.${build.toString(16).padStart(4, '0')}`;
      } catch {
      }
    }

    return versions;
  }

  getBatteryStatus(devicePath: string): { percentage: number; charging: boolean; status: string } | null {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return null;

    // Try unified battery (0x1004) first, then legacy (0x1000)
    const unifiedFeature = proto.features.get(HidppFeature.UNIFIED_BATTERY);
    if (unifiedFeature) {
      return this.getUnifiedBattery(devicePath, proto.deviceIndex, unifiedFeature.featureIndex);
    }

    const legacyFeature = proto.features.get(HidppFeature.BATTERY_UNIFIED);
    if (legacyFeature) {
      return this.getLegacyBattery(devicePath, proto.deviceIndex, legacyFeature.featureIndex);
    }

    return null;
  }

  private getUnifiedBattery(devicePath: string, deviceIndex: number, featureIndex: number) {
    // GetCapabilities (function 0x00) then GetStatus (function 0x01)
    const response = this.sendRequest(devicePath, deviceIndex, featureIndex, 0x01);
    if (!response) return null;

    const parsed = parseHidppMessage(response);
    if (!parsed) return null;

    const percentage = parsed.params[0];
    const level = parsed.params[1]; // 0=critical, 1=low, 3=good, 5=full
    const chargingStatus = parsed.params[2];

    const STATUS_MAP: Record<number, string> = {
      0: 'discharging',
      1: 'charging',
      2: 'charging_slow',
      3: 'charging_complete',
      4: 'charging_error',
    };

    return {
      percentage,
      charging: chargingStatus >= 1 && chargingStatus <= 3,
      status: STATUS_MAP[chargingStatus] || 'unknown',
    };
  }

  private getLegacyBattery(devicePath: string, deviceIndex: number, featureIndex: number) {
    // GetBatteryLevelStatus (function 0x00)
    const response = this.sendRequest(devicePath, deviceIndex, featureIndex, 0x00);
    if (!response) return null;

    const parsed = parseHidppMessage(response);
    if (!parsed) return null;

    const percentage = parsed.params[0];
    const nextLevel = parsed.params[1];
    const status = parsed.params[2];

    return {
      percentage,
      charging: status === 1 || status === 2 || status === 5,
      status: status === 0 ? 'discharging' : 'charging',
    };
  }

  getDpiInfo(devicePath: string): { current: number; min: number; max: number; step: number; levels: number[] } | null {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return null;

    const feature = proto.features.get(HidppFeature.ADJUSTABLE_DPI);
    if (!feature) return null;

    // GetSensorCount (function 0x00)
    const countResp = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x00);
    if (!countResp) return null;

    const countParsed = parseHidppMessage(countResp);
    if (!countParsed) return null;

    const sensorCount = countParsed.params[0];

    // GetSensorDPI (function 0x01) — sensor 0
    const dpiResp = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x01, [0x00]);
    if (!dpiResp) return null;

    const dpiParsed = parseHidppMessage(dpiResp);
    if (!dpiParsed) return null;

    const currentDpi = (dpiParsed.params[1] << 8) | dpiParsed.params[2];
    const defaultDpi = (dpiParsed.params[3] << 8) | dpiParsed.params[4];

    // GetSensorDPIList (function 0x02) — sensor 0
    const listResp = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x02, [0x00]);
    if (!listResp) return null;

    const listParsed = parseHidppMessage(listResp);
    if (!listParsed) return null;

    const dpiValues: number[] = [];
    let min = 0xffff;
    let max = 0;
    let step = 0;

    // DPI list: pairs of bytes (big-endian), 0xe000+ means step-based encoding
    for (let i = 1; i < listParsed.params.length - 1; i += 2) {
      const value = (listParsed.params[i] << 8) | listParsed.params[i + 1];
      if (value === 0) break;

      if (value >= 0xe000) {
        step = value - 0xe000;
        continue;
      }

      dpiValues.push(value);
      if (value < min) min = value;
      if (value > max) max = value;
    }

    return { current: currentDpi, min, max, step, levels: dpiValues };
  }

  setDpi(devicePath: string, dpi: number, sensorIndex: number = 0): boolean {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return false;

    const feature = proto.features.get(HidppFeature.ADJUSTABLE_DPI);
    if (!feature) return false;

    // SetSensorDPI (function 0x03) — sensor index, dpi high byte, dpi low byte
    try {
      this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x03, [
        sensorIndex,
        (dpi >> 8) & 0xff,
        dpi & 0xff,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  getRgbEffectInfo(devicePath: string): { zoneCount: number } | null {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return null;

    const feature = proto.features.get(HidppFeature.RGB_EFFECTS);
    if (!feature) return null;

    // GetInfo (function 0x00)
    const response = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x00);
    if (!response) return null;

    const parsed = parseHidppMessage(response);
    if (!parsed) return null;

    return {
      zoneCount: parsed.params[0],
    };
  }

  setRgbZoneColor(devicePath: string, zoneIndex: number, r: number, g: number, b: number): boolean {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return false;

    const feature = proto.features.get(HidppFeature.RGB_EFFECTS);
    if (!feature) return false;

    // SetRgbZoneSingleColor (function 0x01)
    try {
      this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x01, [
        zoneIndex,
        r & 0xff,
        g & 0xff,
        b & 0xff,
        0x02, // persistence: RAM only
      ]);
      return true;
    } catch {
      return false;
    }
  }

  setRgbEffect(
    devicePath: string,
    zoneIndex: number,
    effectId: number,
    r: number,
    g: number,
    b: number,
    speed: number,
    brightness: number
  ): boolean {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return false;

    const feature = proto.features.get(HidppFeature.RGB_EFFECTS);
    if (!feature) return false;

    // SetRgbZoneEffect (function 0x02) — LONG report needed
    try {
      this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x02, [
        zoneIndex,
        effectId,
        speed & 0xff,
        (speed >> 8) & 0xff,
        0x00,
        r & 0xff,
        g & 0xff,
        b & 0xff,
        brightness & 0xff,
        0x02, // persistence: RAM only
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  getSpecialKeys(devicePath: string): { buttonCount: number; buttons: SpecialKeyInfo[] } | null {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return null;

    const feature = proto.features.get(HidppFeature.SPECIAL_KEYS_BUTTONS);
    if (!feature) return null;

    // GetCount (function 0x00)
    const countResp = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x00);
    if (!countResp) return null;

    const countParsed = parseHidppMessage(countResp);
    if (!countParsed) return null;

    const buttonCount = countParsed.params[0];
    const buttons: SpecialKeyInfo[] = [];

    for (let i = 0; i < buttonCount; i++) {
      try {
        // GetCidInfo (function 0x01) — index
        const cidResp = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x01, [i]);
        if (!cidResp) continue;

        const cidParsed = parseHidppMessage(cidResp);
        if (!cidParsed) continue;

        const controlId = (cidParsed.params[0] << 8) | cidParsed.params[1];
        const taskId = (cidParsed.params[2] << 8) | cidParsed.params[3];
        const flags = cidParsed.params[4];

        buttons.push({
          index: i,
          controlId,
          taskId,
          remappable: !!(flags & 0x10),
          divertable: !!(flags & 0x20),
          persistentDivert: !!(flags & 0x40),
          rawXY: !!(flags & 0x80),
        });
      } catch {
      }
    }

    return { buttonCount, buttons };
  }

  remapButton(devicePath: string, controlId: number, newTaskId: number): boolean {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return false;

    const feature = proto.features.get(HidppFeature.SPECIAL_KEYS_BUTTONS);
    if (!feature) return false;

    // SetCidReporting (function 0x03)
    try {
      this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x03, [
        (controlId >> 8) & 0xff,
        controlId & 0xff,
        (newTaskId >> 8) & 0xff,
        newTaskId & 0xff,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  getSmartShift(devicePath: string): { autoShift: boolean; threshold: number } | null {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return null;

    const feature = proto.features.get(HidppFeature.SMART_SHIFT);
    if (!feature) return null;

    // GetStatus (function 0x00)
    const response = this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x00);
    if (!response) return null;

    const parsed = parseHidppMessage(response);
    if (!parsed) return null;

    return {
      autoShift: parsed.params[0] === 2,
      threshold: parsed.params[1],
    };
  }

  setSmartShift(devicePath: string, autoShift: boolean, threshold: number): boolean {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return false;

    const feature = proto.features.get(HidppFeature.SMART_SHIFT);
    if (!feature) return false;

    // SetStatus (function 0x01)
    try {
      this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x01, [
        autoShift ? 0x02 : 0x01,
        threshold & 0xff,
      ]);
      return true;
    } catch {
      return false;
    }
  }

  disposeDevice(devicePath: string): void {
    this.deviceProtocols.delete(devicePath);
  }

  dispose(): void {
    this.deviceProtocols.clear();
  }
}

export interface SpecialKeyInfo {
  index: number;
  controlId: number;
  taskId: number;
  remappable: boolean;
  divertable: boolean;
  persistentDivert: boolean;
  rawXY: boolean;
}

export class HidppProtocolError extends Error {
  constructor(
    public readonly errorCode: HidppError,
    public readonly featureIndex: number,
    public readonly functionId: number,
  ) {
    super(`HID++ error ${HidppError[errorCode]} (0x${errorCode.toString(16)}) on feature 0x${featureIndex.toString(16)}, function ${functionId}`);
    this.name = 'HidppProtocolError';
  }
}
