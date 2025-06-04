import { get } from '../../services/api.js';

// Variáveis globais
let allEntregas = [];
let filteredEntregas = [];
let currentPage = 1;
const itemsPerPage = 10;

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    loadEntregas();
    setupEventListeners();
});

// Configurar event listeners
function setupEventListeners() {
    // Enter key no campo de busca
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchEntregas();
        }
    });
    
    // Auto clear on empty input (optional, adjust as needed)
    document.getElementById('searchInput').addEventListener('input', function() {
        if (this.value.trim() === '') {
            // Consider delaying clearSearch or applying filters directly
            // to avoid clearing filters unintentionally while typing
            applyFilters(); // Apply filters immediately on input change
        }
    });

    // Add listeners for filter changes if not using inline onclick
    // document.getElementById('typeFilter').addEventListener('change', filterByType);
    // document.getElementById('startDate').addEventListener('change', filterByDateRange);
    // document.getElementById('endDate').addEventListener('change', filterByDateRange);
}

// Carregar entregas da API
async function loadEntregas() {
    showLoading();
    hideError();
    
    try {
        // Fazendo requisição para o endpoint correto
        const historico = await get('entregas-epi'); // CORREÇÃO: 'get' retorna diretamente o array de dados
        console.log("Dados recebidos da API:", historico);
        
        // Verifica se a resposta é um array
        if (Array.isArray(historico)) {
            allEntregas = historico;
        } else {
            console.warn("API não retornou um array. Recebido:", historico);
            allEntregas = [];
        }
        
        // Ordenar por data mais recente primeiro
        allEntregas.sort((a, b) => {
            // Combina data e hora para ordenação precisa
            const dateA = new Date(`${a.data}T${a.hora || '00:00:00'}`);
            const dateB = new Date(`${b.data}T${b.hora || '00:00:00'}`);
            // Verifica se as datas são válidas antes de subtrair
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
                // Se datas inválidas, pode retornar 0 ou tratar de outra forma
                return 0; 
            }
            return dateB - dateA;
        });
        
        // Aplica filtros iniciais (nenhum filtro por padrão)
        applyFilters(); 
        
    } catch (error) {
        console.error('Erro ao carregar entregas:', error);
        // Tenta mostrar erro da API se disponível
        const apiError = error.response?.data?.error || error.message || 'Erro desconhecido.';
        showError(`Erro ao carregar dados: ${apiError} Verifique a conexão e o console.`);
        allEntregas = [];
        filteredEntregas = [];
        displayEntregas(); // Mostra tabela vazia
        updateRecordsInfo(); // Atualiza info de registros
    } finally {
        hideLoading();
    }
}

