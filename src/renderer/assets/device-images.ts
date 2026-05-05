/**
 * Optional device image assets.
 *
 * Keep this mapping intentionally small and explicit: per-device images vary in aspect ratio,
 * and explicit imports ensure webpack includes the assets in production builds.
 *
 * To add an image:
 * - Put it under `src/renderer/assets/devices/`
 * - Import it here and add it to `DEVICE_IMAGE_ASSETS` keyed by lowercased modelId (e.g. "c332")
 *
 * At runtime, users can also set a custom hardware photo per model (stored under Electron
 * `userData/device-images/`) from the device screen; that overrides bundled assets.
 */

export const DEVICE_IMAGE_ASSETS: Record<string, string> = {
  // Example:
  // c332: require('./devices/c332.png'),
};

export function getDeviceImageAsset(modelId: string): string | null {
  const key = modelId.toLowerCase();
  return DEVICE_IMAGE_ASSETS[key] ?? null;
}

