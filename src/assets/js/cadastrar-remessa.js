import { get, post } from '../../services/api.js';

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

// Elementos do scanner de código de barras
const scanCaBtn = document.getElementById('scan-ca-btn');
const barcodeModalElement = document.getElementById('barcodeModal');
const barcodeModal = barcodeModalElement ? new bootstrap.Modal(barcodeModalElement) : null;
const barcodeInput = document.getElementById('barcode-input');

// Elementos de status para feedback visual
const caSuccessMessage = document.getElementById('ca-success-message');
const modeloSuccessMessage = document.getElementById('modelo-success-message');
const barcodeLoading = document.getElementById('barcode-loading');
const barcodeSuccess = document.getElementById('barcode-success');
const barcodeError = document.getElementById('barcode-error');
const caErrorMessage = document.createElement('div'); // Elemento para mensagens de erro do CA
caErrorMessage.className = 'text-danger mt-1';
caErrorMessage.style.fontSize = '0.875rem';
caErrorMessage.style.display = 'none';
caSelect.parentNode.appendChild(caErrorMessage); // Adiciona após o select de CA

// Cache de dados para otimização
let dadosCache = {
    cas: [], // Cache geral de todos os CAs (se necessário)
    modelosEpi: [],
    fornecedores: [],
    casPorModeloCache: new Map(), // Cache específico para CAs por modelo ID
    modeloPorCaCache: new Map(), // Cache específico para modelo ID por número CA normalizado
    validCaForModel: [] // Armazena a lista de CAs válidos para o modelo selecionado ATUALMENTE
};

// Estado de carregamento
let isLoading = {
    cas: false,
    modelos: false,
    fornecedores: false
};

// Estado para evitar loops infinitos ou atualizações concorrentes
let isUpdating = {
    ca: false,
    modelo: false
};

// Armazena o ID do CA validado (seja selecionado ou digitado)
let validatedCaId = null;

// Função para normalizar o número do CA para pesquisa e validação
function normalizeCaNumber(caText) {
    if (!caText) return '';
    const numbers = caText.match(/\d+/g);
    return numbers ? numbers.join('') : '';
}

// Configuração do Select2
function initializeSelect2() {
    // Inicializa Select2 para selects genéricos
    $('.searchable-select:not(#id_ca)').select2({
        theme: 'bootstrap-5',
        placeholder: function () {
            return $(this).data('placeholder') || 'Digite para buscar...';
        },
        allowClear: true,
        minimumInputLength: 0,
        language: {
            noResults: function () { return "Nenhum resultado encontrado"; },
            searching: function () { return "Buscando..."; },
            inputTooShort: function () { return "Digite para buscar..."; }
        },
        escapeMarkup: function (markup) { return markup; }
    });

    // Configuração específica para o select de CA com tags e matcher customizado
    $('#id_ca').select2({
        theme: 'bootstrap-5',
        placeholder: 'Digite/Escaneie CA ou selecione modelo',
        allowClear: true,
        tags: true,
        minimumInputLength: 0,
        language: {
            noResults: function () { return "CA não encontrado na lista"; },
            searching: function () { return "Buscando CA..."; }
        },
        matcher: function (params, data) {
            if ($.trim(params.term) === '') {
                return data;
            }
            if (typeof data.text === 'undefined' || !data.id) {
                return null;
            }
            const searchTermNormalized = normalizeCaNumber(params.term);
            const optionTextNormalized = normalizeCaNumber(data.text);
            if (optionTextNormalized.includes(searchTermNormalized)) {
                return data;
            }
            return null;
        },
        createTag: function (params) {
            const term = $.trim(params.term);
            const normalizedTerm = normalizeCaNumber(term);
            // Só cria tag se for um número válido
            if (normalizedTerm === '' || isNaN(parseInt(normalizedTerm))) {
                return null;
            }
            return {
                id: term, // Usa o termo original como ID temporário
                text: term,
                newTag: true // Flag para indicar que é uma tag nova
            };
        }
    });
}

