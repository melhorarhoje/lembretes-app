// popup.js - CORRIGIDO E SIMPLIFICADO
const { ipcRenderer } = require('electron');

let lembretes = {};
let editandoId = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Iniciando aplicação...');
    await inicializarAplicacao();
});

async function inicializarAplicacao() {
    try {
        // Carregar configurações
        const configuracoes = await ipcRenderer.invoke('carregar-configuracoes');
        atualizarIconesCabecalho(configuracoes);
        
        // Carregar lembretes
        await carregarLembretes();
        
        // Configurar event listeners
        configurarEventListeners();
        
        console.log('✅ Aplicação inicializada com sucesso');
        
    } catch (erro) {
        console.error('❌ Erro ao inicializar aplicação:', erro);
        mostrarToast('Erro ao carregar aplicação', 'erro');
    }
}

async function carregarLembretes() {
    try {
        console.log('📥 Carregando lembretes...');
        lembretes = await ipcRenderer.invoke('carregar-lembretes');
        console.log(`✅ ${Object.keys(lembretes).length} lembretes carregados`);
        renderizarLembretes();
        atualizarStatusSincronizacao();
        
    } catch (erro) {
        console.error('❌ Erro ao carregar lembretes:', erro);
        mostrarToast('Erro ao carregar lembretes', 'erro');
    }
}

function renderizarLembretes() {
    const lista = document.getElementById('lista-lembretes');
    if (!lista) {
        console.error('❌ Elemento lista-lembretes não encontrado');
        return;
    }

    lista.innerHTML = '';

    const lembretesArray = Object.values(lembretes);
    
    if (lembretesArray.length === 0) {
        lista.innerHTML = '<li class="sem-lembretes">Nenhum lembrete cadastrado</li>';
        return;
    }

    // Ordenar por data de atualização (mais recentes primeiro)
    lembretesArray.sort((a, b) => new Date(b.atualizadoEm) - new Date(a.atualizadoEm));

    lembretesArray.forEach(lembrete => {
        const item = criarElementoLembrete(lembrete);
        lista.appendChild(item);
    });
}

function criarElementoLembrete(lembrete) {
    const li = document.createElement('li');
    li.className = 'item-lembrete';
    if (lembrete.dataHora) {
        li.classList.add('com-alarme');
    }

    const agora = new Date();
    const dataHora = lembrete.dataHora ? new Date(lembrete.dataHora) : null;
    const alarmePassado = dataHora && dataHora < agora;

    li.innerHTML = `
        <div class="conteudo-lembrete">
            <div class="texto-lembrete">${escapeHtml(lembrete.mensagem)}</div>
            <div class="controles-lembrete">
                <button class="btn-editar" data-id="${lembrete.id}" title="Editar">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-alarme ${lembrete.dataHora ? 'ativo' : ''}" data-id="${lembrete.id}" title="${lembrete.dataHora ? 'Alterar Alarme' : 'Configurar Alarme'}">
                    <i class="fas ${lembrete.dataHora ? 'fa-bell' : 'fa-bell-slash'}"></i>
                </button>
                <button class="btn-som ${lembrete.somHabilitado ? 'ativo' : ''}" data-id="${lembrete.id}" title="${lembrete.somHabilitado ? 'Desativar Som' : 'Ativar Som'}">
                    <i class="fas ${lembrete.somHabilitado ? 'fa-volume-up' : 'fa-volume-mute'}"></i>
                </button>
                <button class="btn-excluir" data-id="${lembrete.id}" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        ${lembrete.dataHora ? `
            <div class="info-alarme ${alarmePassado ? 'passado' : ''}">
                <i class="fas fa-clock"></i>
                ${formatarDataHora(lembrete.dataHora)}
                ${alarmePassado ? ' (Passado)' : ''}
            </div>
        ` : ''}
        ${lembrete.sincronizado ? '<div class="status-sincronizado"><i class="fas fa-cloud"></i></div>' : ''}
    `;

    return li;
}

