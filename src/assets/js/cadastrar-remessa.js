import { get, post } from '../../services/api.js';
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
const scanCaBtn = document.getElementById('scan-ca-btn');
const barcodeModalElement = document.getElementById('barcodeModal');
const barcodeModal = barcodeModalElement ? new bootstrap.Modal(barcodeModalElement) : null;
const barcodeInput = document.getElementById('barcode-input');
const caSuccessMessage = document.getElementById('ca-success-message');
const modeloSuccessMessage = document.getElementById('modelo-success-message');
const barcodeLoading = document.getElementById('barcode-loading');
const barcodeSuccess = document.getElementById('barcode-success');
const barcodeError = document.getElementById('barcode-error');
const caErrorMessage = document.createElement('div');
caErrorMessage.className = 'text-danger mt-1';
caErrorMessage.style.fontSize = '0.875rem';
caErrorMessage.style.display = 'none';
caSelect.parentNode.appendChild(caErrorMessage);
let dadosCache = {
    cas: [],
    modelosEpi: [],
    fornecedores: [],
    casPorModeloCache: new Map(),
    modeloPorCaCache: new Map(),
    validCaForModel: []
};
let isLoading = {
    cas: false,
    modelos: false,
    fornecedores: false
};
let isUpdating = {
    ca: false,
    modelo: false
};
let validatedCaId = null;

function normalizeCaNumber(caText) {
    if (!caText) return '';
    const numbers = caText.match(/\d+/g);
    return numbers ? numbers.join('') : '';
}

function initializeSelect2() {
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
            if (normalizedTerm === '' || isNaN(parseInt(normalizedTerm))) {
                return null;
            }
            return {
                id: term,
                text: term,
                newTag: true
            };
        }
    });
}

function toggleLoading(fieldId, show) {
    const fieldElement = document.getElementById(fieldId);
    const fieldGroup = fieldElement?.closest('.field-group');
    const loadingIndicator = fieldGroup?.querySelector('.loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = show ? 'block' : 'none';
    }
}

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

function showCaError(message) {
    const $caSelectContainer = $(caSelect).next('.select2-container').find('.select2-selection');
    if (message) {
        caErrorMessage.textContent = message;
        caErrorMessage.style.display = 'block';
        caSelect.classList.add('is-invalid');
        $caSelectContainer.addClass('is-invalid');
        validatedCaId = null;
        $(caSelect).val(null).trigger('change.select2'); 
    } else {
        caErrorMessage.style.display = 'none';
        caSelect.classList.remove('is-invalid');
        $caSelectContainer.removeClass('is-invalid');
    }
}

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
            throw new Error('Formato de dados inválido recebido da API.');
        }
        if (items.length === 0) {
            if (selectElement) {
                selectElement.innerHTML = `<option value="" selected disabled>Nenhum item disponível</option>`;
                $(selectElement).trigger('change');
            }
            dadosCache[cacheKey] = [];
            return [];
        }
        dadosCache[cacheKey] = items;
        if (selectElement) populateSelectOptions(selectElement, items, valueField, textField);
        if (cacheKey === 'cas') {
            dadosCache.modeloPorCaCache.clear();
            items.forEach(ca => {
                const normalizedCa = normalizeCaNumber(ca.numero_ca);
                if (normalizedCa && ca.id_modelo_epi) {
                    dadosCache.modeloPorCaCache.set(normalizedCa, ca.id_modelo_epi);
                }
            });
        }
        return items;
    } catch (error) {
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

function populateSelectOptions(selectElement, items, valueField, textField, selectedValue = null) {
    if (!selectElement) return;
    const currentValue = selectedValue || $(selectElement).val();
    const placeholderText = $(selectElement).data('placeholder') || 'Selecione...';
    selectElement.innerHTML = '';
    const placeholderOption = document.createElement('option');
    placeholderOption.value = "";
    placeholderOption.textContent = placeholderText;
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
        }
    });
    $(selectElement).val(currentValue).trigger('change.select2');
}

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
            dadosCache.validCaForModel = [];
            return [];
        }
        dadosCache.casPorModeloCache.set(modeloId, cas);
        dadosCache.validCaForModel = cas;
        return cas;
    } catch (error) {
        dadosCache.validCaForModel = [];
        return [];
    } finally {
        toggleLoading('id_ca', false);
    }
}

function validateSelectedCaOption(selectedValue) {
    showCaError(null);
    validatedCaId = null;
    if (!selectedValue) {
        return false;
    }
    const modeloSelecionadoId = $(modeloEpiSelect).val();
    if (!modeloSelecionadoId) {
        return false;
    }
    const selectedOption = caSelect.querySelector(`option[value="${selectedValue}"]`);
    if (!selectedOption || selectedOption.dataset.select2Tag === 'true') {
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
        if ($(caSelect).val() != foundCa.id_ca) {
            $(caSelect).val(foundCa.id_ca).trigger('change.select2');
        }
        return true;
    } else {
        showCaError(`CA "${caTextToValidate}" selecionado não pertence à lista do modelo atual.`);
        $(caSelect).val(null).trigger('change.select2'); 
        return false;
    }
}

