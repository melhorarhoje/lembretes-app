// firebaseService.js - CORRIGIDO PARA orderBy E getStatus
const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, collection, query, orderBy, onSnapshot, addDoc, setDoc, doc, getDocs, deleteDoc } = require('firebase/firestore');
const { getAuth, signInAnonymously } = require('firebase/auth');

class FirebaseService {
    constructor() {
        this.inicializado = false;
        this.bancoDados = null;
        this.observador = null;
        this.inicializar();
    }

    async inicializar() {
        const configFirebase = {
            apiKey: "AIzaSyARMkDUSjzQukAZ--rqCBwHb2Ma81494zQ",
            authDomain: "compi-reminder.firebaseapp.com",
            projectId: "compi-reminder",
            storageBucket: "compi-reminder.firebasestorage.app",
            messagingSenderId: "513840064003",
            appId: "1:513840064003:web:641ce56ee2eb4858625036"
        };

        try {
            // Verificar se já existe app e evitar duplicação
            if (!getApps().length) {
                const app = initializeApp(configFirebase);
                const auth = getAuth(app);
                await signInAnonymously(auth);
                console.log('✅ Autenticado anonimamente');
                this.bancoDados = getFirestore(app);
                this.inicializado = true;
                console.log('✅ Firebase inicializado com sucesso');
            } else {
                this.bancoDados = getFirestore();
                this.inicializado = true;
                console.log('✅ Firebase já estava inicializado');
            }

            // Verificar conexão
            await this.verificarConexao();

        } catch (erro) {
            console.error('❌ Erro ao inicializar Firebase:', erro);
            this.inicializado = false;
        }
    }

    async verificarConexao() {
        if (!this.inicializado) return false;

        try {
            await getDocs(collection(this.bancoDados, 'lembretesCompartilhados'));
            console.log('✅ Conexão com Firebase estabelecida');
            return true;
        } catch (erro) {
            console.error('❌ Sem conexão com Firebase:', erro.message);
            this.inicializado = false;
            return false;
        }
    }

    observarMudancas(callback) {
        if (!this.inicializado) {
            console.log('⚠️ Firebase não inicializado - ignorando observador');
            return null;
        }

        try {
            const q = query(collection(this.bancoDados, 'lembretesCompartilhados'), orderBy('atualizadoEm', 'desc'));
            this.observador = onSnapshot(
                q,
                (snapshot) => {
                    const mudancas = [];
                    snapshot.docChanges().forEach((mudanca) => {
                        const dados = mudanca.type === 'removed' ? null : this.converterDoFirebase(mudanca.doc);
                        mudancas.push({
                            tipo: mudanca.type,
                            id: mudanca.doc.id,
                            dados: dados
                        });
                    });

                    console.log(`🔄 Firebase: ${mudancas.length} mudança(s) recebida(s)`);
                    callback(mudancas);
                },
                (erro) => {
                    console.error('❌ Erro no observador Firebase:', erro);
                    this.inicializado = false;
                }
            );

            console.log('👂 Observador Firebase ativo');
            return this.observador;
        } catch (erro) {
            console.error('❌ Erro ao criar observador:', erro);
            this.inicializado = false;
            return null;
        }
    }

    pararObservacao() {
        if (this.observador) {
            this.observador();
            this.observador = null;
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
                await setDoc(doc(this.bancoDados, 'lembretesCompartilhados', lembrete.id), dadosFirebase, { merge: true });
                console.log(`✅ Firebase atualizado: ${lembrete.id}`);
            } else {
                const docRef = await addDoc(collection(this.bancoDados, 'lembretesCompartilhados'), dadosFirebase);
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
            const q = query(collection(this.bancoDados, 'lembretesCompartilhados'), orderBy('atualizadoEm', 'desc'));
            const snapshot = await getDocs(q);
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
            await deleteDoc(doc(this.bancoDados, 'lembretesCompartilhados', id));
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
            online: this.inicializado // Removido navigator.onLine, pois não está disponível no main process
        };
    }
}

const firebaseService = new FirebaseService();
module.exports = firebaseService;