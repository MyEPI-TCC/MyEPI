// consultar-estoque.js
// Importa as funções do seu arquivo api.js
import { get } from '../../services/api.js';

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('tabela-estoque-tbody');
    const searchInput = document.getElementById('pesquisaEstoque');
    const clearSearchButton = document.getElementById('clearSearchButton');
    const filtrosStatus = document.querySelectorAll('input[name="filtroStatus"]');
    
    // Elementos do modal scanner
    const barcodeModalElement = document.getElementById('barcodeModal');
    const barcodeInput = document.getElementById('barcode-input');
    const barcodeLoading = document.getElementById('barcode-loading');
    const barcodeSuccess = document.getElementById('barcode-success');
    const barcodeError = document.getElementById('barcode-error');
    const barcodeModal = new bootstrap.Modal(barcodeModalElement);
    
    // Elementos dos contadores
    const countAdequada = document.getElementById('countAdequada');
    const countModerada = document.getElementById('countModerada');
    const countMinima = document.getElementById('countMinima');
    const countVencido = document.getElementById('countVencido');

    let todosLotes = []; // Armazena todos os lotes carregados da API
    let searchTimeout = null; // Para debounce da pesquisa principal
    let barcodeSearchTimeout = null; // Para debounce da pesquisa no modal

    // --- Função para determinar status do lote ---
    function determinarStatusLote(item) {
        const hoje = new Date();
        const validade = new Date(item.validade_lote);
        const quantidade = parseInt(item.quantidade) || 0;
        
        // Verifica se está vencido
        if (validade < hoje) {
            return 'vencido';
        }
        
        // Critérios baseados na quantidade (você pode ajustar estes valores)
        if (quantidade >= 50) {
            return 'adequada';
        } else if (quantidade >= 20) {
            return 'moderada';
        } else {
            return 'minima';
        }
    }

    // --- Função para ordenar lotes (mais recentes primeiro) ---
    function ordenarLotesPorMaisRecentes(lotes) {
        return lotes.sort((a, b) => {
            // Primeiro tenta ordenar por data de entrega
            if (a.data_entrega && b.data_entrega) {
                return new Date(b.data_entrega) - new Date(a.data_entrega);
            }
            // Se não houver data de entrega, ordena por ID se existir
            if (a.id && b.id) {
                return b.id - a.id;
            }
            // Fallback: ordena por código do lote
            if (a.codigo_lote && b.codigo_lote) {
                return b.codigo_lote.localeCompare(a.codigo_lote);
            }
            return 0;
        });
    }

    // --- Função para criar indicador visual de status ---
    function criarIndicadorStatus(status) {
        const indicator = document.createElement('div');
        indicator.classList.add('status-indicator');
        
        switch (status) {
            case 'adequada':
                indicator.innerHTML = '<span class="status-dot dot-adequada"></span>';
                indicator.title = 'Quantidade Adequada';
                break;
            case 'moderada':
                indicator.innerHTML = '<span class="status-dot dot-moderada"></span>';
                indicator.title = 'Quantidade Moderada';
                break;
            case 'minima':
                indicator.innerHTML = '<span class="status-dot dot-minima"></span>';
                indicator.title = 'Quantidade Mínima';
                break;
            case 'vencido':
                indicator.innerHTML = '<span class="status-dot dot-vencido"></span>';
                indicator.title = 'Produto Vencido';
                break;
            default:
                indicator.innerHTML = '<span class="status-dot"></span>';
        }
        
        return indicator;
    }

    // --- Função para atualizar contadores ---
    function atualizarContadores(lotes) {
        const contadores = {
            adequada: 0,
            moderada: 0,
            minima: 0,
            vencido: 0
        };

        lotes.forEach(lote => {
            const status = determinarStatusLote(lote);
            contadores[status]++;
        });

        countAdequada.textContent = contadores.adequada;
        countModerada.textContent = contadores.moderada;
        countMinima.textContent = contadores.minima;
        countVencido.textContent = contadores.vencido;
    }

    // --- Função para renderizar tabela ---
    function renderizarTabela(lotes) {
        tbody.innerHTML = '';
        
        if (lotes && lotes.length > 0) {
            // Ordena os lotes antes de renderizar
            const lotesOrdenados = ordenarLotesPorMaisRecentes([...lotes]);
            
            lotesOrdenados.forEach(item => {
                const tr = document.createElement('tr');
                const status = determinarStatusLote(item);
                
                // Adiciona classe CSS baseada no status
                tr.classList.add(`status-${status}`);
                
                // Formatar datas
                const dataEntrega = item.data_entrega ? 
                    new Date(item.data_entrega).toLocaleDateString('pt-BR') : 'N/A';
                const validade = item.validade_lote ? 
                    new Date(item.validade_lote).toLocaleDateString('pt-BR') : 'N/A';
                
                tr.innerHTML = `
                    <td class="text-center"></td>
                    <td>${item.nome_epi || 'N/A'}</td>
                    <td class="text-center">${item.quantidade || 'N/A'}</td>
                    <td>${dataEntrega}</td>
                    <td>${validade}</td>
                    <td>${item.codigo_lote || 'N/A'}</td>
                    <td>${item.nota_fiscal || 'N/A'}</td>
                    <td>${item.nome_fornecedor || 'N/A'}</td>
                    <td>${item.numero_ca || 'N/A'}</td>
                    <td>${item.observacoes || ''}</td>
                `;
                
                // Adiciona o indicador de status na primeira célula
                const statusTd = tr.querySelector('td:first-child');
                statusTd.appendChild(criarIndicadorStatus(status));
                
                tbody.appendChild(tr);
            });
            
            // Atualiza contadores
            atualizarContadores(lotes);
        } else {
            tbody.innerHTML = '<tr><td colspan="10">Nenhum lote encontrado para os critérios informados.</td></tr>';
            atualizarContadores([]);
        }
    }

    // --- Função para carregar dados da API ---
    async function carregarEstoque() {
        try {
            const response = await get('remessas');
            todosLotes = response.data || response; // Flexibilidade na estrutura da resposta
            renderizarTabela(todosLotes);
            console.log('Remessas carregadas:', todosLotes);
        } catch (error) {
            console.error('Erro ao carregar estoque:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
            tbody.innerHTML = `<tr><td colspan="10">Erro ao carregar dados: ${errorMessage}</td></tr>`;
            atualizarContadores([]);
        }
    }

    // --- Função para filtrar lotes ---
    async function filtrarLotes() {
        const termoPesquisa = searchInput.value.toLowerCase().trim();
        const filtroStatusSelecionado = document.querySelector('input[name="filtroStatus"]:checked').value;
        
        let lotesFiltrados = [...todosLotes];
        
        // Filtro por texto (nome EPI, lote, CA, fornecedor)
        if (termoPesquisa) {
            // Primeiro filtra por campos diretos
            const lotesFiltradosPorTexto = lotesFiltrados.filter(lote => {
                const nomeEpi = (lote.nome_epi || '').toLowerCase();
                const codigoLote = (lote.codigo_lote || '').toLowerCase();
                const numeroCA = (lote.numero_ca || '').toString().toLowerCase();
                const fornecedor = (lote.nome_fornecedor || '').toLowerCase();
                const notaFiscal = (lote.nota_fiscal || '').toLowerCase();
                
                return nomeEpi.includes(termoPesquisa) ||
                       codigoLote.includes(termoPesquisa) ||
                       numeroCA.includes(termoPesquisa) ||
                       fornecedor.includes(termoPesquisa) ||
                       notaFiscal.includes(termoPesquisa);
            });

            // Se o termo pode ser um CA, busca também por CA na API
            let lotesFiltradosPorCA = [];
            let idsModelosDoCA = new Set();
            const termoPodeSerCA = termoPesquisa.startsWith('ca') || /^[0-9]+$/.test(termoPesquisa);

            if (termoPodeSerCA) {
                try {
                    const numeroCaParaBusca = termoPesquisa.startsWith('ca') ? termoPesquisa.substring(2) : termoPesquisa;
                    if (/^[0-9]+$/.test(numeroCaParaBusca)) {
                        const resultadoCA = await get(`ca/numero/${numeroCaParaBusca}`);
                        if (resultadoCA && resultadoCA.success && resultadoCA.data && resultadoCA.data.id_modelo_epi) {
                            idsModelosDoCA.add(resultadoCA.data.id_modelo_epi);
                            // Filtra os lotes que correspondem ao modelo EPI encontrado
                            lotesFiltradosPorCA = todosLotes.filter(lote => 
                                lote.id_modelo_epi && idsModelosDoCA.has(lote.id_modelo_epi)
                            );
                        }
                    }
                } catch (error) {
                    if (!(error.response && error.response.status === 404)) {
                        console.error('Erro ao buscar CA na pesquisa principal:', error);
                    }
                }
            }

            // Combina os resultados de ambas as buscas
            const lotesCombinados = [...lotesFiltradosPorTexto];
            lotesFiltradosPorCA.forEach(loteCA => {
                if (!lotesCombinados.some(l => l.id === loteCA.id)) {
                    lotesCombinados.push(loteCA);
                }
            });

            lotesFiltrados = lotesCombinados;
        }
        
        // Filtro por status
        if (filtroStatusSelecionado !== 'todos') {
            lotesFiltrados = lotesFiltrados.filter(lote => {
                const status = determinarStatusLote(lote);
                return status === filtroStatusSelecionado;
            });
        }
        
        renderizarTabela(lotesFiltrados);
    }

    // --- Lógica do Modal Scanner de CA ---
    function showModalStatus(type, message = '') {
        barcodeLoading.style.display = type === 'loading' ? 'flex' : 'none';
        barcodeSuccess.style.display = type === 'success' ? 'flex' : 'none';
        barcodeError.style.display = type === 'error' ? 'flex' : 'none';
        if (type === 'success') barcodeSuccess.querySelector('span').textContent = message || 'CA encontrado!';
        if (type === 'error') barcodeError.querySelector('span').textContent = message || 'CA não encontrado ou inválido.';
    }

    async function buscarCaNoModal() {
        const termo = barcodeInput.value.trim();
        if (!termo) {
            showModalStatus('none');
            return;
        }

        showModalStatus('loading');
        const termoPodeSerCA = termo.toLowerCase().startsWith('ca') || /^[0-9]+$/.test(termo);
        let caEncontrado = null;

        if (termoPodeSerCA) {
            try {
                const numeroCaParaBusca = termo.toLowerCase().startsWith('ca') ? termo.substring(2) : termo;
                if (/^[0-9]+$/.test(numeroCaParaBusca)) {
                    const resultadoCA = await get(`ca/numero/${numeroCaParaBusca}`);
                    if (resultadoCA && resultadoCA.success && resultadoCA.data && resultadoCA.data.numero_ca) {
                        caEncontrado = resultadoCA.data.numero_ca;
                    }
                }
            } catch (error) {
                if (!(error.response && error.response.status === 404)) {
                    console.error('Erro ao buscar CA no modal:', error);
                }
            }
        }

        if (caEncontrado) {
            showModalStatus('success', `${caEncontrado} encontrado!`);
            searchInput.value = caEncontrado; // Preenche a pesquisa principal
            filtrarLotes(); // Filtra a tabela principal
            setTimeout(() => {
                barcodeModal.hide(); // Fecha o modal após sucesso
            }, 1000); // Fecha após 1 segundo
        } else {
            showModalStatus('error');
        }
    }

    // --- Event Listeners ---
    
    // Pesquisa com debounce
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filtrarLotes, 300);
    });
    
    // Botão limpar pesquisa
    clearSearchButton.addEventListener('click', () => {
        searchInput.value = '';
        filtrarLotes();
    });
    
    // Filtros de status
    filtrosStatus.forEach(radio => {
        radio.addEventListener('change', filtrarLotes);
    });

    // Modal Scanner - Input com debounce
    barcodeInput.addEventListener('input', () => {
        clearTimeout(barcodeSearchTimeout);
        barcodeSearchTimeout = setTimeout(buscarCaNoModal, 500);
    });

    // Limpa o modal quando ele é fechado
    barcodeModalElement.addEventListener('hidden.bs.modal', () => {
        barcodeInput.value = '';
        showModalStatus('none');
    });
    
    // Foca no input quando o modal abre
    barcodeModalElement.addEventListener('shown.bs.modal', () => {
        barcodeInput.focus();
    });

    // --- Inicialização ---
    carregarEstoque();
});