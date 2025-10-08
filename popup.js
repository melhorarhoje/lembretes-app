document.addEventListener('DOMContentLoaded', async () => {
    const entradaLembrete = document.getElementById('entrada-lembrete');
    const btnAdicionar = document.getElementById('adicionar-lembrete');
    const lista = document.getElementById('lista-lembretes');
    const alternarExtensao = document.getElementById('alternar-extensao');
    const alternarSom = document.getElementById('alternar-som-global');
    const statusSincronizacao = document.getElementById('status-sincronizacao');
    const modalDataHora = document.getElementById('modal-datahora');
    const textoLembreteModal = document.getElementById('texto-lembrete-modal');
    const dataAlarme = document.getElementById('data-alarme');
    const horaAlarme = document.getElementById('hora-alarme');
    const btnSalvarAlarme = document.getElementById('btn-salvar-alarme');
    const btnRemoverAlarme = document.getElementById('btn-remover-alarme');
    const fecharModal = document.querySelector('.fechar-modal');

    let lembreteEditandoId = null;
    let extensaoHabilitada = true;
    let somGlobalHabilitado = true;

    // Configurar data mínima como hoje
    const hoje = new Date().toISOString().split('T')[0];
    dataAlarme.min = hoje;

    // Inicializar
    await carregarConfiguracoes();
    await carregarLembretes();

    // Event Listeners
    btnAdicionar.addEventListener('click', adicionarLembrete);
    entradaLembrete.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adicionarLembrete();
    });

    alternarExtensao.addEventListener('click', alternarExtensaoHandler);
    alternarSom.addEventListener('click', alternarSomHandler);

    // Modal events
    fecharModal.addEventListener('click', fecharModalHandler);
    btnSalvarAlarme.addEventListener('click', salvarAlarmeHandler);
    btnRemoverAlarme.addEventListener('click', removerAlarmeHandler);

    // Fechar modal ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === modalDataHora) {
            fecharModalHandler();
        }
    });

    // Carregar configurações
    async function carregarConfiguracoes() {
        try {
            const dados = await chrome.storage.local.get(['extensaoHabilitada', 'somGlobalHabilitado']);
            extensaoHabilitada = dados.extensaoHabilitada !== false;
            somGlobalHabilitado = dados.somGlobalHabilitado !== false;
            atualizarIcones();
            atualizarStatusSincronizacao('sincronizado');
        } catch (erro) {
            console.error('Erro ao carregar configurações:', erro);
            mostrarToast('Erro ao carregar configurações', 'erro');
        }
    }

    // Atualizar ícones de estado
    function atualizarIcones() {
        alternarExtensao.className = extensaoHabilitada ? 'fas fa-power-off' : 'fas fa-power-off desabilitado';
        alternarSom.className = somGlobalHabilitado ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    }

    function atualizarStatusSincronizacao(status) {
        statusSincronizacao.className = `fas fa-cloud ${status}`;
        const titulos = {
            'sincronizando': 'Sincronizando...',
            'sincronizado': 'Sincronizado (Local)',
            'erro': 'Erro na sincronização'
        };
        statusSincronizacao.title = titulos[status] || 'Sincronização';
    }

    // Mostrar toast message
    function mostrarToast(mensagem, tipo = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = mensagem;
        toast.className = `toast mostrar ${tipo}`;
        
        setTimeout(() => {
            toast.className = 'toast';
        }, 3000);
    }

    // Carregar e exibir lembretes
    async function carregarLembretes() {
        try {
            const dados = await chrome.storage.local.get(['lembretes']);
            const lembretes = dados.lembretes || {};
            
            lista.innerHTML = '';
            
            // Ordenar por data de criação (mais recentes primeiro)
            const lembretesOrdenados = Object.entries(lembretes)
                .sort(([,a], [,b]) => new Date(b.criadoEm) - new Date(a.criadoEm));
            
            lembretesOrdenados.forEach(([id, lembrete]) => {
                const item = criarItemLembrete(id, lembrete);
                lista.appendChild(item);
            });

        } catch (erro) {
            console.error('Erro ao carregar lembretes:', erro);
            mostrarToast('Erro ao carregar lembretes', 'erro');
        }
    }

    // Criar elemento de item de lembrete (versão mais robusta)
