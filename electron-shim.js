/**
 * Electron API Shim for Windows
 *
 * Works around a known Electron bug on Windows where require('electron')
 * returns the npm package path string instead of the API object.
 *
 * The shim uses:
 * 1. _linkedBinding() for APIs that work (BrowserWindow, nativeImage, dialog, etc.)
 * 2. Pure JS alternatives for APIs that crash (app, Notification, etc.)
 *
 * Usage: const electron = require('./electron-shim');
 */
'use strict';

const path = require('path');
const EventEmitter = require('events');

// ================================================================
// STEP 1: Collect APIs from working linked bindings
// ================================================================
const electron = {};

const BINDINGS = {
  // These bindings were verified to work (no segfault)
  'electron_browser_window':       null,
  'electron_common_native_image':  null,
  'electron_browser_dialog':       null,
  'electron_common_clipboard':     null,
  'electron_common_shell':         null,
  'electron_common_features':      null,
  'electron_browser_global_shortcut': null,
  'electron_browser_power_monitor':   null,
  'electron_browser_screen':          null,
  'electron_browser_protocol':        null,
};

for (const name of Object.keys(BINDINGS)) {
  try {
    const binding = process._linkedBinding(name);
    if (typeof binding === 'object' && binding !== null) {
      Object.assign(electron, binding);
    }
  } catch (e) {
    // skip unavailable
  }
}

// ================================================================
// STEP 2: Build 'app' (EventEmitter replacement for electron.app)
// ================================================================
class App extends EventEmitter {
  constructor() {
    super();
    this._ready = false;
    this._isQuitting = false;
    this._name = 'pomodoro-timer';
    this._version = '1.0.0';

    // Mark ready on next tick to allow listeners to be registered
    process.nextTick(() => {
      if (!this._ready) {
        this._ready = true;
        this.emit('ready');
      }
    });
  }

  whenReady() {
    if (this._ready) return Promise.resolve();
    return new Promise(resolve => this.once('ready', resolve));
  }

  quit() {
    this._isQuitting = true;
    this.emit('before-quit');
    process.nextTick(() => process.exit(0));
  }

  exit(code) {
    process.exit(code || 0);
  }

  isReady() { return this._ready; }
  getName() { return this._name; }
  getVersion() { return this._version; }
  getPath(name) {
    const home = process.env.USERPROFILE || process.env.HOME || __dirname;
    const map = {
      home, appData: home + '/AppData/Roaming',
      userData: home + '/AppData/Roaming/pomodoro-timer',
      temp: process.env.TEMP || '/tmp',
      desktop: home + '/Desktop',
      documents: home + '/Documents',
      downloads: home + '/Downloads',
      exe: process.execPath,
    };
    return map[name] || home;
  }

  // Dock/Taskbar
  setBadgeCount(count) { /* no-op on Windows without native binding */ }
  getBadgeCount() { return 0; }
}

const app = new App();
electron.app = app;

// ================================================================
// STEP 3: Build 'ipcMain' (EventEmitter-based IPC)
// ================================================================
class IpcMain extends EventEmitter {
  handle(channel, handler) {
    this.on('handle:' + channel, (event, ...args) => {
      return handler(event, ...args);
    });
  }

  handleOnce(channel, handler) {
    this.once('handle:' + channel, (event, ...args) => {
      return handler(event, ...args);
    });
  }

  removeHandler(channel) {
    this.removeAllListeners('handle:' + channel);
  }

  on(channel, listener) {
    super.on(channel, listener);
  }
}
electron.ipcMain = new IpcMain();

// ================================================================
// STEP 4: Build 'Notification'
// ================================================================
class Notification {
  static isSupported() {
    return true;
  }

  constructor(options = {}) {
    this.title = options.title || '';
    this.body = options.body || '';
    this.silent = options.silent || false;
    this._clickHandler = null;
  }

  on(event, handler) {
    if (event === 'click') this._clickHandler = handler;
  }

  show() {
    // Use Windows toast via PowerShell if available, otherwise just log
    const title = this.title.replace(/'/g, "''");
    const body = this.body.replace(/'/g, "''");
    try {
      const { exec } = require('child_process');
      exec(
        `powershell -Command "` +
        `[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null; ` +
        `$template = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02); ` +
        `$texts = $template.GetElementsByTagName('text'); ` +
        `$texts.Item(0).AppendChild($template.CreateTextNode('${title}')) > $null; ` +
        `$texts.Item(1).AppendChild($template.CreateTextNode('${body}')) > $null; ` +
        `$toast = [Windows.UI.Notifications.ToastNotification]::new($template); ` +
        `[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('Pomodoro').Show($toast)"`,
        (err) => { /* ignore errors */ }
      );
    } catch (e) {
      // Fallback: log to console
      console.log(`[Notification] ${this.title}: ${this.body}`);
    }
  }
}
electron.Notification = Notification;

// ================================================================
// STEP 5: Stub Tray and Menu (not used without native bindings,
//         window minimize provides similar functionality)
// ================================================================
class Tray {
  constructor(icon) {
    this._icon = icon;
    this._toolTip = '';
  }
  setToolTip(tip) { this._toolTip = tip; }
  setContextMenu(menu) { /* accept but no-op */ }
  on(event, handler) { /* accept but no-op */ }
  destroy() {}
  displayBalloon(options) {}
}
electron.Tray = Tray;

// Menu is used by Tray for context menus
const Menu = {
  buildFromTemplate: (template) => template,
  setApplicationMenu: (menu) => {},
  getApplicationMenu: () => null,
  sendActionToFirstResponder: (action) => {},
};
electron.Menu = Menu;

// ================================================================
// STEP 6: Add other commonly-needed stubs
// ================================================================
electron.screen = {
  getCursorScreenPoint: () => ({ x: 0, y: 0 }),
  getPrimaryDisplay: () => ({
    id: 1,
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 },
    scaleFactor: 1,
  }),
  getAllDisplays: () => [electron.screen.getPrimaryDisplay()],
};

// net (for potential future use)
electron.net = {
  request: (url) => {
    const http = require(url.startsWith('https') ? 'https' : 'http');
    return http.request(url);
  },
};

// process (expose Electron's process info)
electron.process = {
  type: 'browser',
  versions: process.versions,
  platform: process.platform,
  arch: process.arch,
};

// crashReporter stub
electron.crashReporter = {
  start: () => {},
  addExtraParameter: () => {},
  removeExtraParameter: () => {},
};

// ================================================================
// STEP 7: Export
// ================================================================
module.exports = electron;

// Also patch require.cache so subsequent require('electron')
// from the npm package doesn't shadow us
try {
  const electronRequirePath = require.resolve('electron');
  if (electronRequirePath && electronRequirePath.includes('node_modules')) {
    require.cache[electronRequirePath] = {
      id: electronRequirePath,
      filename: electronRequirePath,
      loaded: true,
      exports: electron,
    };
  }
} catch (e) { /* ignore */ }

console.log('[electron-shim] API built successfully');
console.log('[electron-shim] Available APIs:', Object.keys(electron).sort().join(', '));
