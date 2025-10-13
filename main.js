// main.js - VERSÃO COMPLETA COM PERSISTÊNCIA CORRIGIDA
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// Sistema de armazenamento corrigido - persiste dados entre execuções
class SimpleStore {
  constructor() {
    // ✅ USAR app.getPath('userData') para pasta persistente
    const userDataPath = app.getPath('userData');
    this.storePath = path.join(userDataPath, 'dados-lembretes.json');
    this.data = this.carregarDados();
    console.log('Arquivo de dados:', this.storePath);
  }

  carregarDados() {
    try {
      if (fs.existsSync(this.storePath)) {
        const dados = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
        console.log('Dados carregados:', Object.keys(dados.lembretes).length, 'lembretes');
        return dados;
      }
    } catch (erro) {
      console.log('Erro ao carregar dados, criando novo arquivo...', erro);
    }
    
    // Dados padrão se arquivo não existir
    const dadosPadrao = { 
      lembretes: {}, 
      configuracoes: { 
        extensaoHabilitada: true, 
        somGlobalHabilitado: true 
      } 
    };
    console.log('Criando novo arquivo de dados...');
    return dadosPadrao;
  }

  salvarDados() {
    try {
      // ✅ GARANTIR que a pasta existe
      const pasta = path.dirname(this.storePath);
      if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, { recursive: true });
      }
      
      fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
      console.log('Dados salvos com sucesso em:', this.storePath);
      return true;
    } catch (erro) {
      console.error('ERRO CRÍTICO ao salvar dados:', erro);
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
  let alarmesReagendados = 0;
  
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
        alarmesReagendados++;
        console.log(`Alarme reagendado: ${lembrete.mensagem.substring(0, 20)}...`);
      } else {
        // ✅ LIMPAR ALARMES EXPIRADOS
        lembrete.dataHora = null;
        console.log(`Alarme expirado removido: ${lembrete.mensagem.substring(0, 20)}...`);
      }
    }
  }
  
  console.log(`Total de alarmes reagendados: ${alarmesReagendados}`);
  store.salvarDados();
}

// ✅ HANDLERS ÚNICOS

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
  store.salvarDados(); // ✅ SALVAR IMEDIATAMENTE
  console.log('Lembrete adicionado e salvo:', id);
  return id;
});

ipcMain.handle('atualizar-texto-lembrete', (event, id, novoTexto) => {
  if (store.data.lembretes[id]) {
    store.data.lembretes[id].mensagem = novoTexto;
    store.data.lembretes[id].atualizadoEm = new Date().toISOString();
    store.salvarDados(); // ✅ SALVAR IMEDIATAMENTE
  }
  return true;
});

ipcMain.handle('excluir-lembrete', (event, id) => {
  if (store.data.lembretes[id]) {
    delete store.data.lembretes[id];
    store.salvarDados(); // ✅ SALVAR IMEDIATAMENTE
  }
  return true;
});

// Alarmes
ipcMain.handle('configurar-alarme', (event, id, dataHora) => {
  if (store.data.lembretes[id]) {
    store.data.lembretes[id].dataHora = dataHora;
    store.data.lembretes[id].atualizadoEm = new Date().toISOString();
    store.salvarDados(); // ✅ SALVAR IMEDIATAMENTE
    
    const dataHoraObj = new Date(dataHora);
    const agora = new Date();
    const tempoRestante = dataHoraObj.getTime() - agora.getTime();
    
    if (tempoRestante > 0) {
      if (alarmesAtivos.has(id)) {
        clearTimeout(alarmesAtivos.get(id));
      }
      
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
    store.salvarDados(); // ✅ SALVAR IMEDIATAMENTE
    
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
    store.salvarDados(); // ✅ SALVAR IMEDIATAMENTE
  }
  return true;
});

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