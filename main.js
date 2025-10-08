// main.js - Processo Principal do Electron
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Configurar armazenamento
const store = new Store();

let mainWindow;
let alertaWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 650,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    resizable: true,
    minimizable: true,
    maximizable: false,
    title: 'Lembretes Compartilhados'
  });

  mainWindow.loadFile('index.html');
  
  // Remover menu padrão para interface mais limpa
  Menu.setApplicationMenu(null);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function createAlertaWindow(lembreteId) {
  alertaWindow = new BrowserWindow({
    width: 450,
    height: 350,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    skipTaskbar: true
  });

  alertaWindow.loadFile('alerta.html', { query: { id: lembreteId } });
  alertaWindow.on('closed', () => {
    alertaWindow = null;
  });
}

// Handlers para IPC (comunicação entre processos)
ipcMain.handle('salvar-lembretes', (event, lembretes) => {
  store.set('lembretes', lembretes);
  return true;
});

ipcMain.handle('carregar-lembretes', (event) => {
  return store.get('lembretes', {});
});

ipcMain.handle('abrir-janela-alerta', (event, lembreteId) => {
  createAlertaWindow(lembreteId);
});

ipcMain.handle('fechar-janela-alerta', (event) => {
  if (alertaWindow) {
    alertaWindow.close();
  }
});

// Inicializar app
app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});