// Função para mostrar/ocultar indicador de carregamento
function toggleLoading(fieldId, show) {
    const fieldElement = document.getElementById(fieldId);
    const fieldGroup = fieldElement?.closest('.field-group');
    const loadingIndicator = fieldGroup?.querySelector('.loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
}

// Função para marcar campo como preenchido automaticamente
function markAsAutoFilled(element) {
    if (!element) return;
    const $element = $(element);
    $element.addClass('auto-filled');
    if ($element.hasClass('select2-hidden-accessible')) {
        $element.next('.select2-container').addClass('auto-filled');
    }
    setTimeout(() => {
        $element.removeClass('auto-filled');
        if ($element.hasClass('select2-hidden-accessible')) {
            $element.next('.select2-container').removeClass('auto-filled');
        }
    }, 3000);
}

// Função para mostrar mensagem de sucesso associada a um campo
function showSuccessMessage(elementId, message, duration = 3000) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        setTimeout(() => {
            element.style.display = 'none';
        }, duration);
    }
}

// Função para mostrar/ocultar mensagem de erro do CA
function showCaError(message) {
    const $caSelectContainer = $(caSelect).next('.select2-container').find('.select2-selection');
    if (message) {
        caErrorMessage.textContent = message;
        caErrorMessage.style.display = 'block';
        caSelect.classList.add('is-invalid');
        $caSelectContainer.addClass('is-invalid');
        validatedCaId = null;
    } else {
        caErrorMessage.style.display = 'none';
        caSelect.classList.remove('is-invalid');
        $caSelectContainer.removeClass('is-invalid');
    }
}

// Função genérica para popular selects
async function popularSelect(selectElement, endpoint, valueField, textField, cacheKey, forceReload = false) {
    const isCaSelect = selectElement && selectElement.id === 'id_ca';
    if (!selectElement && !isCaSelect) return [];

    if (isLoading[cacheKey] && !forceReload) {
        if (selectElement) populateSelectOptions(selectElement, dadosCache[cacheKey], valueField, textField);
        return dadosCache[cacheKey];
    }

    isLoading[cacheKey] = true;
    const fieldId = selectElement ? selectElement.id : null;
    if (fieldId) toggleLoading(fieldId, true);

    try {
        if (!forceReload && dadosCache[cacheKey] && dadosCache[cacheKey].length > 0) {
            if (selectElement) populateSelectOptions(selectElement, dadosCache[cacheKey], valueField, textField);
            return dadosCache[cacheKey];
        }

        const response = await get(endpoint);
        const items = response?.success ? response.data : (Array.isArray(response) ? response : []);

        if (!Array.isArray(items)) {
            console.error(`Resposta inesperada para ${endpoint}:`, response);
            throw new Error('Formato de dados inválido recebido da API.');
        }

        if (items.length === 0) {
            console.warn(`Nenhum item encontrado para ${endpoint}`);
            if (selectElement) {
                selectElement.innerHTML = `<option value="" selected disabled>Nenhum item disponível</option>`;
                $(selectElement).trigger('change');
            }
            dadosCache[cacheKey] = [];
            return [];
        }

        dadosCache[cacheKey] = items;
        if (selectElement) populateSelectOptions(selectElement, items, valueField, textField);

        // Preenche cache de modelo por CA se estiver carregando todos os CAs
        if (cacheKey === 'cas') {
            dadosCache.modeloPorCaCache.clear();
            items.forEach(ca => {
                const normalizedCa = normalizeCaNumber(ca.numero_ca);
                if (normalizedCa && ca.id_modelo_epi) {
                    dadosCache.modeloPorCaCache.set(normalizedCa, ca.id_modelo_epi);
                }
            });
            console.log('Cache modeloPorCaCache preenchido:', dadosCache.modeloPorCaCache);
        }

        return items;

    } catch (error) {
        console.error(`Erro ao carregar ${endpoint}:`, error);
        if (selectElement) {
            selectElement.innerHTML = `<option value="" selected disabled>Erro ao carregar</option>`;
            $(selectElement).trigger('change');
        }
        dadosCache[cacheKey] = [];
        return [];
    } finally {
        isLoading[cacheKey] = false;
        if (fieldId) toggleLoading(fieldId, false);
    }
}

