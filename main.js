const electron = require('./electron-shim');
const { app, BrowserWindow, ipcMain, nativeImage, Notification } = electron;
const path = require('path');

let mainWindow = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 520,
    minWidth: 320,
    minHeight: 440,
    frame: false,
    transparent: false,
    resizable: true,
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// IPC handlers
ipcMain.handle('send-notification', (event, { title, body }) => {
  if (Notification.isSupported()) {
    const n = new Notification({ title, body });
    n.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    n.show();
  }
});

ipcMain.handle('update-tray', (event, { title, isRunning }) => {
  if (mainWindow) {
    mainWindow.setTitle(title);
  }
});

ipcMain.handle('set-always-on-top', (event, isTop) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isTop);
  }
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-close', () => {
  if (mainWindow) mainWindow.hide();
});

// App lifecycle
app.whenReady().then(() => {
  createWindow();
});

app.on('ready', () => {
  if (!mainWindow) createWindow();
});

app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
  } else {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});
