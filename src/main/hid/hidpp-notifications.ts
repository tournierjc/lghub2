import { HidppFeature, parseHidppMessage } from '../../shared/hidpp-protocol';

export interface DivertedButtonEvent {
  type: 'diverted-button';
  devicePath: string;
  controlId: number;
  pressed: boolean;
}

export type HidppNotification = DivertedButtonEvent;

/**
 * Parse raw HID++ notification bytes into structured events.
 * Returns null if the data is not a recognized notification.
 */
export function parseHidppNotification(devicePath: string, data: number[], featureIndexMap: Map<number, HidppFeature>): HidppNotification | null {
  const msg = parseHidppMessage(data);
  if (!msg) return null;

  // Notifications have the softwareId nibble set to 0x0 in most implementations,
  // but some devices use other values. We primarily match by feature index.
  const feature = featureIndexMap.get(msg.featureIndex);
  if (!feature) return null;

  switch (feature) {
    case HidppFeature.SPECIAL_KEYS_BUTTONS:
      return parseSpecialKeysNotification(devicePath, msg);
    default:
      return null;
  }
}

function parseSpecialKeysNotification(devicePath: string, msg: ReturnType<typeof parseHidppMessage>): DivertedButtonEvent | null {
  if (!msg) return null;

  // divertedButtonEvent uses function ID 0x00
  if (msg.functionId !== 0x00) return null;

  if (msg.params.length < 3) return null;

  const controlId = (msg.params[0] << 8) | msg.params[1];
  const buttonData = msg.params[2];

  // bit 0: pressed, bit 1: released
  const pressed = (buttonData & 0x01) !== 0;
  const released = (buttonData & 0x02) !== 0;

  // If both pressed and released are set in a single notification, treat as a click (pressed then released)
  // For macro triggering, we only care about the press event
  if (!pressed && !released) return null;

  return {
    type: 'diverted-button',
    devicePath,
    controlId,
    pressed: pressed || released,
  };
}
