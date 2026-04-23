import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Device, DeviceProfile } from '../../../shared/device-types';
import { HidDeviceInfo } from '../../../shared/ipc-channels';

export interface DevicesState {
  discovered: HidDeviceInfo[];
  connected: Device[];
  selectedDeviceId: string | null;
  profiles: Record<string, DeviceProfile[]>;
  loading: boolean;
  error: string | null;
}

const initialState: DevicesState = {
  discovered: [],
  connected: [],
  selectedDeviceId: null,
  profiles: {},
  loading: false,
  error: null,
};

export const scanDevices = createAsyncThunk('devices/scan', async () => {
  const devices: Device[] = await window.device.scan();
  return devices;
});

export const refreshAllDevices = createAsyncThunk('devices/refreshAll', async () => {
  const devices: Device[] = await window.device.getAll();
  return devices;
});

export const setDeviceDpi = createAsyncThunk(
  'devices/setDpi',
  async ({ hidPath, dpi }: { hidPath: string; dpi: number }) => {
    const ok = await window.device.setDpi(hidPath, dpi);
    if (ok === false) throw new Error('setDpi failed on device');
    return { hidPath, dpi };
  }
);

export const setDeviceRgb = createAsyncThunk(
  'devices/setRgb',
  async ({ hidPath, zoneIndex, r, g, b }: { hidPath: string; zoneIndex: number; r: number; g: number; b: number }) => {
    const ok = await window.device.setRgb(hidPath, zoneIndex, r, g, b);
    if (ok === false) throw new Error('setRgb failed on device');
    return { hidPath, zoneIndex, r, g, b };
  }
);

export const setDeviceRgbEffect = createAsyncThunk(
  'devices/setRgbEffect',
  async (params: {
    hidPath: string;
    zoneIndex: number;
    effectId: number;
    r: number;
    g: number;
    b: number;
    speed: number;
    brightness: number;
  }) => {
    const ok = await window.device.setRgbEffect(
      params.hidPath, params.zoneIndex, params.effectId,
      params.r, params.g, params.b, params.speed, params.brightness
    );
    if (ok === false) throw new Error('setRgbEffect failed on device');
    return params;
  }
);

export const refreshBattery = createAsyncThunk(
  'devices/refreshBattery',
  async (hidPath: string) => {
    const device: Device = await window.device.refreshBattery(hidPath);
    return device;
  }
);

// --- Profile thunks ---

export const loadProfiles = createAsyncThunk(
  'devices/loadProfiles',
  async (modelId: string) => {
    const profiles: DeviceProfile[] = await window.profile.getAll(modelId);
    return { modelId, profiles };
  }
);

export const createProfile = createAsyncThunk(
  'devices/createProfile',
  async ({ modelId, name, baseProfile }: { modelId: string; name: string; baseProfile?: DeviceProfile }) => {
    const profile: DeviceProfile = await window.profile.create(modelId, name, baseProfile);
    return { modelId, profile };
  }
);

export const updateProfile = createAsyncThunk(
  'devices/updateProfile',
  async ({ modelId, profileId, updates }: { modelId: string; profileId: string; updates: Partial<DeviceProfile> }) => {
    const profile: DeviceProfile | null = await window.profile.update(modelId, profileId, updates);
    return { modelId, profileId, profile };
  }
);

export const deleteProfile = createAsyncThunk(
  'devices/deleteProfile',
  async ({ modelId, profileId }: { modelId: string; profileId: string }) => {
    await window.profile.delete(modelId, profileId);
    return { modelId, profileId };
  }
);

export const setActiveProfile = createAsyncThunk(
  'devices/setActiveProfile',
  async ({ modelId, profileId }: { modelId: string; profileId: string }) => {
    await window.profile.setActive(modelId, profileId);
    return { modelId, profileId };
  }
);

export const exportProfile = createAsyncThunk(
  'devices/exportProfile',
  async ({ modelId, profileId }: { modelId: string; profileId: string }) => {
    const success: boolean = await window.profile.export(modelId, profileId);
    return success;
  }
);

