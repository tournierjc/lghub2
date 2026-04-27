import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { KeyActionValue, MacroAction } from '../../shared/device-types';

const execAsync = promisify(exec);

const LINUX_KEYCODE_MAP: Record<number, string> = {
  1: 'Escape',
  2: '1',
  3: '2',
  4: '3',
  5: '4',
  6: '5',
  7: '6',
  8: '7',
  9: '8',
  10: '9',
  11: '0',
  12: 'minus',
  13: 'equal',
  14: 'BackSpace',
  15: 'Tab',
  16: 'q',
  17: 'w',
  18: 'e',
  19: 'r',
  20: 't',
  21: 'y',
  22: 'u',
  23: 'i',
  24: 'o',
  25: 'p',
  26: 'bracketleft',
  27: 'bracketright',
  28: 'Return',
  29: 'Control_L',
  30: 'a',
  31: 's',
  32: 'd',
  33: 'f',
  34: 'g',
  35: 'h',
  36: 'j',
  37: 'k',
  38: 'l',
  39: 'semicolon',
  40: 'apostrophe',
  41: 'grave',
  42: 'Shift_L',
  43: 'backslash',
  44: 'z',
  45: 'x',
  46: 'c',
  47: 'v',
  48: 'b',
  49: 'n',
  50: 'm',
  51: 'comma',
  52: 'period',
  53: 'slash',
  54: 'Shift_R',
  55: 'KP_Multiply',
  56: 'Alt_L',
  57: 'space',
  58: 'Caps_Lock',
  59: 'F1',
  60: 'F2',
  61: 'F3',
  62: 'F4',
  63: 'F5',
  64: 'F6',
  65: 'F7',
  66: 'F8',
  67: 'F9',
  68: 'F10',
  69: 'Num_Lock',
  70: 'Scroll_Lock',
  71: 'KP_Home',
  72: 'KP_Up',
  73: 'KP_Prior',
  74: 'KP_Subtract',
  75: 'KP_Left',
  76: 'KP_Begin',
  77: 'KP_Right',
  78: 'KP_Add',
  79: 'KP_End',
  80: 'KP_Down',
  81: 'KP_Next',
  82: 'KP_Insert',
  83: 'KP_Delete',
  87: 'F11',
  88: 'F12',
  96: 'KP_Enter',
  97: 'Control_R',
  98: 'KP_Divide',
  99: 'Print',
  100: 'Alt_R',
  102: 'Home',
  103: 'Up',
  104: 'Prior',
  105: 'Left',
  106: 'Right',
  107: 'End',
  108: 'Down',
  109: 'Next',
  110: 'Insert',
  111: 'Delete',
  113: 'Mute',
  114: 'VolumeDown',
  115: 'VolumeUp',
  116: 'Power',
  117: 'KP_Equal',
  119: 'Pause',
  125: 'Super_L',
  126: 'Super_R',
  127: 'Menu',
};

export class MacroExecutor {
  private xdotoolAvailable: boolean | null = null;
  private readonly modifierMap: Record<string, string> = {
    Ctrl: 'ctrl',
    Alt: 'alt',
    Shift: 'shift',
    Meta: 'super',
  };

  private readonly keyMap: Record<string, string> = {
    Enter: 'Return',
    Backspace: 'BackSpace',
    Escape: 'Escape',
    ' ': 'space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    PageUp: 'Prior',
    PageDown: 'Next',
    '-': 'minus',
    '=': 'equal',
  };

  async executeKey(keyAction: KeyActionValue): Promise<void> {
    if (process.platform !== 'linux') {
      console.warn('Key execution is only supported on Linux via xdotool');
      return;
    }

    const available = await this.isXdotoolAvailable();
    if (!available) {
      console.warn('xdotool is not installed. Key assignments cannot be executed. Install xdotool to enable button playback.');
      return;
    }

    const keyName = this.keyMap[keyAction.key] ?? keyAction.key;
    const combo = [...keyAction.modifiers.map((modifier) => this.modifierMap[modifier] ?? modifier.toLowerCase()), keyName].join('+');
    await execAsync(`xdotool key ${combo}`);
  }

  async executeMacro(steps: MacroAction[]): Promise<void> {
    if (process.platform !== 'linux') {
      console.warn('Macro execution is only supported on Linux via xdotool');
      return;
    }

    const available = await this.isXdotoolAvailable();
    if (!available) {
      console.warn('xdotool is not installed. Macros cannot be executed. Install xdotool to enable macro playback.');
      return;
    }

    for (const step of steps) {
      try {
        await this.executeStep(step);
      } catch (err) {
        console.error(`Macro step failed (${step.type} ${step.value}):`, err);
      }
    }
  }

  private async executeStep(step: MacroAction): Promise<void> {
    switch (step.type) {
      case 'delay':
        await this.sleep(step.value);
        return;
      case 'keydown':
        await this.sendKey('keydown', step.value);
        return;
      case 'keyup':
        await this.sendKey('keyup', step.value);
        return;
      default:
        return;
    }
  }

  private async sendKey(action: 'keydown' | 'keyup', keycode: number): Promise<void> {
    const keyName = LINUX_KEYCODE_MAP[keycode];
    if (!keyName) {
      console.warn(`Unknown Linux keycode ${keycode} for macro ${action}. Skipping.`);
      return;
    }
    await execAsync(`xdotool ${action} ${keyName}`);
  }

  private async isXdotoolAvailable(): Promise<boolean> {
    if (this.xdotoolAvailable !== null) return this.xdotoolAvailable;
    try {
      await execAsync('which xdotool');
      this.xdotoolAvailable = true;
    } catch {
      this.xdotoolAvailable = false;
    }
    return this.xdotoolAvailable;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
