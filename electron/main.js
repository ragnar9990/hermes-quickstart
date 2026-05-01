const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const detect = require('../src/lib/detect.js');
const configWriter = require('../src/lib/config-writer.js');
const secrets = require('../src/lib/secrets.js');
const installers = {
  win32: require('../src/lib/installers/windows.js'),
  darwin: require('../src/lib/installers/mac.js'),
  linux: require('../src/lib/installers/linux.js'),
};

const isDev = !app.isPackaged;

// Workaround: "Network service crashed" on Windows with some Intel/AMD GPUs.
// Disabling HW accel + the GPU sandbox is the standard fix and has zero
// visible effect for a wizard UI like this one.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-sandbox');
app.commandLine.appendSwitch('no-sandbox');

function createWindow() {
  const win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 820,
    minHeight: 600,
    backgroundColor: '#0b0d10',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  ipcMain.handle('detect:os', () => detect.detectOS());
  ipcMain.handle('detect:wsl', () => detect.detectWSL());
  ipcMain.handle('detect:hermes', () => detect.detectHermes());

  ipcMain.handle('secrets:set', (_e, account, value) => secrets.set(account, value));
  ipcMain.handle('secrets:get', (_e, account) => secrets.get(account));

  ipcMain.handle('config:write', (_e, cfg) => configWriter.write(cfg));
  ipcMain.handle('config:preview', (_e, cfg) => configWriter.preview(cfg));

  ipcMain.handle('install:checkDeps', async () => {
    const installer = installers[process.platform];
    if (!installer || !installer.checkDeps) return { missing: [] };
    return installer.checkDeps();
  });

  ipcMain.handle('install:installDeps', async (e, missing, password) => {
    const installer = installers[process.platform];
    if (!installer || !installer.installDeps) return { ok: true };
    return installer.installDeps(missing, password, (chunk) => {
      e.sender.send('install:log', chunk);
    });
  });

  ipcMain.handle('install:run', async (e, payload) => {
    const platform = process.platform;
    const installer = installers[platform];
    if (!installer) throw new Error(`Unsupported platform: ${platform}`);
    return installer.run(payload, (chunk) => {
      e.sender.send('install:log', chunk);
    });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
