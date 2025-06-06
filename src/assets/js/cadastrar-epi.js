// cadastrar-epi.js
import { get, post, put } from '../../services/api.js'; // Import API functions

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('modeloEpiForm');
    const formTitle = document.getElementById('formTitle');
    const submitButton = document.getElementById('submitButton');
    const modeloEpiIdInput = document.getElementById('modeloEpiId');
    
    // Campos do formulário
    const nomeEpiInput = document.getElementById('nomeEpi');
    const marcaSelect = document.getElementById('marcaSelect');
    const categoriaSelect = document.getElementById('categoriaSelect');
    const quantidadeInput = document.getElementById('quantidade');
    const descartavelCheck = document.getElementById('descartavelCheck');
    const rastreavelCheck = document.getElementById('rastreavelCheck');
    const descricaoEpiTextarea = document.getElementById('descricaoEpi');

    // Elementos da foto
    const fotoEpiInput = document.getElementById('fotoEpiInput');
    const fotoPreview = document.getElementById('fotoPreview');
    const fotoPlaceholder = document.getElementById('fotoPlaceholder');
    const removerFotoBtn = document.getElementById('removerFotoBtn');
    let fotoAtual = null; // Para armazenar o arquivo da foto selecionada
    let fotoRemovida = false; // Flag para indicar se a foto foi removida na edição
    let urlFotoOriginal = null; // Armazena a URL da foto original no modo edição

    // --- Carregamento Inicial (Selects e Modo Edição) ---

    async function carregarMarcas() {
        try {
            const marcas = await get('marcas');
            marcaSelect.innerHTML = '<option value="" selected disabled>Selecione uma marca...</option>'; // Reset
            marcas.forEach(marca => {
                const option = document.createElement('option');
                option.value = marca.id_marca;
                option.textContent = marca.nome_marca;
                marcaSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao carregar marcas:', error);
        }
    }

    async function carregarCategorias() {
        try {
            const categorias = await get('categorias');
            categoriaSelect.innerHTML = '<option value="" selected disabled>Selecione uma categoria...</option>'; // Reset
            categorias.forEach(categoria => {
                const option = document.createElement('option');
                option.value = categoria.id_categoria;
                option.textContent = categoria.nome_categoria;
                categoriaSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Erro ao carregar categorias:', error);
        }
    }

    // --- Lógica de Upload e Preview da Foto ---

    fotoEpiInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            fotoAtual = file;
            fotoRemovida = false;
            const reader = new FileReader();
            reader.onload = (e) => {
                fotoPreview.src = e.target.result;
                fotoPreview.style.display = 'block';
                fotoPlaceholder.style.display = 'none';
                removerFotoBtn.style.display = 'inline-block';
            }
            reader.readAsDataURL(file);
        } 
    });

    removerFotoBtn.addEventListener('click', () => {
        fotoEpiInput.value = '';
        fotoPreview.src = '#';
        fotoPreview.style.display = 'none';
        fotoPlaceholder.style.display = 'flex';
        removerFotoBtn.style.display = 'none';
        fotoAtual = null;
        fotoRemovida = true; 
        urlFotoOriginal = null; // Garante que a foto original não será mantida
    });

    // --- Preencher Formulário para Edição ---
    async function preencherFormularioParaEdicao(id) {
        try {
            const modelo = await get(`modelos-epi/${id}`);
            
            formTitle.textContent = 'Editar Modelo de EPI';
            submitButton.textContent = 'Salvar Alterações';
            modeloEpiIdInput.value = modelo.id_modelo_epi;

            nomeEpiInput.value = modelo.nome_epi || '';
            quantidadeInput.value = modelo.quantidade !== null ? modelo.quantidade : '';
            descartavelCheck.checked = modelo.descartavel || false;
            rastreavelCheck.checked = modelo.rastreavel || false;
            descricaoEpiTextarea.value = modelo.descricao_epi || '';

            // Aguarda o carregamento dos selects para definir os valores
            await Promise.all([carregarMarcas(), carregarCategorias()]); 
            marcaSelect.value = modelo.id_marca || '';
            categoriaSelect.value = modelo.id_categoria || '';

            // Preenche a foto se existir
            if (modelo.foto_epi_url) {
                urlFotoOriginal = modelo.foto_epi_url;
                fotoPreview.src = modelo.foto_epi_url;
                fotoPreview.style.display = 'block';
                fotoPlaceholder.style.display = 'none';
                removerFotoBtn.style.display = 'inline-block';
            } else {
                fotoPreview.style.display = 'none';
                fotoPlaceholder.style.display = 'flex';
                removerFotoBtn.style.display = 'none';
            }

        } catch (error) {
            console.error(`Erro ao carregar modelo de EPI ${id}:`, error);
            alert('Erro ao carregar dados do modelo para edição. Verifique o console.');
            window.location.href = 'modelos-epi.html'; // Volta para a lista em caso de erro
        }
    }

    // --- Submissão do Formulário (Criação/Edição) ---

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }
        form.classList.add('was-validated');

        const formData = new FormData();
        formData.append('nome_epi', nomeEpiInput.value);
        formData.append('id_marca', marcaSelect.value);
        formData.append('id_categoria', categoriaSelect.value);
        formData.append('quantidade', quantidadeInput.value);
        formData.append('descartavel', descartavelCheck.checked);
        formData.append('rastreavel', rastreavelCheck.checked);
        formData.append('descricao_epi', descricaoEpiTextarea.value);

        // Adiciona a foto SOMENTE se uma NOVA foto foi selecionada
        if (fotoAtual) {
            formData.append('foto_epi', fotoAtual);
        } 
        
        const epiId = modeloEpiIdInput.value;
        let success = false;
        let message = '';
        let resultId = null;

        submitButton.disabled = true;
        submitButton.textContent = epiId ? 'Salvando...' : 'Cadastrando...';

        try {
            if (epiId) {
                // Modo Edição (PUT)
                console.log("Enviando dados para PUT:", Object.fromEntries(formData.entries()));
                const result = await put(`modelos-epi/${epiId}`, formData);
                message = result.message || 'Modelo de EPI atualizado com sucesso!';
                success = true;
                resultId = epiId; // Para edição, usa o ID existente
            } else {
                // Modo Criação (POST)
                console.log("Enviando dados para POST:", Object.fromEntries(formData.entries()));
                const result = await post('modelos-epi', formData);
                message = result.message || 'Modelo de EPI cadastrado com sucesso!';
                success = true;
                resultId = result.id; // Para criação, usa o ID retornado
            }

            if (success) {
                // Armazenar dados no sessionStorage para exibir na página de confirmação
                const dadosConfirmacao = {
                    id: resultId,
                    nome_epi: nomeEpiInput.value,
                    marca: marcaSelect.options[marcaSelect.selectedIndex].text,
                    categoria: categoriaSelect.options[categoriaSelect.selectedIndex].text,
                    quantidade: quantidadeInput.value,
                    descartavel: descartavelCheck.checked,
                    rastreavel: rastreavelCheck.checked,
                    descricao_epi: descricaoEpiTextarea.value,
                    message: message,
                    tipo_operacao: epiId ? 'edicao' : 'cadastro'
                };

                sessionStorage.setItem('dadosConfirmacaoEpi', JSON.stringify(dadosConfirmacao));
                
                // Redirecionar para página de confirmação
                window.location.href = 'confirmacao-epi.html';
            }
        } catch (error) {
            console.error('Erro ao salvar modelo de EPI:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Erro desconhecido ao salvar.';
            alert(`Erro: ${errorMessage}`);
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = epiId ? 'Salvar Alterações' : 'Cadastrar';
        }
    });

    // --- Inicialização --- 
    const urlParams = new URLSearchParams(window.location.search);
    const epiIdParaEditar = urlParams.get('id');

    if (epiIdParaEditar) {
        // Modo Edição: Carrega dados existentes
        preencherFormularioParaEdicao(epiIdParaEditar);
    } else {
        // Modo Criação: Apenas carrega os selects
        carregarMarcas();
        carregarCategorias();
    }
});