async function processarEselecionarCA(codigoCa) {
    const numeroCaNormalizado = normalizeCaNumber(codigoCa);
    if (!numeroCaNormalizado) {
        showCaError(`Formato de CA inválido: ${codigoCa}`);
        $(caSelect).val(null).trigger('change.select2'); 
        return null;
    }
    toggleLoading('id_ca', true);
    showCaError(null);
    isUpdating.ca = true;
    isUpdating.modelo = true;
    try {
        let caInfo = null;
        let modeloIdDoCa = dadosCache.modeloPorCaCache.get(numeroCaNormalizado);
        if (modeloIdDoCa) {
            const casDoModelo = await buscarCAsPorModelo(modeloIdDoCa);
            caInfo = casDoModelo.find(ca => normalizeCaNumber(ca.numero_ca) === numeroCaNormalizado);
        } else {
            try {
                const response = await get(`ca/numero/${numeroCaNormalizado}`);
                if (response.success && response.data) {
                    caInfo = response.data;
                    modeloIdDoCa = caInfo.id_modelo_epi;
                    if (modeloIdDoCa) dadosCache.modeloPorCaCache.set(numeroCaNormalizado, modeloIdDoCa);
                } else {
                }
            } catch (error) {
            }
        }
        if (!caInfo || !modeloIdDoCa) {
            showCaError(`CA ${codigoCa} não encontrado ou sem modelo associado.`);
            $(caSelect).find(`option[value="${codigoCa}"]`).remove();
            $(caSelect).val(null).trigger('change.select2');
            return null;
        }
        const modeloSelecionadoAtual = $(modeloEpiSelect).val();
        if (modeloSelecionadoAtual != modeloIdDoCa) {
            $(modeloEpiSelect).val(modeloIdDoCa).trigger('change.select2');
            markAsAutoFilled(modeloEpiSelect);
            showSuccessMessage('modelo-success-message', '✓ Modelo atualizado automaticamente.');
            const casDoNovoModelo = await buscarCAsPorModelo(modeloIdDoCa);
            populateSelectOptions(caSelect, casDoNovoModelo, 'id_ca', 'numero_ca', caInfo.id_ca);
        } else {
            if (dadosCache.validCaForModel.length === 0) {
                const casDoModeloAtual = await buscarCAsPorModelo(modeloIdDoCa);
                populateSelectOptions(caSelect, casDoModeloAtual, 'id_ca', 'numero_ca', caInfo.id_ca);
            }
        }
        const $caSelect = $(caSelect);
        $caSelect.find(`option[value="${codigoCa}"]`).remove();
        if (!$caSelect.find(`option[value="${caInfo.id_ca}"]`).length) {
            const option = new Option(caInfo.numero_ca, caInfo.id_ca, true, true);
            option.dataset.item = JSON.stringify(caInfo);
            $caSelect.append(option);
        }
        $caSelect.val(caInfo.id_ca).trigger('change.select2');
        markAsAutoFilled(caSelect);
        validatedCaId = caInfo.id_ca;
        showCaError(null);
        return caInfo;
    } catch (error) {
        showCaError(`Erro ao validar CA ${codigoCa}.`);
        $(caSelect).val(null).trigger('change.select2'); 
        return null;
    } finally {
        toggleLoading('id_ca', false);
        setTimeout(() => {
            isUpdating.ca = false;
            isUpdating.modelo = false;
        }, 100);
    }
}

$(modeloEpiSelect).on('change', async function () {
    if (isUpdating.modelo) return;
    const modeloId = $(this).val();
    if (modeloId) {
        const casDoModelo = await buscarCAsPorModelo(modeloId);
        populateSelectOptions(caSelect, casDoModelo, 'id_ca', 'numero_ca');
        showSuccessMessage('modelo-success-message', '✓ CAs disponíveis carregados.');
        showCaError(null);
        validatedCaId = null;
    } else {
        populateSelectOptions(caSelect, [], 'id_ca', 'numero_ca');
        showCaError(null);
        validatedCaId = null;
    }
});

$(caSelect).on('change', async function () {
    if (isUpdating.ca) return;
    const selectedValue = $(this).val();
    if (!selectedValue) {
        validatedCaId = null;
        showCaError(null);
    } else {
        const selectedOption = caSelect.querySelector(`option[value="${selectedValue}"]`);
        const isNewTag = selectedOption && selectedOption.dataset.select2Tag === 'true';
        if (isNewTag) {
            const caInfo = await processarEselecionarCA(selectedValue);
            if (!caInfo) {
                $(caSelect).val(null).trigger('change.select2'); 
            }
        } else {
            validateSelectedCaOption(selectedValue);
        }
    }
});

form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentCaValue = $(caSelect).val();
    if (!validatedCaId && currentCaValue) {
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
        showCaError('O campo CA é obrigatório.');
        caSelect.focus();
        return;
    }
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
            validatedCaId = null;
            showCaError(null);
            dadosCache.validCaForModel = [];
            populateSelectOptions(caSelect, [], 'id_ca', 'numero_ca');
        } else {
            alert(`Erro ao cadastrar remessa: ${response.error || 'Erro desconhecido'}`);
        }
    } catch (error) {
        alert('Erro de comunicação ao cadastrar remessa.');
    }
});

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
                    }, 500);
                } else {
                    barcodeError.style.display = 'flex';
                    barcodeInput.value = ''; 
                    barcodeInput.focus(); 
                }
            }, 700);
        }
    });
}

async function inicializarPagina() {
    initializeSelect2();
    await Promise.all([
        popularSelect(modeloEpiSelect, 'modelos-epi', 'id_modelo_epi', 'nome_epi', 'modelosEpi'),
        popularSelect(fornecedorSelect, 'fornecedores', 'id_fornecedor', 'nome_fornecedor', 'fornecedores'),
        popularSelect(null, 'ca', 'id_ca', 'numero_ca', 'cas')
    ]);
}

document.addEventListener('DOMContentLoaded', inicializarPagina);

