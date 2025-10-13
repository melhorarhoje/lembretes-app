// main.js - VERSÃO COMPLETA CORRIGIDA
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

// ✅ CONTROLE DE ALARMES ATIVOS
const alarmesAtivos = new Map();

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
    title: 'COMPI - Painel de Lembretes'
  });

  mainWindow.loadFile('index.html');
  Menu.setApplicationMenu(null);
}

function createAlertaWindow(lembreteId) {
  // ✅ VERIFICAR SE EXTENSÃO ESTÁ HABILITADA ANTES DE CRIAR ALERTA
  const configuracoes = store.data.configuracoes;
  if (!configuracoes.extensaoHabilitada) {
    console.log('Extensão desabilitada - alerta bloqueado');
    return null;
  }

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
    title: 'COMPI - Alerta'
  });

  alertaWindow.loadFile('alerta.html', { query: { id: lembreteId } });
  return alertaWindow;
}

// ✅ REAGENDAR ALARMES AO INICIAR (APENAS SE EXTENSÃO HABILITADA)
function reagendarAlarmesAoIniciar() {
  const configuracoes = store.data.configuracoes;
  
  if (!configuracoes.extensaoHabilitada) {
    console.log('Extensão desabilitada - nenhum alarme reagendado');
    return;
  }
  
  console.log('Reagendando alarmes ativos...');
  const agora = new Date();
  
  for (const [id, lembrete] of Object.entries(store.data.lembretes)) {
    if (lembrete.dataHora) {
      const dataHoraObj = new Date(lembrete.dataHora);
      const tempoRestante = dataHoraObj.getTime() - agora.getTime();
      
      if (tempoRestante > 0) {
        // ✅ CANCELAR ALARME EXISTENTE
        if (alarmesAtivos.has(id)) {
          clearTimeout(alarmesAtivos.get(id));
        }
        
        // ✅ AGENDAR NOVO ALARME
        const alarmeId = setTimeout(() => {
          createAlertaWindow(id);
          alarmesAtivos.delete(id);
        }, tempoRestante);
        
        alarmesAtivos.set(id, alarmeId);
        console.log(`Alarme reagendado: ${lembrete.mensagem.substring(0, 20)}...`);
      } else {
        // ✅ LIMPAR ALARMES EXPIRADOS
        lembrete.dataHora = null;
        console.log(`Alarme expirado removido: ${lembrete.mensagem.substring(0, 20)}...`);
      }
    }
  }
  
  store.salvarDados();
}

// ✅ HANDLERS ÚNICOS (SEM DUPLICAÇÃO)

// Configurações
ipcMain.handle('carregar-configuracoes', () => {
  return store.data.configuracoes;
});

ipcMain.handle('salvar-configuracoes', (event, configuracoes) => {
  store.data.configuracoes = configuracoes;
  store.salvarDados();
  return true;
});

// Lembretes
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

// Alarmes
ipcMain.handle('configurar-alarme', (event, id, dataHora) => {
  if (store.data.lembretes[id]) {
    store.data.lembretes[id].dataHora = dataHora;
    store.data.lembretes[id].atualizadoEm = new Date().toISOString();
    store.salvarDados();
    
    const dataHoraObj = new Date(dataHora);
    const agora = new Date();
    const tempoRestante = dataHoraObj.getTime() - agora.getTime();
    
    if (tempoRestante > 0) {
      // ✅ CANCELAR ALARME EXISTENTE SE HOUVER
      if (alarmesAtivos.has(id)) {
        clearTimeout(alarmesAtivos.get(id));
      }
      
      // ✅ SÓ AGENDAR SE EXTENSÃO ESTIVER HABILITADA
      const configuracoes = store.data.configuracoes;
      if (configuracoes.extensaoHabilitada) {
        const alarmeId = setTimeout(() => {
          createAlertaWindow(id);
          alarmesAtivos.delete(id);
        }, tempoRestante);
        
        alarmesAtivos.set(id, alarmeId);
        console.log(`Alarme agendado para: ${dataHoraObj.toLocaleString()}`);
      } else {
        console.log('Extensão desabilitada - alarme não agendado');
      }
    }
  }
  return true;
});

ipcMain.handle('remover-alarme', (event, id) => {
  if (store.data.lembretes[id]) {
    store.data.lembretes[id].dataHora = null;
    store.data.lembretes[id].atualizadoEm = new Date().toISOString();
    store.salvarDados();
    
    // ✅ CANCELAR ALARME ATIVO
    if (alarmesAtivos.has(id)) {
      clearTimeout(alarmesAtivos.get(id));
      alarmesAtivos.delete(id);
    }
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

// ✅ NOVO HANDLER: DESATIVAR TODOS OS ALARMES
ipcMain.handle('desativar-todos-alarmes', () => {
  for (const [id, alarme] of alarmesAtivos.entries()) {
    clearTimeout(alarme);
  }
  alarmesAtivos.clear();
  console.log('Todos os alarmes foram desativados');
  return true;
});

ipcMain.handle('abrir-janela-alerta', (event, lembreteId) => {
  createAlertaWindow(lembreteId);
});

// Inicializar app
app.whenReady().then(() => {
  createMainWindow();
  reagendarAlarmesAoIniciar();
});

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