// main.js - SISTEMA HÍBRIDO COMPLETO (Firebase + Local) - CORRIGIDO
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
        const id = lembrete.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.data.lembretes[id] = {
            ...lembrete,
            id: id,
            sincronizado: false,
            criadoEm: lembrete.criadoEm || new Date().toISOString(),
            atualizadoEm: new Date().toISOString()
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

// ✅ GERENCIADOR HÍBRIDO DE DADOS - CORRIGIDO E SIMPLIFICADO
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
            console.log('🔥 Inicializando Firebase...');
            this.firebaseService = require('./firebaseService.js');
            
            // Aguardar inicialização do Firebase
            setTimeout(() => {
                if (this.firebaseService && this.firebaseService.inicializado) {
                    console.log('✅ Firebase inicializado com sucesso');
                    this.iniciarObservacaoTempoReal();
                } else {
                    console.log('⚠️ Firebase não inicializado - usando modo local');
                }
            }, 2000);
            
        } catch (erro) {
            console.log('❌ Erro ao carregar FirebaseService:', erro.message);
            this.firebaseService = { 
                inicializado: false,
                getStatus: () => ({ inicializado: false, online: false })
            };
        }
    }

    iniciarObservacaoTempoReal() {
        if (!this.firebaseService || !this.firebaseService.inicializado) {
            console.log('⚠️ Firebase offline - sem observação em tempo real');
            return;
        }

        try {
            console.log('👂 Iniciando observação Firebase em tempo real...');
            this.firebaseService.observarMudancas((mudancas) => {
                console.log(`🔄 ${mudancas.length} mudança(s) recebida(s) do Firebase`);
                this.processarMudancasFirebase(mudancas);
            });
            this.observadorAtivo = true;
            
        } catch (erro) {
            console.error('❌ Erro ao iniciar observação:', erro);
        }
    }

    processarMudancasFirebase(mudancas) {
        if (this.sincronizando || mudancas.length === 0) return;

        let atualizou = false;
        
        for (const mudanca of mudancas) {
            switch (mudanca.tipo) {
                case 'added':
                case 'modified':
                    if (mudanca.dados) {
                        // Verificar se é mais recente que o local
                        const local = this.localStore.data.lembretes[mudanca.id];
                        if (!local || new Date(mudanca.dados.atualizadoEm) > new Date(local.atualizadoEm)) {
                            this.localStore.data.lembretes[mudanca.id] = mudanca.dados;
                            atualizou = true;
                            console.log(`✅ ${mudanca.tipo === 'added' ? 'Adicionado' : 'Atualizado'} do Firebase: ${mudanca.id}`);
                        }
                    }
                    break;
                    
                case 'removed':
                    if (this.localStore.data.lembretes[mudanca.id]) {
                        delete this.localStore.data.lembretes[mudanca.id];
                        atualizou = true;
                        console.log(`🗑️ Removido do Firebase: ${mudanca.id}`);
                    }
                    break;
            }
        }
        
        if (atualizou) {
            this.localStore.salvarDados();
            // Notificar frontend para atualizar
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('dados-atualizados');
            }
        }
    }

    // ✅ SALVAR LEMBRETE (SIMPLIFICADO)
    async salvarLembrete(lembrete) {
        console.log('💾 Salvando lembrete:', lembrete.mensagem?.substring(0, 50));
        
        // Primeiro salva localmente (rápido)
        const idLocal = this.localStore.salvarLembreteLocal(lembrete);
        
        // Depois tenta sincronizar com Firebase (background)
        if (this.firebaseService && this.firebaseService.inicializado) {
            this.sincronizarComFirebaseEmBackground(idLocal);
        }

        return idLocal;
    }

    // ✅ SINCRONIZAÇÃO EM BACKGROUND
    async sincronizarComFirebaseEmBackground(idLocal) {
        if (this.sincronizando) return;
        
        try {
            this.sincronizando = true;
            const lembreteLocal = this.localStore.data.lembretes[idLocal];
            
            if (!lembreteLocal) {
                console.log('⚠️ Lembrete local não encontrado para sincronização:', idLocal);
                return;
            }

            const idFirebase = await this.firebaseService.salvarLembreteCompartilhado(lembreteLocal);
            
            // Atualizar ID local com ID do Firebase se necessário
            if (idFirebase !== idLocal) {
                this.localStore.data.lembretes[idFirebase] = {
                    ...lembreteLocal,
                    id: idFirebase,
                    sincronizado: true
                };
                delete this.localStore.data.lembretes[idLocal];
                console.log(`🔄 Sincronizado: ${idLocal} → ${idFirebase}`);
            } else {
                this.localStore.data.lembretes[idLocal].sincronizado = true;
                console.log(`✅ Sincronizado com Firebase: ${idLocal}`);
            }
            
            this.localStore.salvarDados();
            
        } catch (erroFirebase) {
            console.log('⚠️ Firebase offline - mantendo apenas local:', erroFirebase.message);
            this.localStore.data.lembretes[idLocal].sincronizado = false;
            this.localStore.salvarDados();
        } finally {
            this.sincronizando = false;
        }
    }

    // ✅ CARREGAR LEMBRETES (SIMPLIFICADO)
    async carregarLembretes() {
        console.log('📥 Carregando lembretes...');
        
        // SEMPRE retorna dados locais primeiro (rápido)
        const dadosLocais = this.localStore.data.lembretes;
        console.log(`📁 ${Object.keys(dadosLocais).length} lembretes locais carregados`);
        
        // Tenta carregar do Firebase em background
        if (this.firebaseService && this.firebaseService.inicializado && !this.sincronizando) {
            this.carregarDoFirebaseEmBackground();
        }
        
        return dadosLocais;
    }

    async carregarDoFirebaseEmBackground() {
        try {
            this.sincronizando = true;
            console.log('🔄 Tentando carregar do Firebase...');
            
            const lembretesFirebase = await this.firebaseService.buscarLembretesCompartilhados();
            
            // Mesclar com dados locais
            let atualizou = false;
            for (const [id, lembrete] of Object.entries(lembretesFirebase)) {
                const local = this.localStore.data.lembretes[id];
                if (!local || new Date(lembrete.atualizadoEm) > new Date(local.atualizadoEm)) {
                    this.localStore.data.lembretes[id] = lembrete;
                    atualizou = true;
                }
            }
            
            if (atualizou) {
                this.localStore.salvarDados();
                console.log('✅ Dados sincronizados do Firebase');
                
                // Notificar frontend
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('dados-atualizados');
                }
            }
            
        } catch (erro) {
            console.log('⚠️ Erro ao carregar do Firebase:', erro.message);
        } finally {
            this.sincronizando = false;
        }
    }

    // ✅ EXCLUIR LEMBRETE
    async excluirLembrete(id) {
        console.log('🗑️ Excluindo lembrete:', id);
        const excluidoLocal = this.localStore.excluirLembreteLocal(id);
        
        // Tenta excluir do Firebase
        if (excluidoLocal && this.firebaseService && this.firebaseService.inicializado && !id.startsWith('local_')) {
            try {
                await this.firebaseService.excluirLembreteCompartilhado(id);
                console.log(`✅ Excluído do Firebase: ${id}`);
            } catch (erroFirebase) {
                console.log('⚠️ Não foi possível excluir do Firebase:', erroFirebase.message);
            }
        }
        
        return excluidoLocal;
    }

    getStatus() {
        const statusFirebase = this.firebaseService ? this.firebaseService.getStatus() : { inicializado: false, online: false };
        
        return {
            firebase: statusFirebase,
            local: { 
                itens: Object.keys(this.localStore.data.lembretes).length
            },
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
                // Limpar data/hora passada
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
    const novoLembrete = {
        mensagem: lembrete.mensagem || '',
        dataHora: null,
        somHabilitado: true,
        criadoEm: new Date().toISOString(),
        atualizadoEm: new Date().toISOString()
    };
    return await gerenciadorDados.salvarLembrete(novoLembrete);
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

ipcMain.handle('sincronizar-manualmente', async (event) => {
    console.log('🔄 Sincronização manual solicitada');
    await gerenciadorDados.carregarDoFirebaseEmBackground();
    return true;
});

// ✅ ESCUTAR ATUALIZAÇÕES DO FRONTEND
ipcMain.on('dados-atualizados', async (event) => {
    console.log('📥 Frontend solicitou atualização de dados');
    // Forçar recarregamento dos dados no frontend
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('dados-atualizados');
    }
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