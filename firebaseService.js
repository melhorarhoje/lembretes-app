// firebaseService.js - COMPARTILHADO ENTRE TODOS OS USUÁRIOS
class FirebaseService {
    constructor() {
        this.inicializado = false;
        this.bancoDados = null;
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
                console.log('Firebase inicializado com sucesso - MODO COMPARTILHADO');
            }
        } catch (erro) {
            console.error('Erro ao inicializar Firebase:', erro);
            this.inicializado = false;
        }
    }

    // Converter lembrete para Firebase (SEM usuário específico)
    converterParaFirebase(lembrete) {
        return {
            mensagem: lembrete.mensagem,
            dataHora: lembrete.dataHora,
            somHabilitado: lembrete.somHabilitado,
            criadoEm: lembrete.criadoEm,
            atualizadoEm: lembrete.atualizadoEm,
            // REMOVIDO: usuarioId - todos compartilham os mesmos dados
            ultimoEditor: this.obterIdentificadorUsuario() // Para rastrear quem editou
        };
    }

    // Converter do Firebase
    converterDoFirebase(doc) {
        const dados = doc.data();
        return {
            id: doc.id,
            mensagem: dados.mensagem,
            dataHora: dados.dataHora,
            somHabilitado: dados.somHabilitado,
            criadoEm: dados.criadoEm,
            atualizadoEm: dados.atualizadoEm,
            ultimoEditor: dados.ultimoEditor,
            sincronizado: true
        };
    }

    obterIdentificadorUsuario() {
        // Identificador simples baseado em máquina/navegador
        return `user_${Math.random().toString(36).substr(2, 9)}`;
    }

    // 🔥 NOVO: Ouvir mudanças em tempo real
    observarMudancas(callback) {
        if (!this.inicializado) return;

        return this.bancoDados.collection('lembretesCompartilhados')
            .onSnapshot((snapshot) => {
                const mudancas = [];
                snapshot.docChanges().forEach((mudanca) => {
                    mudancas.push({
                        tipo: mudanca.type,
                        id: mudanca.doc.id,
                        dados: mudanca.type === 'removed' ? null : this.converterDoFirebase(mudanca.doc)
                    });
                });
                callback(mudancas);
            }, (erro) => {
                console.error('Erro ao observar mudanças:', erro);
            });
    }

    // 🔥 NOVO: Buscar todos os lembretes compartilhados
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
            console.error('Erro ao buscar lembretes compartilhados:', erro);
            throw erro;
        }
    }

    // 🔥 NOVO: Salvar lembrete compartilhado
    async salvarLembreteCompartilhado(lembrete) {
        if (!this.inicializado) {
            throw new Error('Firebase não inicializado');
        }

        try {
            const dadosFirebase = this.converterParaFirebase(lembrete);
            
            if (lembrete.id) {
                // Atualizar existente
                await this.bancoDados.collection('lembretesCompartilhados')
                    .doc(lembrete.id)
                    .set(dadosFirebase, { merge: true });
                return lembrete.id;
            } else {
                // Criar novo
                const docRef = await this.bancoDados.collection('lembretesCompartilhados').add(dadosFirebase);
                return docRef.id;
            }
        } catch (erro) {
            console.error('Erro ao salvar lembrete compartilhado:', erro);
            throw erro;
        }
    }

    // 🔥 NOVO: Excluir lembrete compartilhado
    async excluirLembreteCompartilhado(id) {
        if (!this.inicializado) {
            throw new Error('Firebase não inicializado');
        }

        try {
            await this.bancoDados.collection('lembretesCompartilhados').doc(id).delete();
        } catch (erro) {
            console.error('Erro ao excluir lembrete compartilhado:', erro);
            throw erro;
        }
    }
}

const firebaseService = new FirebaseService();