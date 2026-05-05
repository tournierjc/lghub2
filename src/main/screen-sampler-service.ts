import { desktopCapturer } from 'electron';
import type { DeviceService } from './hid/device-service';

interface ActiveSampler {
  timer: NodeJS.Timeout;
  zoneIndexes: number[];
  brightnessPct: number;
}

export class ScreenSamplerService {
  private readonly sessions = new Map<string, ActiveSampler>();

  constructor(private readonly deviceService: DeviceService) {}

  start(hidPath: string, zoneIndexes: number[], brightnessPct: number, intervalMs: number = 180): void {
    this.stop(hidPath);

    const uniqueZones = [...new Set(zoneIndexes.filter((zoneIndex) => Number.isFinite(zoneIndex) && zoneIndex >= 0))];
    if (uniqueZones.length === 0) return;

    const clampedBrightness = Math.max(5, Math.min(100, Math.round(brightnessPct)));

    const tick = () => {
      void this.sampleAndApply(hidPath, uniqueZones, clampedBrightness);
    };

    const timer = setInterval(tick, intervalMs);
    this.sessions.set(hidPath, { timer, zoneIndexes: uniqueZones, brightnessPct: clampedBrightness });
    tick();
  }

  stop(hidPath: string): void {
    const active = this.sessions.get(hidPath);
    if (!active) return;
    clearInterval(active.timer);
    this.sessions.delete(hidPath);
  }

  stopAll(): void {
    for (const path of [...this.sessions.keys()]) {
      this.stop(path);
    }
  }

  private async sampleAndApply(hidPath: string, zoneIndexes: number[], brightnessPct: number): Promise<void> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 288, height: 288 },
        fetchWindowIcons: false,
      });
      const thumb = sources[0]?.thumbnail;
      if (!thumb || thumb.isEmpty()) return;

      const { width, height } = thumb.getSize();
      const bitmap = thumb.toBitmap();
      if (!bitmap?.length || width <= 2 || height <= 2) return;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      const cx = Math.floor(width / 2);
      const cy = Math.floor(height / 2);
      const radius = Math.min(width, height, 28) >>> 2;

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const sx = cx + dx;
          const sy = cy + dy;
          if (sx < 0 || sx >= width || sy < 0 || sy >= height) continue;
          const i = (sx + width * sy) * 4;
          /* Electron nativeImage bitmap is RGBA on little-endian desktops */
          rSum += bitmap[i];
          gSum += bitmap[i + 1];
          bSum += bitmap[i + 2];
          count++;
        }
      }

      if (count <= 0) return;

      const brightness = brightnessPct / 100;
      const r = clampByte(Math.round((rSum / count) * brightness));
      const g = clampByte(Math.round((gSum / count) * brightness));
      const b = clampByte(Math.round((bSum / count) * brightness));

      for (const zoneIndex of zoneIndexes) {
        await this.deviceService.setDeviceRgb(hidPath, zoneIndex, r, g, b);
      }
    } catch {
      /* Sampling can fail transiently — skip this frame */
    }
  }
}

function clampByte(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(255, value));
}