// Função auxiliar para popular opções do select
function populateSelectOptions(selectElement, items, valueField, textField, selectedValue = null) {
    if (!selectElement) return;
    const currentValue = selectedValue || $(selectElement).val();
    const placeholderText = $(selectElement).data('placeholder') || 'Selecione...';
    selectElement.innerHTML = ''; // Limpa opções existentes

    const placeholderOption = document.createElement('option');
    placeholderOption.value = "";
    placeholderOption.textContent = placeholderText;
    // Não desabilitar placeholder para permitir limpar seleção
    // placeholderOption.disabled = true;
    placeholderOption.selected = !currentValue || currentValue === "";
    selectElement.appendChild(placeholderOption);

    items.forEach(item => {
        if (item && typeof item === 'object' && item.hasOwnProperty(valueField) && item.hasOwnProperty(textField)) {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            option.dataset.item = JSON.stringify(item);
            if (currentValue && item[valueField] == currentValue) {
                option.selected = true;
                placeholderOption.selected = false;
            }
            selectElement.appendChild(option);
        } else {
            console.warn('Item inválido encontrado ao popular select:', item);
        }
    });

    // Define o valor selecionado e dispara change.select2 para UI
    $(selectElement).val(currentValue).trigger('change.select2');
}

// Função para buscar CAs por modelo específico
async function buscarCAsPorModelo(modeloId) {
    if (!modeloId) {
        dadosCache.validCaForModel = [];
        return [];
    }
    if (dadosCache.casPorModeloCache.has(modeloId)) {
        dadosCache.validCaForModel = dadosCache.casPorModeloCache.get(modeloId);
        return dadosCache.validCaForModel;
    }

    toggleLoading('id_ca', true);
    try {
        const response = await get(`ca/modelo/${modeloId}`);
        const cas = response.success ? response.data : [];
        if (!Array.isArray(cas)) {
            console.error('Resposta inesperada ao buscar CAs por modelo:', response);
            dadosCache.validCaForModel = [];
            return [];
        }
        dadosCache.casPorModeloCache.set(modeloId, cas);
        dadosCache.validCaForModel = cas;
        return cas;
    } catch (error) {
        console.error('Erro ao buscar CAs por modelo:', error);
        dadosCache.validCaForModel = [];
        return [];
    } finally {
        toggleLoading('id_ca', false);
    }
}

// *** CORRIGIDO: Função para validar o CA selecionado (NÃO TAG) contra a lista do modelo ***
function validateSelectedCaOption(selectedValue) {
    showCaError(null);
    validatedCaId = null;

    if (!selectedValue) {
        return false; // Nada selecionado
    }

    const modeloSelecionadoId = $(modeloEpiSelect).val();
    if (!modeloSelecionadoId) {
        // Se um CA foi selecionado de uma lista (não digitado), mas não há modelo,
        // algo está errado no fluxo, mas não mostramos erro aqui, pois o change do modelo deve tratar.
        console.warn("CA selecionado sem modelo definido. Aguardando seleção de modelo.");
        return false;
    }

    const selectedOption = caSelect.querySelector(`option[value="${selectedValue}"]`);
    if (!selectedOption || selectedOption.dataset.select2Tag === 'true') {
        // Não é uma opção válida ou é uma tag (tratada em outro lugar)
        return false;
    }

    const caTextToValidate = selectedOption.textContent;
    const normalizedInput = normalizeCaNumber(caTextToValidate);

    const validCas = dadosCache.validCaForModel;
    if (!validCas || validCas.length === 0) {
        showCaError('Não foi possível carregar CAs para este modelo. Validação indisponível.');
        return false;
    }

    const foundCa = validCas.find(ca => normalizeCaNumber(ca.numero_ca) === normalizedInput);

    if (foundCa) {
        validatedCaId = foundCa.id_ca;
        // Garante que o valor do select é o ID correto
        if ($(caSelect).val() != foundCa.id_ca) {
            $(caSelect).val(foundCa.id_ca).trigger('change.select2');
        }
        return true;
    } else {
        // Este caso não deveria ocorrer se a lista foi populada corretamente pelo modelo
        showCaError(`CA "${caTextToValidate}" selecionado não pertence à lista do modelo atual.`);
        return false;
    }
}

