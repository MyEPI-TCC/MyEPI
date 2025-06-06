// Variáveis globais
let funcionariosData = [];
let funcionarioIdParaExcluir = null;

// const API_BASE_URL = 'http://localhost:3000/api';
// const UPLOADS_BASE_URL = 'http://localhost:3000/uploads';

const API_BASE_URL = 'https://my-epi-api.vercel.app/api';
const UPLOADS_BASE_URL = 'https://my-epi-api.vercel.app/uploads';

// Elementos DOM
let confirmacaoExclusaoModal;
const tabelaFuncionarios = document.getElementById('tabelaFuncionarios');

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
  confirmacaoExclusaoModal = new bootstrap.Modal(document.getElementById('confirmacaoExclusaoModal'));
  document.getElementById('btnConfirmarExclusao').addEventListener('click', confirmarExclusao);
  inicializar();
});

// Inicialização
async function inicializar() {
  try {
    await carregarFuncionarios();
  } catch (error) {
    exibirMensagem('Erro ao carregar dados: ' + error.message, 'danger');
  }
}

// Carregar e ordenar funcionários (mais recentes primeiro)
async function carregarFuncionarios() {
  try {
    const response = await axios.get(`${API_BASE_URL}/funcionarios`);
    funcionariosData = response.data;

    // Ordenar por ID decrescente (mais novos primeiro)
    funcionariosData.sort((a, b) => b.id_funcionario - a.id_funcionario);

    renderizarTabelaFuncionarios();
  } catch (error) {
    console.error('Erro ao carregar funcionários:', error);
    throw error;
  }
}

// Obter iniciais do nome
function obterIniciais(nome, sobrenome) {
  const primeiraLetra = nome?.charAt(0).toUpperCase() || '';
  const segundaLetra = sobrenome?.charAt(0).toUpperCase() || '';
  return primeiraLetra + segundaLetra;
}

// Renderizar tabela
function renderizarTabelaFuncionarios() {
  const tbody = tabelaFuncionarios.querySelector('tbody');
  tbody.innerHTML = '';

  if (funcionariosData.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="7" class="text-center">Nenhum funcionário cadastrado</td>';
    tbody.appendChild(tr);
    return;
  }

  funcionariosData.forEach(funcionario => {
    const iniciais = obterIniciais(funcionario.nome_funcionario, funcionario.sobrenome_funcionario);
    
    // Criar elemento de linha
    const tr = document.createElement('tr');
    
    // Criar célula da foto
    const tdFoto = document.createElement('td');
    const fotoContainer = document.createElement('div');
    fotoContainer.className = 'foto-container';
    
    // Verificar se tem foto
    if (funcionario.foto_perfil_path && funcionario.foto_perfil_path.trim() !== '') {
      const fotoUrl = `${UPLOADS_BASE_URL}/${funcionario.foto_perfil_path}`;
      
      // Criar elemento de imagem
      const img = document.createElement('img');
      img.src = fotoUrl;
      img.alt = `Foto de ${funcionario.nome_funcionario}`;
      img.className = 'foto-funcionario';
      
      // Se a imagem falhar ao carregar, mostrar iniciais
      img.onerror = function() {
        this.style.display = 'none';
        const iniciaisDiv = document.createElement('div');
        iniciaisDiv.className = 'foto-iniciais';
        iniciaisDiv.textContent = iniciais;
        fotoContainer.appendChild(iniciaisDiv);
      };
      
      fotoContainer.appendChild(img);
    } else {
      // Sem foto - mostrar iniciais
      const iniciaisDiv = document.createElement('div');
      iniciaisDiv.className = 'foto-iniciais';
      iniciaisDiv.textContent = iniciais;
      fotoContainer.appendChild(iniciaisDiv);
    }
    
    // Adicionar container da foto à célula
    tdFoto.appendChild(fotoContainer);
    
    // Criar outras células
    const tdNome = document.createElement('td');
    tdNome.textContent = funcionario.nome_funcionario || '';
    
    const tdSobrenome = document.createElement('td');
    tdSobrenome.textContent = funcionario.sobrenome_funcionario || '';
    
    const tdMatricula = document.createElement('td');
    tdMatricula.textContent = funcionario.numero_matricula || '';
    
    const tdCargo = document.createElement('td');
    tdCargo.textContent = funcionario.nome_cargo || '';
    
    const tdTipoSanguineo = document.createElement('td');
    tdTipoSanguineo.textContent = funcionario.tipo_sanguineo || '';
    
    const tdAcoes = document.createElement('td');
    tdAcoes.innerHTML = `
      <div style="display: flex; justify-content: center; gap: 5px;">
        <a href="cadastrar-funcionario.html?id=${funcionario.id_funcionario}" 
           class="btn btn-sm btn-warning me-1" title="Editar">
          <i class="fas fa-edit"></i>
        </a>
        <button class="btn btn-sm btn-danger" 
                onclick="excluirFuncionario(${funcionario.id_funcionario})" 
                title="Excluir">
          <i class="fas fa-trash-alt"></i>
        </button>
      </div>
    `;
    
    // Adicionar todas as células à linha
    tr.appendChild(tdFoto);
    tr.appendChild(tdNome);
    tr.appendChild(tdSobrenome);
    tr.appendChild(tdMatricula);
    tr.appendChild(tdCargo);
    tr.appendChild(tdTipoSanguineo);
    tr.appendChild(tdAcoes);
    
    // Adicionar linha ao tbody
    tbody.appendChild(tr);
  });
}

// Exclusão
function excluirFuncionario(id) {
  funcionarioIdParaExcluir = id;
  confirmacaoExclusaoModal.show();
}

async function confirmarExclusao() {
  if (!funcionarioIdParaExcluir) return;

  try {
    await axios.delete(`${API_BASE_URL}/funcionarios/${funcionarioIdParaExcluir}`);
    await carregarFuncionarios();
    exibirMensagem('Funcionário excluído com sucesso', 'success');
  } catch (error) {
    exibirMensagem('Erro ao excluir funcionário: ' + error.message, 'danger');
  } finally {
    confirmacaoExclusaoModal.hide();
    funcionarioIdParaExcluir = null;
  }
}

// Mensagem de alerta
function exibirMensagem(texto, tipo) {
  const alerta = document.createElement('div');
  alerta.className = `alert alert-${tipo} alert-dismissible fade show`;
  alerta.role = 'alert';
  alerta.innerHTML = `
    ${texto}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  const main = document.querySelector('main');
  main.insertBefore(alerta, main.firstChild);
  setTimeout(() => alerta.remove(), 5000);
}