// Exibir entregas na tabela
function displayEntregas() {
    const tbody = document.getElementById('historico-tbody');
    
    if (!filteredEntregas || filteredEntregas.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    <i>Nenhuma entrega encontrada com os filtros atuais</i>
                </td>
            </tr>
        `;
        updatePagination(0);
        updateRecordsInfo(); // Atualiza info mesmo se vazio
        return;
    }
    
    // Calcular items para a página atual
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = filteredEntregas.slice(startIndex, endIndex);
    
    tbody.innerHTML = pageItems.map(entrega => {
        // Baseado na estrutura da sua API (Model/Controller)
        const nomeEpi = entrega.nome_epi || 'N/A';
        const funcionario = entrega.nome_funcionario || 'N/A';
        const tipo = entrega.tipo_movimentacao || 'N/A';
        const quantidade = entrega.quantidade || 0;
        const data = formatDate(entrega.data);
        const hora = formatTime(entrega.hora); // Usa função para formatar hora
        const descricao = entrega.descricao || '-';
        
        // Determinar classe e texto do status (CORRIGIDO para 3 tipos)
        const tipoLower = tipo.toLowerCase();
        let statusClass = 'status-outro'; // Default
        let statusText = tipo.toUpperCase(); // Default text

        if (tipoLower.includes('entrega')) {
            statusClass = 'status-entrega';
            statusText = 'ENTREGA';
        } else if (tipoLower.includes('troca')) { // Verifica 'troca' primeiro
            statusClass = 'status-troca';
            statusText = 'TROCA';
        } else if (tipoLower.includes('devolucao')) { // Depois verifica 'devolucao'
            statusClass = 'status-devolucao';
            statusText = 'DEVOLUÇÃO';
        } else {
            // Mantém o texto original se não for nenhum dos tipos esperados
            statusText = tipo.toUpperCase(); 
        }
        
        return `
            <tr>
                <td class="fw-semibold">${nomeEpi}</td>
                <td>${funcionario}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${statusText}
                    </span>
                </td>
                <td class="fw-bold">${Math.abs(quantidade)}</td>
                <td>${data} às ${hora}</td>
                <td class="text-truncate" style="max-width: 200px;" title="${descricao}">
                    ${descricao}
                </td>
            </tr>
        `;
    }).join('');
    
    updatePagination(filteredEntregas.length);
    updateRecordsInfo(); // Atualiza info após exibir
}

// Buscar entregas (agora chama applyFilters)
function searchEntregas() {
    applyFilters(); 
}

// Limpar busca e filtros
function clearSearch() {
    document.getElementById('searchInput').value = '';
    document.getElementById('typeFilter').value = 'todos';
    document.getElementById('startDate').value = '';
    document.getElementById('endDate').value = '';
    
    applyFilters(); // Aplica filtros (que agora resultarão em nenhum filtro)
}

// Filtrar por tipo (agora chama applyFilters)
function filterByType() {
    applyFilters(); 
}

// Filtrar por intervalo de datas (agora chama applyFilters)
function filterByDateRange() {
    applyFilters(); 
}

// Função centralizada para aplicar todos os filtros
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    const typeFilter = document.getElementById('typeFilter').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    let filtered = [...allEntregas];

    // 1. Filtro por termo de busca
    if (searchTerm) {
        filtered = filtered.filter(entrega => {
            const nomeEpi = (entrega.nome_epi || '').toLowerCase();
            const funcionario = (entrega.nome_funcionario || '').toLowerCase();
            const descricao = (entrega.descricao || '').toLowerCase();
            
            return nomeEpi.includes(searchTerm) || 
                   funcionario.includes(searchTerm) || 
                   descricao.includes(searchTerm);
        });
    }

    // 2. Filtro por tipo (CORRIGIDO para incluir 'troca')
    if (typeFilter !== 'todos') {
        filtered = filtered.filter(entrega => {
            const tipoEntrega = (entrega.tipo_movimentacao || '').toLowerCase();
            if (typeFilter === 'entrega') {
                return tipoEntrega.includes('entrega');
            } else if (typeFilter === 'troca') {
                return tipoEntrega.includes('troca');
            } else if (typeFilter === 'devolucao') {
                return tipoEntrega.includes('devolucao');
            }
            return false; // Caso tipo inválido
        });
    }

    // 3. Filtro por data
    if (startDate || endDate) {
        filtered = filterByDateRangeHelper(filtered, startDate, endDate);
    }

    filteredEntregas = filtered;
    currentPage = 1; // Resetar para a primeira página após filtrar
    displayEntregas();
    // updateRecordsInfo já é chamado dentro de displayEntregas
}

// Helper para filtro de data (mantido)
function filterByDateRangeHelper(entregas, startDate, endDate) {
    if (!startDate && !endDate) return entregas;
    
    const start = startDate ? new Date(startDate + 'T00:00:00') : null;
    const end = endDate ? new Date(endDate + 'T23:59:59') : null;

    // Validação das datas de filtro
    if ((start && isNaN(start.getTime())) || (end && isNaN(end.getTime()))) {
        console.warn("Datas de filtro inválidas.");
        return entregas; // Retorna sem filtrar se as datas forem inválidas
    }

    return entregas.filter(entrega => {
        const entregaDateStr = entrega.data;
        if (!entregaDateStr) return false; // Não inclui registros sem data no filtro de data
        
        try {
            // Cria o objeto Date diretamente da string ISO 8601 (UTC)
            const entregaDate = new Date(entregaDateStr);
            if (isNaN(entregaDate.getTime())) return false; // Ignora datas inválidas nos dados

            // Compara as datas (considerando apenas a parte da data, ignorando a hora para o filtro)
            const entregaDateOnly = new Date(entregaDate.getFullYear(), entregaDate.getMonth(), entregaDate.getDate());

            if (start && end) {
                return entregaDateOnly >= start && entregaDateOnly <= end;
            } else if (start) {
                return entregaDateOnly >= start;
            } else if (end) {
                return entregaDateOnly <= end;
            }
        } catch (e) {
            console.error("Erro ao parsear data da entrega:", entregaDateStr, e);
            return false;
        }
        
        return true; // Caso não haja filtro de data
    });
}

// Recarregar dados
async function reloadData() {
    const reloadIcon = document.getElementById('reloadIcon');
    reloadIcon.classList.add('spinning');
    
    // Limpa filtros antes de recarregar
    clearSearch(); 
    
    await loadEntregas(); // loadEntregas já chama applyFilters e displayEntregas
    
    // Remove o spin após um tempo (mesmo se loadEntregas falhar)
    setTimeout(() => {
        reloadIcon.classList.remove('spinning');
    }, 500); 
}

// Exportar para CSV (mantido, mas com aspas em todos os campos string)
function exportToCSV() {
    if (!filteredEntregas || filteredEntregas.length === 0) {
        alert('Não há dados para exportar.');
        return;
    }
    
    const headers = ['Nome do EPI', 'Funcionário', 'Tipo', 'Quantidade', 'Data', 'Hora', 'Descrição'];
    
    // Função auxiliar para escapar aspas duplas dentro dos campos
    const escapeCSV = (field) => {
        const str = String(field === null || field === undefined ? '' : field);
        // Escapa aspas duplas duplicando-as e envolve o campo em aspas
        return `"${str.replace(/"/g, '""')}"`;
    };

    const csvRows = filteredEntregas.map(entrega => {
        // Determinar o texto do status para o CSV (igual à lógica de exibição)
        const tipo = entrega.tipo_movimentacao || 'N/A';
        const tipoLower = tipo.toLowerCase();
        let statusText = tipo.toUpperCase(); // Default text
        if (tipoLower.includes('entrega')) {
            statusText = 'ENTREGA';
        } else if (tipoLower.includes('troca')) {
            statusText = 'TROCA';
        } else if (tipoLower.includes('devolucao')) {
            statusText = 'DEVOLUÇÃO';
        } else {
            statusText = tipo.toUpperCase();
        }

        return [
            escapeCSV(entrega.nome_epi),
            escapeCSV(entrega.nome_funcionario),
            escapeCSV(statusText), // Usa o statusText formatado
            escapeCSV(Math.abs(entrega.quantidade || 0)),
            escapeCSV(formatDate(entrega.data)),
            escapeCSV(formatTime(entrega.hora)),
            escapeCSV(entrega.descricao)
        ].join(',');
    });

    const csvContent = [
        headers.join(','),
        ...csvRows
    ].join('\n');
    
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); // Adiciona BOM para Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `historico-entregas-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Libera memória
}

