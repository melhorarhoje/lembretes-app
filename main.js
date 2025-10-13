// main.js - SISTEMA HÍBRIDO COMPLETO (Firebase + Local)
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

// ✅ SISTEMA DE ARMAZENAMENTO LOCAL
class SimpleStore {
    constructor() {
        const userDataPath = app.getPath('userData');
        this.storePath = path.join(userDataPath, 'dados-lembretes.json');
        this.data = this.carregarDados();
        console.log('📁 Arquivo local:', this.storePath);
    }

    carregarDados() {
        try {
            if (fs.existsSync(this.storePath)) {
                const dados = JSON.parse(fs.readFileSync(this.storePath, 'utf8'));
                console.log('📂 Dados locais carregados:', Object.keys(dados.lembretes || {}).length, 'lembretes');
                return dados;
            }
        } catch (erro) {
            console.log('❌ Erro ao carregar dados locais, criando novo...', erro);
        }
        
        const dadosPadrao = { 
            lembretes: {}, 
            configuracoes: { 
                extensaoHabilitada: true, 
                somGlobalHabilitado: true 
            } 
        };
        console.log('🆕 Criando novo arquivo de dados local');
        return dadosPadrao;
    }

    salvarDados() {
        try {
            const pasta = path.dirname(this.storePath);
            if (!fs.existsSync(pasta)) {
                fs.mkdirSync(pasta, { recursive: true });
            }
            
            fs.writeFileSync(this.storePath, JSON.stringify(this.data, null, 2));
            console.log('💾 Dados locais salvos');
            return true;
        } catch (erro) {
            console.error('❌ ERRO ao salvar dados locais:', erro);
            return false;
        }
    }

    salvarLembreteLocal(lembrete) {
        const id = lembrete.id || `local_${Date.now()}`;
        this.data.lembretes[id] = {
            ...lembrete,
            id: id,
            sincronizado: false
        };
        this.salvarDados();
        return id;
    }

    excluirLembreteLocal(id) {
        if (this.data.lembretes[id]) {
            delete this.data.lembretes[id];
            this.salvarDados();
            return true;
        }
        return false;
    }
}

// ✅ GERENCIADOR HÍBRIDO DE DADOS
class GerenciadorDados {
    constructor() {
        this.localStore = new SimpleStore();
        this.firebaseService = null;
        this.sincronizando = false;
        this.observadorAtivo = false;
        this.inicializarFirebase();
    }

    inicializarFirebase() {
        try {
            // ✅ CARREGAR FIREBASE DINAMICAMENTE
            this.firebaseService = require('./firebaseService.js');
            console.log('🔥 FirebaseService carregado');
            
            // ✅ INICIAR OBSERVAÇÃO EM TEMPO REAL
            this.iniciarObservacaoTempoReal();
            
        } catch (erro) {
            console.log('⚠️ FirebaseService não disponível - modo local apenas');
            this.firebaseService = null;
        }
    }

    iniciarObservacaoTempoReal() {
        if (!this.firebaseService || !this.firebaseService.inicializado) {
            console.log('⚠️ Não é possível observar mudanças - Firebase offline');
            return;
        }

        try {
            this.firebaseService.observarMudancas((mudancas) => {
                this.processarMudancasFirebase(mudancas);
            });
            this.observadorAtivo = true;
            console.log('👂 Observando mudanças Firebase em tempo real');
        } catch (erro) {
            console.error('❌ Erro ao iniciar observação:', erro);
        }
    }

    processarMudancasFirebase(mudancas) {
        if (this.sincronizando) return;

        console.log(`🔄 Processando ${mudancas.length} mudanças do Firebase`);
        
        for (const mudanca of mudancas) {
            switch (mudanca.tipo) {
                case 'added':
                case 'modified':
                    // ✅ ATUALIZAR/CRIAR LOCALMENTE
                    this.localStore.data.lembretes[mudanca.id] = {
                        ...mudanca.dados,
                        sincronizado: true
                    };
                    console.log(`✅ ${mudanca.tipo === 'added' ? 'Adicionado' : 'Atualizado'} do Firebase: ${mudanca.dados.mensagem.substring(0, 30)}...`);
                    break;
                    
                case 'removed':
                    // ✅ REMOVER LOCALMENTE
                    if (this.localStore.data.lembretes[mudanca.id]) {
                        delete this.localStore.data.lembretes[mudanca.id];
                        console.log(`🗑️ Removido do Firebase: ${mudanca.id}`);
                    }
                    break;
            }
        }
        
        this.localStore.salvarDados();
        
        // ✅ NOTIFICAR FRONTEND PARA ATUALIZAR
        if (mainWindow) {
            mainWindow.webContents.send('dados-atualizados');
        }
    }

