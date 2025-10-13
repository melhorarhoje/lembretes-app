// teste-conexao.js - TESTE DE PERMISSÕES E CONEXÃO COM FIREBASE
try {
    // Importações modulares para Firebase v9
    const { initializeApp } = require('firebase/app');
    const { getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc, doc } = require('firebase/firestore');
    const { getAuth, signInAnonymously } = require('firebase/auth');

    console.log('🧪 INICIANDO TESTE DE CONEXÃO E PERMISSÕES FIREBASE...');

    const configFirebase = {
        apiKey: "AIzaSyARMkDUSjzQukAZ--rqCBwHb2Ma81494zQ",
        authDomain: "compi-reminder.firebaseapp.com",
        projectId: "compi-reminder",
        storageBucket: "compi-reminder.firebasestorage.app",
        messagingSenderId: "513840064003",
        appId: "1:513840064003:web:641ce56ee2eb4858625036"
    };

    async function testarConexaoEPermissoes() {
        try {
            // 1. Inicializar Firebase
            const app = initializeApp(configFirebase);
            console.log('✅ Firebase inicializado com sucesso');

            // 2. Autenticar anonimamente
            const auth = getAuth(app);
            const userCredential = await signInAnonymously(auth);
            console.log('✅ Autenticado anonimamente com sucesso. UID:', userCredential.user.uid);

            // 3. Inicializar Firestore
            const db = getFirestore(app);
            console.log('✅ Firestore inicializado');

            // 4. Teste de leitura na coleção
            console.log('🔍 Testando leitura na coleção "lembretesCompartilhados"...');
            const snapshotLeitura = await getDocs(collection(db, 'lembretesCompartilhados'));
            console.log(`✅ Leitura bem-sucedida! Documentos encontrados: ${snapshotLeitura.size}`);

            // 5. Teste de escrita (criar um documento de teste)
            console.log('✍️ Testando escrita na coleção "lembretesCompartilhados"...');
            const dadosTeste = {
                mensagem: 'Lembrete de teste para verificação de permissões',
                dataHora: new Date().toISOString(),
                somHabilitado: true,
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };

            const docRef = await addDoc(collection(db, 'lembretesCompartilhados'), dadosTeste);
            console.log(`✅ Escrita bem-sucedida! Documento criado com ID: ${docRef.id}`);

            // 6. Teste de atualização
            console.log('🔄 Testando atualização do documento...');
            await updateDoc(doc(db, 'lembretesCompartilhados', docRef.id), {
                mensagem: 'Lembrete de teste atualizado',
                atualizadoEm: new Date().toISOString()
            });
            console.log('✅ Atualização bem-sucedida!');

            // 7. Teste de leitura do documento atualizado
            console.log('🔍 Verificando documento atualizado...');
            const docAtualizado = await getDocs(collection(db, 'lembretesCompartilhados')).then(snapshot => 
                snapshot.docs.find(d => d.id === docRef.id)
            );
            if (docAtualizado && docAtualizado.exists()) {
                console.log(`✅ Leitura do documento atualizado bem-sucedida! Mensagem: ${docAtualizado.data().mensagem}`);
            } else {
                console.error('❌ Documento atualizado não encontrado!');
                process.exit(1);
            }

            // 8. Teste de exclusão
            console.log('🗑️ Testando exclusão do documento...');
            await deleteDoc(doc(db, 'lembretesCompartilhados', docRef.id));
            console.log('✅ Exclusão bem-sucedida!');

            // 9. Verificação final
            console.log('🎉 TODOS OS TESTES DE CONEXÃO E PERMISSÕES CONCLUÍDOS COM SUCESSO!');
            process.exit(0);

        } catch (erro) {
            console.error('❌ ERRO DURANTE OS TESTES:', erro.message);
            if (erro.code === 'permission-denied') {
                console.error('🚫 Permissões insuficientes! Verifique as regras de segurança do Firestore.');
                console.error('💡 Certifique-se de que a coleção "lembretesCompartilhados" está coberta pelas regras e que a autenticação anônima está habilitada.');
            } else if (erro.code === 'unavailable' || erro.code === 'deadline-exceeded') {
                console.error('🌐 Problema de conectividade! Verifique a política de rede do ambiente de trabalho.');
            } else if (erro.code === 'auth/operation-not-allowed') {
                console.error('🚫 Autenticação anônima não habilitada! Habilite-a no console do Firebase (Authentication > Sign-in method).');
            }
            console.error('🔍 Detalhes do erro:', erro);
            process.exit(1);
        }
    }

    testarConexaoEPermissoes();
} catch (erro) {
    console.error('❌ ERRO NA INICIALIZAÇÃO DO MÓDULO FIREBASE:', erro.message);
    console.error('🔍 Detalhes do erro:', erro);
    console.error('💡 Verifique se o módulo "firebase" está instalado corretamente (npm install firebase@9.23.0).');
    process.exit(1);
}