import { LightingCapability, LightingEffect } from '../shared/device-types';

export interface EffectPrefab {
  name: string;
  id: string;
  type: string;
  deviceSupport: LightingCapability[];
}

export const EFFECT_PREFABS: EffectPrefab[] = [
  { name: 'SOLID', id: '37dd7c07-8ad3-44da-b88e-8d368872c9c8', type: 'SOLID', deviceSupport: [LightingCapability.MOUSE_MONO_ZONAL, LightingCapability.MOUSE_RGB_ZONAL, LightingCapability.KEYBOARD_MONO_ZONAL, LightingCapability.KEYBOARD_RGB_ZONAL, LightingCapability.KEYBOARD_MONO_PER_KEY, LightingCapability.KEYBOARD_RGB_PER_KEY, LightingCapability.HEADSET_RGB_ZONAL, LightingCapability.HEADSET_RGB_PER_KEY, LightingCapability.SPEAKER_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL, LightingCapability.MOUSEPAD_RGB_ZONAL, LightingCapability.MICROPHONE_RGB_PER_KEY, LightingCapability.ILLUMINATION_LIGHT_RGB_PER_KEY] },
  { name: 'COLOR_CYCLE', id: '63cab8b1-108a-4869-8b52-0268ae927c4c', type: 'COLOR_CYCLE', deviceSupport: [LightingCapability.MOUSE_MONO_ZONAL, LightingCapability.MOUSE_RGB_ZONAL, LightingCapability.KEYBOARD_MONO_ZONAL, LightingCapability.KEYBOARD_RGB_ZONAL, LightingCapability.KEYBOARD_MONO_PER_KEY, LightingCapability.KEYBOARD_RGB_PER_KEY, LightingCapability.HEADSET_RGB_ZONAL, LightingCapability.HEADSET_RGB_PER_KEY, LightingCapability.SPEAKER_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL, LightingCapability.MOUSEPAD_RGB_ZONAL, LightingCapability.MICROPHONE_RGB_PER_KEY, LightingCapability.ILLUMINATION_LIGHT_RGB_PER_KEY] },
  { name: 'STARLIGHT', id: 'a584cde8-fe14-4d9d-a4f2-3345ea0379bf', type: 'STARLIGHT', deviceSupport: [LightingCapability.MOUSE_MONO_ZONAL, LightingCapability.MOUSE_RGB_ZONAL, LightingCapability.KEYBOARD_MONO_ZONAL, LightingCapability.KEYBOARD_RGB_ZONAL, LightingCapability.KEYBOARD_MONO_PER_KEY, LightingCapability.KEYBOARD_RGB_PER_KEY, LightingCapability.HEADSET_RGB_ZONAL, LightingCapability.SPEAKER_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL, LightingCapability.MOUSEPAD_RGB_ZONAL] },
  { name: 'SCREEN_SAMPLER', id: '8423af3a-fb0a-4a4b-a192-09b9b46d6a82', type: 'SCREEN_SAMPLER', deviceSupport: [LightingCapability.MOUSE_RGB_ZONAL, LightingCapability.MOUSEPAD_RGB_ZONAL, LightingCapability.SPEAKER_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL, LightingCapability.HEADSET_RGB_ZONAL] },
  { name: 'AUDIO_VISUALIZER', id: 'c03e6328-0a89-406e-98c8-8bc771b5ac87', type: 'AUDIO_VISUALIZER', deviceSupport: [LightingCapability.MOUSE_RGB_ZONAL, LightingCapability.HEADSET_RGB_ZONAL, LightingCapability.SPEAKER_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL, LightingCapability.MOUSEPAD_RGB_ZONAL, LightingCapability.KEYBOARD_MONO_ZONAL, LightingCapability.MOUSE_MONO_ZONAL] },
];

const EFFECT_TYPE_TO_ENUM: Record<string, LightingEffect> = {
  SOLID: LightingEffect.SOLID,
  COLOR_CYCLE: LightingEffect.COLOR_CYCLE,
  STARLIGHT: LightingEffect.STARLIGHT,
  SCREEN_SAMPLER: LightingEffect.SCREEN_SAMPLER,
  AUDIO_VISUALIZER: LightingEffect.AUDIO_VISUALIZER,
};

const BREATHING_SUPPORTED: LightingCapability[] = [
  LightingCapability.MOUSE_MONO_ZONAL, LightingCapability.MOUSE_RGB_ZONAL,
  LightingCapability.KEYBOARD_MONO_ZONAL, LightingCapability.KEYBOARD_RGB_ZONAL,
  LightingCapability.KEYBOARD_MONO_PER_KEY, LightingCapability.KEYBOARD_RGB_PER_KEY,
  LightingCapability.HEADSET_RGB_ZONAL, LightingCapability.HEADSET_RGB_PER_KEY,
  LightingCapability.SPEAKER_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL,
  LightingCapability.MOUSEPAD_RGB_ZONAL, LightingCapability.MICROPHONE_RGB_PER_KEY,
  LightingCapability.ILLUMINATION_LIGHT_RGB_PER_KEY,
];

const WAVE_SUPPORTED: LightingCapability[] = [
  LightingCapability.KEYBOARD_RGB_PER_KEY, LightingCapability.KEYBOARD_RGB_ZONAL,
  LightingCapability.MOUSEPAD_RGB_ZONAL, LightingCapability.GAMEBOARD_RGB_ZONAL,
];

const RIPPLE_SUPPORTED: LightingCapability[] = [
  LightingCapability.KEYBOARD_RGB_PER_KEY,
];

export interface AvailableEffect {
  id: LightingEffect;
  label: string;
}

export function getAvailableEffects(capability: LightingCapability): AvailableEffect[] {
  const effects: AvailableEffect[] = [];

  for (const prefab of EFFECT_PREFABS) {
    if (prefab.deviceSupport.includes(capability)) {
      const effectEnum = EFFECT_TYPE_TO_ENUM[prefab.type];
      if (effectEnum && !effects.find((e) => e.id === effectEnum)) {
        effects.push({ id: effectEnum, label: formatEffectLabel(prefab.type) });
      }
    }
  }

  if (BREATHING_SUPPORTED.includes(capability) && !effects.find((e) => e.id === LightingEffect.BREATHING)) {
    effects.push({ id: LightingEffect.BREATHING, label: 'Breathing' });
  }
  if (WAVE_SUPPORTED.includes(capability) && !effects.find((e) => e.id === LightingEffect.WAVE)) {
    effects.push({ id: LightingEffect.WAVE, label: 'Wave' });
  }
  if (RIPPLE_SUPPORTED.includes(capability) && !effects.find((e) => e.id === LightingEffect.RIPPLE)) {
    effects.push({ id: LightingEffect.RIPPLE, label: 'Ripple' });
  }

  return effects;
}

function formatEffectLabel(type: string): string {
  return type.split('_').map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(' ');
}
