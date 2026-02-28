const { app, BrowserWindow, powerSaveBlocker, ipcMain, globalShortcut, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store').default || require('electron-store');
const AutoLaunch = require('auto-launch');

const store = new Store({
  defaults: {
    serverUrl: 'https://digipal-cms.replit.app',
    autoRelaunch: false,
    autoStart: false,
    kioskMode: false,
    hideCursor: false,
    screenWakeLock: true
  }
});

let mainWindow = null;
let powerBlockerId = null;
let isQuitting = false;
let isRelaunchingFromMinimize = false;

const autoLauncher = new AutoLaunch({
  name: 'Digipal Player',
  isHidden: false
});

function createWindow() {
  const kioskMode = store.get('kioskMode', false);

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    fullscreen: true,
    frame: false,
    kiosk: kioskMode,
    autoHideMenuBar: true,
    backgroundColor: '#0a0e1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true
    }
  });

  mainWindow.setMenuBarVisibility(false);

  const serverUrl = store.get('serverUrl', 'https://digipal-cms.replit.app');
  const playerUrl = serverUrl.endsWith('/') ? serverUrl + 'player.html' : serverUrl + '/player.html';
  mainWindow.loadURL(playerUrl);

  mainWindow.on('close', (e) => {
    if (!isQuitting && store.get('autoRelaunch', false)) {
      e.preventDefault();
      mainWindow.hide();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.setFullScreen(true);
          mainWindow.focus();
        }
      }, 1500);
    }
  });

  mainWindow.on('minimize', (e) => {
    if (store.get('autoRelaunch', false) && !isRelaunchingFromMinimize) {
      e.preventDefault();
      isRelaunchingFromMinimize = true;
      mainWindow.hide();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.restore();
          mainWindow.setFullScreen(true);
          mainWindow.focus();
          isRelaunchingFromMinimize = false;
        }
      }, 1500);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (store.get('screenWakeLock', true)) {
    enableWakeLock();
  }

  if (kioskMode) {
    registerKioskShortcuts();
  }
}

function enableWakeLock() {
  if (powerBlockerId === null || !powerSaveBlocker.isStarted(powerBlockerId)) {
    powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  }
}

function disableWakeLock() {
  if (powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId)) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }
}

function registerKioskShortcuts() {
  try {
    globalShortcut.register('Alt+F4', () => {});
    globalShortcut.register('Alt+Tab', () => {});
    globalShortcut.register('CommandOrControl+W', () => {});
    globalShortcut.register('CommandOrControl+Q', () => {});
    globalShortcut.register('F11', () => {});
    globalShortcut.register('Escape', () => {});
    globalShortcut.register('Super', () => {});
  } catch (e) {}
}

function unregisterKioskShortcuts() {
  globalShortcut.unregisterAll();
}

ipcMain.handle('get-settings', () => {
  return {
    serverUrl: store.get('serverUrl'),
    autoRelaunch: store.get('autoRelaunch'),
    autoStart: store.get('autoStart'),
    kioskMode: store.get('kioskMode'),
    hideCursor: store.get('hideCursor'),
    screenWakeLock: store.get('screenWakeLock')
  };
});

ipcMain.handle('set-setting', async (event, key, value) => {
  store.set(key, value);

  switch (key) {
    case 'autoStart':
      try {
        if (value) {
          await autoLauncher.enable();
        } else {
          await autoLauncher.disable();
        }
      } catch (e) {}
      break;

    case 'kioskMode':
      if (mainWindow) {
        mainWindow.setKiosk(value);
        if (value) {
          registerKioskShortcuts();
        } else {
          unregisterKioskShortcuts();
        }
      }
      break;

    case 'screenWakeLock':
      if (value) {
        enableWakeLock();
      } else {
        disableWakeLock();
      }
      break;

    case 'serverUrl':
      if (mainWindow) {
        const playerUrl = value.endsWith('/') ? value + 'player.html' : value + '/player.html';
        mainWindow.loadURL(playerUrl);
      }
      break;

    case 'autoRelaunch':
      break;
  }

  return true;
});

ipcMain.handle('force-quit', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

app.on('ready', () => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (store.get('autoRelaunch', false) && !isQuitting) {
    createWindow();
  } else {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  unregisterKioskShortcuts();
  disableWakeLock();
});
