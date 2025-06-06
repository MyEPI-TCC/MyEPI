// modelos-epi.js
// Importa as funções do seu arquivo api.js
import { get, deleteRequest } from '../../services/api.js'; // <-- Ajuste este caminho se necessário

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('modelos-epi-tbody');
    const searchInput = document.getElementById('pesquisaEpi');
    const barcodeModalElement = document.getElementById('barcodeModal');
    const barcodeInput = document.getElementById('barcode-input');
    const barcodeLoading = document.getElementById('barcode-loading');
    const barcodeSuccess = document.getElementById('barcode-success');
    const barcodeError = document.getElementById('barcode-error');
    const barcodeModal = new bootstrap.Modal(barcodeModalElement); // Instancia o modal do Bootstrap

    let todosModelos = []; // Armazena todos os modelos carregados da API
    let modelosCAs = {}; // Armazena os CAs por modelo
    let searchTimeout = null; // Para debounce da pesquisa principal
    let barcodeSearchTimeout = null; // Para debounce da pesquisa no modal

    // --- Função para ordenar modelos (mais recentes primeiro) ---
    function ordenarModelosPorMaisRecentes(modelos) {
        return modelos.sort((a, b) => {
            // Primeiro tenta ordenar por data de criação se existir
            if (a.created_at && b.created_at) {
                return new Date(b.created_at) - new Date(a.created_at);
            }
            // Se não houver data, ordena por ID (assumindo que IDs maiores são mais recentes)
            if (a.id_modelo_epi && b.id_modelo_epi) {
                return b.id_modelo_epi - a.id_modelo_epi;
            }
            // Se não houver nem data nem ID, mantém ordem original
            return 0;
        });
    }

    // --- Funções para buscar CAs por modelo ---
    async function buscarCasPorModelo(idModelo) {
        try {
            const resultado = await get(`ca/modelo/${idModelo}`);
            if (resultado && resultado.success && resultado.data && resultado.data.length > 0) {
                return resultado.data;
            }
            return [];
        } catch (error) {
            console.error(`Erro ao buscar CAs para o modelo ${idModelo}:`, error);
            return [];
        }
    }

    async function carregarCAsParaModelos(modelos) {
        const promessas = modelos.map(async (modelo) => {
            if (!modelosCAs[modelo.id_modelo_epi]) {
                const cas = await buscarCasPorModelo(modelo.id_modelo_epi);
                modelosCAs[modelo.id_modelo_epi] = cas;
            }
        });
        
        await Promise.all(promessas);
    }

    function formatarCAs(idModelo) {
        if (!modelosCAs[idModelo] || modelosCAs[idModelo].length === 0) {
            return 'N/A';
        }
        
        // Ordenar CAs por validade (mais recente primeiro)
        const casOrdenados = [...modelosCAs[idModelo]].sort((a, b) => {
            if (a.validade_ca && b.validade_ca) {
                return new Date(b.validade_ca) - new Date(a.validade_ca);
            }
            return 0;
        });
        
        // Pegar o CA mais recente
        const caMaisRecente = casOrdenados[0];
        
        // Formatar a data de validade
        const dataValidade = caMaisRecente.validade_ca ? 
            new Date(caMaisRecente.validade_ca).toLocaleDateString('pt-BR') : 
            'N/A';
        
        // Verificar se o CA está ativo
        const ativo = caMaisRecente.ativo ? 
            '<span class="badge bg-success">Ativo</span>' : 
            '<span class="badge bg-danger">Inativo</span>';
        
        return `<div>
            <strong>${caMaisRecente.numero_ca}</strong>
            <div class="small">Val: ${dataValidade} ${ativo}</div>
        </div>`;
    }

    // --- Funções de Renderização e Carregamento da Tabela --- 

    function renderizarTabela(modelos) {
        tbody.innerHTML = ''; 
        if (modelos && modelos.length > 0) {
            // Ordena os modelos antes de renderizar
            const modelosOrdenados = ordenarModelosPorMaisRecentes([...modelos]);
            
            modelosOrdenados.forEach(modelo => {
                const tr = document.createElement('tr');
                const descartavelIcon = modelo.descartavel ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="fas fa-times-circle text-danger"></i>';
                const rastreavelIcon = modelo.rastreavel ? '<i class="fas fa-check-circle text-success"></i>' : '<i class="fas fa-times-circle text-danger"></i>';
                
                // Célula da Foto
                const fotoTd = document.createElement('td');
                const fotoContainer = document.createElement('div');
                fotoContainer.classList.add('epi-photo-container');
                if (modelo.foto_epi_url) {
                    const img = document.createElement('img');
                    img.src = modelo.foto_epi_url;
                    img.alt = `Foto ${modelo.nome_epi || 'EPI'}`;
                    img.classList.add('epi-photo');
                    img.onerror = () => img.replaceWith(criarPlaceholderFoto());
                    fotoContainer.appendChild(img);
                } else {
                    fotoContainer.appendChild(criarPlaceholderFoto());
                }
                fotoTd.appendChild(fotoContainer);
                tr.appendChild(fotoTd);

                // Outras Células
                tr.innerHTML += `
                    <td>${modelo.nome_epi || 'N/A'}</td>
                    <td>${modelo.nome_marca || 'N/A'}</td>
                    <td>${modelo.nome_categoria || 'N/A'}</td>
                    <td>${formatarCAs(modelo.id_modelo_epi)}</td>
                    <td>${modelo.quantidade !== null ? modelo.quantidade : 'N/A'}</td>
                    <td class="text-center">${descartavelIcon}</td>
                    <td class="text-center">${rastreavelIcon}</td>
                    <td>${modelo.descricao_epi || 'N/A'}</td>
                `;

                // Célula de Ações
                const tdAcoes = document.createElement('td');
                tdAcoes.innerHTML = `
                  <div style="display: flex; justify-content: center; gap: 5px;">
                    <a href="cadastrar-epi.html?id=${modelo.id_modelo_epi}" 
                       class="action-btn edit-btn btn btn-sm btn-warning" title="Editar">
                      <i class="fas fa-edit"></i>
                    </a>
                    <button class="action-btn delete-btn btn btn-sm btn-danger" 
                            data-id="${modelo.id_modelo_epi}" 
                            title="Excluir">
                      <i class="fas fa-trash-alt"></i>
                    </button>
                  </div>
                `;
                tr.appendChild(tdAcoes);
                tbody.appendChild(tr);
            });
            adicionarEventListenersBotoesExcluir();
        } else {
            tbody.innerHTML = '<tr><td colspan="10">Nenhum modelo de EPI encontrado para os critérios informados.</td></tr>';
        }
    }

    async function carregarModelosEpi() {
        try {
            const modelosCarregados = await get('modelos-epi');
            // Ordena os modelos logo após carregar da API
            todosModelos = ordenarModelosPorMaisRecentes(modelosCarregados);
            
            // Buscar CAs para todos os modelos
            await carregarCAsParaModelos(todosModelos);
            
            renderizarTabela(todosModelos);
        } catch (error) {
            console.error('Erro ao carregar modelos de EPI:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
            tbody.innerHTML = `<tr><td colspan="10">Erro ao carregar dados: ${errorMessage}</td></tr>`;
        }
    }

    function criarPlaceholderFoto() {
        const placeholder = document.createElement('div');
        placeholder.classList.add('epi-placeholder');
        placeholder.innerHTML = '<i class="fas fa-image"></i>';
        return placeholder;
    }

    // --- Lógica de Pesquisa Principal (Nome ou CA) --- 

    async function filtrarModelos() {
        const termoPesquisa = searchInput.value.toLowerCase().trim();
        if (!termoPesquisa) {
            renderizarTabela(todosModelos);
            return;
        }

        const modelosFiltradosPorNome = todosModelos.filter(modelo => 
            (modelo.nome_epi || '').toLowerCase().includes(termoPesquisa)
        );

        let modelosFiltradosPorCA = [];
        let idsModelosDoCA = new Set();
        const termoPodeSerCA = termoPesquisa.startsWith('ca') || /^[0-9]+$/.test(termoPesquisa);

        if (termoPodeSerCA) {
            try {
                const numeroCaParaBusca = termoPesquisa.startsWith('ca') ? termoPesquisa.substring(2) : termoPesquisa;
                if (/^[0-9]+$/.test(numeroCaParaBusca)) {
                    const resultadoCA = await get(`ca/numero/${numeroCaParaBusca}`);
                    if (resultadoCA && resultadoCA.success && resultadoCA.data && resultadoCA.data.id_modelo_epi) {
                        idsModelosDoCA.add(resultadoCA.data.id_modelo_epi);
                    }
                }
            } catch (error) {
                if (!(error.response && error.response.status === 404)) {
                    console.error('Erro ao buscar CA na pesquisa principal:', error);
                }
            }
        }

        if (idsModelosDoCA.size > 0) {
            modelosFiltradosPorCA = todosModelos.filter(modelo => idsModelosDoCA.has(modelo.id_modelo_epi));
        }

        const modelosCombinados = [...modelosFiltradosPorNome];
        modelosFiltradosPorCA.forEach(modeloCA => {
            if (!modelosCombinados.some(m => m.id_modelo_epi === modeloCA.id_modelo_epi)) {
                modelosCombinados.push(modeloCA);
            }
        });

        // Aplica ordenação também nos resultados filtrados
        renderizarTabela(modelosCombinados);
    }

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(filtrarModelos, 300);
    });

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
                        caEncontrado = resultadoCA.data.numero_ca; // Guarda o número do CA encontrado
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
            filtrarModelos(); // Filtra a tabela principal
            setTimeout(() => {
                barcodeModal.hide(); // Fecha o modal após sucesso
            }, 1000); // Fecha após 1 segundo
        } else {
            showModalStatus('error');
        }
    }

    barcodeInput.addEventListener('input', () => {
        clearTimeout(barcodeSearchTimeout);
        barcodeSearchTimeout = setTimeout(buscarCaNoModal, 500); // Debounce maior para digitação/scan
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

    // --- Lógica de Exclusão --- 

    function adicionarEventListenersBotoesExcluir() {
        document.querySelectorAll('.delete-btn').forEach(button => {
            const clone = button.cloneNode(true);
            button.parentNode.replaceChild(clone, button);
            clone.addEventListener('click', async (event) => {
                const id = event.currentTarget.getAttribute('data-id');
                const confirmar = confirm(`Tem certeza que deseja excluir o modelo de EPI com ID ${id}?`);
                if (confirmar) {
                    try {
                        const result = await deleteRequest(`modelos-epi/${id}`);
                        alert(result.message || `Modelo de EPI com ID ${id} excluído com sucesso!`);
                        await carregarModelosEpi();
                        filtrarModelos(); // Reaplicar filtro
                    } catch (error) {
                        console.error(`Erro ao excluir modelo de EPI com ID ${id}:`, error);
                        const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido';
                        alert(`Erro ao excluir modelo: ${errorMessage}`);
                    }
                }
            });
        });
    }

    // --- Inicialização --- 
    carregarModelosEpi();
});

