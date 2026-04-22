import fs from 'fs';
import path from 'path';
import https from 'https';
import { app } from 'electron';
import { EventEmitter } from 'events';

export interface MarketplaceAsset {
  id: string;
  name: string;
  type: 'plugin' | 'profile' | 'pack';
  version?: string;
  author?: string;
  description?: string;
  downloadUrl?: string;
  iconUrl?: string;
  installedAt: string;
}

interface MarketplaceData {
  version: 1;
  assets: MarketplaceAsset[];
}

export class MarketplaceService extends EventEmitter {
  private dataPath: string;
  private assetsDir: string;
  private data: MarketplaceData;

  constructor() {
    super();
    const userDataDir = app.getPath('userData');
    this.dataPath = path.join(userDataDir, 'marketplace.json');
    this.assetsDir = path.join(userDataDir, 'marketplace-assets');
    this.data = this.load();
    this.ensureAssetsDir();
  }

  private load(): MarketplaceData {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        return JSON.parse(raw) as MarketplaceData;
      }
    } catch {
    }
    return { version: 1, assets: [] };
  }

  private save(): void {
    fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private ensureAssetsDir(): void {
    if (!fs.existsSync(this.assetsDir)) {
      fs.mkdirSync(this.assetsDir, { recursive: true });
    }
  }

  getInstalledAssets(): MarketplaceAsset[] {
    return this.data.assets;
  }

  async install(assetData: Record<string, unknown>): Promise<MarketplaceAsset> {
    const id = (assetData.id ?? assetData.pluginId ?? assetData.assetId ?? '') as string;
    const name = (assetData.name ?? assetData.title ?? 'Unknown') as string;
    const type = this.inferType(assetData);
    const downloadUrl = (assetData.downloadUrl ?? assetData.url ?? '') as string;

    this.emit('installation-started', { id, name });

    const asset: MarketplaceAsset = {
      id,
      name,
      type,
      version: (assetData.version ?? '1.0') as string,
      author: (assetData.author ?? assetData.publisher ?? '') as string,
      description: (assetData.description ?? '') as string,
      downloadUrl,
      iconUrl: (assetData.iconUrl ?? assetData.icon ?? '') as string,
      installedAt: new Date().toISOString(),
    };

    if (downloadUrl) {
      try {
        const assetDir = path.join(this.assetsDir, id);
        if (!fs.existsSync(assetDir)) {
          fs.mkdirSync(assetDir, { recursive: true });
        }
        const destPath = path.join(assetDir, 'asset.zip');
        await this.downloadFile(downloadUrl, destPath);
      } catch {
      }
    }

    const existingIdx = this.data.assets.findIndex(a => a.id === id);
    if (existingIdx >= 0) {
      this.data.assets[existingIdx] = asset;
    } else {
      this.data.assets.push(asset);
    }
    this.save();

    this.emit('installation-finished', { id, name, success: true });
    return asset;
  }

  uninstall(pluginId: string): boolean {
    const idx = this.data.assets.findIndex(a => a.id === pluginId);
    if (idx < 0) return false;

    this.emit('uninstallation-started', { id: pluginId });

    const assetDir = path.join(this.assetsDir, pluginId);
    if (fs.existsSync(assetDir)) {
      fs.rmSync(assetDir, { recursive: true, force: true });
    }

    this.data.assets.splice(idx, 1);
    this.save();

    this.emit('asset-removed', pluginId);
    return true;
  }

  private inferType(data: Record<string, unknown>): MarketplaceAsset['type'] {
    const typeStr = String(data.type ?? data.assetType ?? '').toLowerCase();
    if (typeStr.includes('plugin')) return 'plugin';
    if (typeStr.includes('profile')) return 'profile';
    if (typeStr.includes('pack')) return 'pack';
    if (data.downloadUrl && String(data.downloadUrl).includes('.lplug')) return 'plugin';
    return 'profile';
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const request = https.get(url, (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          this.downloadFile(response.headers.location, dest).then(resolve, reject);
          return;
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      });
      request.on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
      request.setTimeout(30000, () => {
        request.destroy();
        reject(new Error('Download timed out'));
      });
    });
  }
}
