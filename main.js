// main.js - PROCESSO PRINCIPAL COMPLETO
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

// 🔥 HANDLERS PARA TODAS AS FUNÇÕES DO POPUP.JS

// Configurações
ipcMain.handle('carregar-configuracoes', () => {
  return {
    extensaoHabilitada: store.get('extensaoHabilitada', true),
    somGlobalHabilitado: store.get('somGlobalHabilitado', true)
  };
});

ipcMain.handle('salvar-configuracoes', (event, configuracoes) => {
  store.set('extensaoHabilitada', configuracoes.extensaoHabilitada);
  store.set('somGlobalHabilitado', configuracoes.somGlobalHabilitado);
  return true;
});

// Lembretes
ipcMain.handle('carregar-lembretes', () => {
  return store.get('lembretes', {});
});

ipcMain.handle('salvar-lembretes', (event, lembretes) => {
  store.set('lembretes', lembretes);
  return true;
});

ipcMain.handle('adicionar-lembrete', (event, lembrete) => {
  const lembretes = store.get('lembretes', {});
  const id = Date.now().toString();
  
  lembretes[id] = {
    ...lembrete,
    id: id
  };
  
  store.set('lembretes', lembretes);
  return id;
});

ipcMain.handle('atualizar-texto-lembrete', (event, id, novoTexto) => {
  const lembretes = store.get('lembretes', {});
  
  if (lembretes[id]) {
    lembretes[id].mensagem = novoTexto;
    lembretes[id].atualizadoEm = new Date().toISOString();
    store.set('lembretes', lembretes);
  }
  
  return true;
});

ipcMain.handle('excluir-lembrete', (event, id) => {
  const lembretes = store.get('lembretes', {});
  
  if (lembretes[id]) {
    delete lembretes[id];
    store.set('lembretes', lembretes);
  }
  
  return true;
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