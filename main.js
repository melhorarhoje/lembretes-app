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

// ✅ GERENCIADOR HÍBRIDO DE DADOS - FOCADO EM SINCRONIZAÇÃO
class GerenciadorDados {
    constructor() {
        this.localStore = new SimpleStore();
        this.firebaseService = null;
        this.sincronizando = false;
        this.ultimaSincronizacao = null;
        this.inicializarFirebase();
    }

    inicializarFirebase() {
        try {
            console.log('🔥 Inicializando Firebase para sincronização...');
            this.firebaseService = require('./firebaseService.js');
            
            // Aguardar um pouco para inicialização completa
            setTimeout(() => {
                if (this.firebaseService && this.firebaseService.inicializado) {
                    console.log('✅ Firebase inicializado - iniciando sincronização');
                    this.iniciarSincronizacaoTempoReal();
                    this.sincronizarDadosIniciais();
                } else {
                    console.log('⚠️ Firebase offline - modo local apenas');
                }
            }, 3000);
            
        } catch (erro) {
            console.log('❌ Firebase não disponível:', erro.message);
            this.firebaseService = { 
                inicializado: false,
                getStatus: () => ({ inicializado: false, online: false })
            };
        }
    }

    // ✅ SINCRONIZAÇÃO EM TEMPO REAL - CORRIGIDA
    iniciarSincronizacaoTempoReal() {
        if (!this.firebaseService || !this.firebaseService.inicializado) {
            console.log('❌ Firebase não disponível para sincronização');
            return;
        }

        try {
            console.log('🔄 Iniciando sincronização em tempo real...');
            
            this.firebaseService.observarMudancas((mudancas) => {
                console.log(`📥 ${mudancas.length} mudança(s) recebida(s) em tempo real`);
                this.processarMudancasRemotas(mudancas);
            });
            
            console.log('✅ Sincronização em tempo real ativa');
            
        } catch (erro) {
            console.error('❌ Erro na sincronização tempo real:', erro);
        }
    }

    // ✅ SINCRONIZAR DADOS INICIAIS AO ABRIR APP
    async sincronizarDadosIniciais() {
        if (!this.firebaseService || !this.firebaseService.inicializado || this.sincronizando) {
            return;
        }

        try {
            this.sincronizando = true;
            console.log('🔄 Sincronizando dados iniciais...');
            
            const lembretesRemotos = await this.firebaseService.buscarLembretesCompartilhados();
            let atualizou = false;

            // MESCLAGEM INTELIGENTE: Manter o mais recente
            for (const [id, lembreteRemoto] of Object.entries(lembretesRemotos)) {
                const lembreteLocal = this.localStore.data.lembretes[id];
                
                if (!lembreteLocal) {
                    // Novo lembrete remoto - adicionar localmente
                    this.localStore.data.lembretes[id] = lembreteRemoto;
                    atualizou = true;
                    console.log(`✅ Adicionado localmente: ${id}`);
                } else {
                    // Conflito: verificar qual é mais recente
                    const tempoLocal = new Date(lembreteLocal.atualizadoEm || 0).getTime();
                    const tempoRemoto = new Date(lembreteRemoto.atualizadoEm || 0).getTime();
                    
                    if (tempoRemoto > tempoLocal) {
                        // Remoto é mais recente - atualizar local
                        this.localStore.data.lembretes[id] = lembreteRemoto;
                        atualizou = true;
                        console.log(`✅ Atualizado localmente: ${id}`);
                    }
                }
            }

            if (atualizou) {
                this.localStore.salvarDados();
                this.notificarFrontend();
                console.log('✅ Sincronização inicial completa');
            }
            
        } catch (erro) {
            console.log('⚠️ Erro na sincronização inicial:', erro.message);
        } finally {
            this.sincronizando = false;
        }
    }

    // ✅ PROCESSAR MUDANÇAS RECEBIDAS DO FIREBASE
    processarMudancasRemotas(mudancas) {
        if (this.sincronizando || mudancas.length === 0) return;

        let atualizou = false;
        console.log(`🔄 Processando ${mudancas.length} mudança(s) remota(s)`);
        
        for (const mudanca of mudancas) {
            try {
                switch (mudanca.tipo) {
                    case 'added':
                    case 'modified':
                        if (mudanca.dados) {
                            const id = mudanca.id;
                            const lembreteLocal = this.localStore.data.lembretes[id];
                            
                            // SÓ ATUALIZAR SE O REMOTO FOR MAIS RECENTE
                            if (!lembreteLocal || this.remotoEhMaisRecente(lembreteLocal, mudanca.dados)) {
                                this.localStore.data.lembretes[id] = mudanca.dados;
                                atualizou = true;
                                console.log(`✅ ${mudanca.tipo === 'added' ? 'Adicionado' : 'Atualizado'} remotamente: ${id}`);
                            }
                        }
                        break;
                        
                    case 'removed':
                        if (this.localStore.data.lembretes[mudanca.id]) {
                            delete this.localStore.data.lembretes[mudanca.id];
                            atualizou = true;
                            console.log(`🗑️ Removido remotamente: ${mudanca.id}`);
                        }
                        break;
                }
            } catch (erro) {
                console.error(`❌ Erro processando mudança ${mudanca.id}:`, erro);
            }
        }
        
        if (atualizou) {
            this.localStore.salvarDados();
            this.notificarFrontend();
            console.log('✅ Mudanças remotas aplicadas localmente');
        }
    }