function criarItemLembrete(id, lembrete) {
    const item = document.createElement('li');
    item.className = 'item-lembrete';
    
    const temAlarme = lembrete.dataHora && new Date(lembrete.dataHora) > new Date();
    const textoData = temAlarme ? 
        formatarData(lembrete.dataHora) : 
        'Sem alarme';
    
    const classeAlarme = temAlarme ? '' : 'sem-alarme';

    item.innerHTML = `
        <div class="conteudo-lembrete">
            <div class="texto-lembrete" data-id="${id}">${escapeHtml(lembrete.mensagem)}</div>
            <div class="info-alarme ${classeAlarme}">
                <i class="fas fa-clock"></i>
                <span>${textoData}</span>
            </div>
        </div>
        <div class="acoes-lembrete">
            <i class="fas fa-edit" data-id="${id}" title="Editar lembrete"></i>
            <i class="fas fa-calendar" data-id="${id}" title="Configurar alarme"></i>
            <i class="fas fa-bell${lembrete.somHabilitado ? '' : '-slash'}" 
               data-id="${id}" 
               title="${lembrete.somHabilitado ? 'Desabilitar som' : 'Habilitar som'}"></i>
            <i class="fas fa-trash" data-id="${id}" title="Excluir lembrete"></i>
        </div>
    `;

    // Adicionar event listeners de forma segura
    const textoElement = item.querySelector('.texto-lembrete');
    if (textoElement) {
        textoElement.addEventListener('click', (e) => {
            e.stopPropagation();
            iniciarEdicaoTexto(e.currentTarget, id, lembrete.mensagem);
        });
    }

    const iconeCalendario = item.querySelector('.fa-calendar');
    if (iconeCalendario) {
        iconeCalendario.addEventListener('click', (e) => {
            e.stopPropagation();
            abrirModalConfigurarAlarme(id, lembrete.mensagem, lembrete.dataHora);
        });
    }

    const iconeLixeira = item.querySelector('.fa-trash');
    if (iconeLixeira) {
        iconeLixeira.addEventListener('click', (e) => {
            e.stopPropagation();
            excluirLembrete(id);
        });
    }

    const iconeSom = item.querySelector('.fa-bell, .fa-bell-slash');
    if (iconeSom) {
        iconeSom.addEventListener('click', (e) => {
            e.stopPropagation();
            alternarSomLembrete(id);
        });
    }

    const iconeEditar = item.querySelector('.fa-edit');
    if (iconeEditar) {
        iconeEditar.addEventListener('click', (e) => {
            e.stopPropagation();
            if (textoElement) {
                textoElement.click();
            }
        });
    }

    return item;
}

// Função auxiliar para escapar HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

   // Substituir a função iniciarEdicaoTexto por esta versão corrigida:

