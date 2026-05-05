import { LightingCapability, LightingEffect } from '../shared/device-types';

export interface EffectPrefab {
  effect: LightingEffect;
  label: string;
  deviceSupport: LightingCapability[];
  hasColor: boolean;
  hasSpeed: boolean;
  hasBrightness: boolean;
  description?: string;
}

const FULL_EFFECT_SUPPORT: LightingCapability[] = [
  LightingCapability.MOUSE_MONO_ZONAL, LightingCapability.MOUSE_RGB_ZONAL,
  LightingCapability.KEYBOARD_MONO_ZONAL, LightingCapability.KEYBOARD_RGB_ZONAL,
  LightingCapability.KEYBOARD_MONO_PER_KEY, LightingCapability.KEYBOARD_RGB_PER_KEY,
  LightingCapability.HEADSET_RGB_ZONAL, LightingCapability.HEADSET_RGB_PER_KEY,
  LightingCapability.SPEAKER_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL,
  LightingCapability.MOUSEPAD_RGB_ZONAL, LightingCapability.MICROPHONE_RGB_PER_KEY,
  LightingCapability.ILLUMINATION_LIGHT_RGB_PER_KEY,
];

const STARLIGHT_SUPPORTED: LightingCapability[] = [
  LightingCapability.MOUSE_MONO_ZONAL, LightingCapability.MOUSE_RGB_ZONAL,
  LightingCapability.KEYBOARD_MONO_ZONAL, LightingCapability.KEYBOARD_RGB_ZONAL,
  LightingCapability.KEYBOARD_MONO_PER_KEY, LightingCapability.KEYBOARD_RGB_PER_KEY,
  LightingCapability.HEADSET_RGB_ZONAL, LightingCapability.SPEAKER_RGB_ZONAL,
  LightingCapability.GAMEBOARD_RGB_ZONAL, LightingCapability.MOUSEPAD_RGB_ZONAL,
];

const SCREEN_SAMPLER_SUPPORTED: LightingCapability[] = [
  LightingCapability.MOUSE_RGB_ZONAL, LightingCapability.MOUSEPAD_RGB_ZONAL,
  LightingCapability.SPEAKER_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL,
  LightingCapability.HEADSET_RGB_ZONAL,
];

const WAVE_SUPPORTED: LightingCapability[] = [
  LightingCapability.KEYBOARD_RGB_PER_KEY, LightingCapability.KEYBOARD_RGB_ZONAL,
  LightingCapability.MOUSEPAD_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL,
];

const RIPPLE_SUPPORTED: LightingCapability[] = [
  LightingCapability.KEYBOARD_RGB_PER_KEY,
];

export const EFFECT_PREFABS: EffectPrefab[] = [
  {
    effect: LightingEffect.SOLID,
    label: 'Solid',
    deviceSupport: FULL_EFFECT_SUPPORT,
    hasColor: true,
    hasSpeed: false,
    hasBrightness: true,
  },
  {
    effect: LightingEffect.COLOR_CYCLE,
    label: 'Color Cycle',
    deviceSupport: FULL_EFFECT_SUPPORT,
    hasColor: false,
    hasSpeed: true,
    hasBrightness: true,
    description: 'Cycles through colors automatically.',
  },
  {
    effect: LightingEffect.STARLIGHT,
    label: 'Starlight',
    deviceSupport: STARLIGHT_SUPPORTED,
    hasColor: true,
    hasSpeed: true,
    hasBrightness: true,
  },
  {
    effect: LightingEffect.BREATHING,
    label: 'Breathing',
    deviceSupport: FULL_EFFECT_SUPPORT,
    hasColor: true,
    hasSpeed: true,
    hasBrightness: true,
  },
  {
    effect: LightingEffect.WAVE,
    label: 'Wave',
    deviceSupport: WAVE_SUPPORTED,
    hasColor: false,
    hasSpeed: true,
    hasBrightness: true,
    description: 'Uses the device\'s built-in wave pattern.',
  },
  {
    effect: LightingEffect.RIPPLE,
    label: 'Ripple',
    deviceSupport: RIPPLE_SUPPORTED,
    hasColor: true,
    hasSpeed: true,
    hasBrightness: true,
  },
  {
    effect: LightingEffect.SCREEN_SAMPLER,
    label: 'Screen Sampler',
    deviceSupport: SCREEN_SAMPLER_SUPPORTED,
    hasColor: false,
    hasSpeed: false,
    hasBrightness: true,
    description: 'Matches color from screen center via software sampling. Choose zones and brightness, then Apply. Re-enable after switching profiles.',
  },
];

export interface AvailableEffect {
  id: LightingEffect;
  label: string;
}

export function getAvailableEffects(capability: LightingCapability): AvailableEffect[] {
  return EFFECT_PREFABS
    .filter((prefab) => prefab.deviceSupport.includes(capability))
    .map((prefab) => ({ id: prefab.effect, label: prefab.label }));
}

export function getEffectPrefab(effect: LightingEffect): EffectPrefab | undefined {
  return EFFECT_PREFABS.find((prefab) => prefab.effect === effect);
}
