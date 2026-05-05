import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { pathToFileURL } from 'node:url';

interface DeviceImageData {
  version: 1;
  /** Lowercase model id (e.g. "c332") → filename in imagesDir */
  byModel: Record<string, string>;
}

const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']);

export class DeviceImageStore {
  private readonly dataPath: string;
  private readonly imagesDir: string;
  private data: DeviceImageData;

  constructor() {
    const userData = app.getPath('userData');
    this.dataPath = path.join(userData, 'device-images.json');
    this.imagesDir = path.join(userData, 'device-images');
    this.data = this.load();
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  private load(): DeviceImageData {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        const parsed = JSON.parse(raw) as DeviceImageData;
        if (parsed?.version === 1 && parsed.byModel && typeof parsed.byModel === 'object') {
          return parsed;
        }
      }
    } catch {
    }
    return { version: 1, byModel: {} };
  }

  private save(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private sanitizeModelId(modelId: string): string | null {
    const m = modelId.trim().toLowerCase();
    return /^[0-9a-f]{1,8}$/.test(m) ? m : null;
  }

  /** `file:` URL usable in renderer `<img src>` */
  getCustomImageFileUrl(modelId: string): string | null {
    const key = this.sanitizeModelId(modelId);
    if (!key) return null;
    const fileName = this.data.byModel[key];
    if (!fileName) return null;
    const full = path.join(this.imagesDir, fileName);
    if (!fs.existsSync(full)) return null;
    return pathToFileURL(full).href;
  }

  importFromFile(modelId: string, sourcePath: string): { ok: boolean; error?: string } {
    const key = this.sanitizeModelId(modelId);
    if (!key) return { ok: false, error: 'Invalid model id' };

    if (!fs.existsSync(sourcePath) || !fs.statSync(sourcePath).isFile()) {
      return { ok: false, error: 'Source file not found' };
    }

    const ext = path.extname(sourcePath).toLowerCase();
    if (!ALLOWED_EXT.has(ext)) {
      return { ok: false, error: 'Unsupported image type' };
    }

    const destName = `${key}${ext}`;
    const destPath = path.join(this.imagesDir, destName);

    const previousName = this.data.byModel[key];
    if (previousName && previousName !== destName) {
      const previousPath = path.join(this.imagesDir, previousName);
      try {
        if (fs.existsSync(previousPath)) fs.unlinkSync(previousPath);
      } catch {
      }
    }

    try {
      fs.copyFileSync(sourcePath, destPath);
      this.data.byModel[key] = destName;
      this.save();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error)?.message ?? String(err) };
    }
  }

  clear(modelId: string): boolean {
    const key = this.sanitizeModelId(modelId);
    if (!key) return false;
    const fileName = this.data.byModel[key];
    if (!fileName) return false;
    const full = path.join(this.imagesDir, fileName);
    delete this.data.byModel[key];
    this.save();
    try {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch {
    }
    return true;
  }
}