// *** CORRIGIDO: Função para processar CA vindo do Scanner OU DIGITAÇÃO DIRETA (TAG) ***
async function processarEselecionarCA(codigoCa) {
    const numeroCaNormalizado = normalizeCaNumber(codigoCa);
    if (!numeroCaNormalizado) {
        console.warn('Código CA inválido ou vazio:', codigoCa);
        showCaError(`Formato de CA inválido: ${codigoCa}`);
        return null;
    }

    console.log(`Processando CA (Scan/Digitado): ${codigoCa} (Normalizado: ${numeroCaNormalizado})`);
    toggleLoading('id_ca', true);
    showCaError(null);
    isUpdating.ca = true; // Bloqueia eventos change do CA
    isUpdating.modelo = true; // Bloqueia eventos change do Modelo

    try {
        let caInfo = null;
        let modeloIdDoCa = dadosCache.modeloPorCaCache.get(numeroCaNormalizado);

        if (modeloIdDoCa) {
            console.log(`Modelo ID ${modeloIdDoCa} encontrado no cache para CA ${numeroCaNormalizado}`);
            const casDoModelo = await buscarCAsPorModelo(modeloIdDoCa);
            caInfo = casDoModelo.find(ca => normalizeCaNumber(ca.numero_ca) === numeroCaNormalizado);
        } else {
            console.warn(`Modelo não encontrado no cache para CA ${numeroCaNormalizado}. Buscando na API...`);
            try {
                // Tenta buscar o CA específico (ajuste endpoint se necessário)
                const response = await get(`ca/numero/${numeroCaNormalizado}`);
                if (response.success && response.data) {
                    caInfo = response.data;
                    modeloIdDoCa = caInfo.id_modelo_epi;
                    if (modeloIdDoCa) dadosCache.modeloPorCaCache.set(numeroCaNormalizado, modeloIdDoCa);
                } else {
                    console.error(`CA ${numeroCaNormalizado} não encontrado na API.`);
                }
            } catch (error) {
                console.error(`Erro ao buscar CA ${numeroCaNormalizado} na API:`, error);
            }
        }

        if (!caInfo || !modeloIdDoCa) {
            console.error(`CA ${numeroCaNormalizado} não encontrado ou sem modelo associado.`);
            showCaError(`CA ${codigoCa} não encontrado ou sem modelo associado.`);
            // Limpa o select CA se a tag foi criada
            $(caSelect).find(`option[value="${codigoCa}"]`).remove();
            $(caSelect).val(null).trigger('change.select2');
            return null;
        }

        console.log('CA Info encontrado:', caInfo);
        const modeloSelecionadoAtual = $(modeloEpiSelect).val();

        // Atualiza o Modelo EPI se necessário
        if (modeloSelecionadoAtual != modeloIdDoCa) {
            console.log(`Modelo do CA (${modeloIdDoCa}) diferente do selecionado (${modeloSelecionadoAtual}). Atualizando modelo...`);
            $(modeloEpiSelect).val(modeloIdDoCa).trigger('change.select2'); // Atualiza UI do modelo
            markAsAutoFilled(modeloEpiSelect);
            showSuccessMessage('modelo-success-message', '✓ Modelo atualizado automaticamente.');
            // Busca CAs para o novo modelo e popula o select CA
            const casDoNovoModelo = await buscarCAsPorModelo(modeloIdDoCa);
            populateSelectOptions(caSelect, casDoNovoModelo, 'id_ca', 'numero_ca', caInfo.id_ca);
        } else {
            // Se o modelo já estava correto, garante que a lista de CAs está populada
            if (dadosCache.validCaForModel.length === 0) {
                const casDoModeloAtual = await buscarCAsPorModelo(modeloIdDoCa);
                populateSelectOptions(caSelect, casDoModeloAtual, 'id_ca', 'numero_ca', caInfo.id_ca);
            }
        }

        // Seleciona o CA correto no select
        const $caSelect = $(caSelect);
        // Remove a tag temporária (com texto como valor) se existir
        $caSelect.find(`option[value="${codigoCa}"]`).remove();
        // Adiciona a opção correta (com ID como valor) se não existir
        if (!$caSelect.find(`option[value="${caInfo.id_ca}"]`).length) {
            const option = new Option(caInfo.numero_ca, caInfo.id_ca, true, true);
            option.dataset.item = JSON.stringify(caInfo);
            $caSelect.append(option);
        }
        // Define o valor e dispara change.select2 para atualizar UI (incluindo clear button)
        $caSelect.val(caInfo.id_ca).trigger('change.select2');
        markAsAutoFilled(caSelect);
        validatedCaId = caInfo.id_ca;
        showCaError(null); // Limpa erro após sucesso

        return caInfo;

    } catch (error) {
        console.error('Erro ao processar CA escaneado/digitado:', error);
        showCaError(`Erro ao validar CA ${codigoCa}.`);
        return null;
    } finally {
        toggleLoading('id_ca', false);
        // Libera flags após um pequeno delay para garantir que UI atualize
        setTimeout(() => {
            isUpdating.ca = false;
            isUpdating.modelo = false;
        }, 100);
    }
}

