import { get } from '../../services/api.js';

const tabela = document.getElementById('tabela-estoque');

async function carregarEstoque() {
    try {
        const response = await get('remessas');
        // response já é o objeto com success e data
        const estoque = response.data; // aqui está o array de remessas
        
        tabela.innerHTML = '';
        console.log(estoque);
        
        estoque.forEach(item => {
            const row = `
                <tr>
                    <td>${item.nome_epi}</td>
                    <td>${item.quantidade}</td>
                    <td>${new Date(item.data_entrega).toLocaleDateString()}</td>
                    <td>${new Date(item.validade_lote).toLocaleDateString()}</td>
                    <td>${item.codigo_lote}</td>
                    <td>${item.nota_fiscal}</td>
                    <td>${item.nome_fornecedor}</td>
                    <td>${item.numero_ca}</td>
                    <td>${item.observacoes || ''}</td>
                </tr>
            `;
            tabela.innerHTML += row;
        });
        
        console.log('Remessas carregadas:', estoque);
    } catch (error) {
        console.error('Erro ao carregar estoque:', error);
        alert('Erro ao carregar estoque!');
    }
}

// Chama ao abrir
carregarEstoque();