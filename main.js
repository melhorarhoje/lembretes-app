// main.js - VERSÃO TOTALMENTE LIMPA SEM DEPENDÊNCIAS EXTERNAS
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Sistema de armazenamento simples com JSON
class SimpleStore {
  constructor() {
    this.storePath = path.join(__dirname, 'dados-lembretes.json');
    this.data = this.carregarDados();
  }

  carregarDados() {
    try {
      if (fs.existsSync(this.storePath)) {
        return JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
      }
    } catch (erro) {
      console.log('Criando novo arquivo de dados...');
    }
    return { 
      lembretes: {}, 
      configuracoes: { 
        extensaoHabilitada: true, 
        somGlobalHabilitado: true 
      } 
    };
  }

  salvarDados() {
    try {
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
      return true;
    } catch (erro) {
      console.error('Erro ao salvar dados:', erro);
      return false;
    }
  }
}

const store = new SimpleStore();
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
  Menu.setApplicationMenu(null);
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
}

// HANDLERS SIMPLIFICADOS
ipcMain.handle('carregar-configuracoes', () => {
  return store.data.configuracoes;
});

ipcMain.handle('salvar-configuracoes', (event, configuracoes) => {
  store.data.configuracoes = configuracoes;
  store.salvarDados();
  return true;
});

ipcMain.handle('carregar-lembretes', () => {
  return store.data.lembretes;
});

ipcMain.handle('adicionar-lembrete', (event, lembrete) => {
  const id = Date.now().toString();
  store.data.lembretes[id] = {
    ...lembrete,
    id: id
  };
  store.salvarDados();
  return id;
});

ipcMain.handle('atualizar-texto-lembrete', (event, id, novoTexto) => {
  if (store.data.lembretes[id]) {
    store.data.lembretes[id].mensagem = novoTexto;
    store.data.lembretes[id].atualizadoEm = new Date().toISOString();
    store.salvarDados();
  }
  return true;
});

ipcMain.handle('excluir-lembrete', (event, id) => {
  if (store.data.lembretes[id]) {
    delete store.data.lembretes[id];
    store.salvarDados();
  }
  return true;
});

ipcMain.handle('configurar-alarme', (event, id, dataHora) => {
  if (store.data.lembretes[id]) {
    store.data.lembretes[id].dataHora = dataHora;
    store.data.lembretes[id].atualizadoEm = new Date().toISOString();
    store.salvarDados();
    
    // Agendar alarme simples
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
  if (store.data.lembretes[id]) {
    store.data.lembretes[id].dataHora = null;
    store.data.lembretes[id].atualizadoEm = new Date().toISOString();
    store.salvarDados();
  }
  return true;
});

ipcMain.handle('alternar-som-lembrete', (event, id) => {
  if (store.data.lembretes[id]) {
    store.data.lembretes[id].somHabilitado = !store.data.lembretes[id].somHabilitado;
    store.data.lembretes[id].atualizadoEm = new Date().toISOString();
    store.salvarDados();
  }
  return true;
});

ipcMain.handle('abrir-janela-alerta', (event, lembreteId) => {
  createAlertaWindow(lembreteId);
});

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