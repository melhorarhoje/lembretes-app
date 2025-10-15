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

// ✅ GERENCIADOR HÍBRIDO DE DADOS - CORRIGIDO PARA SINCRONIZAÇÃO EM TEMPO REAL
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
            // ✅ CARREGAR FIREBASE COM TRY/CATCH ROBUSTO
            this.firebaseService = require('./firebaseService.js');
            console.log('🔥 FirebaseService carregado, status:', this.firebaseService.inicializado);
            
            // ✅ INICIAR OBSERVAÇÃO IMEDIATAMENTE SE JÁ ESTIVER INICIALIZADO
            if (this.firebaseService.inicializado) {
                this.iniciarObservacaoTempoReal();
            } else {
                // ✅ TENTAR NOVAMENTE APÓS UM TEMPO SE NÃO ESTIVER INICIALIZADO
                setTimeout(() => {
                    if (this.firebaseService.inicializado) {
                        this.iniciarObservacaoTempoReal();
                    } else {
                        console.log('⚠️ Firebase não inicializado após timeout - modo local apenas');
                        // ✅ TENTAR RECONECTAR PERIODICAMENTE
                        this.tentarReconexaoPeriodica();
                    }
                }, 2000);
            }
            
        } catch (erro) {
            console.log('❌ Erro ao carregar FirebaseService:', erro.message);
            this.firebaseService = { 
                inicializado: false,
                getStatus: () => ({ inicializado: false, online: false })
            };
        }
    }

    // ✅ TENTAR RECONEXÃO PERIÓDICA SE FIREBASE NÃO INICIALIZAR
    tentarReconexaoPeriodica() {
        const intervalo = setInterval(() => {
            if (this.firebaseService && this.firebaseService.inicializado) {
                console.log('✅ Firebase conectado - iniciando observação');
                this.iniciarObservacaoTempoReal();
                clearInterval(intervalo);
            } else if (this.firebaseService) {
                console.log('🔄 Tentando reconectar Firebase...');
                // ✅ FORÇAR NOVA TENTATIVA DE INICIALIZAÇÃO
                try {
                    this.firebaseService.inicializar();
                } catch (erro) {
                    console.log('❌ Falha na reconexão:', erro.message);
                }
            }
        }, 10000); // Tentar a cada 10 segundos
    }

    iniciarObservacaoTempoReal() {
        if (!this.firebaseService || !this.firebaseService.inicializado) {
            console.log('⚠️ Firebase offline - sem observação em tempo real');
            return;
        }

        try {
            // ✅ PARAR OBSERVAÇÃO ANTERIOR SE EXISTIR
            if (this.observadorAtivo) {
                this.firebaseService.pararObservacao();
            }

            this.firebaseService.observarMudancas((mudancas) => {
                this.processarMudancasFirebase(mudancas);
            });
            this.observadorAtivo = true;
            console.log('👂 Observando mudanças Firebase em tempo real');
            
        } catch (erro) {
            console.error('❌ Erro ao iniciar observação:', erro);
            this.observadorAtivo = false;
        }
    }

    processarMudancasFirebase(mudancas) {
        if (this.sincronizando || mudancas.length === 0) return;

        console.log(`🔄 Processando ${mudancas.length} mudanças do Firebase`);
        let atualizou = false;
        
        for (const mudanca of mudancas) {
            // ✅ IGNORAR MUDANÇAS QUE FORAM FEITAS POR ESTE CLIENTE
            const lembreteAtual = this.localStore.data.lembretes[mudanca.id];
            if (lembreteAtual && lembreteAtual.atualizadoEm) {
                const tempoAtualizacaoLocal = new Date(lembreteAtual.atualizadoEm).getTime();
                const tempoAtualizacaoRemoto = mudanca.dados ? new Date(mudanca.dados.atualizadoEm).getTime() : 0;
                
                // Se a atualização local é mais recente, ignorar a mudança remota
                if (tempoAtualizacaoLocal > tempoAtualizacaoRemoto) {
                    console.log(`⏩ Ignorando mudança remota (local mais recente): ${mudanca.id}`);
                    continue;
                }
            }
            
            switch (mudanca.tipo) {
                case 'added':
                case 'modified':
                    if (mudanca.dados) {
                        this.localStore.data.lembretes[mudanca.id] = mudanca.dados;
                        atualizou = true;
                        console.log(`✅ ${mudanca.tipo === 'added' ? 'Adicionado' : 'Atualizado'} do Firebase: ${mudanca.dados.mensagem.substring(0, 30)}...`);
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
            
            // ✅ NOTIFICAR FRONTEND PARA ATUALIZAR
            if (mainWindow) {
                mainWindow.webContents.send('dados-atualizados');
            }
        }
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

// ✅ SINCRONIZAÇÃO MANUAL
ipcMain.handle('sincronizar-manualmente', async () => {
    console.log('🔄 Sincronização manual solicitada');
    await gerenciadorDados.carregarLembretes();
    return true;
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

// ✅ VERIFICAR CONECTIVIDADE PERIODICAMENTE
function iniciarVerificacaoConectividade() {
    setInterval(() => {
        const status = gerenciadorDados.getStatus();
        if (!status.firebase.inicializado && gerenciadorDados.firebaseService) {
            console.log('🔄 Verificação periódica: Firebase offline, tentando reconectar...');
            gerenciadorDados.firebaseService.reinicializar();
        }
    }, 30000); // Verificar a cada 30 segundos
}

// Chamar após criar a janela principal
app.whenReady().then(() => {
    createMainWindow();
    reagendarAlarmesAoIniciar();
    iniciarVerificacaoConectividade(); // ← Adicionar esta linha
});