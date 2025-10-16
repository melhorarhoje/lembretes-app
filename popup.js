// popup.js - VERSÃO COMPLETA COM SINCRONIZAÇÃO
const { ipcRenderer } = require('electron');

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
    let sincronizacaoAtiva = false;
        let abaAtual = 'compi'; // 'compi' | 'pessoal'

    // ✅ CONFIGURAR DATA MÍNIMA
    const hoje = new Date().toISOString().split('T')[0];
    dataAlarme.min = hoje;

    // ✅ INICIALIZAR
    await carregarConfiguracoes();
    await carregarLembretes();
    iniciarOuvinteSincronizacao();

        // Configurar abas
        const abaCompi = document.getElementById('aba-compi');
        const abaPessoal = document.getElementById('aba-pessoal');

        abaCompi.addEventListener('click', async () => {
            abaAtual = 'compi';
            abaCompi.classList.add('ativa');
            abaPessoal.classList.remove('ativa');
            document.querySelector('.titulo-painel').textContent = 'Painel de lembretes';
            await carregarLembretes();
        });

        abaPessoal.addEventListener('click', async () => {
            abaAtual = 'pessoal';
            abaPessoal.classList.add('ativa');
            abaCompi.classList.remove('ativa');
            document.querySelector('.titulo-painel').textContent = 'Painel de lembretes';
            await carregarLembretes();
        });
    // ✅ EVENT LISTENERS
    btnAdicionar.addEventListener('click', adicionarLembrete);
    entradaLembrete.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') adicionarLembrete();
    });

    alternarExtensao.addEventListener('click', alternarExtensaoHandler);
    alternarSom.addEventListener('click', alternarSomHandler);

    // ✅ MODAL EVENTS
    fecharModal.addEventListener('click', fecharModalHandler);
    btnSalvarAlarme.addEventListener('click', salvarAlarmeHandler);
    btnRemoverAlarme.addEventListener('click', removerAlarmeHandler);

    // ✅ FECHAR MODAL AO CLICAR FORA
    window.addEventListener('click', (e) => {
        if (e.target === modalDataHora) {
            fecharModalHandler();
        }
    });

    // ✅ OUVIR ATUALIZAÇÕES EM TEMPO REAL
    function iniciarOuvinteSincronizacao() {
        ipcRenderer.on('dados-atualizados', async () => {
            console.log('🔄 Dados atualizados recebidos');
            await carregarLembretes();
            mostrarToast('Dados atualizados de outros usuários', 'info');
        });
        let debounceAtualizacao;
        ipcRenderer.on('dados-atualizados', async (event, payload) => {
            console.log('🔔 dados-atualizados recebido', payload && (payload.mudancas ? `${payload.mudancas.length} mudanças` : payload.resumo ? 'snapshot' : 'sem-payload'));

            // Se vierem mudanças incrementais, aplicamos localmente e atualizamos a UI rapidamente
            if (payload && payload.mudancas && payload.mudancas.length > 0) {
                for (const mudanca of payload.mudancas) {
                    switch (mudanca.tipo) {
                        case 'added':
                        case 'modified':
                            // atualizar item direto no DOM por simplicidade: recarregaremos a lista inteira
                            break;
                        case 'removed':
                            break;
                    }
                }

                // Debounce para agrupar atualizações rápidas
                clearTimeout(debounceAtualizacao);
                debounceAtualizacao = setTimeout(async () => {
                    await carregarLembretes();
                    mostrarToast('Dados atualizados de outros usu\u00e1rios', 'info');
                }, 120);

                return;
            }

            // Se vier um snapshot completo, recarregamos tudo
            if (payload && payload.resumo) {
                await carregarLembretes();
                mostrarToast('Dados sincronizados a partir do servidor', 'info');
                return;
            }

            // Fallback genérico: recarregar
            await carregarLembretes();
            mostrarToast('Dados atualizados de outros usu\u00e1rios', 'info');
        });
    }

    // ✅ CARREGAR CONFIGURAÇÕES
    async function carregarConfiguracoes() {
        try {
            const configuracoes = await ipcRenderer.invoke('carregar-configuracoes');
            extensaoHabilitada = configuracoes.extensaoHabilitada !== false;
            somGlobalHabilitado = configuracoes.somGlobalHabilitado !== false;
            await atualizarStatusSincronizacao();
            atualizarIcones();
        } catch (erro) {
            console.error('Erro ao carregar configurações:', erro);
            mostrarToast('Erro ao carregar configurações', 'erro');
        }
    }

    // ✅ ATUALIZAR STATUS DA SINCRONIZAÇÃO
    async function atualizarStatusSincronizacao() {
        try {
            const status = await ipcRenderer.invoke('get-status-sincronizacao');
            
            if (status.firebase.inicializado && status.firebase.online) {
                statusSincronizacao.className = 'fas fa-cloud sincronizado';
                statusSincronizacao.title = `Sincronizado - ${status.local.itens} itens`;
                sincronizacaoAtiva = true;
            } else if (status.firebase.inicializado && !status.firebase.online) {
                statusSincronizacao.className = 'fas fa-cloud sincronizando';
                statusSincronizacao.title = 'Conectando...';
                sincronizacaoAtiva = false;
            } else {
                statusSincronizacao.className = 'fas fa-cloud erro';
                statusSincronizacao.title = 'Modo local apenas';
                sincronizacaoAtiva = false;
            }

            // ✅ ADICIONAR CLIQUE PARA SINCRONIZAÇÃO MANUAL
            statusSincronizacao.style.cursor = 'pointer';
            statusSincronizacao.onclick = async () => {
                if (!sincronizacaoAtiva) {
                    statusSincronizacao.className = 'fas fa-cloud sincronizando';
                    statusSincronizacao.title = 'Sincronizando...';
                    
                    ipcRenderer.send('sincronizar-manualmente');
                    
                    ipcRenderer.once('sincronizacao-completa', async () => {
                        await carregarLembretes();
                        await atualizarStatusSincronizacao();
                        mostrarToast('Sincronização completa', 'sucesso');
                    });

                    setTimeout(async () => {
                        await atualizarStatusSincronizacao();
                    }, 3000);
                }
            };

        } catch (erro) {
            console.error('Erro ao verificar status:', erro);
            statusSincronizacao.className = 'fas fa-cloud erro';
            statusSincronizacao.title = 'Erro ao verificar status';
        }
    }

    // ✅ ATUALIZAR ÍCONES
    function atualizarIcones() {
        alternarExtensao.className = extensaoHabilitada ? 
            'fas fa-power-off' : 'fas fa-power-off desabilitado';
        alternarSom.className = somGlobalHabilitado ? 
            'fas fa-volume-up' : 'fas fa-volume-mute';
    }

    // ✅ CARREGAR LEMBRETES
    async function carregarLembretes() {
        try {
            const lembretes = await ipcRenderer.invoke('carregar-lembretes');
            
            lista.innerHTML = '';

            let entradas = Object.entries(lembretes)
                .sort(([,a], [,b]) => new Date(b.criadoEm) - new Date(a.criadoEm));

            // Filtrar abas:
            // - Aba Pessoal: apenas itens explícitos pessoais (lembrete.local === true)
            // - Aba COMPI: todos exceto itens pessoais
            if (abaAtual === 'pessoal') {
                entradas = entradas.filter(([id, lembrete]) => (lembrete && lembrete.local === true));
            } else {
                // COMPI: excluir lembretes pessoais
                entradas = entradas.filter(([id, lembrete]) => !(lembrete && lembrete.local === true));
            }
            const lembretesOrdenados = entradas;
            
            if (lembretesOrdenados.length === 0) {
                lista.innerHTML = '<li class="item-vazio">Nenhum lembrete ainda. Adicione o primeiro!</li>';
                return;
            }
            
            lembretesOrdenados.forEach(([id, lembrete]) => {
                const item = criarItemLembrete(id, lembrete);
                lista.appendChild(item);
            });

            await atualizarStatusSincronizacao();

        } catch (erro) {
            console.error('Erro ao carregar lembretes:', erro);
            mostrarToast('Erro ao carregar lembretes', 'erro');
        }
    }

    // ✅ CRIAR ITEM DE LEMBRETE
    function criarItemLembrete(id, lembrete) {
        const item = document.createElement('li');
        item.className = 'item-lembrete';
        
        const temAlarme = lembrete.dataHora && new Date(lembrete.dataHora) > new Date();
        const textoData = temAlarme ? 
            formatarData(lembrete.dataHora) : 
            'Sem alarme';
        
        const classeAlarme = temAlarme ? '' : 'sem-alarme';
        const sincronizado = lembrete.sincronizado !== false;

        item.innerHTML = `
            <div class="conteudo-lembrete">
                <div class="texto-lembrete" data-id="${id}">
                    ${escapeHtml(lembrete.mensagem)}
                    ${!sincronizado ? ' <i class="fas fa-cloud-upload-alt icone-sincronizacao" title="Aguardando sincronização"></i>' : ''}
                    ${lembrete.local === true ? ' <span class="badge-pessoal">Pessoal</span>' : ''}
                </div>
                <div class="info-alarme ${classeAlarme}">
                    <i class="fas fa-clock"></i>
                    <span>${textoData}</span>
                    ${sincronizado ? ' <i class="fas fa-cloud icone-cloud" title="Sincronizado"></i>' : ' <i class="fas fa-laptop icone-local" title="Apenas local"></i>'}
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

        // ✅ EVENT LISTENERS
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

    // ✅ INICIAR EDIÇÃO DE TEXTO
    function iniciarEdicaoTexto(elemento, id, textoAtual) {
        if (!elemento || !elemento.parentNode) {
            console.error('Elemento ou parentNode não encontrado');
            return;
        }

        const input = document.createElement('input');
        input.type = 'text';
        input.value = textoAtual;
        input.className = 'texto-lembrete-editando';
        input.style.cssText = `
            width: 100%;
            border: 2px solid #2563eb;
            border-radius: 4px;
            padding: 6px 8px;
            font-size: 14px;
            font-family: inherit;
            background: white;
            box-sizing: border-box;
        `;

        elemento.parentNode.replaceChild(input, elemento);
        input.focus();
        input.select();

        const salvarEdicao = () => {
            const novoTexto = input.value.trim();
            
            if (!input.parentNode) {
                console.error('ParentNode não encontrado ao salvar edição');
                return;
            }

            const novoElementoTexto = document.createElement('div');
            novoElementoTexto.className = 'texto-lembrete';
            novoElementoTexto.textContent = novoTexto || textoAtual;
            novoElementoTexto.setAttribute('data-id', id);
            
            novoElementoTexto.addEventListener('click', (e) => {
                e.stopPropagation();
                iniciarEdicaoTexto(e.target, id, novoTexto || textoAtual);
            });
            
            input.parentNode.replaceChild(novoElementoTexto, input);

            if (novoTexto && novoTexto !== textoAtual) {
                atualizarTextoLembrete(id, novoTexto);
            }
        };

        const cancelarEdicao = () => {
            if (!input.parentNode) return;
            
            const novoElementoTexto = document.createElement('div');
            novoElementoTexto.className = 'texto-lembrete';
            novoElementoTexto.textContent = textoAtual;
            novoElementoTexto.setAttribute('data-id', id);
            novoElementoTexto.addEventListener('click', (e) => {
                e.stopPropagation();
                iniciarEdicaoTexto(e.target, id, textoAtual);
            });
            
            input.parentNode.replaceChild(novoElementoTexto, input);
        };

        input.addEventListener('blur', salvarEdicao);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                salvarEdicao();
            } else if (e.key === 'Escape') {
                cancelarEdicao();
            }
        });

        input.addEventListener('click', (e) => e.stopPropagation());
    }

    // ✅ ABRIR MODAL CONFIGURAR ALARME
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

    // ✅ ADICIONAR LEMBRETE
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

            if (abaAtual === 'pessoal') {
                // salvar apenas localmente
                await ipcRenderer.invoke('adicionar-lembrete-local', lembrete);
            } else {
                await ipcRenderer.invoke('adicionar-lembrete', lembrete);
            }

            entradaLembrete.value = '';
            mostrarToast('Lembrete adicionado', 'sucesso');
            await carregarLembretes();
            
        } catch (erro) {
            console.error('Erro ao adicionar lembrete:', erro);
            mostrarToast('Erro ao adicionar lembrete', 'erro');
        }
    }

    // ✅ ATUALIZAR TEXTO LEMBRETE
    async function atualizarTextoLembrete(id, novoTexto) {
        try {
            await ipcRenderer.invoke('atualizar-texto-lembrete', id, novoTexto);
            mostrarToast('Lembrete atualizado', 'sucesso');
            await carregarLembretes();
        } catch (erro) {
            console.error('Erro ao atualizar lembrete:', erro);
            mostrarToast('Erro ao atualizar lembrete', 'erro');
        }
    }

    // ✅ EXCLUIR LEMBRETE
    async function excluirLembrete(id) {
        if (!confirm('Tem certeza que deseja excluir este lembrete?')) {
            return;
        }

        try {
            await ipcRenderer.invoke('excluir-lembrete', id);
            mostrarToast('Lembrete excluído', 'sucesso');
            await carregarLembretes();
        } catch (erro) {
            console.error('Erro ao excluir lembrete:', erro);
            mostrarToast('Erro ao excluir lembrete', 'erro');
        }
    }

    // ✅ SALVAR ALARME
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
            await ipcRenderer.invoke('configurar-alarme', lembreteEditandoId, dataHora.toISOString());
            mostrarToast('Alarme configurado com sucesso', 'sucesso');
            await carregarLembretes();
            fecharModalHandler();
        } catch (erro) {
            console.error('Erro ao configurar alarme:', erro);
            mostrarToast('Erro ao configurar alarme', 'erro');
        }
    }

    // ✅ REMOVER ALARME
    async function removerAlarmeHandler() {
        if (!lembreteEditandoId) return;

        try {
            await ipcRenderer.invoke('remover-alarme', lembreteEditandoId);
            mostrarToast('Alarme removido', 'sucesso');
            await carregarLembretes();
            fecharModalHandler();
        } catch (erro) {
            console.error('Erro ao remover alarme:', erro);
            mostrarToast('Erro ao remover alarme', 'erro');
        }
    }

    // ✅ ALTERNAR SOM LEMBRETE
    async function alternarSomLembrete(id) {
        try {
            await ipcRenderer.invoke('alternar-som-lembrete', id);
            await carregarLembretes();
        } catch (erro) {
            console.error('Erro ao alternar som:', erro);
            mostrarToast('Erro ao alternar som', 'erro');
        }
    }

    // ✅ ALTERNAR EXTENSÃO
    async function alternarExtensaoHandler() {
        try {
            extensaoHabilitada = !extensaoHabilitada;
            
            await ipcRenderer.invoke('salvar-configuracoes', { 
                extensaoHabilitada, 
                somGlobalHabilitado 
            });
            
            if (!extensaoHabilitada) {
                await ipcRenderer.invoke('desativar-todos-alarmes');
                mostrarToast('🔕 Extensão DESABILITADA - Nenhum alerta será exibido', 'erro');
            } else {
                mostrarToast('🔔 Extensão HABILITADA - Alertas ativados', 'sucesso');
            }
            
            atualizarIcones();
            
        } catch (erro) {
            console.error('Erro ao alternar extensão:', erro);
            mostrarToast('Erro ao alternar extensão', 'erro');
        }
    }

    // ✅ ALTERNAR SOM GLOBAL
    async function alternarSomHandler() {
        try {
            somGlobalHabilitado = !somGlobalHabilitado;
            await ipcRenderer.invoke('salvar-configuracoes', { extensaoHabilitada, somGlobalHabilitado });
            atualizarIcones();
            
            const mensagem = somGlobalHabilitado ? '🔊 Som habilitado' : '🔇 Som desabilitado';
            mostrarToast(mensagem, 'info');
        } catch (erro) {
            console.error('Erro ao alternar som:', erro);
            mostrarToast('Erro ao alternar som', 'erro');
        }
    }

    // ✅ MOSTRAR TOAST
    function mostrarToast(mensagem, tipo = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = mensagem;
        toast.className = `toast mostrar ${tipo}`;
        
        setTimeout(() => {
                toast.className = 'toast';
            }, 2000);
    }

    // ✅ FUNÇÕES AUXILIARES
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

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