export const importProfile = createAsyncThunk(
  'devices/importProfile',
  async (modelId: string) => {
    const profile: DeviceProfile | null = await window.profile.import(modelId);
    return { modelId, profile };
  }
);

const devicesSlice = createSlice({
  name: 'devices',
  initialState,
  reducers: {
    setDiscoveredDevices(state, action: PayloadAction<HidDeviceInfo[]>) {
      state.discovered = action.payload;
    },
    selectDevice(state, action: PayloadAction<string | null>) {
      state.selectedDeviceId = action.payload;
    },
    clearError(state) {
      state.error = null;
    },
    profileAutoSwitched(state, action: PayloadAction<{ modelId: string; profileId: string }>) {
      const { modelId, profileId } = action.payload;
      const device = state.connected.find((d) => d.modelId === modelId);
      if (device) {
        const profile = state.profiles[modelId]?.find((p) => p.id === profileId);
        if (profile) device.activeProfile = profile;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(scanDevices.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(scanDevices.fulfilled, (state, action) => {
        state.loading = false;
        state.connected = action.payload;
        if (action.payload.length > 0 && !state.selectedDeviceId) {
          state.selectedDeviceId = action.payload[0].id;
        }
      })
      .addCase(scanDevices.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to scan devices';
      })
      .addCase(refreshAllDevices.fulfilled, (state, action) => {
        state.connected = action.payload;
      })
      .addCase(setDeviceDpi.fulfilled, (state, action) => {
        const device = state.connected.find((d) => d.hidPath === action.payload.hidPath);
        if (device?.activeProfile.dpi) {
          device.activeProfile.dpi.levels.forEach((l) => (l.isActive = false));
          const level = device.activeProfile.dpi.levels.find((l) => l.dpi === action.payload.dpi);
          if (level) level.isActive = true;
        }
      })
      .addCase(refreshBattery.fulfilled, (state, action) => {
        if (action.payload) {
          const idx = state.connected.findIndex((d) => d.hidPath === action.payload.hidPath);
          if (idx >= 0) {
            state.connected[idx] = action.payload;
          }
        }
      })
      .addCase(loadProfiles.fulfilled, (state, action) => {
        const { modelId, profiles } = action.payload;
        state.profiles[modelId] = profiles;
        const device = state.connected.find((d) => d.modelId === modelId);
        if (device && profiles.length > 0) {
          const scannedDpi = device.activeProfile?.dpi;
          const active =
            profiles.find((p) => p.id === device.activeProfile?.id) ||
            profiles.find((p) => p.isDefault) ||
            profiles[0];
          device.activeProfile = { ...active, dpi: active.dpi ?? scannedDpi };
        }
      })
      .addCase(createProfile.fulfilled, (state, action) => {
        const { modelId, profile } = action.payload;
        if (!state.profiles[modelId]) state.profiles[modelId] = [];
        state.profiles[modelId].push(profile);
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        const { modelId, profileId, profile } = action.payload;
        if (profile && state.profiles[modelId]) {
          const idx = state.profiles[modelId].findIndex((p) => p.id === profileId);
          if (idx >= 0) state.profiles[modelId][idx] = profile;
        }
      })
      .addCase(deleteProfile.fulfilled, (state, action) => {
        const { modelId, profileId } = action.payload;
        if (state.profiles[modelId]) {
          state.profiles[modelId] = state.profiles[modelId].filter((p) => p.id !== profileId);
        }
      })
      .addCase(setActiveProfile.fulfilled, (state, action) => {
        const { modelId, profileId } = action.payload;
        const device = state.connected.find((d) => d.modelId === modelId);
        if (device) {
          const profiles = state.profiles[modelId];
          const profile = profiles?.find((p) => p.id === profileId);
          if (profile) device.activeProfile = profile;
        }
      })
      .addCase(importProfile.fulfilled, (state, action) => {
        const { modelId, profile } = action.payload;
        if (profile) {
          if (!state.profiles[modelId]) state.profiles[modelId] = [];
          state.profiles[modelId].push(profile);
        }
      });
  },
});

export const { setDiscoveredDevices, selectDevice, clearError, profileAutoSwitched } = devicesSlice.actions;

export default devicesSlice.reducer;
