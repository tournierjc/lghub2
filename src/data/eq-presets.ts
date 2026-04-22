export interface EqPresetData {
  id: string;
  name: string;
  displayName: string;
  bands: number[];
  deviceType: 'HEADSET' | 'SPEAKER';
}

export const EQ_PRESETS: EqPresetData[] = [
  // --- Headset presets ---
  { id: '0c94ec70-b811-4301-853f-e044c119cf97', name: 'EQUALIZER_FLAT', displayName: 'Flat', deviceType: 'HEADSET', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: '76b7a515-2c3c-4dab-bf65-48fff5318008', name: 'EQUALIZER_FPS', displayName: 'FPS', deviceType: 'HEADSET', bands: [0, 0, -0.96, -1.44, 3.84, 4.56, 3.12, 3.12, 1.92, 0.48] },
  { id: '617470b0-7712-4f74-8da0-d4ca9283c8fb', name: 'EQUALIZER_MOBA', displayName: 'MOBA', deviceType: 'HEADSET', bands: [0, -1.92, -2.4, 0, 4.32, 1.92, 3.6, 7.68, 3.6, 0] },
  { id: '4b5147ba-0818-4c77-9dd4-152072c20042', name: 'EQUALIZER_BASS_BOOST', displayName: 'Bass Boost', deviceType: 'HEADSET', bands: [3.6, 2.64, 1.68, 0.96, 0.96, 0, 0, 0, 0, 0] },
  { id: '88615910-55f0-4e5a-88c8-855003ffa87a', name: 'EQUALIZER_CINEMATIC', displayName: 'Cinematic', deviceType: 'HEADSET', bands: [3.12, 2.64, 1.92, 1.2, 1.2, 1.92, 1.2, 0, 0, 0] },
  { id: '937a09ad-86d3-495c-847a-de859fc59712', name: 'EQUALIZER_COMMUNICATIONS', displayName: 'Communications', deviceType: 'HEADSET', bands: [0, -0.96, -0.96, 1.92, 3.6, 4.32, 3.6, 3.6, 1.68, 0.96] },

  // --- Speaker presets ---
  { id: '34d14cea-9476-4fa9-aca7-bcdb008952fd', name: 'EQUALIZER_FLAT', displayName: 'Flat', deviceType: 'SPEAKER', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: '58d82764-0486-4068-a818-68d1cc87e91d', name: 'EQUALIZER_FPS', displayName: 'FPS', deviceType: 'SPEAKER', bands: [0, 0, -6, -5, -3, -2, -3, -3, -5, -6] },
  { id: 'e6b6fdd4-7988-4c2c-8122-3853c3a1b2f4', name: 'EQUALIZER_MOBA', displayName: 'MOBA', deviceType: 'SPEAKER', bands: [0, -10, -11, 0, -2, -5, -3, -17, -3, 0] },
  { id: 'fd92f827-4096-4e6c-96b5-b3e7620d1502', name: 'EQUALIZER_BASS_BOOST', displayName: 'Bass Boost', deviceType: 'SPEAKER', bands: [0, 0, 0, 0, 0, -3, -4, -5, -6, -6] },
  { id: '6856912f-c4be-4add-9f9c-56249d566be6', name: 'EQUALIZER_CINEMATIC', displayName: 'Cinematic', deviceType: 'SPEAKER', bands: [-3, -4, -5, -6, -6, -5, -6, 0, 0, 0] },
  { id: 'd27c3937-c03e-4fd5-9871-19c773513060', name: 'EQUALIZER_COMMUNICATIONS', displayName: 'Communications', deviceType: 'SPEAKER', bands: [0, -0.96, -0.96, 1.92, 3.6, 4.32, 3.6, 3.6, 1.68, 0.96] },
];

export function getPresetsForDevice(deviceType: 'HEADSET' | 'SPEAKER'): EqPresetData[] {
  return EQ_PRESETS.filter((p) => p.deviceType === deviceType);
}
