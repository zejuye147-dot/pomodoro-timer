const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pomodoroAPI', {
  // Send system notification
  sendNotification: (title, body) => {
    ipcRenderer.invoke('send-notification', { title, body });
  },

  // Update tray tooltip and menu
  updateTray: (title, isRunning) => {
    ipcRenderer.invoke('update-tray', { title, isRunning });
  },

  // Set always-on-top
  setAlwaysOnTop: (isTop) => {
    ipcRenderer.invoke('set-always-on-top', isTop);
  },

  // Window controls
  minimizeWindow: () => {
    ipcRenderer.invoke('window-minimize');
  },
  closeWindow: () => {
    ipcRenderer.invoke('window-close');
  },

  // Listen for tray menu toggle
  onTrayToggle: (callback) => {
    ipcRenderer.on('tray-toggle', callback);
    return () => ipcRenderer.removeListener('tray-toggle', callback);
  }
});
