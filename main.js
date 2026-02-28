const { app, BrowserWindow, powerSaveBlocker, ipcMain, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

const settingsPath = path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (e) {}
}

function getSetting(key, defaultValue) {
  var settings = loadSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

function setSetting(key, value) {
  var settings = loadSettings();
  settings[key] = value;
  saveSettings(settings);
}

let mainWindow = null;
let powerBlockerId = null;
let isQuitting = false;
let isRelaunchingFromMinimize = false;

function setAutoStart(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      path: process.execPath,
      args: []
    });
  } catch (e) {}
}

function createWindow() {
  var kioskMode = getSetting('kioskMode', false);

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

  var serverUrl = getSetting('serverUrl', 'https://digipal-cms.replit.app');
  var playerUrl = serverUrl.endsWith('/') ? serverUrl + 'player.html' : serverUrl + '/player.html';
  mainWindow.loadURL(playerUrl);

  mainWindow.on('close', function(e) {
    if (!isQuitting && getSetting('autoRelaunch', false)) {
      e.preventDefault();
      mainWindow.hide();
      setTimeout(function() {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.setFullScreen(true);
          mainWindow.focus();
        }
      }, 1500);
    }
  });

  mainWindow.on('minimize', function(e) {
    if (getSetting('autoRelaunch', false) && !isRelaunchingFromMinimize) {
      e.preventDefault();
      isRelaunchingFromMinimize = true;
      mainWindow.hide();
      setTimeout(function() {
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

  mainWindow.on('closed', function() {
    mainWindow = null;
  });

  if (getSetting('screenWakeLock', true)) {
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
    globalShortcut.register('Alt+F4', function() {});
    globalShortcut.register('Alt+Tab', function() {});
    globalShortcut.register('CommandOrControl+W', function() {});
    globalShortcut.register('CommandOrControl+Q', function() {});
    globalShortcut.register('F11', function() {});
    globalShortcut.register('Escape', function() {});
  } catch (e) {}
}

function unregisterKioskShortcuts() {
  globalShortcut.unregisterAll();
}

ipcMain.handle('get-settings', function() {
  return {
    serverUrl: getSetting('serverUrl', 'https://digipal-cms.replit.app'),
    autoRelaunch: getSetting('autoRelaunch', false),
    autoStart: getSetting('autoStart', false),
    kioskMode: getSetting('kioskMode', false),
    hideCursor: getSetting('hideCursor', false),
    screenWakeLock: getSetting('screenWakeLock', true)
  };
});

ipcMain.handle('set-setting', function(event, key, value) {
  setSetting(key, value);

  switch (key) {
    case 'autoStart':
      setAutoStart(value);
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
        var playerUrl = value.endsWith('/') ? value + 'player.html' : value + '/player.html';
        mainWindow.loadURL(playerUrl);
      }
      break;

    case 'autoRelaunch':
      break;
  }

  return true;
});

ipcMain.handle('force-quit', function() {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('get-app-version', function() {
  return app.getVersion();
});

app.on('ready', function() {
  createWindow();
});

app.on('window-all-closed', function() {
  if (getSetting('autoRelaunch', false) && !isQuitting) {
    createWindow();
  } else {
    app.quit();
  }
});

app.on('activate', function() {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', function() {
  isQuitting = true;
  unregisterKioskShortcuts();
  disableWakeLock();
});
