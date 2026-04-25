import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import { DeviceProfile } from '../shared/device-types';
import { normalizeProcessName } from './app-detection';

interface ProfileStoreData {
  version: number;
  devices: Record<string, DeviceProfileSet>;
}

interface DeviceProfileSet {
  modelId: string;
  activeProfileId: string;
  profiles: DeviceProfile[];
}

const STORE_VERSION = 1;

export class ProfileStore {
  private dataPath: string;
  private data: ProfileStoreData;

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'profiles.json');
    this.data = this.loadOrCreate();
  }

  private loadOrCreate(): ProfileStoreData {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        return JSON.parse(raw) as ProfileStoreData;
      }
    } catch {
    }
    return { version: STORE_VERSION, devices: {} };
  }

  private save(): void {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getProfiles(modelId: string): DeviceProfile[] {
    return this.data.devices[modelId]?.profiles || [];
  }

  getActiveProfileId(modelId: string): string | null {
    return this.data.devices[modelId]?.activeProfileId || null;
  }

  createProfile(modelId: string, name: string, baseProfile?: DeviceProfile): DeviceProfile {
    const profile: DeviceProfile = {
      id: uuidv4(),
      name,
      isDefault: false,
      dpi: baseProfile?.dpi ? JSON.parse(JSON.stringify(baseProfile.dpi)) : undefined,
      lighting: baseProfile?.lighting ? JSON.parse(JSON.stringify(baseProfile.lighting)) : undefined,
      assignments: baseProfile?.assignments ? JSON.parse(JSON.stringify(baseProfile.assignments)) : undefined,
      applicationPath: undefined,
      applicationName: undefined,
      executableName: undefined,
      detectionExecutables: undefined,
    };

    if (!this.data.devices[modelId]) {
      this.data.devices[modelId] = {
        modelId,
        activeProfileId: profile.id,
        profiles: [],
      };
    }

    this.data.devices[modelId].profiles.push(profile);
    this.save();
    return profile;
  }

  updateProfile(modelId: string, profileId: string, updates: Partial<DeviceProfile>): DeviceProfile | null {
    const deviceData = this.data.devices[modelId];
    if (!deviceData) return null;

    const idx = deviceData.profiles.findIndex((p) => p.id === profileId);
    if (idx < 0) return null;

    const profile = deviceData.profiles[idx];
    if (updates.name !== undefined) profile.name = updates.name;
    if (updates.dpi !== undefined) profile.dpi = updates.dpi;
    if (updates.lighting !== undefined) profile.lighting = updates.lighting;
    if (updates.assignments !== undefined) profile.assignments = updates.assignments;
    if ('applicationPath' in updates) profile.applicationPath = updates.applicationPath || undefined;
    if ('applicationName' in updates) profile.applicationName = updates.applicationName || undefined;
    if ('executableName' in updates) profile.executableName = updates.executableName || undefined;
    if ('detectionExecutables' in updates) {
      profile.detectionExecutables = updates.detectionExecutables && updates.detectionExecutables.length > 0
        ? [...updates.detectionExecutables]
        : undefined;
    }

    this.save();
    return profile;
  }

  deleteProfile(modelId: string, profileId: string): boolean {
    const deviceData = this.data.devices[modelId];
    if (!deviceData) return false;

    const idx = deviceData.profiles.findIndex((p) => p.id === profileId);
    if (idx < 0) return false;
    if (deviceData.profiles[idx].isDefault) return false;

    deviceData.profiles.splice(idx, 1);

    if (deviceData.activeProfileId === profileId && deviceData.profiles.length > 0) {
      deviceData.activeProfileId = deviceData.profiles[0].id;
    }

    this.save();
    return true;
  }

  setActiveProfile(modelId: string, profileId: string): boolean {
    const deviceData = this.data.devices[modelId];
    if (!deviceData) return false;
    if (!deviceData.profiles.find((p) => p.id === profileId)) return false;

    deviceData.activeProfileId = profileId;
    this.save();
    return true;
  }

  setDefaultProfile(modelId: string, profile: DeviceProfile): void {
    if (!this.data.devices[modelId]) {
      this.data.devices[modelId] = {
        modelId,
        activeProfileId: profile.id,
        profiles: [profile],
      };
    } else {
      const existing = this.data.devices[modelId].profiles.find((p) => p.isDefault);
      if (!existing) {
        this.data.devices[modelId].profiles.unshift(profile);
      }
    }
    this.save();
  }

  exportProfile(modelId: string, profileId: string): string | null {
    const deviceData = this.data.devices[modelId];
    if (!deviceData) return null;

    const profile = deviceData.profiles.find((p) => p.id === profileId);
    if (!profile) return null;

    return JSON.stringify({ version: STORE_VERSION, modelId, profile }, null, 2);
  }

  findProfileForApp(modelId: string, appId: string): DeviceProfile | null {
    const deviceData = this.data.devices[modelId];
    if (!deviceData) return null;

    const normalizedAppId = normalizeProcessName(appId);
    return deviceData.profiles.find((profile) => {
      const candidates = [
        profile.executableName,
        profile.applicationPath,
        ...(profile.detectionExecutables || []),
      ];

      return candidates.some((candidate) => candidate && normalizeProcessName(candidate) === normalizedAppId);
    }) || null;
  }

  importProfile(modelId: string, json: string): DeviceProfile | null {
    try {
      const imported = JSON.parse(json);
      if (!imported.profile) return null;

      const profile: DeviceProfile = {
        ...imported.profile,
        id: uuidv4(),
        isDefault: false,
      };

      if (!this.data.devices[modelId]) {
        this.data.devices[modelId] = {
          modelId,
          activeProfileId: profile.id,
          profiles: [],
        };
      }

      this.data.devices[modelId].profiles.push(profile);
      this.save();
      return profile;
    } catch {
      return null;
    }
  }
}
