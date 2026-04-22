/**
 * HID++ 2.0 Protocol definitions for Logitech devices
 * 
 * Reference: https://lekensteyn.nl/files/logitech/
 * Report structure:
 *   SHORT  (0x10): 7 bytes total  [reportId, deviceIndex, featureIndex, funcId_swId, param0, param1, param2]
 *   LONG   (0x11): 20 bytes total [reportId, deviceIndex, featureIndex, funcId_swId, ...params(16)]
 *   VERY_LONG (0x12): 64 bytes total
 */

export const LOGITECH_VENDOR_ID = 0x046d;

export enum HidppReportType {
  SHORT = 0x10,
  LONG = 0x11,
  VERY_LONG = 0x12,
}

export const REPORT_LENGTHS: Record<HidppReportType, number> = {
  [HidppReportType.SHORT]: 7,
  [HidppReportType.LONG]: 20,
  [HidppReportType.VERY_LONG]: 64,
};

/**
 * HID++ 2.0 Feature IDs
 * Each feature provides a set of functions accessible via feature index
 */
export enum HidppFeature {
  ROOT = 0x0000, // IRoot - feature discovery
  FEATURE_SET = 0x0001, // IFeatureSet - list all features
  FEATURE_INFO = 0x0002, // IFeatureInfo

  // Device info
  DEVICE_FW_VERSION = 0x0003,
  DEVICE_UNIT_ID = 0x0004,
  DEVICE_NAME = 0x0005,
  DEVICE_TYPE_AND_NAME = 0x0007,

  // Power
  BATTERY_UNIFIED = 0x1000,
  BATTERY_VOLTAGE = 0x1001,
  UNIFIED_BATTERY = 0x1004,

  // Keyboard
  KEYBOARD_REPROGRAMMABLE_KEYS = 0x1b00,
  SPECIAL_KEYS_BUTTONS = 0x1b04,
  FN_INVERSION = 0x0040,
  GAME_MODE = 0x4522,

  // Mouse
  ADJUSTABLE_DPI = 0x2201,
  ANGLE_SNAPPING = 0x2230,
  SURFACE_TUNING = 0x2240,
  THUMB_WHEEL = 0x2150,
  SMART_SHIFT = 0x2110,
  HIRES_SCROLL = 0x2121,
  LOWRES_SCROLL = 0x2130,

  // Lighting
  RGB_EFFECTS = 0x8070,
  PER_KEY_LIGHTING_V2 = 0x8071,
  COLOR_LED_EFFECTS = 0x8100,

  // Audio (headsets)
  EQUALIZER = 0x8300,
  SIDETONE = 0x8310,

  // Profiles/onboard memory
  ONBOARD_PROFILES = 0x8100,
  PROFILE_MANAGEMENT = 0x8110,

  // Device reset/pairing
  DEVICE_RESET = 0x0020,
  CHANGE_HOST = 0x1814,
}

/**
 * Error codes in HID++ 2.0 responses
 */
export enum HidppError {
  NO_ERROR = 0x00,
  UNKNOWN = 0x01,
  INVALID_ARGUMENT = 0x02,
  OUT_OF_RANGE = 0x03,
  HARDWARE_ERROR = 0x04,
  LOGITECH_INTERNAL = 0x05,
  INVALID_FEATURE_INDEX = 0x06,
  INVALID_FUNCTION_ID = 0x07,
  BUSY = 0x08,
  UNSUPPORTED = 0x09,
}

/**
 * Represents a HID++ request/response
 */
export interface HidppMessage {
  reportType: HidppReportType;
  deviceIndex: number; // 0xFF for receiver, 0x01-0x06 for devices
  featureIndex: number;
  functionId: number;
  softwareId: number;
  params: number[];
}

/**
 * Device index constants
 */
export const DEVICE_INDEX = {
  RECEIVER: 0xff,
  CORDED: 0x00,
  WIRELESS_1: 0x01,
  WIRELESS_2: 0x02,
  WIRELESS_3: 0x03,
  WIRELESS_4: 0x04,
  WIRELESS_5: 0x05,
  WIRELESS_6: 0x06,
} as const;

/**
 * Known Logitech product IDs (subset of common devices)
 */
export const KNOWN_DEVICES: Record<number, { name: string; type: string }> = {
  // Receivers
  0xc548: { name: 'Bolt Receiver', type: 'receiver' },
  0xc52b: { name: 'Unifying Receiver', type: 'receiver' },
  0xc539: { name: 'Lightspeed Receiver', type: 'receiver' },
  0xc53a: { name: 'Powerplay Receiver', type: 'receiver' },

  // Mice
  0xc332: { name: 'G502', type: 'mouse' },
  0xc090: { name: 'G502 X Plus', type: 'mouse' },
  0xc091: { name: 'G502 X Lightspeed', type: 'mouse' },
  0xc09d: { name: 'PRO X Superlight 2', type: 'mouse' },
  0xc547: { name: 'G502 Hero', type: 'mouse' },
  0xc08b: { name: 'G502 Lightspeed', type: 'mouse' },
  0xc088: { name: 'G Pro Wireless', type: 'mouse' },
  0xc084: { name: 'G203', type: 'mouse' },

  // Keyboards
  0xc33c: { name: 'G513 RGB', type: 'keyboard' },
  0xc343: { name: 'G915 TKL', type: 'keyboard' },
  0xc339: { name: 'G Pro Keyboard', type: 'keyboard' },
  0xc33f: { name: 'G815', type: 'keyboard' },

  // Headsets
  0x0a87: { name: 'G733 Lightspeed', type: 'headset' },
  0x0a9f: { name: 'G PRO X 2', type: 'headset' },
  0x0ab5: { name: 'G535 Lightspeed', type: 'headset' },
};

/**
 * Builds a HID++ 2.0 message buffer
 */
export function buildHidppMessage(msg: HidppMessage): number[] {
  const length = REPORT_LENGTHS[msg.reportType];
  const buffer = new Array(length).fill(0);

  buffer[0] = msg.reportType;
  buffer[1] = msg.deviceIndex;
  buffer[2] = msg.featureIndex;
  buffer[3] = (msg.functionId << 4) | (msg.softwareId & 0x0f);

  for (let i = 0; i < msg.params.length && i + 4 < length; i++) {
    buffer[i + 4] = msg.params[i];
  }

  return buffer;
}

/**
 * Parses a HID++ 2.0 response buffer
 */
export function parseHidppMessage(data: number[]): HidppMessage | null {
  if (data.length < 7) return null;

  const reportType = data[0] as HidppReportType;
  if (!(reportType in REPORT_LENGTHS)) return null;

  return {
    reportType,
    deviceIndex: data[1],
    featureIndex: data[2],
    functionId: (data[3] >> 4) & 0x0f,
    softwareId: data[3] & 0x0f,
    params: data.slice(4),
  };
}

/**
 * Check if a response is an error
 */
export function isHidppError(data: number[]): HidppError | null {
  // Error responses use feature index 0xFF
  if (data.length >= 7 && data[2] === 0xff) {
    return data[6] as HidppError;
  }
  return null;
}