// Iniciar edição do texto do lembrete
function iniciarEdicaoTexto(elemento, id, textoAtual) {
    // Verificar se o elemento e o pai existem
    if (!elemento || !elemento.parentNode) {
        console.error('Elemento ou parentNode não encontrado');
        return;
    }

    const input = document.createElement('input');
    input.type = 'text';
    input.value = textoAtual;
    input.className = 'texto-lembrete editando';
    input.style.width = '100%';
    input.style.border = '1px solid #2563eb';
    input.style.borderRadius = '3px';
    input.style.padding = '4px';
    
    // Substituir o elemento pelo input
    elemento.parentNode.replaceChild(input, elemento);
    input.focus();
    input.select();

    const salvarEdicao = () => {
        const novoTexto = input.value.trim();
        
        // Verificar novamente se o parentNode existe
        if (!input.parentNode) {
            console.error('ParentNode não encontrado ao salvar edição');
            return;
        }

        if (novoTexto && novoTexto !== textoAtual) {
            atualizarTextoLembrete(id, novoTexto);
        }
        
        // Restaurar elemento original
        const novoElementoTexto = document.createElement('div');
        novoElementoTexto.className = 'texto-lembrete';
        novoElementoTexto.textContent = novoTexto || textoAtual;
        novoElementoTexto.setAttribute('data-id', id);
        novoElementoTexto.addEventListener('click', (e) => 
            iniciarEdicaoTexto(e.target, id, novoTexto || textoAtual)
        );
        
        input.parentNode.replaceChild(novoElementoTexto, input);
    };

    const cancelarEdicao = () => {
        if (!input.parentNode) return;
        
        // Restaurar elemento original sem salvar
        const novoElementoTexto = document.createElement('div');
        novoElementoTexto.className = 'texto-lembrete';
        novoElementoTexto.textContent = textoAtual;
        novoElementoTexto.setAttribute('data-id', id);
        novoElementoTexto.addEventListener('click', (e) => 
            iniciarEdicaoTexto(e.target, id, textoAtual)
        );
        
        input.parentNode.replaceChild(novoElementoTexto, input);
    };

    input.addEventListener('blur', salvarEdicao);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            salvarEdicao();
        } else if (e.key === 'Escape') {
            cancelarEdicao();
        }
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            cancelarEdicao();
        }
    });
}

    // Abrir modal para configurar alarme
    function abrirModalConfigurarAlarme(id, mensagem, dataHora) {
        lembreteEditandoId = id;
        textoLembreteModal.textContent = mensagem;
        
        if (dataHora) {
            const data = new Date(dataHora);
            dataAlarme.value = data.toISOString().split('T')[0];
            horaAlarme.value = data.toTimeString().slice(0, 5);
        } else {
            dataAlarme.value = '';
            horaAlarme.value = '';
        }

        modalDataHora.style.display = 'block';
    }

    function fecharModalHandler() {
        modalDataHora.style.display = 'none';
        lembreteEditandoId = null;
    }

    async function salvarAlarmeHandler() {
        if (!lembreteEditandoId) return;

        const data = dataAlarme.value;
        const hora = horaAlarme.value;

        if (!data || !hora) {
            mostrarToast('Selecione data e hora', 'erro');
            return;
        }

        const dataHora = new Date(`${data}T${hora}`);
        if (dataHora <= new Date()) {
            mostrarToast('Selecione uma data/hora futura', 'erro');
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                action: 'configurarAlarmeLembrete',
                id: lembreteEditandoId,
                dataHora: dataHora.toISOString()
            });

            mostrarToast('Alarme configurado com sucesso', 'sucesso');
            await carregarLembretes();
            fecharModalHandler();
        } catch (erro) {
            console.error('Erro ao configurar alarme:', erro);
            mostrarToast('Erro ao configurar alarme', 'erro');
        }
    }

    async function removerAlarmeHandler() {
        if (!lembreteEditandoId) return;

        try {
            await chrome.runtime.sendMessage({
                action: 'removerAlarmeLembrete',
                id: lembreteEditandoId
            });

            mostrarToast('Alarme removido', 'sucesso');
            await carregarLembretes();
            fecharModalHandler();
        } catch (erro) {
            console.error('Erro ao remover alarme:', erro);
            mostrarToast('Erro ao remover alarme', 'erro');
        }
    }

    // Adicionar novo lembrete
    async function adicionarLembrete() {
        const mensagem = entradaLembrete.value.trim();
        if (!mensagem) {
            mostrarToast('Digite um lembrete', 'erro');
            return;
        }

        try {
            const lembrete = {
                mensagem: mensagem,
                dataHora: null,
                somHabilitado: true,
                criadoEm: new Date().toISOString(),
                atualizadoEm: new Date().toISOString()
            };

            await chrome.runtime.sendMessage({
                action: 'adicionarLembrete',
                lembrete: lembrete
            });

            entradaLembrete.value = '';
            mostrarToast('Lembrete adicionado', 'sucesso');
            await carregarLembretes();
            
        } catch (erro) {
            console.error('Erro ao adicionar lembrete:', erro);
            mostrarToast('Erro ao adicionar lembrete', 'erro');
        }
    }

    // Atualizar texto do lembrete
    async function atualizarTextoLembrete(id, novoTexto) {
        try {
            await chrome.runtime.sendMessage({
                action: 'atualizarTextoLembrete',
                id: id,
                novoTexto: novoTexto
            });

            mostrarToast('Lembrete atualizado', 'sucesso');
            await carregarLembretes();
        } catch (erro) {
            console.error('Erro ao atualizar lembrete:', erro);
            mostrarToast('Erro ao atualizar lembrete', 'erro');
        }
    }

    // Excluir lembrete
    async function excluirLembrete(id) {
        if (!confirm('Tem certeza que deseja excluir este lembrete?')) {
            return;
        }

        try {
            await chrome.runtime.sendMessage({
                action: 'excluirLembrete',
                id: id
            });

            mostrarToast('Lembrete excluído', 'sucesso');
            await carregarLembretes();
        } catch (erro) {
            console.error('Erro ao excluir lembrete:', erro);
            mostrarToast('Erro ao excluir lembrete', 'erro');
        }
    }

    // Alternar som do lembrete
    async function alternarSomLembrete(id) {
        try {
            await chrome.runtime.sendMessage({
                action: 'alternarSomLembrete',
                id: id
            });

            await carregarLembretes();
        } catch (erro) {
            console.error('Erro ao alternar som:', erro);
            mostrarToast('Erro ao alternar som', 'erro');
        }
    }

    // Alternar extensão
    async function alternarExtensaoHandler() {
        try {
            extensaoHabilitada = !extensaoHabilitada;
            await chrome.storage.local.set({ extensaoHabilitada });
            atualizarIcones();
            
            const mensagem = extensaoHabilitada ? 'Extensão habilitada' : 'Extensão desabilitada';
            mostrarToast(mensagem, 'info');
        } catch (erro) {
            console.error('Erro ao alternar extensão:', erro);
            mostrarToast('Erro ao alternar extensão', 'erro');
        }
    }

    // Alternar som global
    async function alternarSomHandler() {
        try {
            somGlobalHabilitado = !somGlobalHabilitado;
            await chrome.storage.local.set({ somGlobalHabilitado });
            atualizarIcones();
            
            const mensagem = somGlobalHabilitado ? 'Som habilitado' : 'Som desabilitado';
            mostrarToast(mensagem, 'info');
        } catch (erro) {
            console.error('Erro ao alternar som:', erro);
            mostrarToast('Erro ao alternar som', 'erro');
        }
    }

    // Formatador de data
    function formatarData(dataString) {
        if (!dataString) return 'Sem alarme';
        
        const data = new Date(dataString);
        return data.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
});