// Paginação
function updatePagination(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const pagination = document.getElementById('pagination');
    
    if (totalPages <= 1) {
        pagination.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    const maxPagesToShow = 5; // Número máximo de botões de página visíveis
    let startPage, endPage;

    if (totalPages <= maxPagesToShow) {
        // Mostra todas as páginas
        startPage = 1;
        endPage = totalPages;
    } else {
        // Calcula início e fim para centralizar a página atual
        const maxPagesBeforeCurrent = Math.floor(maxPagesToShow / 2);
        const maxPagesAfterCurrent = Math.ceil(maxPagesToShow / 2) - 1;
        if (currentPage <= maxPagesBeforeCurrent) {
            startPage = 1;
            endPage = maxPagesToShow;
        } else if (currentPage + maxPagesAfterCurrent >= totalPages) {
            startPage = totalPages - maxPagesToShow + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - maxPagesBeforeCurrent;
            endPage = currentPage + maxPagesAfterCurrent;
        }
    }

    // Botão anterior
    paginationHTML += `
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <a class="page-link" href="#" ${currentPage > 1 ? `onclick="event.preventDefault(); goToPage(${currentPage - 1})"` : ''}>
                ‹ Anterior
            </a>
        </li>
    `;
    
    // Ellipsis inicial
    if (startPage > 1) {
        paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="event.preventDefault(); goToPage(1)">1</a></li>`;
        if (startPage > 2) {
            paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
    }
    
    // Páginas numeradas
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <li class="page-item ${i === currentPage ? 'active' : ''}">
                <a class="page-link" href="#" onclick="event.preventDefault(); goToPage(${i})">${i}</a>
            </li>
        `;
    }
    
    // Ellipsis final
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
        }
        paginationHTML += `<li class="page-item"><a class="page-link" href="#" onclick="event.preventDefault(); goToPage(${totalPages})">${totalPages}</a></li>`;
    }
    
    // Botão próximo
    paginationHTML += `
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <a class="page-link" href="#" ${currentPage < totalPages ? `onclick="event.preventDefault(); goToPage(${currentPage + 1})"` : ''}>
                Próximo ›
            </a>
        </li>
    `;
    
    pagination.innerHTML = paginationHTML;
}

