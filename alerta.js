// alerta.js - ADAPTADO PARA ELECTRON
const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', async () => {
    const textoLembrete = document.getElementById('texto-lembrete');
    const horaLembrete = document.getElementById('hora-lembrete');
    const botaoFecharAlerta = document.getElementById('fechar-alerta');
    const botaoSilenciar = document.getElementById('silenciar-alarme');
    const somAlarme = document.getElementById('som-alarme');

    // Obter ID do lembrete da URL
    const paramsUrl = new URLSearchParams(window.location.search);
    const idLembrete = paramsUrl.get('id');

    if (!idLembrete) {
        textoLembrete.textContent = 'Lembrete não encontrado';
        return;
    }

    // Carregar dados do lembrete - AGORA COM ELECTRON
    try {
        const lembretes = await ipcRenderer.invoke('carregar-lembretes');
        const configuracoes = await ipcRenderer.invoke('carregar-configuracoes');
        
        const lembrete = lembretes[idLembrete];
        
        if (lembrete) {
            textoLembrete.textContent = lembrete.mensagem;
            
            if (lembrete.dataHora) {
                horaLembrete.textContent = new Date(lembrete.dataHora).toLocaleString('pt-BR');
            } else {
                horaLembrete.textContent = 'Sem data específica';
            }

            // Verificar se o som deve tocar
            const somGlobalHabilitado = configuracoes.somGlobalHabilitado !== false;
            const somIndividualHabilitado = lembrete.somHabilitado !== false;
            const somDeveTocar = somGlobalHabilitado && somIndividualHabilitado;

            // Configurar botão de silenciar
            if (!somDeveTocar) {
                botaoSilenciar.innerHTML = '<i class="fas fa-volume-mute"></i> Silenciado';
                botaoSilenciar.style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
                botaoSilenciar.disabled = true;
            }

            // Tocar som do alarme se estiver habilitado
            if (somDeveTocar) {
                tocarAlarme();
            }

        } else {
            textoLembrete.textContent = 'Lembrete não encontrado';
            horaLembrete.textContent = '';
        }
    } catch (erro) {
        console.error('Erro ao carregar lembrete:', erro);
        textoLembrete.textContent = 'Erro ao carregar lembrete';
    }

    // Função para tocar o alarme (APENAS UMA VEZ)
    function tocarAlarme() {
        if (somAlarme) {
            somAlarme.loop = false;
            somAlarme.play().catch(erro => {
                console.log('Não foi possível reproduzir o som do alarme:', erro);
                tocarTomSistema();
            });
        } else {
            tocarTomSistema();
        }
    }

    // Fallback: tocar tom do sistema (APENAS UMA VEZ)
    function tocarTomSistema() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 2);
            
        } catch (erro) {
            console.log('Fallback de áudio também falhou:', erro);
        }
    }

    // Silenciar alarme
    botaoSilenciar.addEventListener('click', () => {
        if (somAlarme) {
            somAlarme.pause();
            somAlarme.currentTime = 0;
        }
        botaoSilenciar.innerHTML = '<i class="fas fa-volume-off"></i> Silenciado';
        botaoSilenciar.style.backgroundColor = 'rgba(100, 100, 100, 0.3)';
        botaoSilenciar.disabled = true;
    });

    // Fechar janela
    botaoFecharAlerta.addEventListener('click', () => {
        if (somAlarme) {
            somAlarme.pause();
            somAlarme.currentTime = 0;
        }
        window.close();
    });

    // Fechar automaticamente após 45 segundos (se não silenciado)
    setTimeout(() => {
        if (!botaoSilenciar.disabled) {
            window.close();
        }
    }, 45000);

    // Focar na janela
    window.focus();
});