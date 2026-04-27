import { DeviceType } from './device-types';

export interface ButtonDef {
  controlId: number;
  name: string;
  category: 'primary' | 'scroll' | 'dpi' | 'macro' | 'media' | 'extra';
  defaultTaskId: number;
  remappable: boolean;
  layoutPos?: [number, number];
  layoutAlign?: 'left' | 'right' | 'top' | 'bottom' | 'center';
}

// G502 HERO (0xc332)
export const G502_BUTTONS: ButtonDef[] = [
  { controlId: 0x0050, name: 'Left Click',    category: 'primary', defaultTaskId: 0x0050, remappable: false, layoutPos: [31, 17], layoutAlign: 'top' },
  { controlId: 0x0051, name: 'Right Click',   category: 'primary', defaultTaskId: 0x0051, remappable: false, layoutPos: [69, 17], layoutAlign: 'top' },
  { controlId: 0x0052, name: 'Middle Click',  category: 'scroll',  defaultTaskId: 0x0052, remappable: true,  layoutPos: [50, 29], layoutAlign: 'right' },
  { controlId: 0x00c3, name: 'Back',          category: 'extra',   defaultTaskId: 0x00c3, remappable: true,  layoutPos: [19, 46], layoutAlign: 'left' },
  { controlId: 0x00c4, name: 'Forward',       category: 'extra',   defaultTaskId: 0x00c4, remappable: true,  layoutPos: [23, 39], layoutAlign: 'left' },
  { controlId: 0x00d7, name: 'DPI Up',        category: 'dpi',     defaultTaskId: 0x00d7, remappable: true,  layoutPos: [35, 51], layoutAlign: 'left' },
  { controlId: 0x00d8, name: 'DPI Down',      category: 'dpi',     defaultTaskId: 0x00d8, remappable: true,  layoutPos: [37, 58], layoutAlign: 'left' },
  { controlId: 0x00c2, name: 'DPI Cycle',     category: 'dpi',     defaultTaskId: 0x00c2, remappable: true,  layoutPos: [29, 54], layoutAlign: 'left' },
  { controlId: 0x00d0, name: 'G4',            category: 'macro',   defaultTaskId: 0x0000, remappable: true,  layoutPos: [78, 43], layoutAlign: 'right' },
  { controlId: 0x00d4, name: 'G5',            category: 'macro',   defaultTaskId: 0x0000, remappable: true,  layoutPos: [82, 37], layoutAlign: 'right' },
  { controlId: 0x00d9, name: 'G-Shift',       category: 'extra',   defaultTaskId: 0x00d9, remappable: true,  layoutPos: [29, 47], layoutAlign: 'left' },
  { controlId: 0x00d6, name: 'Smart Shift',   category: 'scroll',  defaultTaskId: 0x00d6, remappable: true,  layoutPos: [50, 20], layoutAlign: 'right' },
  { controlId: 0x00b5, name: 'Scroll Up',     category: 'scroll',  defaultTaskId: 0x00b5, remappable: false, layoutPos: [50, 11], layoutAlign: 'right' },
  { controlId: 0x00b6, name: 'Scroll Down',   category: 'scroll',  defaultTaskId: 0x00b6, remappable: false, layoutPos: [50, 35], layoutAlign: 'right' },
];

// G513 RGB Mechanical Keyboard (0xc33c)
export const G513_BUTTONS: ButtonDef[] = [
  { controlId: 0x0100, name: 'G1', category: 'macro', defaultTaskId: 0x0000, remappable: true, layoutPos: [4,  50] },
  { controlId: 0x0101, name: 'G2', category: 'macro', defaultTaskId: 0x0000, remappable: true, layoutPos: [4,  60] },
  { controlId: 0x0102, name: 'G3', category: 'macro', defaultTaskId: 0x0000, remappable: true, layoutPos: [4,  70] },
  { controlId: 0x0103, name: 'G4', category: 'macro', defaultTaskId: 0x0000, remappable: true, layoutPos: [4,  80] },
  { controlId: 0x0104, name: 'G5', category: 'macro', defaultTaskId: 0x0000, remappable: true, layoutPos: [4,  90] },
  { controlId: 0x00e0, name: 'Play/Pause', category: 'media', defaultTaskId: 0x00e0, remappable: true, layoutPos: [88, 10] },
  { controlId: 0x00e1, name: 'Stop',       category: 'media', defaultTaskId: 0x00e1, remappable: true, layoutPos: [91, 10] },
  { controlId: 0x00e2, name: 'Previous',   category: 'media', defaultTaskId: 0x00e2, remappable: true, layoutPos: [85, 10] },
  { controlId: 0x00e3, name: 'Next',       category: 'media', defaultTaskId: 0x00e3, remappable: true, layoutPos: [94, 10] },
  { controlId: 0x00e4, name: 'Mute',       category: 'media', defaultTaskId: 0x00e4, remappable: true, layoutPos: [97, 10] },
  { controlId: 0x00e5, name: 'Volume Up',  category: 'media', defaultTaskId: 0x00e5, remappable: true, layoutPos: [97, 20] },
  { controlId: 0x00e6, name: 'Volume Down',category: 'media', defaultTaskId: 0x00e6, remappable: true, layoutPos: [97, 30] },
  { controlId: 0x00d5, name: 'Game Mode',  category: 'extra', defaultTaskId: 0x00d5, remappable: true, layoutPos: [7,  10] },
];

