import { DeviceProfile, DpiConfig, RGBColor } from './device-types';

export function getDpiLevelColor(index: number): RGBColor {
  const colors: RGBColor[] = [
    { r: 0, g: 212, b: 255 },
    { r: 255, g: 165, b: 0 },
    { r: 0, g: 255, b: 100 },
    { r: 255, g: 50, b: 50 },
    { r: 180, g: 0, b: 255 },
  ];

  return colors[index % colors.length];
}

export function getSupportedDpiValues(dpiConfig?: DpiConfig): number[] {
  if (!dpiConfig) return [];
  return dpiConfig.supportedValues && dpiConfig.supportedValues.length > 0
    ? [...dpiConfig.supportedValues]
    : dpiConfig.levels.map((level) => level.dpi);
}

export function normalizeDpiConfig(dpiConfig: DpiConfig, preferredActiveDpi?: number): DpiConfig {
  const levels = dpiConfig.levels.length > 0
    ? dpiConfig.levels.map((level, index) => ({
        ...level,
        color: level.color ?? getDpiLevelColor(index),
      }))
    : [{
        dpi: preferredActiveDpi ?? dpiConfig.defaultDpi,
        color: getDpiLevelColor(0),
        isActive: true,
      }];

  const activeDpi = preferredActiveDpi ?? levels[dpiConfig.activeLevelIndex]?.dpi ?? levels[0].dpi;
  const activeLevelIndex = Math.max(0, levels.findIndex((level) => level.dpi === activeDpi));
  const defaultDpi = levels.some((level) => level.dpi === dpiConfig.defaultDpi)
    ? dpiConfig.defaultDpi
    : levels[activeLevelIndex]?.dpi ?? levels[0].dpi;

  return {
    ...dpiConfig,
    levels: levels.map((level, index) => ({
      ...level,
      isActive: index === activeLevelIndex,
    })),
    supportedValues: getSupportedDpiValues(dpiConfig),
    activeLevelIndex,
    defaultDpi,
  };
}

function mergeSupportedDpiValues(storedDpi?: DpiConfig, scannedDpi?: DpiConfig): number[] | undefined {
  const values = scannedDpi?.supportedValues?.length
    ? scannedDpi.supportedValues
    : storedDpi?.supportedValues;

  return values ? [...new Set(values)] : undefined;
}

export function mergeProfileDpi(storedDpi?: DpiConfig, scannedDpi?: DpiConfig): DpiConfig | undefined {
  if (!storedDpi) return scannedDpi;
  if (!scannedDpi) return storedDpi;

  const merged = scannedDpi.levels.length > storedDpi.levels.length ? scannedDpi : storedDpi;
  return {
    ...merged,
    supportedValues: mergeSupportedDpiValues(storedDpi, scannedDpi),
  };
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
