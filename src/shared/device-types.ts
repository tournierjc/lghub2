export enum DeviceType {
  MOUSE = 'mouse',
  KEYBOARD = 'keyboard',
  HEADSET = 'headset',
  SPEAKER = 'speaker',
  WEBCAM = 'webcam',
  MOUSEPAD = 'mousepad',
  MICROPHONE = 'microphone',
}

export enum ConnectionType {
  USB = 'usb',
  LIGHTSPEED = 'lightspeed',
  BLUETOOTH = 'bluetooth',
}

export enum LightingCapability {
  NONE = 'NONE',
  MOUSE_MONO_ZONAL = 'MOUSE_MONO_ZONAL',
  MOUSE_RGB_ZONAL = 'MOUSE_RGB_ZONAL',
  KEYBOARD_MONO_ZONAL = 'KEYBOARD_MONO_ZONAL',
  KEYBOARD_RGB_ZONAL = 'KEYBOARD_RGB_ZONAL',
  KEYBOARD_MONO_PER_KEY = 'KEYBOARD_MONO_PER_KEY',
  KEYBOARD_RGB_PER_KEY = 'KEYBOARD_RGB_PER_KEY',
  HEADSET_RGB_ZONAL = 'HEADSET_RGB_ZONAL',
  HEADSET_RGB_PER_KEY = 'HEADSET_RGB_PER_KEY',
  SPEAKER_RGB_ZONAL = 'SPEAKER_RGB_ZONAL',
  GAMEBOARD_RGB_ZONAL = 'GAMEBOARD_RGB_ZONAL',
  MOUSEPAD_RGB_ZONAL = 'MOUSEPAD_RGB_ZONAL',
  MICROPHONE_RGB_PER_KEY = 'MICROPHONE_RGB_PER_KEY',
  ILLUMINATION_LIGHT_RGB_PER_KEY = 'ILLUMINATION_LIGHT_RGB_PER_KEY',
}

export enum LightingEffect {
  SOLID = 'SOLID',
  COLOR_CYCLE = 'COLOR_CYCLE',
  STARLIGHT = 'STARLIGHT',
  BREATHING = 'BREATHING',
  WAVE = 'WAVE',
  RIPPLE = 'RIPPLE',
  SCREEN_SAMPLER = 'SCREEN_SAMPLER',
  AUDIO_VISUALIZER = 'AUDIO_VISUALIZER',
}

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export interface LightingZone {
  id: string;
  name: string;
  ledCount: number;
}

export interface LightingConfig {
  effect: LightingEffect;
  colors: RGBColor[];
  speed: number;
  brightness: number;
  zones?: string[];
}

export interface DpiLevel {
  dpi: number;
  color: RGBColor;
  isActive: boolean;
}

export interface DpiConfig {
  levels: DpiLevel[];
  supportedValues?: number[];
  activeLevelIndex: number;
  defaultDpi: number;
}

export interface BatteryInfo {
  percentage: number;
  charging: boolean;
  voltage?: number;
}

export interface DeviceProfile {
  id: string;
  name: string;
  isDefault: boolean;
  applicationPath?: string;
  applicationName?: string;
  executableName?: string;
  detectionExecutables?: string[];
  dpi?: DpiConfig;
  lighting?: LightingConfig[];
  assignments?: Record<string, ButtonAssignment>;
}

export interface ButtonAssignment {
  buttonId: string;
  action: ButtonAction;
}

export interface KeyActionValue {
  key: string;
  modifiers: string[];
}

export interface ButtonAction {
  type: 'key' | 'macro' | 'dpi' | 'media' | 'system' | 'disabled';
  value: KeyActionValue | number | MacroAction[] | '';
}

export interface MacroAction {
  type: 'keydown' | 'keyup' | 'delay';
  value: number;
}

export interface EqPreset {
  id: string;
  name: string;
  bands: number[];
  isCustom: boolean;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  modelId: string;
  unitId: string;
  connectionType: ConnectionType;
  connected: boolean;
  hidPath: string;

  lightingCapability: LightingCapability;
  hasDpi: boolean;
  hasEq: boolean;
  hasMacros: boolean;
  hasBattery: boolean;

  battery?: BatteryInfo;
  firmware?: string;
  serialNumber?: string;

  activeProfile: DeviceProfile;
  profiles: DeviceProfile[];
  lightingZones?: LightingZone[];
  eqPresets?: EqPreset[];
}