// --- Event Listeners --- //

// Evento de mudança no Modelo EPI
$(modeloEpiSelect).on('change', async function (event) {
    if (isUpdating.modelo) {
        console.log("Modelo 'change' event ignored due to isUpdating.modelo flag.");
        return;
    }

    const modeloId = $(this).val();
    console.log('Modelo EPI selecionado:', modeloId);
    showCaError(null);
    validatedCaId = null;
    isUpdating.ca = true; // Previne validação enquanto limpa/popula CA
    $(caSelect).val(null).trigger('change.select2'); // Limpa seleção do CA
    // caSelect.disabled = !modeloId; // Não desabilitar mais, permitir digitar CA

    if (modeloId) {
        const casDoModelo = await buscarCAsPorModelo(modeloId);
        populateSelectOptions(caSelect, casDoModelo, 'id_ca', 'numero_ca');
        // caSelect.disabled = false;
        showSuccessMessage('modelo-success-message', '✓ CAs disponíveis carregados.');
    } else {
        // Limpa opções do CA se nenhum modelo for selecionado, mas mantém habilitado
        populateSelectOptions(caSelect, [], 'id_ca', 'numero_ca');
    }
    // Atraso mínimo antes de liberar a flag
    await new Promise(resolve => setTimeout(resolve, 50));
    isUpdating.ca = false;
});

// Evento de mudança no CA (seleção ou digitação/tag)
$(caSelect).on('change', async function (event) {
    if (isUpdating.ca) {
        console.log("CA 'change' event ignored due to isUpdating.ca flag.");
        return;
    }

    const selectedValue = $(this).val();
    console.log('CA selecionado/digitado (change event):', selectedValue);

    if (!selectedValue) {
        // Limpo pelo usuário (botão 'x')
        console.log("CA limpo pelo usuário.");
        validatedCaId = null;
        showCaError(null);
        // Se o modelo foi preenchido automaticamente antes, não o limpamos aqui.
        // O usuário pode querer selecionar outro CA para o mesmo modelo.
    } else {
        // Verifica se é uma tag nova (digitada)
        const selectedOption = caSelect.querySelector(`option[value="${selectedValue}"]`);
        const isNewTag = selectedOption && selectedOption.dataset.select2Tag === 'true';

        if (isNewTag) {
            console.log("Nova tag CA detectada:", selectedValue);
            // Processa como se fosse um scan/digitação direta
            await processarEselecionarCA(selectedValue);
        } else {
            console.log("Opção CA existente selecionada:", selectedValue);
            // Valida a opção selecionada contra o modelo atual (se houver)
            validateSelectedCaOption(selectedValue);
        }
    }
});