    // ✅ VERIFICAR SE DADO REMOTO É MAIS RECENTE
    remotoEhMaisRecente(local, remoto) {
        try {
            const tempoLocal = new Date(local.atualizadoEm || local.criadoEm || 0).getTime();
            const tempoRemoto = new Date(remoto.atualizadoEm || remoto.criadoEm || 0).getTime();
            return tempoRemoto > tempoLocal;
        } catch (erro) {
            console.error('❌ Erro comparando timestamps:', erro);
            return false;
        }
    }

    // ✅ SALVAR LEMBRETE (LOCAL + SINCRONIZAR)
    async salvarLembrete(lembrete) {
        console.log('💾 Salvando lembrete:', lembrete.mensagem?.substring(0, 30));
        
        // 1. SALVAR LOCALMENTE (INSTANTÂNEO)
        const idLocal = this.localStore.salvarLembreteLocal(lembrete);
        
        // 2. SINCRONIZAR COM FIREBASE (BACKGROUND)
        if (this.firebaseService && this.firebaseService.inicializado) {
            this.sincronizarLembreteComFirebase(idLocal);
        }

        return idLocal;
    }

    // ✅ SINCRONIZAR LEMBRETE INDIVIDUAL
    async sincronizarLembreteComFirebase(idLocal) {
        if (this.sincronizando) return;
        
        try {
            this.sincronizando = true;
            const lembreteLocal = this.localStore.data.lembretes[idLocal];
            
            if (!lembreteLocal) {
                console.log('⚠️ Lembrete local não encontrado para sincronização');
                return;
            }

            const idFirebase = await this.firebaseService.salvarLembreteCompartilhado(lembreteLocal);
            
            // Atualizar ID se necessário (de local para Firebase)
            if (idFirebase !== idLocal) {
                this.localStore.data.lembretes[idFirebase] = {
                    ...lembreteLocal,
                    id: idFirebase,
                    sincronizado: true
                };
                delete this.localStore.data.lembretes[idLocal];
                console.log(`🔄 ID atualizado: ${idLocal} → ${idFirebase}`);
            } else {
                this.localStore.data.lembretes[idLocal].sincronizado = true;
            }
            
            this.localStore.salvarDados();
            console.log(`✅ Lembrete sincronizado: ${idFirebase}`);
            
        } catch (erroFirebase) {
            console.log('⚠️ Firebase offline - mantendo local:', erroFirebase.message);
            this.localStore.data.lembretes[idLocal].sincronizado = false;
            this.localStore.salvarDados();
        } finally {
            this.sincronizando = false;
        }
    }

    // ✅ CARREGAR LEMBRETES (SEM ALTERAÇÕES)
    async carregarLembretes() {
        console.log('📥 Carregando lembretes locais...');
        return this.localStore.data.lembretes;
    }

    // ✅ EXCLUIR LEMBRETE (LOCAL + REMOTO)
    async excluirLembrete(id) {
        console.log('🗑️ Excluindo lembrete:', id);
        const excluidoLocal = this.localStore.excluirLembreteLocal(id);
        
        // Tentar excluir do Firebase também
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

    // ✅ NOTIFICAR FRONTEND SOBRE ATUALIZAÇÕES
    notificarFrontend() {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('dados-atualizados');
            console.log('📢 Frontend notificado sobre atualizações');
        }
    }

    // ✅ SINCRONIZAÇÃO MANUAL
    async sincronizarManualmente() {
        if (!this.firebaseService || !this.firebaseService.inicializado) {
            console.log('❌ Firebase não disponível para sincronização manual');
            return false;
        }

        try {
            console.log('🔄 Sincronização manual iniciada...');
            await this.sincronizarDadosIniciais();
            console.log('✅ Sincronização manual concluída');
            return true;
        } catch (erro) {
            console.error('❌ Erro na sincronização manual:', erro);
            return false;
        }
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
