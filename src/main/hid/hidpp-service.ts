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
import { DeviceProfile, DpiConfig } from '../../shared/device-types';

const SOFTWARE_ID = 0x07;
const FEATURE_DISCOVERY_TIMEOUT_MS = 2000;
const ONBOARD_PROFILE_DIRECTORY_ADDRESS = 0x0000;
const ONBOARD_PROFILE_DIRECTORY_ENTRY_SIZE = 4;
const ONBOARD_PROFILE_DPI_SLOT_COUNT = 5;
const ONBOARD_PROFILE_DISABLED_DPI = 0xffff;
const ONBOARD_PROFILE_DEFAULT_DPI_OFFSET = 1;
const ONBOARD_PROFILE_SWITCHED_DPI_OFFSET = 2;
const ONBOARD_PROFILE_CURRENT_DPI_OFFSET = 3;
const ONBOARD_PROFILE_DPI_LIST_OFFSET = 4;
const ONBOARD_PROFILE_MEMORY_CHUNK_SIZE = 16;
const LIGHTING_SPEED_UI_MAX = 100;
const COLOR_LED_EFFECT_MIN_PERIOD = 150;
const COLOR_LED_EFFECT_MAX_PERIOD = 3000;

const OnboardProfileOpcode = {
  GET_PROFILES_DESCR: 0x00,
  GET_CURRENT_PROFILE: 0x40,
  MEMORY_READ: 0x50,
  MEMORY_ADDR_WRITE: 0x60,
  MEMORY_WRITE: 0x70,
  MEMORY_WRITE_END: 0x80,
  GET_CURRENT_DPI_INDEX: 0xb0,
  SET_CURRENT_DPI_INDEX: 0xc0,
} as const;

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

interface OnboardProfilesDescriptor {
  profileCount: number;
  sectorSize: number;
  effectiveSectorSize: number;
}

interface OnboardProfilesFeatureContext {
  deviceIndex: number;
  featureIndex: number;
}

interface HidppDpiInfo {
  current: number;
  defaultDpi: number;
  min: number;
  max: number;
  step: number;
  levels: number[];
  activeLevelIndex: number;
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

  getDpiInfo(devicePath: string): HidppDpiInfo | null {
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

    return {
      current: currentDpi,
      defaultDpi,
      min,
      max,
      step,
      levels: dpiValues,
      activeLevelIndex: dpiValues.indexOf(currentDpi),
    };
  }

