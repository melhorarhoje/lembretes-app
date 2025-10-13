// firebaseService.js - SERVIÇO FIREBASE COMPLETO PARA ELECTRON
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
            if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
                firebase.initializeApp(configFirebase);
                this.bancoDados = firebase.firestore();
                this.inicializado = true;
                console.log('✅ Firebase inicializado com sucesso');
            } else if (firebase.apps.length > 0) {
                this.bancoDados = firebase.firestore();
                this.inicializado = true;
                console.log('✅ Firebase já estava inicializado');
            }
        } catch (erro) {
            console.error('❌ Erro ao inicializar Firebase:', erro);
            this.inicializado = false;
        }
    }

    // ✅ OBSERVAR MUDANÇAS EM TEMPO REAL
    observarMudancas(callback) {
        if (!this.inicializado) {
            console.log('⚠️ Firebase não inicializado - ignorando observador');
            return null;
        }

        try {
            this.observador = this.bancoDados.collection('lembretesCompartilhados')
                .orderBy('atualizadoEm', 'desc')
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
                    
                    console.log(`🔄 Mudanças recebidas: ${mudancas.length} itens`);
                    callback(mudancas);
                }, (erro) => {
                    console.error('❌ Erro ao observar mudanças Firebase:', erro);
                });
            
            return this.observador;
        } catch (erro) {
            console.error('❌ Erro ao criar observador Firebase:', erro);
            return null;
        }
    }

    // ✅ PARAR DE OBSERVAR MUDANÇAS
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
                mensagem: lembrete.mensagem,
                dataHora: lembrete.dataHora,
                somHabilitado: lembrete.somHabilitado !== false,
                criadoEm: lembrete.criadoEm || new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };

            let idFinal = lembrete.id;

            if (lembrete.id && lembrete.id.startsWith('local_')) {
                // ✅ ID local - criar novo no Firebase
                const docRef = await this.bancoDados.collection('lembretesCompartilhados').add(dadosFirebase);
                idFinal = docRef.id;
                console.log(`✅ Local → Firebase: ${lembrete.id} → ${idFinal}`);
            } else if (lembrete.id) {
                // ✅ ID do Firebase - atualizar existente
                await this.bancoDados.collection('lembretesCompartilhados')
                    .doc(lembrete.id)
                    .set(dadosFirebase, { merge: true });
                idFinal = lembrete.id;
                console.log(`✅ Firebase atualizado: ${lembrete.id}`);
            } else {
                // ✅ Novo lembrete - criar no Firebase
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

    // ✅ VERIFICAR STATUS DA CONEXÃO
    getStatus() {
        return {
            inicializado: this.inicializado,
            online: this.inicializado && navigator.onLine
        };
    }
}

// ✅ INSTÂNCIA GLOBAL
const firebaseService = new FirebaseService();