// Evento de submissão do formulário
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Valida o CA selecionado/digitado uma última vez
    const currentCaValue = $(caSelect).val();
    if (!validatedCaId && currentCaValue) {
        // Se há algo selecionado mas não está validado, tenta validar
        // (Isso pode acontecer se o usuário selecionou e não houve evento change)
        // Ou se digitou algo inválido e tentou submeter
        const selectedOption = caSelect.querySelector(`option[value="${currentCaValue}"]`);
        const isNewTag = selectedOption && selectedOption.dataset.select2Tag === 'true';

        if (isNewTag) {
            showCaError('CA digitado não foi validado. Verifique o número.');
            caSelect.focus();
            return;
        } else if (!validateSelectedCaOption(currentCaValue)) {
            showCaError(caErrorMessage.textContent || 'Selecione um CA válido para o modelo.');
            caSelect.focus();
            return;
        }
    } else if (!validatedCaId) {
        // Se não há nada selecionado/validado
        showCaError('O campo CA é obrigatório.');
        caSelect.focus();
        return;
    }

    // Verifica se o modelo está selecionado (pode não estar se só o CA foi digitado e falhou)
    if (!$(modeloEpiSelect).val()) {
        showCaError('O campo Modelo do EPI é obrigatório.');
        modeloEpiSelect.focus();
        return;
    }

    const remessaData = {
        codigo_lote: codigoLoteInput.value,
        quantidade: parseInt(quantidadeInput.value, 10),
        id_ca: validatedCaId,
        id_modelo_epi: parseInt(modeloEpiSelect.value, 10),
        id_fornecedor: parseInt(fornecedorSelect.value, 10),
        data_entrega: dataEntregaInput.value,
        validade_lote: validadeLoteInput.value,
        nota_fiscal: notaFiscalInput.value,
        observacoes: observacoesInput.value
    };

    try {
        const response = await post('remessas', remessaData);
        if (response.success) {
            window.location.href = 'confirmacao-estoque.html';
            form.reset();
            $('.searchable-select').val(null).trigger('change.select2');
            // caSelect.disabled = true; // Não desabilitar mais
            validatedCaId = null;
            showCaError(null);
            dadosCache.validCaForModel = []; // Limpa CAs do modelo anterior
            populateSelectOptions(caSelect, [], 'id_ca', 'numero_ca'); // Limpa opções do CA
        } else {
            alert(`Erro ao cadastrar remessa: ${response.error || 'Erro desconhecido'}`);
        }
    } catch (error) {
        console.error('Erro ao enviar formulário:', error);
        alert('Erro de comunicação ao cadastrar remessa.');
    }
});

// --- Lógica do Scanner --- //

if (scanCaBtn && barcodeModal) {
    scanCaBtn.addEventListener('click', () => {
        barcodeModal.show();
    });
}

if (barcodeModalElement) {
    barcodeModalElement.addEventListener('shown.bs.modal', () => {
        barcodeInput.focus();
        barcodeInput.value = '';
        barcodeLoading.style.display = 'none';
        barcodeSuccess.style.display = 'none';
        barcodeError.style.display = 'none';
    });
}

let barcodeTimeout;
if (barcodeInput) {
    barcodeInput.addEventListener('input', () => {
        clearTimeout(barcodeTimeout);
        const codigo = barcodeInput.value.trim();

        barcodeLoading.style.display = 'none';
        barcodeSuccess.style.display = 'none';
        barcodeError.style.display = 'none';

        if (codigo.length > 3) {
            barcodeLoading.style.display = 'flex';
            barcodeTimeout = setTimeout(async () => {
                const caInfo = await processarEselecionarCA(codigo);
                barcodeLoading.style.display = 'none';
                if (caInfo) {
                    barcodeSuccess.style.display = 'flex';
                    setTimeout(() => {
                        barcodeModal.hide();
                    }, 1000);
                } else {
                    barcodeError.style.display = 'flex';
                }
            }, 700);
        }
    });
}

// --- Inicialização --- //
async function inicializarPagina() {
    initializeSelect2();
    // caSelect.disabled = true; // Não desabilitar mais

    await Promise.all([
        popularSelect(modeloEpiSelect, 'modelos-epi', 'id_modelo_epi', 'nome_epi', 'modelosEpi'),
        popularSelect(fornecedorSelect, 'fornecedores', 'id_fornecedor', 'nome_fornecedor', 'fornecedores'),
        popularSelect(null, 'ca', 'id_ca', 'numero_ca', 'cas') // Pré-carrega CAs para cache modeloPorCa
    ]);

    console.log('Página inicializada.');
}

document.addEventListener('DOMContentLoaded', inicializarPagina);