function configurarEventListeners() {
    // Botão adicionar lembrete
    const btnAdicionar = document.getElementById('adicionar-lembrete');
    const entradaLembrete = document.getElementById('entrada-lembrete');

    btnAdicionar.addEventListener('click', adicionarLembrete);
    entradaLembrete.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            adicionarLembrete();
        }
    });

    // Botões do cabeçalho
    document.getElementById('alternar-extensao').addEventListener('click', alternarExtensao);
    document.getElementById('alternar-som-global').addEventListener('click', alternarSomGlobal);

    // Modal de data/hora
    const modal = document.getElementById('modal-datahora');
    const fecharModal = document.querySelector('.fechar-modal');
    const btnSalvarAlarme = document.getElementById('btn-salvar-alarme');
    const btnRemoverAlarme = document.getElementById('btn-remover-alarme');

    fecharModal.addEventListener('click', () => modal.style.display = 'none');
    btnSalvarAlarme.addEventListener('click', salvarAlarme);
    btnRemoverAlarme.addEventListener('click', removerAlarme);

    // Fechar modal clicando fora
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Event delegation para botões dinâmicos
    document.getElementById('lista-lembretes').addEventListener('click', (e) => {
        const id = e.target.closest('button')?.dataset.id;
        if (!id) return;

        if (e.target.closest('.btn-editar')) {
            editarLembrete(id);
        } else if (e.target.closest('.btn-alarme')) {
            configurarAlarme(id);
        } else if (e.target.closest('.btn-som')) {
            alternarSomLembrete(id);
        } else if (e.target.closest('.btn-excluir')) {
            excluirLembrete(id);
        }
    });

    // Escutar atualizações do backend
    ipcRenderer.on('dados-atualizados', async () => {
        console.log('📥 Recebida atualização de dados');
        await carregarLembretes();
        mostrarToast('Dados atualizados!', 'info');
    });
}

async function adicionarLembrete() {
    const entrada = document.getElementById('entrada-lembrete');
    const texto = entrada.value.trim();

    if (!texto) {
        mostrarToast('Digite um lembrete', 'aviso');
        return;
    }

    try {
        const id = await ipcRenderer.invoke('adicionar-lembrete', { mensagem: texto });
        console.log('✅ Lembrete adicionado:', id);
        
        entrada.value = '';
        await carregarLembretes();
        mostrarToast('Lembrete adicionado!', 'sucesso');
        
    } catch (erro) {
        console.error('❌ Erro ao adicionar lembrete:', erro);
        mostrarToast('Erro ao adicionar lembrete', 'erro');
    }
}

function editarLembrete(id) {
    const lembrete = lembretes[id];
    if (!lembrete) return;

    const novoTexto = prompt('Editar lembrete:', lembrete.mensagem);
    if (novoTexto !== null && novoTexto.trim() !== '' && novoTexto !== lembrete.mensagem) {
        ipcRenderer.invoke('atualizar-texto-lembrete', id, novoTexto.trim())
            .then(() => {
                carregarLembretes();
                mostrarToast('Lembrete atualizado!', 'sucesso');
            })
            .catch(erro => {
                console.error('Erro ao atualizar lembrete:', erro);
                mostrarToast('Erro ao atualizar lembrete', 'erro');
            });
    }
}

function configurarAlarme(id) {
    const lembrete = lembretes[id];
    if (!lembrete) return;

    editandoId = id;
    const modal = document.getElementById('modal-datahora');
    const textoModal = document.getElementById('texto-lembrete-modal');
    const dataInput = document.getElementById('data-alarme');
    const horaInput = document.getElementById('hora-alarme');

    textoModal.textContent = `"${lembrete.mensagem}"`;
    
    // Configurar data mínima como hoje
    const hoje = new Date().toISOString().split('T')[0];
    dataInput.min = hoje;

    if (lembrete.dataHora) {
        const dataHora = new Date(lembrete.dataHora);
        dataInput.value = dataHora.toISOString().split('T')[0];
        horaInput.value = dataHora.toTimeString().slice(0, 5);
    } else {
        dataInput.value = '';
        horaInput.value = '';
    }

    modal.style.display = 'block';
}

async function salvarAlarme() {
    if (!editandoId) return;

    const dataInput = document.getElementById('data-alarme').value;
    const horaInput = document.getElementById('hora-alarme').value;

    if (!dataInput || !horaInput) {
        mostrarToast('Selecione data e hora', 'aviso');
        return;
    }

    const dataHora = new Date(`${dataInput}T${horaInput}`);
    const agora = new Date();

    if (dataHora <= agora) {
        mostrarToast('Selecione uma data/hora futura', 'aviso');
        return;
    }

    try {
        await ipcRenderer.invoke('configurar-alarme', editandoId, dataHora.toISOString());
        document.getElementById('modal-datahora').style.display = 'none';
        await carregarLembretes();
        mostrarToast('Alarme configurado!', 'sucesso');
        
    } catch (erro) {
        console.error('Erro ao configurar alarme:', erro);
        mostrarToast('Erro ao configurar alarme', 'erro');
    }
}

async function removerAlarme() {
    if (!editandoId) return;

    try {
        await ipcRenderer.invoke('remover-alarme', editandoId);
        document.getElementById('modal-datahora').style.display = 'none';
        await carregarLembretes();
        mostrarToast('Alarme removido!', 'sucesso');
        
    } catch (erro) {
        console.error('Erro ao remover alarme:', erro);
        mostrarToast('Erro ao remover alarme', 'erro');
    }
}

