const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { generatePPT } = require('./lib/pptGenerator');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 480,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC：选择图片文件夹 ──
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择包含图片的文件夹',
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC：选择保存位置 ──
ipcMain.handle('select-save-path', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存 PPT 文件',
    defaultPath: 'output.pptx',
    filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
  });
  return result.canceled ? null : result.filePath;
});

// ── IPC：生成 PPT ──
ipcMain.handle('generate-ppt', async (_event, { sourceDir, outputPath, compress }) => {
  return generatePPT(sourceDir, outputPath, { compress }, (current, total, name) => {
    mainWindow.webContents.send('progress', { current, total, name });
  });
});
