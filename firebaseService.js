// firebaseService.js - CORRIGIDO PARA ELECTRON
// firebaseService.js
// Usar o build compat facilita o uso em CommonJS/Electron
const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');

class FirebaseService {
    constructor() {
        this.inicializado = false;
        this.bancoDados = null;
        this.unsubscribe = null; // função para parar o snapshot
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
                console.log('✅ Firebase inicializado com sucesso');
            } else {
                firebase.app();
                console.log('✅ Firebase já estava inicializado');
            }

            this.bancoDados = firebase.firestore();
            this.inicializado = true;

            // Ajuste de cache (opcional)
            try {
                this.bancoDados.settings({ cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED });
            } catch (e) {
                // Algumas versões não aceitam chamada repetida; ignorar falhas aqui
            }

            // Verificar conexão de forma assíncrona
            this.verificarConexao();

        } catch (erro) {
            console.error('❌ Erro ao inicializar Firebase:', erro);
            this.inicializado = false;
        }
    }

    async verificarConexao() {
        if (!this.inicializado) return false;

        try {
            await this.bancoDados.collection('lembretesCompartilhados').limit(1).get();
            console.log('✅ Conexão com Firebase estabelecida');
            return true;
        } catch (erro) {
            console.error('❌ Sem conexão com Firebase:', erro && erro.message ? erro.message : erro);
            this.inicializado = false;
            return false;
        }
    }

    // Observa mudanças e chama callback com { mudancas, resumo, metadata }
    observarMudancas(callback) {
        if (!this.inicializado) {
            console.log('⚠️ Firebase não inicializado - ignorando observador');
            return null;
        }

        try {
            const query = this.bancoDados.collection('lembretesCompartilhados').orderBy('atualizadoEm', 'desc');

            // Se já temos um unsubscribe ativo, reutilizamos
            if (this.unsubscribe) {
                console.log('⚠️ Observador já ativo - reutilizando');
                return this.unsubscribe;
            }

            this.unsubscribe = query.onSnapshot((snapshot) => {
                const mudancas = [];
                snapshot.docChanges().forEach((mudanca) => {
                    const dados = mudanca.type === 'removed' ? null : this.converterDoFirebase(mudanca.doc);
                    mudancas.push({
                        tipo: mudanca.type,
                        id: mudanca.doc.id,
                        dados: dados,
                        metadata: { fromCache: snapshot.metadata ? snapshot.metadata.fromCache : false }
                    });
                });

                const resumo = {};
                snapshot.forEach(doc => {
                    resumo[doc.id] = this.converterDoFirebase(doc);
                });

                callback({ mudancas, resumo, metadata: snapshot.metadata });
            }, (erro) => {
                console.error('❌ Erro no observador Firebase:', erro);
                this.inicializado = false;
            });

            console.log('👂 Observador Firebase ativo');
            return this.unsubscribe;
        } catch (erro) {
            console.error('❌ Erro ao criar observador:', erro);
            this.inicializado = false;
            return null;
        }
    }

    pararObservacao() {
        if (this.unsubscribe) {
            try {
                this.unsubscribe();
            } catch (e) {
                // ignore
            }
            this.unsubscribe = null;
            console.log('✅ Observador Firebase parado');
        }
    }

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
                await this.bancoDados.collection('lembretesCompartilhados').doc(lembrete.id).set(dadosFirebase, { merge: true });
                console.log(`✅ Firebase atualizado: ${lembrete.id}`);
            } else {
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

    async buscarLembretesCompartilhados() {
        if (!this.inicializado) {
            throw new Error('Firebase não inicializado');
        }

        try {
            const snapshot = await this.bancoDados.collection('lembretesCompartilhados').orderBy('atualizadoEm', 'desc').get();
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

    async excluirLembreteCompartilhado(id) {
        if (!this.inicializado) {
            throw new Error('Firebase não inicializado');
        }

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

    getStatus() {
        return {
            inicializado: this.inicializado,
            online: this.inicializado && (typeof navigator !== 'undefined' ? navigator.onLine : true)
        };
    }
}

const firebaseService = new FirebaseService();
module.exports = firebaseService;