    // ✅ SALVAR LEMBRETE (HÍBRIDO)
    async salvarLembrete(lembrete) {
        const idLocal = this.localStore.salvarLembreteLocal(lembrete);
        console.log(`💾 Salvo localmente: ${lembrete.mensagem.substring(0, 30)}...`);

        // ✅ TENTAR SINCRONIZAR COM FIREBASE
        if (this.firebaseService && this.firebaseService.inicializado) {
            try {
                this.sincronizando = true;
                const idFirebase = await this.firebaseService.salvarLembreteCompartilhado({
                    ...lembrete,
                    id: idLocal
                });
                
                // ✅ ATUALIZAR ID LOCAL COM ID DO FIREBASE
                if (idFirebase !== idLocal) {
                    const lembreteLocal = this.localStore.data.lembretes[idLocal];
                    delete this.localStore.data.lembretes[idLocal];
                    this.localStore.data.lembretes[idFirebase] = {
                        ...lembreteLocal,
                        id: idFirebase,
                        sincronizado: true
                    };
                    this.localStore.salvarDados();
                    console.log(`🔄 Sincronizado: ${idLocal} → ${idFirebase}`);
                } else {
                    this.localStore.data.lembretes[idLocal].sincronizado = true;
                    this.localStore.salvarDados();
                    console.log(`✅ Sincronizado com Firebase: ${idLocal}`);
                }
                
            } catch (erroFirebase) {
                console.log('⚠️ Firebase offline - mantendo apenas local');
                this.localStore.data.lembretes[idLocal].sincronizado = false;
                this.localStore.salvarDados();
            } finally {
                this.sincronizando = false;
            }
        }

        return this.localStore.data.lembretes[idLocal]?.id || idLocal;
    }

    // ✅ CARREGAR LEMBRETES (HÍBRIDO)
    async carregarLembretes() {
        // ✅ PRIMEIRO TENTA FIREBASE
        if (this.firebaseService && this.firebaseService.inicializado && !this.sincronizando) {
            try {
                this.sincronizando = true;
                console.log('🔄 Tentando carregar do Firebase...');
                
                const lembretesFirebase = await this.firebaseService.buscarLembretesCompartilhados();
                
                // ✅ SINCRONIZAR COM DADOS LOCAIS
                this.localStore.data.lembretes = lembretesFirebase;
                this.localStore.salvarDados();
                
                console.log(`✅ Dados sincronizados do Firebase: ${Object.keys(lembretesFirebase).length} itens`);
                return lembretesFirebase;
                
            } catch (erroFirebase) {
                console.log('⚠️ Firebase offline - usando dados locais');
            } finally {
                this.sincronizando = false;
            }
        }
        
        // ✅ FALLBACK: DADOS LOCAIS
        console.log(`📁 Usando dados locais: ${Object.keys(this.localStore.data.lembretes).length} itens`);
        return this.localStore.data.lembretes;
    }

    // ✅ EXCLUIR LEMBRETE (HÍBRIDO)
    async excluirLembrete(id) {
        const excluidoLocal = this.localStore.excluirLembreteLocal(id);
        
        // ✅ TENTAR EXCLUIR DO FIREBASE
        if (excluidoLocal && this.firebaseService && this.firebaseService.inicializado && !id.startsWith('local_')) {
            try {
                await this.firebaseService.excluirLembreteCompartilhado(id);
                console.log(`✅ Excluído do Firebase: ${id}`);
            } catch (erroFirebase) {
                console.log('⚠️ Não foi possível excluir do Firebase - apenas local');
            }
        }
        
        return excluidoLocal;
    }

    getStatus() {
        return {
            firebase: this.firebaseService ? this.firebaseService.getStatus() : { inicializado: false, online: false },
            local: { itens: Object.keys(this.localStore.data.lembretes).length },
            sincronizando: this.sincronizando
        };
    }
}

