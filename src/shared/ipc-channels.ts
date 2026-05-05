/**
 * IPC Channel definitions matching the original LGHUB preload API surface.
 * These channels define the communication between renderer and main process.
 */

export enum IpcChannel {
  // Window management
  MINIMIZE = 'window:minimize',
  MAXIMIZE = 'window:maximize',
  CLOSE_WINDOW = 'window:close',
  SET_WINDOW_TITLE = 'window:set-title',
  RELAUNCH = 'window:relaunch',
  FOCUS = 'window:focus',
  BLUR = 'window:blur',
  BACK = 'window:back',

  // System tray
  SET_TRAY_TOOLTIP = 'tray:set-tooltip',

  // Store
  GET_STORAGE = 'store:get',
  SET_STORE = 'store:set',

  // File system
  OPEN_DIALOG = 'dialog:open',
  SAVE_DIALOG = 'dialog:save',
  READ_FILE = 'fs:read-file',

  // WebSocket - Agent connection
  CREATE_CONNECTION = 'ws:create',
  CONNECT_AGENT = 'ws:connect',
  SOCKET_CLOSE = 'ws:close',
  SOCKET_OPEN = 'ws:open',
  SOCKET_ERROR = 'ws:error',
  SOCKET_SEND = 'ws:send',
  SOCKET_ON_MESSAGE = 'ws:on-message',
  SOCKET_GET_STATE = 'ws:get-state',

  // WebSocket - GL Agent connection
  GL_CREATE_CONNECTION = 'gl:create',
  GL_CONNECT_AGENT = 'gl:connect',
  GL_DISCONNECT_AGENT = 'gl:disconnect',
  GL_SOCKET_SEND = 'gl:send',
  GL_SOCKET_ON_MESSAGE = 'gl:on-message',

  // Marketplace (webview ↔ main — channel names match marketplace-preload.ts)
  MARKETPLACE_REQUEST_INSTALLED_ASSETS = 'REQUEST_INSTALLED_ASSETS',
  MARKETPLACE_INSTALL = 'INSTALL',
  MARKETPLACE_UNINSTALL_PLUGIN = 'UNINSTALL_PLUGIN',
  MARKETPLACE_SET_INSTALLED_ASSETS = 'SET_INSTALLED_ASSETS',
  MARKETPLACE_ADD_INSTALLED_ASSET = 'ADD_INSTALLED_ASSET',
  MARKETPLACE_REMOVE_INSTALLED_ASSET = 'REMOVE_INSTALLED_ASSET',
  MARKETPLACE_INSTALLATION_STARTED = 'INSTALLATION_STARTED',
  MARKETPLACE_INSTALLATION_FINISHED = 'INSTALLATION_FINISHED',
  MARKETPLACE_UNINSTALLATION_STARTED = 'UNINSTALLATION_STARTED',
  MARKETPLACE_RELOAD = 'RELOAD_MARKETPLACE',
  MARKETPLACE_PRELOAD_PATH = 'marketplace:preload-path',

  // Audio
  ACTIVE_AUDIO_DEVICE = 'audio:active-device',

  // Security/Auth
  GET_HMAC = 'security:get-hmac',
  READ_DEVICE_SALT = 'security:device-salt',
  ACCOUNT_LOGIN = 'auth:login',
  ACCOUNT_LOGOUT = 'auth:logout',

  // System
  GET_OS_INFO = 'system:os-info',
  DEEPLINK = 'system:deeplink',
  OPEN_EXTERNAL = 'system:open-external',
  SCREEN_ROTATE = 'system:screen-rotate',
  SCREEN_CAPTURE = 'system:screen-capture',

  // Device recommendation
  DEVICE_RECOMMENDATION = 'device:recommendation',

  // Backend connection status
  SET_BACKEND_CONNECTION_STATUS = 'backend:connection-status',

  // HID - Direct device communication
  HID_ENUMERATE = 'hid:enumerate',
  HID_CONNECT = 'hid:connect',
  HID_DISCONNECT = 'hid:disconnect',
  HID_SEND = 'hid:send',
  HID_ON_DATA = 'hid:on-data',
  HID_GET_FEATURE = 'hid:get-feature',

  // Device service - high-level operations
  DEVICE_SCAN = 'device:scan',
  DEVICE_GET_ALL = 'device:get-all',
  DEVICE_SET_DPI = 'device:set-dpi',
  DEVICE_SET_RGB = 'device:set-rgb',
  DEVICE_SET_RGB_EFFECT = 'device:set-rgb-effect',
  DEVICE_REFRESH_BATTERY = 'device:refresh-battery',
  DEVICE_DISCONNECT = 'device:disconnect',
  DEVICE_ON_UPDATE = 'device:on-update',
  DEVICE_GET_BUTTONS = 'device:get-buttons',
  DEVICE_REMAP_BUTTON = 'device:remap-button',
  DEVICE_SET_SMART_SHIFT = 'device:set-smart-shift',
  DEVICE_GET_SMART_SHIFT = 'device:get-smart-shift',

  // Profile management
  PROFILE_GET_ALL = 'profile:get-all',
  PROFILE_CREATE = 'profile:create',
  PROFILE_UPDATE = 'profile:update',
  PROFILE_DELETE = 'profile:delete',
  PROFILE_SET_ACTIVE = 'profile:set-active',
  PROFILE_EXPORT = 'profile:export',
  PROFILE_IMPORT = 'profile:import',

  // Application data
  APP_DATA_SEARCH = 'appdata:search',
  APP_DATA_GET = 'appdata:get',
  APP_DATA_IMPORT = 'appdata:import',

  // App-profile auto-switching (main → renderer)
  APP_PROFILE_SWITCHED = 'app:profile-switched',
}

/**
 * IPC API type definitions for type-safe IPC communication
 */
export interface IpcApi {
  // Window
  minimize(): void;
  maximize(): void;
  close(): void;
  setTitle(title: string): void;
  relaunch(): void;

  // Store
  getStorage<T>(key: string): Promise<T | undefined>;
  setStorage<T>(key: string, value: T): Promise<void>;

  // System
  getOsInfo(): Promise<OsInfo>;
  openExternal(url: string): void;

  // HID
  enumerateDevices(): Promise<HidDeviceInfo[]>;
  connectDevice(path: string): Promise<boolean>;
  disconnectDevice(path: string): void;
  sendToDevice(path: string, data: number[]): Promise<number[]>;
}

export interface OsInfo {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  hostname: string;
}

export interface HidDeviceInfo {
  path: string;
  vendorId: number;
  productId: number;
  serialNumber: string;
  manufacturer: string;
  product: string;
  interface: number;
  usagePage: number;
  usage: number;
}
