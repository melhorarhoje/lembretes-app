// firebaseService.js - OTIMIZADO PARA SINCRONIZAÇÃO
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
            if (!firebase.apps.length) {
                firebase.initializeApp(configFirebase);
                console.log('✅ Firebase inicializado para sincronização');
            } else {
                firebase.app();
                console.log('✅ Firebase já inicializado');
            }
            
            this.bancoDados = firebase.firestore();
            this.inicializado = true;
            
            // Configurações otimizadas para tempo real
            this.bancoDados.settings({
                cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED
            });
            
        } catch (erro) {
            console.error('❌ Erro ao inicializar Firebase:', erro);
            this.inicializado = false;
        }
    }

    // ✅ OBSERVAR MUDANÇAS - CORRIGIDO E SIMPLIFICADO
    observarMudancas(callback) {
        if (!this.inicializado) {
            console.log('❌ Firebase não inicializado');
            return null;
        }

        try {
            console.log('👂 Configurando observador Firebase...');
            
            this.observador = this.bancoDados.collection('lembretesCompartilhados')
                .onSnapshot((snapshot) => {
                    const mudancas = [];
                    
                    snapshot.docChanges().forEach((mudanca) => {
                        if (mudanca.type === 'added' || mudanca.type === 'modified' || mudanca.type === 'removed') {
                            const dados = mudanca.type === 'removed' ? null : this.converterDoFirebase(mudanca.doc);
                            mudancas.push({
                                tipo: mudanca.type,
                                id: mudanca.doc.id,
                                dados: dados
                            });
                        }
                    });

                    if (mudancas.length > 0) {
                        console.log(`📡 Firebase: ${mudancas.length} mudança(s)`);
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
            return null;
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

            if (lembrete.id && !lembrete.id.startsWith('local_')) {
                // ATUALIZAR EXISTENTE
                await this.bancoDados.collection('lembretesCompartilhados')
                    .doc(lembrete.id)
                    .set(dadosFirebase, { merge: true });
            } else {
                // NOVO LEMBRETE
                const docRef = await this.bancoDados.collection('lembretesCompartilhados').add(dadosFirebase);
                idFinal = docRef.id;
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

        if (id.startsWith('local_')) {
            return;
        }

        try {
            await this.bancoDados.collection('lembretesCompartilhados').doc(id).delete();
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

    // ✅ PARAR OBSERVAÇÃO
    pararObservacao() {
        if (this.observador) {
            this.observador();
            this.observador = null;
        }
    }

    getStatus() {
        return {
            inicializado: this.inicializado,
            online: this.inicializado && navigator.onLine
        };
    }
}

// ✅ INSTÂNCIA GLOBAL
const firebaseService = new FirebaseService();
module.exports = firebaseService;