async function alternarSomLembrete(id) {
    try {
        await ipcRenderer.invoke('alternar-som-lembrete', id);
        await carregarLembretes();
        mostrarToast('Som do lembrete alterado!', 'info');
        
    } catch (erro) {
        console.error('Erro ao alternar som:', erro);
        mostrarToast('Erro ao alterar som', 'erro');
    }
}

async function excluirLembrete(id) {
    const lembrete = lembretes[id];
    if (!lembrete) return;

    if (confirm(`Excluir o lembrete "${lembrete.mensagem}"?`)) {
        try {
            await ipcRenderer.invoke('excluir-lembrete', id);
            await carregarLembretes();
            mostrarToast('Lembrete excluído!', 'sucesso');
            
        } catch (erro) {
            console.error('Erro ao excluir lembrete:', erro);
            mostrarToast('Erro ao excluir lembrete', 'erro');
        }
    }
}

async function alternarExtensao() {
    try {
        const configuracoes = await ipcRenderer.invoke('carregar-configuracoes');
        configuracoes.extensaoHabilitada = !configuracoes.extensaoHabilitada;
        
        await ipcRenderer.invoke('salvar-configuracoes', configuracoes);
        atualizarIconesCabecalho(configuracoes);
        
        const estado = configuracoes.extensaoHabilitada ? 'ativada' : 'desativada';
        mostrarToast(`Extensão ${estado}`, 'info');
        
    } catch (erro) {
        console.error('Erro ao alternar extensão:', erro);
        mostrarToast('Erro ao alterar extensão', 'erro');
    }
}

async function alternarSomGlobal() {
    try {
        const configuracoes = await ipcRenderer.invoke('carregar-configuracoes');
        configuracoes.somGlobalHabilitado = !configuracoes.somGlobalHabilitado;
        
        await ipcRenderer.invoke('salvar-configuracoes', configuracoes);
        atualizarIconesCabecalho(configuracoes);
        
        const estado = configuracoes.somGlobalHabilitado ? 'ativado' : 'desativado';
        mostrarToast(`Som global ${estado}`, 'info');
        
    } catch (erro) {
        console.error('Erro ao alternar som global:', erro);
        mostrarToast('Erro ao alterar som', 'erro');
    }
}

function atualizarIconesCabecalho(configuracoes) {
    const iconeExtensao = document.getElementById('alternar-extensao');
    const iconeSom = document.getElementById('alternar-som-global');

    iconeExtensao.className = configuracoes.extensaoHabilitada ? 'fas fa-power-off' : 'fas fa-power-off desativado';
    iconeSom.className = configuracoes.somGlobalHabilitado ? 'fas fa-volume-up' : 'fas fa-volume-up desativado';
}

async function atualizarStatusSincronizacao() {
    try {
        const status = await ipcRenderer.invoke('get-status-sincronizacao');
        const iconeSincronizacao = document.getElementById('status-sincronizacao');
        
        if (status.firebase.inicializado) {
            iconeSincronizacao.className = 'fas fa-cloud';
            iconeSincronizacao.title = 'Sincronizado com a nuvem';
        } else {
            iconeSincronizacao.className = 'fas fa-cloud desativado';
            iconeSincronizacao.title = 'Modo offline - sincronização desativada';
        }
    } catch (erro) {
        console.error('Erro ao atualizar status:', erro);
    }
}

// ✅ FUNÇÕES UTILITÁRIAS
function escapeHtml(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

function formatarDataHora(dataHoraString) {
    const dataHora = new Date(dataHoraString);
    return dataHora.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function mostrarToast(mensagem, tipo = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = mensagem;
    toast.className = `toast mostrar ${tipo}`;

    setTimeout(() => {
        toast.classList.remove('mostrar');
    }, 3000);
}

// ✅ SINCRONIZAÇÃO MANUAL
async function sincronizarManualmente() {
    try {
        mostrarToast('Sincronizando...', 'info');
        await ipcRenderer.invoke('sincronizar-manualmente');
        await carregarLembretes();
        mostrarToast('Sincronização completa!', 'sucesso');
    } catch (erro) {
        console.error('Erro na sincronização manual:', erro);
        mostrarToast('Erro na sincronização', 'erro');
    }
}

// Adicionar botão de sincronização manual se necessário
document.addEventListener('DOMContentLoaded', () => {
    // Adicionar botão de sincronização no cabeçalho se não existir
    const iconesCabecalho = document.querySelector('.icones-cabecalho');
    if (iconesCabecalho && !document.getElementById('sincronizar-manual')) {
        const botaoSync = document.createElement('i');
        botaoSync.id = 'sincronizar-manual';
        botaoSync.className = 'fas fa-sync-alt';
        botaoSync.title = 'Sincronizar manualmente';
        botaoSync.addEventListener('click', sincronizarManualmente);
        iconesCabecalho.appendChild(botaoSync);
    }
});