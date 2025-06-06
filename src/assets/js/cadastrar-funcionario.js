import { get, post, put, deleteRequest } from '../../services/api.js';

// Variáveis globais 
let funcionarioAtual = null;
let cargosData = [];

// Elementos DOM
const formFuncionario = document.getElementById('formFuncionario');
const btnSalvar = document.getElementById('btnSalvar');
const btnRemoverFoto = document.getElementById('btnRemoverFoto');
let removerFotoFlag = false;

// Event Listeners
document.addEventListener('DOMContentLoaded', function () {
    if (btnSalvar) {
        btnSalvar.addEventListener('click', salvarFuncionario);
    }
    if (btnRemoverFoto) {
        btnRemoverFoto.addEventListener('click', removerFoto);
    }
    
    const fotoInput = document.getElementById('fotoInput');
    if (fotoInput) {
        fotoInput.addEventListener('change', mostrarPreview);
    }
    
    inicializar();
});

// Funções de inicialização
async function inicializar() {
    try {
        await carregarCargos();

        const urlParams = new URLSearchParams(window.location.search);
        const funcionarioId = urlParams.get('id');

        if (funcionarioId) {
            await carregarFuncionario(funcionarioId);
            if (btnSalvar) {
                btnSalvar.textContent = 'Atualizar';
            }
        } else {
            if (btnSalvar) {
                btnSalvar.textContent = 'Cadastrar';
            }
        }
    } catch (error) {
        console.error('Erro na inicialização:', error);
        exibirMensagem('Erro ao carregar dados: ' + error.message, 'danger');
    }
}

