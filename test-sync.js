#!/usr/bin/env node
// test-sync.js - script de integração simples para validar observer Firestore
(async () => {
  const svc = require('./firebaseService.js');

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // aguardar inicialização
  const maxWait = 15000; // ms
  const start = Date.now();
  while (!svc.inicializado && (Date.now() - start) < maxWait) {
    console.log('Aguardando inicialização do Firebase...');
    await wait(500);
  }

  if (!svc.inicializado) {
    console.error('Firebase não inicializou em tempo. Abortando.');
    process.exit(1);
  }

  console.log('Firebase iniciado - registrando observer...');

  const received = [];
  const unsub = svc.observarMudancas((payload) => {
    const when = new Date().toISOString();
    console.log('OBSERVER_EVENT @', when, JSON.stringify(payload, null, 2));
    received.push({ when, payload });
  });

  try {
    console.log('\n=== Inserindo documento de teste ===');
    const id = await svc.salvarLembreteCompartilhado({
      mensagem: 'test-sync insert',
      dataHora: null,
      somHabilitado: true,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });
    console.log('Inserted id:', id);

    await wait(2500);

    console.log('\n=== Atualizando documento de teste ===');
    await svc.salvarLembreteCompartilhado({
      id: id,
      mensagem: 'test-sync updated',
      atualizadoEm: new Date().toISOString()
    });

    await wait(2500);

    console.log('\n=== Excluindo documento de teste ===');
    await svc.excluirLembreteCompartilhado(id);

    await wait(2500);

  } catch (e) {
    console.error('Erro durante o teste:', e && e.message ? e.message : e);
  } finally {
    if (typeof unsub === 'function') {
      try { unsub(); } catch (e) { }
    }

    console.log('\n=== Resumo de eventos recebidos ===');
    for (const ev of received) {
      console.log(ev.when, JSON.stringify(ev.payload && ev.payload.mudancas ? ev.payload.mudancas.map(m => ({tipo:m.tipo,id:m.id, mensagem: m.dados && m.dados.mensagem})) : ev.payload));
    }

    console.log('\nFim do teste.');
    process.exit(0);
  }
})();