// ✅ INICIALIZAR SISTEMA
const gerenciadorDados = new GerenciadorDados();
let mainWindow;
let alertaWindow;
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
    const configuracoes = gerenciadorDados.localStore.data.configuracoes;
    if (!configuracoes.extensaoHabilitada) {
        console.log('🔕 Extensão desabilitada - alerta bloqueado');
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

// ✅ REAGENDAR ALARMES AO INICIAR
function reagendarAlarmesAoIniciar() {
    const configuracoes = gerenciadorDados.localStore.data.configuracoes;
    
    if (!configuracoes.extensaoHabilitada) {
        console.log('🔕 Extensão desabilitada - nenhum alarme reagendado');
        return;
    }
    
    console.log('🔄 Reagendando alarmes ativos...');
    const agora = new Date();
    let alarmesReagendados = 0;
    
    for (const [id, lembrete] of Object.entries(gerenciadorDados.localStore.data.lembretes)) {
        if (lembrete.dataHora) {
            const dataHoraObj = new Date(lembrete.dataHora);
            const tempoRestante = dataHoraObj.getTime() - agora.getTime();
            
            if (tempoRestante > 0) {
                if (alarmesAtivos.has(id)) {
                    clearTimeout(alarmesAtivos.get(id));
                }
                
                const alarmeId = setTimeout(() => {
                    createAlertaWindow(id);
                    alarmesAtivos.delete(id);
                }, tempoRestante);
                
                alarmesAtivos.set(id, alarmeId);
                alarmesReagendados++;
            } else {
                lembrete.dataHora = null;
            }
        }
    }
    
    console.log(`✅ ${alarmesReagendados} alarme(s) reagendado(s)`);
    gerenciadorDados.localStore.salvarDados();
}

// ✅ HANDLERS IPC
ipcMain.handle('carregar-configuracoes', () => {
    return gerenciadorDados.localStore.data.configuracoes;
});

ipcMain.handle('salvar-configuracoes', (event, configuracoes) => {
    gerenciadorDados.localStore.data.configuracoes = configuracoes;
    gerenciadorDados.localStore.salvarDados();
    return true;
});

ipcMain.handle('carregar-lembretes', async () => {
    return await gerenciadorDados.carregarLembretes();
});

ipcMain.handle('adicionar-lembrete', async (event, lembrete) => {
    return await gerenciadorDados.salvarLembrete(lembrete);
});

ipcMain.handle('atualizar-texto-lembrete', async (event, id, novoTexto) => {
    const lembrete = gerenciadorDados.localStore.data.lembretes[id];
    if (lembrete) {
        lembrete.mensagem = novoTexto;
        lembrete.atualizadoEm = new Date().toISOString();
        lembrete.sincronizado = false;
        
        await gerenciadorDados.salvarLembrete(lembrete);
    }
    return true;
});

ipcMain.handle('excluir-lembrete', async (event, id) => {
    return await gerenciadorDados.excluirLembrete(id);
});

ipcMain.handle('configurar-alarme', (event, id, dataHora) => {
    const lembrete = gerenciadorDados.localStore.data.lembretes[id];
    if (lembrete) {
        lembrete.dataHora = dataHora;
        lembrete.atualizadoEm = new Date().toISOString();
        lembrete.sincronizado = false;
        
        gerenciadorDados.salvarLembrete(lembrete);
        
        const dataHoraObj = new Date(dataHora);
        const agora = new Date();
        const tempoRestante = dataHoraObj.getTime() - agora.getTime();
        
        if (tempoRestante > 0) {
            if (alarmesAtivos.has(id)) {
                clearTimeout(alarmesAtivos.get(id));
            }
            
            const configuracoes = gerenciadorDados.localStore.data.configuracoes;
            if (configuracoes.extensaoHabilitada) {
                const alarmeId = setTimeout(() => {
                    createAlertaWindow(id);
                    alarmesAtivos.delete(id);
                }, tempoRestante);
                
                alarmesAtivos.set(id, alarmeId);
            }
        }
    }
    return true;
});

ipcMain.handle('remover-alarme', (event, id) => {
    const lembrete = gerenciadorDados.localStore.data.lembretes[id];
    if (lembrete) {
        lembrete.dataHora = null;
        lembrete.atualizadoEm = new Date().toISOString();
        lembrete.sincronizado = false;
        
        gerenciadorDados.salvarLembrete(lembrete);
        
        if (alarmesAtivos.has(id)) {
            clearTimeout(alarmesAtivos.get(id));
            alarmesAtivos.delete(id);
        }
    }
    return true;
});

ipcMain.handle('alternar-som-lembrete', async (event, id) => {
    const lembrete = gerenciadorDados.localStore.data.lembretes[id];
    if (lembrete) {
        lembrete.somHabilitado = !lembrete.somHabilitado;
        lembrete.atualizadoEm = new Date().toISOString();
        lembrete.sincronizado = false;
        
        await gerenciadorDados.salvarLembrete(lembrete);
    }
    return true;
});

ipcMain.handle('desativar-todos-alarmes', () => {
    for (const [id, alarme] of alarmesAtivos.entries()) {
        clearTimeout(alarme);
    }
    alarmesAtivos.clear();
    console.log('🔕 Todos os alarmes desativados');
    return true;
});

ipcMain.handle('abrir-janela-alerta', (event, lembreteId) => {
    createAlertaWindow(lembreteId);
});

ipcMain.handle('get-status-sincronizacao', () => {
    return gerenciadorDados.getStatus();
});

// ✅ ESCUTAR ATUALIZAÇÕES DO FRONTEND
ipcMain.on('sincronizar-manualmente', async (event) => {
    console.log('🔄 Sincronização manual solicitada');
    await gerenciadorDados.carregarLembretes();
    event.reply('sincronizacao-completa');
});

// ✅ INICIALIZAR APP
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