// Carregar cargos
async function carregarCargos() {
    try {
        cargosData = await get('cargos');
        const cargoSelect = document.getElementById('cargoSelect');
        
        if (cargoSelect) {
            cargoSelect.innerHTML = '<option value="">Selecione um cargo</option>';

            cargosData.forEach(cargo => {
                const option = document.createElement('option');
                option.value = cargo.id_cargo;
                option.textContent = cargo.nome_cargo;
                cargoSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Erro ao carregar cargos:', error);
        throw error;
    }
}

// Carregar dados do funcionário
async function carregarFuncionario(id) {
    try {
        funcionarioAtual = await get(`funcionarios/${id}`);

        // Preencher campos do formulário
        const campos = {
            'idFuncionario': funcionarioAtual.id_funcionario,
            'nomeFuncionario': funcionarioAtual.nome_funcionario,
            'sobrenomeFuncionario': funcionarioAtual.sobrenome_funcionario,
            'matriculaFuncionario': funcionarioAtual.numero_matricula,
            'cpfFuncionario': funcionarioAtual.cpf,
            'dtNascimento': formatarDataParaInput(funcionarioAtual.dt_nascimento),
            'dtAdmissao': formatarDataParaInput(funcionarioAtual.dt_admissao),
            'tipoSanguineoSelect': funcionarioAtual.tipo_sanguineo,
            'cargoSelect': funcionarioAtual.id_cargo,
            'idEmpresa': funcionarioAtual.id_empresa || 1
        };

        // Preencher os campos se existirem
        Object.keys(campos).forEach(campoId => {
            const elemento = document.getElementById(campoId);
            if (elemento && campos[campoId] !== undefined && campos[campoId] !== null) {
                elemento.value = campos[campoId];
            }
        });

        // Carregar foto se existir
        const preview = document.getElementById('fotoPreview');
        const texto = document.getElementById('fotoTexto');

        if (funcionarioAtual.foto_perfil_path && preview && texto) {
      
            // preview.src = `http://localhost:3000/uploads/${funcionarioAtual.foto_perfil_path}`;
            preview.src = `https://myepi.netlify.app/uploads/${funcionarioAtual.foto_perfil_path}`;
            preview.style.display = 'block';
            texto.style.display = 'none';
            
            preview.onerror = function() {
                console.error('Erro ao carregar imagem:', this.src);
                console.error('Caminho da imagem no banco:', funcionarioAtual.foto_perfil_path);
                this.style.display = 'none';
                if (texto) {
                    texto.style.display = 'block';
                }
            };
            
            preview.onload = function() {
                console.log('Imagem carregada com sucesso:', this.src);
            };
        }
    } catch (error) {
        console.error('Erro ao carregar funcionário:', error);
        exibirMensagem('Erro ao carregar dados do funcionário', 'danger');
        setTimeout(() => {
            window.location.href = 'funcionario.html';
        }, 3000);
    }
}

// Salvar ou atualizar funcionário
async function salvarFuncionario() {
    try {
        if (!formFuncionario || !formFuncionario.checkValidity()) {
            if (formFuncionario) {
                formFuncionario.reportValidity();
            }
            return;
        }

        const formData = new FormData();
        
        // Campos obrigatórios
        const campos = [
            'nomeFuncionario', 'sobrenomeFuncionario', 'matriculaFuncionario',
            'cpfFuncionario', 'dtNascimento', 'dtAdmissao', 
            'tipoSanguineoSelect', 'cargoSelect', 'idEmpresa'
        ];

        // Mapeamento dos IDs para os nomes dos campos da API
        const mapeamentoCampos = {
            'nomeFuncionario': 'nome_funcionario',
            'sobrenomeFuncionario': 'sobrenome_funcionario',
            'matriculaFuncionario': 'numero_matricula',
            'cpfFuncionario': 'cpf',
            'dtNascimento': 'dt_nascimento',
            'dtAdmissao': 'dt_admissao',
            'tipoSanguineoSelect': 'tipo_sanguineo',
            'cargoSelect': 'id_cargo',
            'idEmpresa': 'id_empresa'
        };

        // Adicionar campos ao FormData
        campos.forEach(campoId => {
            const elemento = document.getElementById(campoId);
            if (elemento && elemento.value) {
                const nomeCampo = mapeamentoCampos[campoId] || campoId;
                formData.append(nomeCampo, elemento.value);
            }
        });

        // Adicionar foto se selecionada
        const fotoInput = document.getElementById('fotoInput');
        if (fotoInput && fotoInput.files.length > 0) {
            formData.append('foto', fotoInput.files[0]);
        }

        // Flag para remover foto
        if (removerFotoFlag) {
            formData.append('remover_foto', 'true');
        }

        let resultado;
        if (funcionarioAtual) {
            // Atualizar funcionário existente
            const id = document.getElementById('idFuncionario')?.value;
            if (id) {
                resultado = await put(`funcionarios/${id}`, formData);
                exibirMensagem('Funcionário atualizado com sucesso', 'success');
            }
        } else {
            // Criar novo funcionário
            resultado = await post('funcionarios', formData);
            exibirMensagem('Funcionário cadastrado com sucesso', 'success');
        }

        // Redirecionar após sucesso
        setTimeout(() => {
            window.location.href = 'exibir-funcionarios.html';
        }, 2000);

    } catch (error) {
        console.error('Erro ao salvar funcionário:', error);
        let mensagemErro = 'Erro ao salvar funcionário';
        
        if (error.response?.data?.error) {
            mensagemErro += ': ' + error.response.data.error;
        } else if (error.message) {
            mensagemErro += ': ' + error.message;
        }
        
        exibirMensagem(mensagemErro, 'danger');
    }
}

// Mostrar preview da imagem
function mostrarPreview(event) {
    const file = event.target.files[0];
    if (file) {
        const preview = document.getElementById('fotoPreview');
        const texto = document.getElementById('fotoTexto');
        
        if (preview && texto) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
            texto.style.display = 'none';
            removerFotoFlag = false;
        }
    }
}

// Remover visual da imagem e marcar flag
function removerFoto() {
    const preview = document.getElementById('fotoPreview');
    const texto = document.getElementById('fotoTexto');
    const input = document.getElementById('fotoInput');

    if (preview) {
        preview.src = '';
        preview.style.display = 'none';
    }
    
    if (texto) {
        texto.style.display = 'block';
    }
    
    if (input) {
        input.value = '';
    }

    removerFotoFlag = true;
}

// Formatador de data
function formatarDataParaInput(dataString) {
    if (!dataString) return '';
    
    try {
        const data = new Date(dataString);
        if (isNaN(data.getTime())) return '';
        
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        return `${ano}-${mes}-${dia}`;
    } catch (error) {
        console.error('Erro ao formatar data:', error);
        return '';
    }
}

// Exibir alertas
function exibirMensagem(texto, tipo) {
    const alerta = document.createElement('div');
    alerta.className = `alert alert-${tipo} alert-dismissible fade show`;
    alerta.role = 'alert';
    alerta.innerHTML = `
        ${texto}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;

    const main = document.querySelector('main');
    if (main) {
        main.insertBefore(alerta, main.firstChild);
        
        // Auto-remover após 5 segundos
        setTimeout(() => {
            if (alerta.parentNode) {
                alerta.remove();
            }
        }, 5000);
    }
}