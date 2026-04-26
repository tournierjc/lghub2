import { DeviceProfile, DpiConfig } from './device-types';

export function mergeProfileDpi(storedDpi?: DpiConfig, scannedDpi?: DpiConfig): DpiConfig | undefined {
  if (!storedDpi) return scannedDpi;
  if (!scannedDpi) return storedDpi;

  return scannedDpi.levels.length > storedDpi.levels.length ? scannedDpi : storedDpi;
}

export function mergeProfileStateWithScanned(
  profile: DeviceProfile,
  scannedState: Partial<Pick<DeviceProfile, 'dpi' | 'lighting' | 'assignments'>>,
): DeviceProfile {
  return {
    ...profile,
    dpi: mergeProfileDpi(profile.dpi, scannedState.dpi),
    lighting: profile.lighting ?? scannedState.lighting,
    assignments: profile.assignments ?? scannedState.assignments,
  };
}