// Generic mouse fallback (any unknown mouse)
export const GENERIC_MOUSE_BUTTONS: ButtonDef[] = [
  { controlId: 0x0050, name: 'Left Click',   category: 'primary', defaultTaskId: 0x0050, remappable: false },
  { controlId: 0x0051, name: 'Right Click',  category: 'primary', defaultTaskId: 0x0051, remappable: false },
  { controlId: 0x0052, name: 'Middle Click', category: 'scroll',  defaultTaskId: 0x0052, remappable: true  },
  { controlId: 0x00c3, name: 'Back',         category: 'extra',   defaultTaskId: 0x00c3, remappable: true  },
  { controlId: 0x00c4, name: 'Forward',      category: 'extra',   defaultTaskId: 0x00c4, remappable: true  },
  { controlId: 0x00d7, name: 'DPI Up',       category: 'dpi',     defaultTaskId: 0x00d7, remappable: true  },
  { controlId: 0x00d8, name: 'DPI Down',     category: 'dpi',     defaultTaskId: 0x00d8, remappable: true  },
];

// Generic keyboard fallback
export const GENERIC_KEYBOARD_BUTTONS: ButtonDef[] = [
  { controlId: 0x0100, name: 'G1', category: 'macro', defaultTaskId: 0x0000, remappable: true },
  { controlId: 0x0101, name: 'G2', category: 'macro', defaultTaskId: 0x0000, remappable: true },
  { controlId: 0x0102, name: 'G3', category: 'macro', defaultTaskId: 0x0000, remappable: true },
  { controlId: 0x00e0, name: 'Play/Pause',  category: 'media', defaultTaskId: 0x00e0, remappable: true },
  { controlId: 0x00e4, name: 'Mute',        category: 'media', defaultTaskId: 0x00e4, remappable: true },
  { controlId: 0x00e5, name: 'Volume Up',   category: 'media', defaultTaskId: 0x00e5, remappable: true },
  { controlId: 0x00e6, name: 'Volume Down', category: 'media', defaultTaskId: 0x00e6, remappable: true },
];

const MODEL_BUTTONS: Record<string, ButtonDef[]> = {
  'c332': G502_BUTTONS,
  'c547': G502_BUTTONS, // G502 HERO
  'c090': G502_BUTTONS, // G502 X Plus
  'c091': G502_BUTTONS, // G502 X Lightspeed
  'c33c': G513_BUTTONS,
  'c33f': G513_BUTTONS, // G815 (similar layout)
  'c343': G513_BUTTONS, // G915 TKL
  'c339': G513_BUTTONS, // G Pro keyboard
};

export function getButtonDefsForDevice(modelId: string, deviceType: DeviceType): ButtonDef[] {
  const byModel = MODEL_BUTTONS[modelId.toLowerCase()];
  if (byModel) return byModel;
  if (deviceType === DeviceType.MOUSE) return GENERIC_MOUSE_BUTTONS;
  if (deviceType === DeviceType.KEYBOARD) return GENERIC_KEYBOARD_BUTTONS;
  return GENERIC_MOUSE_BUTTONS;
}

// HID++ task ID to human-readable action label
export const TASK_LABELS: Record<number, string> = {
  0x0000: 'No Action',
  0x0050: 'Left Click',
  0x0051: 'Right Click',
  0x0052: 'Middle Click',
  0x0053: 'Back',
  0x0054: 'Forward',
  0x00b5: 'Scroll Up',
  0x00b6: 'Scroll Down',
  0x005b: 'Scroll Left',
  0x005d: 'Scroll Right',
  0x00c2: 'DPI Cycle',
  0x00c3: 'Browser Back',
  0x00c4: 'Browser Forward',
  0x00d6: 'Smart Shift',
  0x00d7: 'DPI Up',
  0x00d8: 'DPI Down',
  0x00d9: 'G-Shift',
  0x00e0: 'Play/Pause',
  0x00e1: 'Stop',
  0x00e2: 'Previous Track',
  0x00e3: 'Next Track',
  0x00e4: 'Mute',
  0x00e5: 'Volume Up',
  0x00e6: 'Volume Down',
};
