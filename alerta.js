// alerta.js - Simplificado
document.addEventListener('DOMContentLoaded', async () => {
    // Elementos do DOM
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

    // Carregar dados do lembrete e configurações
    try {
        const dados = await chrome.storage.local.get(['lembretes', 'somGlobalHabilitado']);
        const lembrete = dados.lembretes?.[idLembrete];
        
        if (lembrete) {
            textoLembrete.textContent = lembrete.mensagem;
            
            if (lembrete.dataHora) {
                horaLembrete.textContent = new Date(lembrete.dataHora).toLocaleString('pt-BR');
            } else {
                horaLembrete.textContent = 'Sem data específica';
            }

            // Verificar se o som deve tocar (considerando som global e individual)
            const somGlobalHabilitado = dados.somGlobalHabilitado !== false;
            const somIndividualHabilitado = lembrete.somHabilitado !== false;
            const somDeveTocar = somGlobalHabilitado && somIndividualHabilitado;

            // Configurar botão de silenciar baseado no status do som
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

    /* // Função para tocar o alarme
    function tocarAlarme() {
        if (somAlarme) {
            // Tentar reproduzir o som
            somAlarme.play().catch(erro => {
                console.log('Não foi possível reproduzir o som do alarme:', erro);
                // Fallback: usar tom do sistema
                tocarTomSistema();
            });
        } else {
            tocarTomSistema();
        }
    }*/

    // Função para tocar o alarme (APENAS UMA VEZ)
    function tocarAlarme() {
        if (somAlarme) {
            // REMOVER o loop e tocar apenas uma vez
            somAlarme.loop = false;
            
            // Tentar reproduzir o som (apenas uma vez)
            somAlarme.play().catch(erro => {
                console.log('Não foi possível reproduzir o som do alarme:', erro);
                // Fallback: usar tom do sistema (também apenas uma vez)
                tocarTomSistema();
            });
        } else {
            tocarTomSistema();
        }
    }

    /* // Fallback: tocar tom do sistema
    function tocarTomSistema() {
        // Criar um contexto de áudio simples como fallback
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
    }*/

      // Fallback: tocar tom do sistema (APENAS UMA VEZ)
    function tocarTomSistema() {
        // Criar um contexto de áudio simples como fallback (sem loop)
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            // Tocar por 2 segundos e parar automaticamente
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 2);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 2); // Para automaticamente após 2 segundos
            
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
        // Parar o som antes de fechar
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

    // Focar na janela e garantir que esteja visível
    window.focus();
});