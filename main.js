// main.js - VERSÃO SIMPLIFICADA SEM ELECTRON-STORE
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Fallback: usar arquivo JSON simples para armazenamento
function getStore() {
  const storePath = path.join(__dirname, 'lembretes-data.json');
  try {
    if (fs.existsSync(storePath)) {
      return JSON.parse(fs.readFileSync(storePath, 'utf8'));
    }
  } catch (error) {
    console.log('Erro ao carregar dados, criando novo arquivo...');
  }
  return { lembretes: {}, configuracoes: { extensaoHabilitada: true, somGlobalHabilitado: true } };
}

function setStore(data) {
  const storePath = path.join(__dirname, 'lembretes-data.json');
  try {
    fs.writeFileSync(storePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Erro ao salvar dados:', error);
    return false;
  }
}

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
      contextIsolation: false
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
    alwaysOnTop: true
  });

  alertaWindow.loadFile('alerta.html', { query: { id: lembreteId } });
  alertaWindow.on('closed', () => {
    alertaWindow = null;
  });
}

// 🔥 HANDLERS SIMPLIFICADOS SEM ELECTRON-STORE

// Configurações
ipcMain.handle('carregar-configuracoes', () => {
  const store = getStore();
  return store.configuracoes;
});

ipcMain.handle('salvar-configuracoes', (event, configuracoes) => {
  const store = getStore();
  store.configuracoes = configuracoes;
  setStore(store);
  return true;
});

// Lembretes
ipcMain.handle('carregar-lembretes', () => {
  const store = getStore();
  return store.lembretes;
});

ipcMain.handle('salvar-lembretes', (event, lembretes) => {
  const store = getStore();
  store.lembretes = lembretes;
  setStore(store);
  return true;
});

ipcMain.handle('adicionar-lembrete', (event, lembrete) => {
  const store = getStore();
  const id = Date.now().toString();
  
  store.lembretes[id] = {
    ...lembrete,
    id: id
  };
  
  setStore(store);
  return id;
});

// Alarmes
ipcMain.handle('configurar-alarme', (event, id, dataHora) => {
  const lembretes = store.get('lembretes', {});
  
  if (lembretes[id]) {
    lembretes[id].dataHora = dataHora;
    lembretes[id].atualizadoEm = new Date().toISOString();
    store.set('lembretes', lembretes);
    
    // Agendar alarme (simulação - em produção usaria setTimeout)
    const dataHoraObj = new Date(dataHora);
    const agora = new Date();
    const tempoRestante = dataHoraObj.getTime() - agora.getTime();
    
    if (tempoRestante > 0) {
      setTimeout(() => {
        createAlertaWindow(id);
      }, tempoRestante);
    }
  }
  
  return true;
});

ipcMain.handle('remover-alarme', (event, id) => {
  const lembretes = store.get('lembretes', {});
  
  if (lembretes[id]) {
    lembretes[id].dataHora = null;
    lembretes[id].atualizadoEm = new Date().toISOString();
    store.set('lembretes', lembretes);
  }
  
  return true;
});

ipcMain.handle('alternar-som-lembrete', (event, id) => {
  const lembretes = store.get('lembretes', {});
  
  if (lembretes[id]) {
    lembretes[id].somHabilitado = !lembretes[id].somHabilitado;
    lembretes[id].atualizadoEm = new Date().toISOString();
    store.set('lembretes', lembretes);
  }
  
  return true;
});

// Janelas
ipcMain.handle('abrir-janela-alerta', (event, lembreteId) => {
  createAlertaWindow(lembreteId);
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