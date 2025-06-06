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
    // const countVencido = document.getElementById('countVencido'); // Removido se não houver validade

    let todosLotes = []; // Armazena todos os lotes carregados da API
    let searchTimeout = null; // Para debounce da pesquisa principal
    let barcodeSearchTimeout = null; // Para debounce da pesquisa no modal

    // --- Função para determinar status do lote ---
    // Ajustado para usar apenas quantidade, já que validade_lote não está no JSON de exemplo
    function determinarStatusLote(item) {
        const quantidade = parseInt(item.quantidade_estoque) || 0;
        
        // Critérios baseados na quantidade (você pode ajustar estes valores)
        if (quantidade >= 50) {
            return 'adequada';
        } else if (quantidade >= 20) {
            return 'moderada';
        } else {
            return 'minima';
        }
        // Se a validade não for um campo retornado, a lógica 'vencido' não se aplica aqui
        // return 'vencido'; // Removido
    }

    // --- Função para ordenar lotes (mais recentes primeiro) ---
    // Ajustado para não depender de data_entrega, já que não está no JSON de exemplo
    function ordenarLotesPorMaisRecentes(lotes) {
        return lotes.sort((a, b) => {
            // Se não houver data de entrega, ordena por ID se existir
            if (a.id_estoque_lote && b.id_estoque_lote) { // Usando id_estoque_lote
                return b.id_estoque_lote - a.id_estoque_lote;
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
            // case 'vencido': // Removido se não houver validade
            //     indicator.innerHTML = '<span class="status-dot dot-vencido"></span>';
            //     indicator.title = 'Produto Vencido';
            //     break;
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
            // vencido: 0 // Removido
        };

        lotes.forEach(lote => {
            const status = determinarStatusLote(lote);
            contadores[status]++;
        });

        countAdequada.textContent = contadores.adequada;
        countModerada.textContent = contadores.moderada;
        countMinima.textContent = contadores.minima;
        // countVencido.textContent = contadores.vencido; // Removido
    }

    // --- Função para renderizar tabela ---
    // Ajustado para as colunas presentes no JSON de exemplo
    function renderizarTabela(lotes) {
        tbody.innerHTML = '';
        
        if (lotes && lotes.length > 0) {
            // CORREÇÃO AQUI: Removido o 's' extra do nome da função
            const lotesOrdenados = ordenarLotesPorMaisRecentes([...lotes]); 
            
            lotesOrdenados.forEach(item => {
                const tr = document.createElement('tr');
                const status = determinarStatusLote(item);
                
                // Adiciona classe CSS baseada no status
                tr.classList.add(`status-${status}`);
                
                tr.innerHTML = `
                    <td class="text-center"></td>
                    <td>${item.nome_epi || 'N/A'}</td>
                    <td class="text-center">${item.quantidade_estoque || '0'}</td>
                    <td>${item.codigo_lote || 'N/A'}</td>
                    <td>${item.nota_fiscal || 'N/A'}</td>
                    <td>${item.nome_fornecedor || 'N/A'}</td>
                `;
                
                // Adiciona o indicador de status na primeira célula
                const statusTd = tr.querySelector('td:first-child');
                statusTd.appendChild(criarIndicadorStatus(status));
                
                tbody.appendChild(tr);
            });
            
            // Atualiza contadores
            atualizarContadores(lotes);
        } else {
            tbody.innerHTML = '<tr><td colspan="6">Nenhum lote encontrado para os critérios informados.</td></tr>'; // Colspan ajustado
            atualizarContadores([]);
        }
    }

    // --- Função para carregar dados da API ---
    async function carregarEstoque() {
        try {
            const response = await get('estoques');
            // Assume que a resposta da API é um array de objetos de lote
            todosLotes = response.data || response; 
            renderizarTabela(todosLotes);
            console.log('Lotes carregados:', todosLotes);
        } catch (error) {
            console.error('Erro ao carregar estoque:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
            tbody.innerHTML = `<tr><td colspan="6">Erro ao carregar dados: ${errorMessage}</td></tr>`; // Colspan ajustado
            atualizarContadores([]);
        }
    }

    // --- Função para filtrar lotes ---
    // Ajustado para pesquisar apenas pelos campos disponíveis no JSON de exemplo
    async function filtrarLotes() {
        const termoPesquisa = searchInput.value.toLowerCase().trim();
        const filtroStatusSelecionado = document.querySelector('input[name="filtroStatus"]:checked').value;
        
        let lotesFiltrados = [...todosLotes];
        
        // Filtro por texto (nome EPI, lote, fornecedor, nota fiscal)
        if (termoPesquisa) {
            lotesFiltrados = lotesFiltrados.filter(lote => {
                const nomeEpi = (lote.nome_epi || '').toLowerCase();
                const codigoLote = (lote.codigo_lote || '').toLowerCase();
                const fornecedor = (lote.nome_fornecedor || '').toLowerCase();
                const notaFiscal = (lote.nota_fiscal || '').toLowerCase();
                
                return nomeEpi.includes(termoPesquisa) ||
                       codigoLote.includes(termoPesquisa) ||
                       fornecedor.includes(termoPesquisa) ||
                       notaFiscal.includes(termoPesquisa);
            });
            // Removida a lógica de busca por CA na API, já que não está na sua resposta de endpoint principal
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
    // Mantido o modal, mas a busca por CA será apenas na lista de lotes se o CA não vier no JSON
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
        
        // Como o CA não está sendo retornado no JSON de "estoques",
        // esta funcionalidade se torna limitada a uma busca que não tem dados para comparar.
        // Se o CA for um campo da API (ex: um endpoint /ca/numero/{numero}),
        // você precisaria que esse endpoint retornasse o id_modelo_epi ou algo que ligasse ao lote.
        // Por enquanto, esta parte não terá um efeito direto na filtragem da tabela
        // se o CA não for um campo nos seus objetos 'lote'.

        // Mantenho a estrutura para que, se você adicionar 'numero_ca' aos seus objetos 'lote'
        // no futuro, a lógica de preenchimento do searchInput funcione.
        let caEncontradoNaBusca = false;
        if (termo) {
            // Simulando a busca em 'todosLotes' se o 'numero_ca' estivesse presente
            const loteComCa = todosLotes.find(lote => 
                (lote.numero_ca && lote.numero_ca.toString().toLowerCase() === termo.toLowerCase()) ||
                (termo.toLowerCase().startsWith('ca') && lote.numero_ca && lote.numero_ca.toString().toLowerCase() === termo.substring(2).toLowerCase())
            );

            if (loteComCa) {
                caEncontradoNaBusca = true;
                // Exemplo: se encontrasse, preencheria o campo de pesquisa principal
                searchInput.value = loteComCa.numero_ca || termo; // Prefere o CA do lote, se existir
            }
        }
        

        if (caEncontradoNaBusca) {
            showModalStatus('success', `${termo} encontrado!`);
            filtrarLotes(); // Filtra a tabela principal com o CA preenchido
            setTimeout(() => {
                barcodeModal.hide(); // Fecha o modal após sucesso
            }, 1000);
        } else {
            showModalStatus('error', `CA "${termo}" não encontrado ou inválido.`);
            // A busca principal também é atualizada para este CA, mesmo que não tenha encontrado um lote direto
            // Isso permite que o usuário veja que a pesquisa foi aplicada
            searchInput.value = termo;
            filtrarLotes();
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