// teste-conexao.js - TESTE MANUAL DE CONEXÃO
const firebase = require('firebase/app');
require('firebase/firestore');

console.log('🧪 INICIANDO TESTE DE CONEXÃO FIREBASE...');

const configFirebase = {
    apiKey: "AIzaSyARMkDUSjzQukAZ--rqCBwHb2Ma81494zQ",
    authDomain: "compi-reminder.firebaseapp.com",
    projectId: "compi-reminder",
    storageBucket: "compi-reminder.firebasestorage.app",
    messagingSenderId: "513840064003",
    appId: "1:513840064003:web:641ce56ee2eb4858625036"
};

try {
    firebase.initializeApp(configFirebase);
    const db = firebase.firestore();
    
    console.log('✅ Firebase inicializado');
    
    // TESTE DE LEITURA
    db.collection('lembretesCompartilhados').limit(1).get()
        .then((snapshot) => {
            console.log('✅ CONEXÃO BEM-SUCEDIDA!');
            console.log('📊 Documentos encontrados:', snapshot.size);
            process.exit(0);
        })
        .catch((erro) => {
            console.error('❌ ERRO NA CONEXÃO:', erro.message);
            process.exit(1);
        });
        
} catch (erro) {
    console.error('❌ ERRO NA INICIALIZAÇÃO:', erro.message);
    process.exit(1);
}
