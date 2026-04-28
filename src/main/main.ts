import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { registerIpcHandlers } from './ipc-handlers';
import { HidManager } from './hid/hid-manager';
import { DeviceService } from './hid/device-service';
import { ProfileStore } from './profile-store';
import { MarketplaceService } from './marketplace-service';
import { AppSwitcher } from './app-switcher';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let hidManager: HidManager | null = null;
let deviceService: DeviceService | null = null;
let profileStore: ProfileStore | null = null;
let marketplaceService: MarketplaceService | null = null;
let appSwitcher: AppSwitcher | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV !== 'production';
const DEV_SERVER_URL = 'http://localhost:3000';

const ICON_PATH = path.join(__dirname, '../../assets/icon.png');
const TRAY_ICON_PATH = path.join(__dirname, '../../assets/tray.png');

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#07070f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
    icon: ICON_PATH,
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    // Default behavior is "minimize-to-tray", but allow real quit on app.quit()
    // and on explicit close requests.
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createTray(): void {
  const trayIcon = nativeImage.createFromPath(TRAY_ICON_PATH);
  tray = new Tray(trayIcon);
  tray.setToolTip('LGHUB2');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Open LGHUB2', click: () => mainWindow?.show() },
    { type: 'separator' },
    { label: 'Quit', click: () => {
      mainWindow?.destroy();
      app.quit();
    }},
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => mainWindow?.show());
}

async function initializeApp(): Promise<void> {
  hidManager = new HidManager();
  deviceService = new DeviceService(hidManager);
  profileStore = new ProfileStore();
  marketplaceService = new MarketplaceService();
  registerIpcHandlers(mainWindow!, hidManager, deviceService, profileStore, marketplaceService);

  appSwitcher = new AppSwitcher();
  appSwitcher.start(profileStore, deviceService, mainWindow!);
}

app.whenReady().then(async () => {
  createWindow();
  createTray();
  await initializeApp();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

function requestQuit(): void {
  if (isQuitting) return;
  isQuitting = true;
  try {
    app.quit();
  } catch {
    // last resort
    process.exit(0);
  }
}

// Graceful shutdown for terminal Ctrl+C and service managers.
process.on('SIGINT', requestQuit);
process.on('SIGTERM', requestQuit);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  appSwitcher?.stop();
  deviceService?.dispose();
  hidManager?.dispose();
  mainWindow?.destroy();
});
