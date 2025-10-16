// firebaseService.js - CORRIGIDO E SIMPLIFICADO
const firebase = require('firebase/app');
require('firebase/firestore');

class FirebaseService {
    constructor() {
        this.inicializado = false;
        this.bancoDados = null;
        this.observador = null;
        this.inicializar();
    }

    inicializar() {
        const configFirebase = {
            apiKey: "AIzaSyARMkDUSjzQukAZ--rqCBwHb2Ma81494zQ",
            authDomain: "compi-reminder.firebaseapp.com",
            projectId: "compi-reminder",
            storageBucket: "compi-reminder.firebasestorage.app",
            messagingSenderId: "513840064003",
            appId: "1:513840064003:web:641ce56ee2eb4858625036"
        };

        try {
            // ✅ VERIFICAR SE JÁ EXISTE APP E EVITAR DUPLICAÇÃO
            if (!firebase.apps.length) {
                firebase.initializeApp(configFirebase);
                console.log('✅ Firebase inicializado com sucesso');
            } else {
                firebase.app(); // Usar app existente
                console.log('✅ Firebase já estava inicializado');
            }
            
            this.bancoDados = firebase.firestore();
            this.inicializado = true;
            
            // ✅ CONFIGURAÇÕES DO FIRESTORE
            this.bancoDados.settings({
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            
            console.log('🔥 Firebase Service pronto');
            
        } catch (erro) {
            console.error('❌ Erro ao inicializar Firebase:', erro);
            this.inicializado = false;
        }
    }

    // ✅ VERIFICAR CONEXÃO COM FIREBASE
    async verificarConexao() {
        if (!this.inicializado) return false;

        try {
            await this.bancoDados.collection('lembretesCompartilhados').limit(1).get();
            console.log('✅ Conexão com Firebase estabelecida');
            return true;
        } catch (erro) {
            console.error('❌ Sem conexão com Firebase:', erro.message);
            this.inicializado = false;
            return false;
        }
    }

    // ✅ OBSERVAR MUDANÇAS EM TEMPO REAL
    observarMudancas(callback) {
        if (!this.inicializado) {
            console.log('⚠️ Firebase não inicializado - ignorando observador');
            return null;
        }

        try {
            console.log('👂 Iniciando observador Firebase...');
            this.observador = this.bancoDados.collection('lembretesCompartilhados')
                .onSnapshot((snapshot) => {
                    const mudancas = [];
                    snapshot.docChanges().forEach((mudanca) => {
                        const dados = mudanca.type === 'removed' ? null : this.converterDoFirebase(mudanca.doc);
                        mudancas.push({
                            tipo: mudanca.type,
                            id: mudanca.doc.id,
                            dados: dados
                        });
                    });
                    
                    if (mudancas.length > 0) {
                        console.log(`🔄 Firebase: ${mudancas.length} mudança(s) detectada(s)`);
                        callback(mudancas);
                    }
                }, (erro) => {
                    console.error('❌ Erro no observador Firebase:', erro);
                    this.inicializado = false;
                });
            
            console.log('✅ Observador Firebase ativo');
            return this.observador;
        } catch (erro) {
            console.error('❌ Erro ao criar observador:', erro);
            this.inicializado = false;
            return null;
        }
    }

    // ✅ PARAR OBSERVAÇÃO
    pararObservacao() {
        if (this.observador) {
            this.observador();
            this.observador = null;
            console.log('✅ Observador Firebase parado');
        }
    }

    // ✅ SALVAR NO FIREBASE
    async salvarLembreteCompartilhado(lembrete) {
        if (!this.inicializado) {
            throw new Error('Firebase não inicializado');
        }

        try {
            const dadosFirebase = {
                mensagem: lembrete.mensagem || '',
                dataHora: lembrete.dataHora || null,
                somHabilitado: lembrete.somHabilitado !== false,
                criadoEm: lembrete.criadoEm || new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };

            let idFinal = lembrete.id;

            // ✅ DETERMINAR SE É ATUALIZAÇÃO OU CRIAÇÃO
            if (lembrete.id && !lembrete.id.startsWith('local_')) {
                // ✅ ID DO FIREBASE - ATUALIZAR
                await this.bancoDados.collection('lembretesCompartilhados')
                    .doc(lembrete.id)
                    .set(dadosFirebase, { merge: true });
                console.log(`✅ Firebase atualizado: ${lembrete.id}`);
            } else {
                // ✅ NOVO LEMBRETE - CRIAR
                const docRef = await this.bancoDados.collection('lembretesCompartilhados').add(dadosFirebase);
                idFinal = docRef.id;
                console.log(`✅ Novo no Firebase: ${idFinal}`);
            }

            return idFinal;
        } catch (erro) {
            console.error('❌ Erro ao salvar no Firebase:', erro);
            throw erro;
        }
    }

    // ✅ BUSCAR TODOS DO FIREBASE
    async buscarLembretesCompartilhados() {
        if (!this.inicializado) {
            throw new Error('Firebase não inicializado');
        }

        try {
            const snapshot = await this.bancoDados
                .collection('lembretesCompartilhados')
                .orderBy('atualizadoEm', 'desc')
                .get();
            
            const lembretes = {};
            snapshot.forEach(doc => {
                lembretes[doc.id] = this.converterDoFirebase(doc);
            });
            
            console.log(`✅ Firebase: ${Object.keys(lembretes).length} lembretes carregados`);
            return lembretes;
        } catch (erro) {
            console.error('❌ Erro ao buscar do Firebase:', erro);
            throw erro;
        }
    }

    // ✅ EXCLUIR DO FIREBASE
    async excluirLembreteCompartilhado(id) {
        if (!this.inicializado) {
            throw new Error('Firebase não inicializado');
        }

        // ✅ SÓ EXCLUIR SE NÃO FOR ID LOCAL
        if (id.startsWith('local_')) {
            console.log(`⚠️ ID local ignorado: ${id}`);
            return;
        }

        try {
            await this.bancoDados.collection('lembretesCompartilhados').doc(id).delete();
            console.log(`✅ Firebase: lembrete ${id} excluído`);
        } catch (erro) {
            console.error('❌ Erro ao excluir do Firebase:', erro);
            throw erro;
        }
    }

    // ✅ CONVERTER DO FIREBASE
    converterDoFirebase(doc) {
        const dados = doc.data();
        return {
            id: doc.id,
            mensagem: dados.mensagem || '',
            dataHora: dados.dataHora || null,
            somHabilitado: dados.somHabilitado !== false,
            criadoEm: dados.criadoEm || new Date().toISOString(),
            atualizadoEm: dados.atualizadoEm || new Date().toISOString(),
            sincronizado: true
        };
    }

    // ✅ VERIFICAR STATUS
    getStatus() {
        return {
            inicializado: this.inicializado,
            online: this.inicializado && navigator.onLine
        };
    }

    // ✅ REINICIALIZAR FIREBASE
    reinicializar() {
        try {
            this.pararObservacao();
            this.inicializado = false;
            this.inicializar();
            console.log('🔄 Firebase reinicializado');
            return true;
        } catch (erro) {
            console.error('❌ Erro ao reinicializar Firebase:', erro);
            return false;
        }
    }
}

// ✅ INSTÂNCIA GLOBAL
const firebaseService = new FirebaseService();
module.exports = firebaseService;