  getActiveOnboardProfileDpiInfo(devicePath: string): HidppDpiInfo | null {
    const featureContext = this.getOnboardProfilesFeatureContext(devicePath);
    if (!featureContext) return null;

    try {
      const descriptor = this.getOnboardProfilesDescriptor(devicePath, featureContext);
      if (!descriptor) return null;

      const activeProfileIndex = this.getCurrentOnboardProfileIndex(devicePath, featureContext, descriptor.profileCount);
      if (activeProfileIndex === null) return null;

      const directorySector = this.readOnboardMemory(
        devicePath,
        featureContext,
        ONBOARD_PROFILE_DIRECTORY_ADDRESS,
        descriptor.effectiveSectorSize,
      );

      const activeProfileSectorAddress = this.resolveActiveProfileSectorAddress(
        directorySector,
        descriptor.profileCount,
        activeProfileIndex,
      );
      if (activeProfileSectorAddress === null) return null;

      const activeProfileSector = this.readOnboardMemory(
        devicePath,
        featureContext,
        activeProfileSectorAddress,
        descriptor.effectiveSectorSize,
      );

      const currentDpiSlotIndex = this.getCurrentOnboardDpiIndex(devicePath, featureContext);
      return this.parseOnboardProfileDpiInfo(activeProfileSector, currentDpiSlotIndex);
    } catch {
      return null;
    }
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

  syncActiveProfileDpiToHardware(devicePath: string, profile: DeviceProfile): boolean {
    const dpiConfig = profile.dpi;
    if (!dpiConfig || dpiConfig.levels.length === 0) return false;

    const featureContext = this.getOnboardProfilesFeatureContext(devicePath);
    if (!featureContext) return false;

    try {
      const descriptor = this.getOnboardProfilesDescriptor(devicePath, featureContext);
      if (!descriptor) return false;

      const activeProfileIndex = this.getCurrentOnboardProfileIndex(devicePath, featureContext, descriptor.profileCount);
      if (activeProfileIndex === null) return false;

      const directorySector = this.readOnboardMemory(
        devicePath,
        featureContext,
        ONBOARD_PROFILE_DIRECTORY_ADDRESS,
        descriptor.effectiveSectorSize,
      );

      const activeProfileSectorAddress = this.resolveActiveProfileSectorAddress(
        directorySector,
        descriptor.profileCount,
        activeProfileIndex,
      );
      if (activeProfileSectorAddress === null) return false;

      const activeProfileSector = this.readOnboardMemory(
        devicePath,
        featureContext,
        activeProfileSectorAddress,
        descriptor.effectiveSectorSize,
      );

      const nextSector = this.patchActiveProfileDpiSector(activeProfileSector, descriptor.effectiveSectorSize, dpiConfig);
      this.writeOnboardMemory(devicePath, featureContext, activeProfileSectorAddress, nextSector);

      const desiredDpiIndex = this.resolveActiveDpiSlotIndex(
        dpiConfig,
        Math.min(dpiConfig.levels.length, ONBOARD_PROFILE_DPI_SLOT_COUNT),
      );
      const currentDpiIndex = this.getCurrentOnboardDpiIndex(devicePath, featureContext);
      if (currentDpiIndex !== desiredDpiIndex) {
        this.setCurrentOnboardDpiIndex(devicePath, featureContext, desiredDpiIndex);
      }

      return true;
    } catch {
      return false;
    }
  }

  private getOnboardProfilesFeatureContext(devicePath: string): OnboardProfilesFeatureContext | null {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return null;

    const feature = proto.features.get(HidppFeature.ONBOARD_PROFILES);
    if (!feature) return null;

    return {
      deviceIndex: proto.deviceIndex,
      featureIndex: feature.featureIndex,
    };
  }

  private sendOnboardProfilesRequest(
    devicePath: string,
    context: OnboardProfilesFeatureContext,
    opcode: number,
    params: number[] = [],
  ): number[] | null {
    return this.sendRequest(
      devicePath,
      context.deviceIndex,
      context.featureIndex,
      opcode >> 4,
      params,
    );
  }

  private getOnboardProfilesDescriptor(
    devicePath: string,
    context: OnboardProfilesFeatureContext,
  ): OnboardProfilesDescriptor | null {
    const response = this.sendOnboardProfilesRequest(devicePath, context, OnboardProfileOpcode.GET_PROFILES_DESCR);
    if (!response) return null;

    const parsed = parseHidppMessage(response);
    if (!parsed) return null;

    const profileCount = parsed.params[3] || 0;
    const sectorSize = ((parsed.params[7] ?? 0) << 8) | (parsed.params[8] ?? 0);
    if (profileCount <= 0 || sectorSize <= 0) return null;

    return {
      profileCount,
      sectorSize,
      effectiveSectorSize: sectorSize === 0xff ? 0x100 : sectorSize,
    };
  }

  private getCurrentOnboardProfileIndex(
    devicePath: string,
    context: OnboardProfilesFeatureContext,
    profileCount: number,
  ): number | null {
    const response = this.sendOnboardProfilesRequest(devicePath, context, OnboardProfileOpcode.GET_CURRENT_PROFILE);
    if (!response) return null;

    const parsed = parseHidppMessage(response);
    if (!parsed) return null;

    const activeProfileIndex = parsed.params[1];
    if (activeProfileIndex !== undefined) {
      if (activeProfileIndex >= 1 && activeProfileIndex <= profileCount) {
        return activeProfileIndex - 1;
      }

      if (activeProfileIndex >= 0 && activeProfileIndex < profileCount) {
        return activeProfileIndex;
      }
    }

    const fallbackProfileIndex = parsed.params[0];
    if (fallbackProfileIndex !== undefined && fallbackProfileIndex >= 0 && fallbackProfileIndex < profileCount) {
      return fallbackProfileIndex;
    }

    return null;
  }

  private getCurrentOnboardDpiIndex(devicePath: string, context: OnboardProfilesFeatureContext): number | null {
    const response = this.sendOnboardProfilesRequest(devicePath, context, OnboardProfileOpcode.GET_CURRENT_DPI_INDEX);
    if (!response) return null;

    const parsed = parseHidppMessage(response);
    if (!parsed) return null;

    return parsed.params[0] ?? null;
  }

  private setCurrentOnboardDpiIndex(devicePath: string, context: OnboardProfilesFeatureContext, dpiIndex: number): void {
    this.sendOnboardProfilesRequest(devicePath, context, OnboardProfileOpcode.SET_CURRENT_DPI_INDEX, [dpiIndex & 0xff]);
  }

  private readOnboardMemory(
    devicePath: string,
    context: OnboardProfilesFeatureContext,
    sectorAddress: number,
    length: number,
  ): Uint8Array {
    const buffer = new Uint8Array(length);

    for (let offset = 0; offset < length; offset += ONBOARD_PROFILE_MEMORY_CHUNK_SIZE) {
      const remainingBytes = length - offset;
      const isFinalPartialChunk = remainingBytes < ONBOARD_PROFILE_MEMORY_CHUNK_SIZE && offset > 0;
      const chunkOffset = isFinalPartialChunk ? length - ONBOARD_PROFILE_MEMORY_CHUNK_SIZE : offset;
      const response = this.sendOnboardProfilesRequest(devicePath, context, OnboardProfileOpcode.MEMORY_READ, [
        (sectorAddress >> 8) & 0xff,
        sectorAddress & 0xff,
        (chunkOffset >> 8) & 0xff,
        chunkOffset & 0xff,
      ]);
      if (!response) {
        throw new Error('Failed to read onboard profile memory');
      }

      const parsed = parseHidppMessage(response);
      if (!parsed || parsed.params.length < ONBOARD_PROFILE_MEMORY_CHUNK_SIZE) {
        throw new Error('Invalid onboard profile memory read response');
      }

      if (isFinalPartialChunk) {
        const partialStart = ONBOARD_PROFILE_MEMORY_CHUNK_SIZE - remainingBytes;
        buffer.set(parsed.params.slice(partialStart, ONBOARD_PROFILE_MEMORY_CHUNK_SIZE), offset);
        continue;
      }

      buffer.set(parsed.params.slice(0, Math.min(ONBOARD_PROFILE_MEMORY_CHUNK_SIZE, remainingBytes)), offset);
    }

    return buffer;
  }

  private writeOnboardMemory(
    devicePath: string,
    context: OnboardProfilesFeatureContext,
    sectorAddress: number,
    data: Uint8Array,
  ): void {
    this.sendOnboardProfilesRequest(devicePath, context, OnboardProfileOpcode.MEMORY_ADDR_WRITE, [
      (sectorAddress >> 8) & 0xff,
      sectorAddress & 0xff,
      0x00,
      0x00,
    ]);

    for (let offset = 0; offset < data.length; offset += ONBOARD_PROFILE_MEMORY_CHUNK_SIZE) {
      const chunk = data.subarray(offset, offset + ONBOARD_PROFILE_MEMORY_CHUNK_SIZE);
      if (chunk.length !== ONBOARD_PROFILE_MEMORY_CHUNK_SIZE) {
        throw new Error('Onboard profile sector write must use 16-byte chunks');
      }

      this.sendOnboardProfilesRequest(devicePath, context, OnboardProfileOpcode.MEMORY_WRITE, Array.from(chunk));
    }

    this.sendOnboardProfilesRequest(devicePath, context, OnboardProfileOpcode.MEMORY_WRITE_END);
  }

  private resolveActiveProfileSectorAddress(
    directorySector: Uint8Array,
    profileCount: number,
    activeProfileIndex: number,
  ): number | null {
    const profileSectorAddresses: number[] = [];

    for (
      let offset = 0;
      offset + ONBOARD_PROFILE_DIRECTORY_ENTRY_SIZE <= directorySector.length && profileSectorAddresses.length < profileCount;
      offset += ONBOARD_PROFILE_DIRECTORY_ENTRY_SIZE
    ) {
      const sectorAddress = (directorySector[offset] << 8) | directorySector[offset + 1];
      if (sectorAddress === 0xffff) break;
      profileSectorAddresses.push(sectorAddress);
    }

    return profileSectorAddresses[activeProfileIndex] ?? null;
  }

  private patchActiveProfileDpiSector(
    sector: Uint8Array,
    sectorSize: number,
    dpiConfig: DpiConfig,
  ): Uint8Array {
    const nextSector = new Uint8Array(sector);
    const levelValues = dpiConfig.levels
      .slice(0, ONBOARD_PROFILE_DPI_SLOT_COUNT)
      .map((level) => this.normalizeDpiValue(level.dpi));
    const slotCount = levelValues.length;
    const activeIndex = this.resolveActiveDpiSlotIndex(dpiConfig, slotCount);
    const defaultIndex = this.resolveDefaultDpiSlotIndex(dpiConfig, activeIndex, slotCount);
    const switchedIndex = this.normalizeDpiSlotIndex(nextSector[ONBOARD_PROFILE_SWITCHED_DPI_OFFSET], slotCount, activeIndex);

    nextSector[ONBOARD_PROFILE_DEFAULT_DPI_OFFSET] = defaultIndex;
    nextSector[ONBOARD_PROFILE_SWITCHED_DPI_OFFSET] = switchedIndex;
    nextSector[ONBOARD_PROFILE_CURRENT_DPI_OFFSET] = activeIndex;

    for (let index = 0; index < ONBOARD_PROFILE_DPI_SLOT_COUNT; index++) {
      const dpi = levelValues[index] ?? ONBOARD_PROFILE_DISABLED_DPI;
      const dpiOffset = ONBOARD_PROFILE_DPI_LIST_OFFSET + (index * 2);
      nextSector[dpiOffset] = dpi & 0xff;
      nextSector[dpiOffset + 1] = (dpi >> 8) & 0xff;
    }

    const crc = this.computeLogitechCrcCcitt(nextSector.subarray(0, sectorSize - 2));
    nextSector[sectorSize - 2] = (crc >> 8) & 0xff;
    nextSector[sectorSize - 1] = crc & 0xff;
    return nextSector;
  }

  private parseOnboardProfileDpiInfo(sector: Uint8Array, currentDpiSlotIndex: number | null): HidppDpiInfo | null {
    const levels: number[] = [];
    const slotToLevelIndex = new Map<number, number>();

    for (let slotIndex = 0; slotIndex < ONBOARD_PROFILE_DPI_SLOT_COUNT; slotIndex++) {
      const dpiOffset = ONBOARD_PROFILE_DPI_LIST_OFFSET + (slotIndex * 2);
      const rawDpi = sector[dpiOffset] | (sector[dpiOffset + 1] << 8);
      if (rawDpi === ONBOARD_PROFILE_DISABLED_DPI || rawDpi === 0) {
        continue;
      }

      slotToLevelIndex.set(slotIndex, levels.length);
      levels.push(rawDpi);
    }

    if (levels.length === 0) return null;

    const defaultSlotIndex = sector[ONBOARD_PROFILE_DEFAULT_DPI_OFFSET] ?? 0;
    const activeSlotIndex = currentDpiSlotIndex ?? sector[ONBOARD_PROFILE_CURRENT_DPI_OFFSET] ?? defaultSlotIndex;
    const activeLevelIndex = slotToLevelIndex.get(activeSlotIndex) ?? slotToLevelIndex.get(defaultSlotIndex) ?? 0;
    const defaultLevelIndex = slotToLevelIndex.get(defaultSlotIndex) ?? activeLevelIndex;

    return {
      current: levels[activeLevelIndex] ?? levels[0],
      defaultDpi: levels[defaultLevelIndex] ?? levels[activeLevelIndex] ?? levels[0],
      min: Math.min(...levels),
      max: Math.max(...levels),
      step: 0,
      levels,
      activeLevelIndex,
    };
  }

  private resolveDefaultDpiSlotIndex(dpiConfig: DpiConfig, fallbackIndex: number, slotCount: number): number {
    const configuredDefaultIndex = dpiConfig.levels.findIndex((level) => level.dpi === dpiConfig.defaultDpi);
    return this.normalizeDpiSlotIndex(configuredDefaultIndex, slotCount, fallbackIndex);
  }

  private resolveActiveDpiSlotIndex(dpiConfig: DpiConfig, slotCount: number): number {
    const activeLevelIndex = dpiConfig.levels
      .slice(0, ONBOARD_PROFILE_DPI_SLOT_COUNT)
      .findIndex((level) => level.isActive);

    if (activeLevelIndex >= 0) {
      return this.normalizeDpiSlotIndex(activeLevelIndex, slotCount);
    }

    return this.normalizeDpiSlotIndex(dpiConfig.activeLevelIndex, slotCount);
  }

  private normalizeDpiSlotIndex(index: number | undefined, slotCount: number, fallbackIndex: number = 0): number {
    if (slotCount <= 0) return 0;
    if (index !== undefined && index >= 0 && index < slotCount) {
      return index;
    }
    return Math.max(0, Math.min(slotCount - 1, fallbackIndex));
  }

  private normalizeDpiValue(dpi: number): number {
    const normalized = Math.trunc(dpi);
    if (normalized < 0) return 0;
    if (normalized > 0xffff) return 0xffff;
    return normalized;
  }

  private computeLogitechCrcCcitt(data: Uint8Array): number {
    let crc = 0xffff;

    for (const byte of data) {
      const temp = (crc >> 8) ^ byte;
      crc = (crc << 8) & 0xffff;
      const quick = temp ^ (temp >> 4);
      crc ^= quick;
      crc ^= (quick << 5) & 0xffff;
      crc ^= (quick << 7) & 0xffff;
      crc &= 0xffff;
    }

    return crc;
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

  private buildColorLedEffectPayload(effectId: number, r: number, g: number, b: number, speed: number, brightness: number): number[] {
    const intensity = brightness === 100 ? 0 : Math.max(1, Math.min(100, brightness));

    const payload = new Array(11).fill(0);
    payload[0] = effectId;

    const applySpeedBytes = (offset: number) => {
      const effectPeriod = this.mapUiLightingSpeedToEffectPeriod(speed);
      payload[offset] = (effectPeriod >> 8) & 0xff;
      payload[offset + 1] = effectPeriod & 0xff;
    };

    switch (effectId) {
      case 0x01: // fixed
        payload[1] = r & 0xff;
        payload[2] = g & 0xff;
        payload[3] = b & 0xff;
        payload[4] = 0x00;
        break;
      case 0x03: // cycle
        applySpeedBytes(6);
        payload[8] = intensity;
        break;
      case 0x04: // wave
        applySpeedBytes(6);
        payload[8] = intensity;
        break;
      case 0x05: // starlight
        payload[1] = r & 0xff;
        payload[2] = g & 0xff;
        payload[3] = b & 0xff;
        payload[4] = r & 0xff;
        payload[5] = g & 0xff;
        payload[6] = b & 0xff;
        break;
      case 0x0a: // breathing
        payload[1] = r & 0xff;
        payload[2] = g & 0xff;
        payload[3] = b & 0xff;
        applySpeedBytes(4);
        payload[6] = 0x00;
        payload[7] = intensity;
        break;
      case 0x0b: // ripple
        payload[1] = r & 0xff;
        payload[2] = g & 0xff;
        payload[3] = b & 0xff;
        applySpeedBytes(5);
        break;
      default:
        payload[0] = 0x01;
        payload[1] = r & 0xff;
        payload[2] = g & 0xff;
        payload[3] = b & 0xff;
        payload[4] = 0x01;
        break;
    }

    return payload;
  }

  private mapUiLightingSpeedToEffectPeriod(speed: number): number {
    const clampedSpeed = Math.max(0, Math.min(LIGHTING_SPEED_UI_MAX, Math.trunc(speed)));
    const normalizedSpeed = clampedSpeed / LIGHTING_SPEED_UI_MAX;
    const effectPeriod = COLOR_LED_EFFECT_MAX_PERIOD - (normalizedSpeed * (COLOR_LED_EFFECT_MAX_PERIOD - COLOR_LED_EFFECT_MIN_PERIOD));
    return Math.round(effectPeriod);
  }

  setRgbZoneColor(devicePath: string, zoneIndex: number, r: number, g: number, b: number): boolean {
    const proto = this.deviceProtocols.get(devicePath);
    if (!proto) return false;

    const feature = proto.features.get(HidppFeature.RGB_EFFECTS);
    if (!feature) return false;

    // Color LED Effects SetZoneEffect (function nibble 0x03)
    try {
      this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x03, [
        zoneIndex,
        ...this.buildColorLedEffectPayload(0x01, r, g, b, 0, 100),
        0x01,
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

    // Color LED Effects SetZoneEffect (function nibble 0x03) — LONG report needed
    try {
      this.sendRequest(devicePath, proto.deviceIndex, feature.featureIndex, 0x03, [
        zoneIndex,
        ...this.buildColorLedEffectPayload(effectId, r, g, b, speed, brightness),
        0x01,
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
