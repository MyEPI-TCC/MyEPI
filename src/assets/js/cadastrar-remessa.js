import { get, post } from '../../services/api.js'; // Ajuste o caminho se necessário

// Referências aos elementos do formulário
const form = document.getElementById('form-cadastro-remessa');
const codigoLoteInput = document.getElementById('codigo_lote');
const quantidadeInput = document.getElementById('quantidade');
const modeloEpiSelect = document.getElementById('id_modelo_epi');
const caSelect = document.getElementById('id_ca');
const dataEntregaInput = document.getElementById('data_entrega');
const validadeLoteInput = document.getElementById('validade_lote');
const notaFiscalInput = document.getElementById('nota_fiscal');
const fornecedorSelect = document.getElementById('id_fornecedor');
const observacoesInput = document.getElementById('observacoes');

// Função genérica para popular selects (versão atualizada)
async function popularSelect(selectElement, endpoint, valueField, textField) {
    try {
        const response = await get(endpoint); // Chama a função get do seu api.js

        // Verifica se a resposta tem a propriedade 'data' (estrutura esperada) 
        // ou se é diretamente um array
        const items = Array.isArray(response) ? response : response?.data;

        if (!items || !Array.isArray(items) || items.length === 0) {
            console.warn(`Nenhum item encontrado ou formato inesperado para ${endpoint}`);
            selectElement.innerHTML = `<option value="" selected disabled>Nenhum item encontrado</option>`;
            return;
        }

        selectElement.innerHTML = `<option value="" selected disabled>Selecione...</option>`; // Opção padrão

        items.forEach(item => {
            const option = document.createElement('option');
            // Garante que os campos existem no item antes de tentar acessá-los
            option.value = item.hasOwnProperty(valueField) ? item[valueField] : '';
            option.textContent = item.hasOwnProperty(textField) ? item[textField] : 'Texto inválido';
            if (option.value) { // Só adiciona se tiver um valor válido
                selectElement.appendChild(option);
            }
        });

    } catch (error) {
        console.error(`Erro ao carregar ${endpoint}:`, error);
        selectElement.innerHTML = `<option value="" selected disabled>Erro ao carregar</option>`;
    }
}


// Função para carregar todos os dados dos selects ao iniciar a página
async function carregarDadosIniciais() {
    // Usar Promise.all para carregar em paralelo
    await Promise.all([
        popularSelect(fornecedorSelect, 'fornecedores', 'id_fornecedor', 'nome_fornecedor'), // Para fornecedores
        popularSelect(modeloEpiSelect, 'modelos-epi', 'id_modelo_epi', 'nome_epi'),        // Para Modelos EPI
        popularSelect(caSelect, 'ca', 'id_ca', 'numero_ca')                             // Para CAs
    ]);
}

// Event listener para o envio do formulário
form.addEventListener('submit', async (event) => {
    event.preventDefault(); // Impede o envio padrão do formulário

    // Coleta os dados do formulário
    const remessaData = {
        codigo_lote: codigoLoteInput.value,
        quantidade: parseInt(quantidadeInput.value, 10),
        id_modelo_epi: parseInt(modeloEpiSelect.value, 10),
        id_ca: parseInt(caSelect.value, 10),
        data_entrega: dataEntregaInput.value,
        validade_lote: validadeLoteInput.value,
        nota_fiscal: notaFiscalInput.value,
        id_fornecedor: parseInt(fornecedorSelect.value, 10),
        observacoes: observacoesInput.value || null // Envia null se vazio
    };

    // Validação simples (campos required já são validados pelo HTML)
    if (!remessaData.codigo_lote || isNaN(remessaData.quantidade) || isNaN(remessaData.id_modelo_epi) || isNaN(remessaData.id_ca) || isNaN(remessaData.id_fornecedor) || !remessaData.data_entrega || !remessaData.validade_lote || !remessaData.nota_fiscal) {
        alert('Por favor, preencha todos os campos obrigatórios corretamente.');
        return;
    }

    try {
        // Envia os dados para a API
        const response = await post('remessas', remessaData);

        // Verifica a resposta da API (ajuste conforme a estrutura real da sua resposta de POST)
        if (response.success) { // Assumindo que a API retorna { success: true, ... } em caso de sucesso
            form.reset(); // Limpa o formulário
            window.location.href = 'confirmacao-estoque.html';
        } else {
            // Se a API retornar success: false ou outra estrutura de erro
            alert(`Erro ao cadastrar remessa: ${response.message || 'Erro desconhecido retornado pela API.'}`);
        }
    } catch (error) {
        console.error('Erro ao cadastrar remessa:', error);
        const errorMessage = error.response?.data?.message || error.message || 'Erro de comunicação com a API.';
        alert(`Erro ao cadastrar remessa: ${errorMessage}`);
    }
});

// Carrega os dados iniciais (fornecedores, modelos, CAs) quando o script é executado
carregarDadosIniciais();

