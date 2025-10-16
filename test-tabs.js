// test-tabs.js - valida comportamento das abas (COMPI vs Pessoal)
const fs = require('fs');
const path = require('path');
const os = require('os');

(async () => {
  const userDataPath = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  // O SimpleStore usa app.getPath('userData') no Electron; aqui iremos apenas usar o arquivo local do workspace para testar
  const storePath = path.join(process.cwd(), 'dados-lembretes.json');

    if (!fs.existsSync(storePath)) {
    const dadosPadrao = {
      lembretes: {
        // local pendente (não sincronizado) mas NÃO é 'pessoal' (local flag absent)
        'local_pending_1': { id: 'local_pending_1', mensagem: 'Local pendente (não sincronizado)', criadoEm: new Date().toISOString(), sincronizado: false },
        // lembrete pessoal (apenas local, NÃO deve aparecer na aba COMPI)
        'local_pessoal_1': { id: 'local_pessoal_1', mensagem: 'Pessoal 1', criadoEm: new Date().toISOString(), sincronizado: false, local: true },
        'f1': { id: 'f1', mensagem: 'Compartilhado 1', criadoEm: new Date().toISOString(), sincronizado: true },
        'f2': { id: 'f2', mensagem: 'Compartilhado 2', criadoEm: new Date().toISOString(), sincronizado: true }
      },
      configuracoes: { extensaoHabilitada: true, somGlobalHabilitado: true }
    };
    fs.writeFileSync(storePath, JSON.stringify(dadosPadrao, null, 2));
    console.log('Arquivo de store criado em', storePath);
  }

  const raw = fs.readFileSync(storePath, 'utf8');
  const store = JSON.parse(raw);

  // Simula a filtragem presente em popup.js
  function filtrarParaAba(lembretesObj, aba) {
    const entradas = Object.entries(lembretesObj).sort(([,a],[,b]) => new Date(b.criadoEm) - new Date(a.criadoEm));
    if (aba === 'pessoal') {
      // apenas lembretes explicitamente marcados como pessoais
      return entradas.filter(([id, lembrete]) => (lembrete && lembrete.local === true));
    }
    // COMPI: excluir apenas os pessoais
    return entradas.filter(([id, lembrete]) => !(lembrete && lembrete.local === true));
  }

  console.log('\n=== Lista completa (COMPI) ===');
  filtrarParaAba(store.lembretes, 'compi').forEach(([id, l]) => console.log(id, '-', l.mensagem, l.local ? '(local)' : ''));

  console.log('\n=== Lista Pessoal ===');
  filtrarParaAba(store.lembretes, 'pessoal').forEach(([id, l]) => console.log(id, '-', l.mensagem, l.local ? '(local)' : ''));

  // Teste de adição: adicionar um lembrete pessoal e um local pendente
  const novoPessoal = `local_pessoal_${Date.now()}`;
  store.lembretes[novoPessoal] = { id: novoPessoal, mensagem: 'Nova nota pessoal', criadoEm: new Date().toISOString(), sincronizado: false, local: true };

  const novoLocalPend = `local_pending_${Date.now()}`;
  store.lembretes[novoLocalPend] = { id: novoLocalPend, mensagem: 'Novo local pendente', criadoEm: new Date().toISOString(), sincronizado: false };

  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  console.log('\nAdicionados', novoPessoal, 'e', novoLocalPend);

  console.log('\n=== Após adição - COMPI ===');
  filtrarParaAba(store.lembretes, 'compi').forEach(([id, l]) => console.log(id, '-', l.mensagem, l.local ? '(local)' : ''));

  console.log('\n=== Após adição - PESSOAL ===');
  filtrarParaAba(store.lembretes, 'pessoal').forEach(([id, l]) => console.log(id, '-', l.mensagem, l.local ? '(local)' : ''));

  console.log('\nTeste de abas finalizado.');
})();