// Ir para página específica
function goToPage(page) {
    const totalPages = Math.ceil(filteredEntregas.length / itemsPerPage);
    if (page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        displayEntregas();
        // Opcional: rolar para o topo da tabela
        // document.querySelector('.table-responsive')?.scrollIntoView({ behavior: 'smooth' });
    }
}

// Atualizar informações de registros
function updateRecordsInfo() {
    const recordsInfo = document.getElementById('recordsInfo');
    const total = filteredEntregas.length;
    const startIndex = total === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, total);
    
    if (total === 0) {
        recordsInfo.textContent = 'Nenhum registro encontrado';
    } else {
        recordsInfo.textContent = `Mostrando ${startIndex} a ${endIndex} de ${total} registros`;
    }
}

// Utilitários
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        // Tenta criar a data a partir da string ISO 8601 (UTC)
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'Data Inválida';
        }
        // Formata para DD/MM/YYYY no fuso horário local
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Mês é 0-indexado
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (error) {
        console.error("Erro ao formatar data:", dateString, error);
        return 'Data Inválida';
    }
}

function formatTime(timeString) {
    if (!timeString || typeof timeString !== 'string' || !timeString.includes(':')) return 'N/A';
    try {
        // Assume HH:MM:SS ou HH:MM e extrai HH:MM
        const parts = timeString.split(':');
        if (parts.length >= 2) {
            const hour = parts[0].padStart(2, '0');
            const minute = parts[1].padStart(2, '0');
            return `${hour}:${minute}`;
        }
        return 'Hora Inválida';
    } catch (error) {
        console.error("Erro ao formatar hora:", timeString, error);
        return 'Hora Inválida';
    }
}

function showLoading() {
    document.getElementById('loading')?.classList.remove('d-none');
}

function hideLoading() {
    document.getElementById('loading')?.classList.add('d-none');
}

function showError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if(errorDiv) {
        errorDiv.textContent = message;
        errorDiv.classList.remove('d-none');
    }
}

function hideError() {
    const errorDiv = document.getElementById('errorMessage');
     if(errorDiv) {
        errorDiv.classList.add('d-none');
     }
}

// Expor funções globais necessárias para os event handlers inline no HTML
window.searchEntregas = searchEntregas;
window.clearSearch = clearSearch;
window.filterByType = filterByType;
window.filterByDateRange = filterByDateRange;
window.reloadData = reloadData;
window.exportToCSV = exportToCSV;
window.goToPage = goToPage;

