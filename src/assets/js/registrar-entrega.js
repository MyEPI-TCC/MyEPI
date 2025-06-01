import { get, post } from "../../services/api.js"; // Mantendo caminho original

$(document).ready(function () {
    // Elementos do formulário
    const form = document.getElementById("form-registro-entrega");
    const epiModelSelect = document.getElementById("id_modelo_epi");
    const caSelect = document.getElementById("id_ca_epi");
    const funcionarioNomeSelect = document.getElementById("id_funcionario_nome");
    const funcionarioMatriculaSelect = document.getElementById("id_funcionario_matricula");
    const tipoEntregaSelect = document.getElementById("id_tipo_entrega");
    const dataEntregaInput = document.getElementById("data_entrega");
    const quantidadeInput = document.getElementById("quantidade");
    const loteSelect = document.getElementById("id_lote");
    const observacoesTextarea = document.getElementById("observacoes");

    // Elementos de feedback
    const caErrorMessage = document.getElementById("ca-error-message");
    const modeloSuccessMessage = document.getElementById("modelo-success-message");

    // Cache e Estado
    let dadosCache = {
        modelosEpi: [],
        funcionarios: [],
        cas: [], // Cache geral de CAs (pode ser útil para validação rápida)
        lotes: [], // Cache geral de Lotes
        casPorModeloCache: new Map(),
        lotesPorModeloCache: new Map(),
        modeloPorCaCache: new Map(),
        funcionarioPorMatriculaCache: new Map(),
        validCaForModel: [],
        validLoteForModel: [],
    };
    let isLoading = {
        modelos: false,
        funcionarios: false,
        cas: false,
        lotes: false,
    };
    let isUpdating = {
        modelo: false,
        ca: false,
        funcionarioNome: false,
        funcionarioMatricula: false,
        lote: false,
    };
    let validatedCaId = null;
    let validatedFuncionarioId = null;
    let validatedLoteId = null;

    // Variáveis do Scanner
    let scannedInput = "";
    let lastKeyTime = Date.now();

    // --- Funções Auxiliares (Adaptadas de cadastrar-remessa.js) ---

    function normalizeCaNumber(caText) {
        if (!caText) return "";
        const numbers = caText.match(/\d+/g);
        return numbers ? numbers.join("") : "";
    }

    function normalizeMatricula(matriculaText) {
        // Simplesmente remove espaços extras, pode ajustar se necessário
        return matriculaText ? matriculaText.trim() : "";
    }

    function toggleLoading(fieldId, show) {
        const fieldElement = document.getElementById(fieldId);
        const fieldGroup = fieldElement?.closest(".field-group");
        const loadingIndicator = fieldGroup?.querySelector(".loading-indicator");
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? "block" : "none";
        }
    }

    function markAsAutoFilled(element) {
        if (!element) return;
        const $element = $(element);
        $element.addClass("auto-filled");
        if ($element.hasClass("select2-hidden-accessible")) {
            $element.next(".select2-container").addClass("auto-filled");
        }
        setTimeout(() => {
            $element.removeClass("auto-filled");
            if ($element.hasClass("select2-hidden-accessible")) {
                $element.next(".select2-container").removeClass("auto-filled");
            }
        }, 3000);
    }

    function showSuccessMessage(elementId, message, duration = 3000) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.style.display = "block";
            setTimeout(() => {
                element.style.display = "none";
            }, duration);
        }
    }

    function showFieldError(selectElement, errorElement, message) {
        const $selectContainer = $(selectElement).next(".select2-container").find(".select2-selection");
        if (message) {
            errorElement.textContent = message;
            errorElement.style.display = "block";
            selectElement.classList.add("is-invalid");
            $selectContainer.addClass("is-invalid");
        } else {
            errorElement.style.display = "none";
            selectElement.classList.remove("is-invalid");
            $selectContainer.removeClass("is-invalid");
        }
    }

    // --- Inicialização do Select2 --- 

    function initializeSelect2() {
        $(".searchable-select:not(#id_ca_epi, #id_funcionario_matricula)").select2({
            theme: "bootstrap-5",
            placeholder: function () {
                return $(this).data("placeholder") || "Digite para buscar...";
            },
            allowClear: true,
            minimumInputLength: 0, // Permite abrir sem digitar
            language: {
                noResults: function () { return "Nenhum resultado encontrado"; },
                searching: function () { return "Buscando..."; },
                inputTooShort: function () { return "Digite para buscar..."; }
            },
            escapeMarkup: function (markup) { return markup; }
        });

        // Configuração específica para CA (permite tags e validação)
        $("#id_ca_epi").select2({
            theme: "bootstrap-5",
            placeholder: "Digite/Escaneie CA ou selecione modelo",
            allowClear: true,
            tags: true, // Permite digitar valores não existentes na lista
            minimumInputLength: 0,
            language: {
                noResults: function () { return "CA não encontrado na lista"; },
                searching: function () { return "Buscando CA..."; }
            },
            matcher: function (params, data) {
                if ($.trim(params.term) === "") return data;
                if (typeof data.text === "undefined" || !data.id) return null;
                const searchTermNormalized = normalizeCaNumber(params.term);
                const optionTextNormalized = normalizeCaNumber(data.text);
                if (optionTextNormalized.includes(searchTermNormalized)) return data;
                return null;
            },
            createTag: function (params) {
                const term = $.trim(params.term);
                const normalizedTerm = normalizeCaNumber(term);
                // Só cria tag se for um número
                if (normalizedTerm === "" || isNaN(parseInt(normalizedTerm))) return null;
                return { id: term, text: term, newTag: true };
            }
        });

        // Configuração específica para Matrícula (permite tags e validação)
        $("#id_funcionario_matricula").select2({
            theme: "bootstrap-5",
            placeholder: "Digite/Escaneie Matrícula ou selecione nome",
            allowClear: true,
            tags: true, // Permite digitar valores não existentes na lista
            minimumInputLength: 0,
            language: {
                noResults: function () { return "Matrícula não encontrada na lista"; },
                searching: function () { return "Buscando Matrícula..."; }
            },
            // Matcher simples por enquanto, pode refinar se necessário
            matcher: function (params, data) {
                 if ($.trim(params.term) === "") return data;
                 if (typeof data.text === "undefined" || !data.id) return null;
                 const searchTermNormalized = normalizeMatricula(params.term);
                 const optionTextNormalized = normalizeMatricula(data.text);
                 if (optionTextNormalized.includes(searchTermNormalized)) return data;
                 return null;
            },
            createTag: function (params) {
                const term = $.trim(params.term);
                // Só cria tag se não estiver vazio
                if (term === "") return null;
                return { id: term, text: term, newTag: true };
            }
        });
    }

    // --- Funções de Carregamento de Dados --- 

    async function popularSelect(selectElement, endpoint, valueField, textField, cacheKey, config = {}) {
        const { relatedSelectId, filterFn, dataMapFn } = config;
        if (isLoading[cacheKey]) return dadosCache[cacheKey];
        isLoading[cacheKey] = true;
        toggleLoading(selectElement.id, true);
        try {
            // Tenta usar cache primeiro
            if (dadosCache[cacheKey] && dadosCache[cacheKey].length > 0) {
                populateSelectOptions(selectElement, dadosCache[cacheKey], valueField, textField, config);
                return dadosCache[cacheKey];
            }
            // Busca na API
            const response = await get(endpoint);
            let items = response?.success ? response.data : (Array.isArray(response) ? response : []);
            if (!Array.isArray(items)) {
                throw new Error(`Formato de dados inválido para ${cacheKey}`);
            }
            // Aplica mapeamento se necessário (ex: Funcionários)
            if (dataMapFn) {
                items = items.map(dataMapFn);
            }
            dadosCache[cacheKey] = items;
            populateSelectOptions(selectElement, items, valueField, textField, config);

            // Preenche caches específicos
            if (cacheKey === "cas") {
                dadosCache.modeloPorCaCache.clear();
                items.forEach(ca => {
                    const normalizedCa = normalizeCaNumber(ca.numero_ca);
                    if (normalizedCa && ca.id_modelo_epi) {
                        dadosCache.modeloPorCaCache.set(normalizedCa, ca.id_modelo_epi);
                    }
                });
            }
            if (cacheKey === "funcionarios") {
                dadosCache.funcionarioPorMatriculaCache.clear();
                items.forEach(func => {
                    const normalizedMatricula = normalizeMatricula(func.numero_matricula);
                    if (normalizedMatricula && func.id_funcionario) {
                        dadosCache.funcionarioPorMatriculaCache.set(normalizedMatricula, func.id_funcionario);
                    }
                });
            }

            return items;
        } catch (error) {
            console.error(`Erro ao carregar ${cacheKey}:`, error);
            populateSelectOptions(selectElement, [], valueField, textField, { placeholderText: "Erro ao carregar" });
            dadosCache[cacheKey] = [];
            return [];
        } finally {
            isLoading[cacheKey] = false;
            toggleLoading(selectElement.id, false);
        }
    }

    function populateSelectOptions(selectElement, items, valueField, textField, config = {}) {
        const { placeholderText = "Selecione...", selectedValue = null, filterFn, relatedSelectId } = config;
        if (!selectElement) return;
        const $select = $(selectElement);
        const currentValue = selectedValue || $select.val();
        const finalPlaceholder = $select.data("placeholder") || placeholderText;
        selectElement.innerHTML = ""; // Limpa opções existentes

        // Adiciona placeholder
        const placeholderOption = document.createElement("option");
        placeholderOption.value = "";
        placeholderOption.textContent = finalPlaceholder;
        selectElement.appendChild(placeholderOption);

        // Filtra itens se necessário (ex: CAs/Lotes por modelo)
        const itemsToPopulate = filterFn ? items.filter(filterFn) : items;

        // Adiciona itens
        itemsToPopulate.forEach(item => {
            if (item && typeof item === "object" && item.hasOwnProperty(valueField) && item.hasOwnProperty(textField)) {
                const option = document.createElement("option");
                option.value = item[valueField];
                option.textContent = item[textField];
                option.dataset.item = JSON.stringify(item); // Guarda o objeto inteiro
                selectElement.appendChild(option);
            }
        });

        // Restaura valor selecionado e atualiza Select2
        $select.val(currentValue).trigger("change.select2");

        // Atualiza select relacionado (ex: Matrícula quando Nome muda)
        if (relatedSelectId) {
            const relatedSelect = document.getElementById(relatedSelectId);
            if (relatedSelect) {
                const relatedValueField = relatedSelectId === "id_funcionario_matricula" ? "id_funcionario" : "id_funcionario";
                const relatedTextField = relatedSelectId === "id_funcionario_matricula" ? "numero_matricula" : "nome_funcionario";
                populateSelectOptions(relatedSelect, items, relatedValueField, relatedTextField, { selectedValue: currentValue });
            }
        }
    }

    async function buscarDadosDependentes(modeloId, cacheMap, endpointPrefix, targetSelect, valueField, textField, cacheKey) {
        if (!modeloId) {
            dadosCache[cacheKey] = [];
            return [];
        }
        if (cacheMap.has(modeloId)) {
            dadosCache[cacheKey] = cacheMap.get(modeloId);
            return dadosCache[cacheKey];
        }
        toggleLoading(targetSelect.id, true);
        try {
            const response = await get(`${endpointPrefix}/modelo/${modeloId}`); // Ajustado para CA
            // Para Lotes, o endpoint é diferente: `estoques/modelo-epi/${modeloId}`
            if (endpointPrefix === 'estoques') {
                 response = await get(`estoques/modelo-epi/${modeloId}`);
            }

            const data = response.success ? response.data : (Array.isArray(response) ? response : []);
            if (!Array.isArray(data)) {
                dadosCache[cacheKey] = [];
                return [];
            }
            cacheMap.set(modeloId, data);
            dadosCache[cacheKey] = data;
            return data;
        } catch (error) {
            console.error(`Erro ao buscar ${cacheKey} para modelo ${modeloId}:`, error);
            dadosCache[cacheKey] = [];
            return [];
        } finally {
            toggleLoading(targetSelect.id, false);
        }
    }

    function loadTiposEntrega() {
        const tipos = ["Entrega", "Troca", "Devolucao"];
        tipoEntregaSelect.innerHTML = 
            '<option value="" selected disabled>Selecione o Tipo</option>';
        tipos.forEach((tipo) => {
            const option = document.createElement("option");
            option.value = tipo;
            option.textContent = tipo;
            tipoEntregaSelect.appendChild(option);
        });
    }

    // --- Funções de Validação e Processamento (Adaptadas) ---

    function validateSelectedOption(selectElement, errorElement, validList, valueToCheck, normalizeFn, errorMsgPrefix, idField) {
        showFieldError(selectElement, errorElement, null);
        let validatedId = null;
        if (!valueToCheck) return null; // Não valida se vazio

        const selectedOption = selectElement.querySelector(`option[value="${valueToCheck}"]`);
        const isNewTag = selectedOption && selectedOption.dataset.select2Tag === "true";

        if (isNewTag) {
            showFieldError(selectElement, errorElement, `${errorMsgPrefix} digitado "${valueToCheck}" não foi validado/encontrado.`);
            return null;
        }

        if (!validList || validList.length === 0) {
            // Não pode validar se a lista de referência (ex: CAs do modelo) não carregou
            // Poderia mostrar um aviso, mas por ora, não bloqueia
            console.warn(`Lista de validação para ${selectElement.id} está vazia.`);
             // Tenta encontrar o ID pelo valor selecionado na lista completa (cache geral)
            const itemCompleto = dadosCache[selectElement.id === 'id_ca_epi' ? 'cas' : 'lotes']?.find(item => item[idField] == valueToCheck);
            return itemCompleto ? itemCompleto[idField] : null;
        }

        const normalizedInput = normalizeFn(selectedOption.textContent);
        const foundItem = validList.find(item => normalizeFn(item[selectElement.id === 'id_ca_epi' ? 'numero_ca' : 'codigo_lote']) === normalizedInput);

        if (foundItem && foundItem[idField] == valueToCheck) {
            validatedId = foundItem[idField];
            return validatedId;
        } else {
            // Se o valor selecionado não corresponde a um item válido na lista filtrada
            showFieldError(selectElement, errorElement, `${errorMsgPrefix} "${selectedOption.textContent}" selecionado não pertence à lista do modelo atual.`);
            return null;
        }
    }

    async function processarEselecionarItem(selectElement, codigo, apiEndpoint, cacheMap, normalizeFn, idField, textField, relatedSelectElement, relatedIdField, successMsgElement, errorElement, errorMsgPrefix) {
        const codigoNormalizado = normalizeFn(codigo);
        if (!codigoNormalizado) {
            showFieldError(selectElement, errorElement, `Formato inválido: ${codigo}`);
            $(selectElement).val(null).trigger("change.select2");
            return null;
        }

        toggleLoading(selectElement.id, true);
        showFieldError(selectElement, errorElement, null);
        isUpdating[selectElement.id] = true;
        if (relatedSelectElement) isUpdating[relatedSelectElement.id] = true;

        try {
            let itemInfo = null;
            let relatedIdDoItem = cacheMap.get(codigoNormalizado);

            // 1. Tenta buscar via API específica (ex: /ca/numero/ ou /funcionarios?numero_matricula=)
            try {
                const response = await get(`${apiEndpoint}${codigoNormalizado}`);
                const data = response.success ? response.data : (Array.isArray(response) && response.length > 0 ? response[0] : (response || null)); // Ajuste para funcionario
                if (data && data[idField]) {
                    itemInfo = data;
                    relatedIdDoItem = itemInfo[relatedIdField];
                    if (relatedIdDoItem) cacheMap.set(codigoNormalizado, relatedIdDoItem);
                } else {
                     console.log(`${errorMsgPrefix} ${codigo} não encontrado via API específica.`);
                }
            } catch (error) {
                 if (error.response?.status !== 404) {
                    console.error(`Erro ao buscar ${errorMsgPrefix} ${codigo} via API:`, error);
                 }
            }

            // 2. Se não encontrou via API específica ou não tem ID relacionado, tenta no cache geral
            if (!itemInfo && dadosCache[selectElement.id === 'id_ca_epi' ? 'cas' : 'funcionarios']) {
                 itemInfo = dadosCache[selectElement.id === 'id_ca_epi' ? 'cas' : 'funcionarios'].find(item => normalizeFn(item[textField]) === codigoNormalizado);
                 if(itemInfo) relatedIdDoItem = itemInfo[relatedIdField];
            }

            // 3. Se ainda não encontrou, falha
            if (!itemInfo || (relatedSelectElement && !relatedIdDoItem)) {
                const errorDetail = relatedSelectElement && !relatedIdDoItem ? ` ou sem ${relatedSelectElement.id.replace('id_', '').replace('_epi','')} associado` : '';
                showFieldError(selectElement, errorElement, `${errorMsgPrefix} ${codigo} não encontrado${errorDetail}.`);
                $(selectElement).find(`option[value="${codigo}"]`).remove(); // Remove tag inválida
                $(selectElement).val(null).trigger("change.select2");
                return null;
            }

            // 4. Atualiza campo relacionado (Modelo EPI ou Nome Funcionário) se necessário
            if (relatedSelectElement) {
                const relatedSelecionadoAtual = $(relatedSelectElement).val();
                if (relatedSelecionadoAtual != relatedIdDoItem) {
                    $(relatedSelectElement).val(relatedIdDoItem).trigger("change.select2");
                    markAsAutoFilled(relatedSelectElement);
                    if (successMsgElement) showSuccessMessage(successMsgElement.id, `✓ ${relatedSelectElement.id.replace('id_', '').replace('_epi','')} atualizado automaticamente.`);
                    // Espera a atualização do campo relacionado (ex: carregar CAs do modelo)
                    await new Promise(resolve => setTimeout(resolve, 500)); // Pequeno delay
                }
            }

            // 5. Garante que a opção existe e seleciona no select principal
            const $select = $(selectElement);
            $select.find(`option[value="${codigo}"]`).remove(); // Remove tag digitada
            if (!$select.find(`option[value="${itemInfo[idField]}"]`).length) {
                const option = new Option(itemInfo[textField], itemInfo[idField], true, true);
                option.dataset.item = JSON.stringify(itemInfo);
                $select.append(option);
            }
            $select.val(itemInfo[idField]).trigger("change.select2");
            markAsAutoFilled(selectElement);
            showFieldError(selectElement, errorElement, null); // Limpa erro
            return itemInfo;

        } catch (error) {
            console.error(`Erro geral ao processar ${errorMsgPrefix} ${codigo}:`, error);
            showFieldError(selectElement, errorElement, `Erro ao validar ${errorMsgPrefix} ${codigo}.`);
            $(selectElement).val(null).trigger("change.select2");
            return null;
        } finally {
            toggleLoading(selectElement.id, false);
            setTimeout(() => {
                isUpdating[selectElement.id] = false;
                if (relatedSelectElement) isUpdating[relatedSelectElement.id] = false;
            }, 150); // Aumentar ligeiramente o timeout
        }
    }

    // --- Event Listeners --- 

    // Modelo EPI -> Carrega CAs e Lotes
    $(epiModelSelect).on("change", async function () {
        if (isUpdating.modelo) return;
        const modeloId = $(this).val();
        validatedCaId = null;
        validatedLoteId = null;
        showFieldError(caSelect, caErrorMessage, null);
        // Limpa e atualiza CAs
        const casDoModelo = await buscarDadosDependentes(modeloId, dadosCache.casPorModeloCache, "ca", caSelect, "id_ca", "numero_ca", "validCaForModel");
        populateSelectOptions(caSelect, casDoModelo, "id_ca", "numero_ca");
        // Limpa e atualiza Lotes
        const lotesDoModelo = await buscarDadosDependentes(modeloId, dadosCache.lotesPorModeloCache, "estoques", loteSelect, "id_estoque_lote", "codigo_lote", "validLoteForModel");
        populateSelectOptions(loteSelect, lotesDoModelo, "id_estoque_lote", "codigo_lote");

        if (modeloId) {
            showSuccessMessage("modelo-success-message", "✓ CAs e Lotes disponíveis carregados.");
        }
    });

    // CA -> Valida ou Processa Tag
    $(caSelect).on("change", async function () {
        if (isUpdating.ca) return;
        const selectedValue = $(this).val();
        validatedCaId = null;
        showFieldError(caSelect, caErrorMessage, null);

        if (selectedValue) {
            const selectedOption = caSelect.querySelector(`option[value="${selectedValue}"]`);
            const isNewTag = selectedOption && selectedOption.dataset.select2Tag === "true";

            if (isNewTag) {
                const caInfo = await processarEselecionarItem(caSelect, selectedValue, "ca/numero/", dadosCache.modeloPorCaCache, normalizeCaNumber, "id_ca", "numero_ca", epiModelSelect, "id_modelo_epi", modeloSuccessMessage, caErrorMessage, "CA");
                if (caInfo) {
                    validatedCaId = caInfo.id_ca;
                } else {
                    $(caSelect).val(null).trigger("change.select2");
                }
            } else {
                // Valida opção existente contra a lista do modelo
                validatedCaId = validateSelectedOption(caSelect, caErrorMessage, dadosCache.validCaForModel, selectedValue, normalizeCaNumber, "CA", "id_ca");
            }
        }
    });

    // Lote -> Valida (não permite tag)
     $(loteSelect).on("change", function () {
        if (isUpdating.lote) return;
        const selectedValue = $(this).val();
        validatedLoteId = null;
        // Adicionar elemento de erro para lote se necessário
        // showFieldError(loteSelect, loteErrorMessage, null);

        if (selectedValue) {
            // Valida opção existente contra a lista do modelo
            // Nota: Não permite tags para lote, apenas seleção
            const loteValido = dadosCache.validLoteForModel?.find(lote => lote.id_estoque_lote == selectedValue);
            if(loteValido){
                validatedLoteId = loteValido.id_estoque_lote;
            } else if (dadosCache.validLoteForModel?.length > 0) {
                 // Se a lista de lotes do modelo existe mas o selecionado não está nela
                 // showFieldError(loteSelect, loteErrorMessage, "Lote selecionado não pertence ao modelo atual.");
                 console.warn("Lote selecionado não pertence ao modelo atual.");
                 // $(loteSelect).val(null).trigger("change.select2"); // Descomentar para limpar seleção inválida
            } else {
                // Se a lista de lotes do modelo está vazia (não carregou ou não tem lotes)
                // Apenas aceita o ID selecionado, assumindo que veio do cache geral
                validatedLoteId = parseInt(selectedValue, 10);
                console.warn("Validando lote sem lista específica do modelo.");
            }
        }
    });

    // Funcionário Nome -> Sincroniza Matrícula
    $(funcionarioNomeSelect).on("change", function () {
        if (isUpdating.funcionarioNome) return;
        const selectedFuncId = $(this).val();
        validatedFuncionarioId = selectedFuncId ? parseInt(selectedFuncId, 10) : null;
        isUpdating.funcionarioMatricula = true;
        $(funcionarioMatriculaSelect).val(selectedFuncId).trigger("change.select2");
        setTimeout(() => { isUpdating.funcionarioMatricula = false; }, 100);
        // Limpar erro da matrícula se houver
        // showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, null);
    });

    // Funcionário Matrícula -> Sincroniza Nome / Valida ou Processa Tag
    $(funcionarioMatriculaSelect).on("change", async function () {
        if (isUpdating.funcionarioMatricula) return;
        const selectedValue = $(this).val();
        validatedFuncionarioId = null;
        // Limpar erro da matrícula se houver
        // showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, null);

        if (selectedValue) {
            const selectedOption = funcionarioMatriculaSelect.querySelector(`option[value="${selectedValue}"]`);
            const isNewTag = selectedOption && selectedOption.dataset.select2Tag === "true";

            if (isNewTag) {
                // Tenta processar a matrícula digitada
                const funcInfo = await processarEselecionarItem(funcionarioMatriculaSelect, selectedValue, "funcionarios?numero_matricula=", dadosCache.funcionarioPorMatriculaCache, normalizeMatricula, "id_funcionario", "numero_matricula", funcionarioNomeSelect, "id_funcionario", null, null, "Matrícula"); // Adicionar elementos de erro/sucesso se desejar
                if (funcInfo) {
                    validatedFuncionarioId = funcInfo.id_funcionario;
                } else {
                    $(funcionarioMatriculaSelect).val(null).trigger("change.select2");
                    // Sincroniza nome para vazio também
                    isUpdating.funcionarioNome = true;
                    $(funcionarioNomeSelect).val(null).trigger("change.select2");
                    setTimeout(() => { isUpdating.funcionarioNome = false; }, 100);
                }
            } else {
                // Apenas sincroniza o nome se a seleção foi de um item existente
                validatedFuncionarioId = parseInt(selectedValue, 10);
                isUpdating.funcionarioNome = true;
                $(funcionarioNomeSelect).val(selectedValue).trigger("change.select2");
                setTimeout(() => { isUpdating.funcionarioNome = false; }, 100);
            }
        }
         else {
             // Se limpou a matrícula, limpa o nome também
             isUpdating.funcionarioNome = true;
             $(funcionarioNomeSelect).val(null).trigger("change.select2");
             setTimeout(() => { isUpdating.funcionarioNome = false; }, 100);
         }
    });

    // --- Scanner --- 
    document.addEventListener("keypress", async (event) => {
        const currentTime = Date.now();
        // Ignora input se foco estiver em campos editáveis
        if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA" || $(event.target).closest('.select2-search__field').length > 0) {
            lastKeyTime = currentTime;
            return;
        }
        // Reseta buffer se pausa longa
        if (currentTime - lastKeyTime > 150) { // Aumentar um pouco o tempo
            scannedInput = "";
        }
        // Processa ao pressionar Enter
        if (event.key === "Enter") {
            if (scannedInput.length > 3) {
                console.log("Scanner Enter detectado, código:", scannedInput);
                await processScannedCode(scannedInput);
            }
            scannedInput = "";
        } else if (event.key && event.key.length === 1) {
            // Adiciona ao buffer
            scannedInput += event.key;
        }
        lastKeyTime = currentTime;
    });

    async function processScannedCode(code) {
        console.log("Processando código do scanner:", code);
        // Prioridade 1: Tentar como Matrícula de Funcionário
        const funcInfo = await processarEselecionarItem(funcionarioMatriculaSelect, code, "funcionarios?numero_matricula=", dadosCache.funcionarioPorMatriculaCache, normalizeMatricula, "id_funcionario", "numero_matricula", funcionarioNomeSelect, "id_funcionario", null, null, "Matrícula");
        if (funcInfo) {
            console.log(`Scanner: Funcionário ${funcInfo.nome_funcionario} selecionado.`);
            validatedFuncionarioId = funcInfo.id_funcionario;
            return; // Encontrou funcionário, termina
        }

        // Prioridade 2: Tentar como CA
        const caInfo = await processarEselecionarItem(caSelect, code, "ca/numero/", dadosCache.modeloPorCaCache, normalizeCaNumber, "id_ca", "numero_ca", epiModelSelect, "id_modelo_epi", modeloSuccessMessage, caErrorMessage, "CA");
        if (caInfo) {
            console.log(`Scanner: CA ${caInfo.numero_ca} selecionado.`);
            validatedCaId = caInfo.id_ca;
            return; // Encontrou CA, termina
        }

        console.log(`Scanner: Código ${code} não reconhecido.`);
        // Poderia adicionar feedback visual aqui se não reconhecido
    }

    // --- Submissão do Formulário --- 
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Revalidar campos Select2 antes de submeter
        const modeloId = $(epiModelSelect).val();
        const caValue = $(caSelect).val();
        const loteValue = $(loteSelect).val();
        const funcValue = $(funcionarioNomeSelect).val(); // Usa nome ou matrícula, já que estão sincronizados

        if (!modeloId) {
            alert("Selecione o Modelo do EPI.");
            $(epiModelSelect).select2("open");
            return;
        }

        // Valida CA
        validatedCaId = validateSelectedOption(caSelect, caErrorMessage, dadosCache.validCaForModel, caValue, normalizeCaNumber, "CA", "id_ca");
        if (!validatedCaId) {
             if (!caErrorMessage.textContent) { // Se não houve erro específico, mostra erro genérico
                 showFieldError(caSelect, caErrorMessage, "Selecione ou digite/escaneie um CA válido para o modelo.");
             }
            $(caSelect).select2("open");
            return;
        }

         // Valida Funcionário (apenas verifica se algo foi selecionado)
         if (!funcValue) {
             alert("Selecione o Funcionário (Nome ou Matrícula).");
             // Poderia adicionar showFieldError para funcionário se desejado
             $(funcionarioNomeSelect).select2("open");
             return;
         }
         validatedFuncionarioId = parseInt(funcValue, 10);

         // Valida Lote
         validatedLoteId = validateSelectedOption(loteSelect, null, dadosCache.validLoteForModel, loteValue, (val) => val, "Lote", "id_estoque_lote"); // Normalização simples
         if (!validatedLoteId) {
             alert("Selecione um Lote válido para o modelo.");
             // Poderia adicionar showFieldError para lote se desejado
             $(loteSelect).select2("open");
             return;
         }

        // Coleta dados para envio
        const now = new Date();
        const dataFormatada = dataEntregaInput.value || now.toISOString().split("T")[0];
        const horaFormatada = now.toTimeString().split(" ")[0];

        const entregaData = {
            tipo_movimentacao: tipoEntregaSelect.value,
            data: dataFormatada,
            hora: horaFormatada,
            quantidade: parseInt(quantidadeInput.value, 10),
            descricao: observacoesTextarea.value || null,
            id_funcionario: validatedFuncionarioId,
            id_modelo_epi: parseInt(modeloId, 10),
            id_ca: validatedCaId, // Adiciona o ID do CA validado
            id_estoque_lote: validatedLoteId,
        };

        // Validação final dos dados coletados
        if (
            !entregaData.tipo_movimentacao ||
            isNaN(entregaData.quantidade) ||
            entregaData.quantidade <= 0 ||
            isNaN(entregaData.id_funcionario) ||
            isNaN(entregaData.id_modelo_epi) ||
            isNaN(entregaData.id_ca) ||
            isNaN(entregaData.id_estoque_lote)
        ) {
            alert("Erro na coleta de dados. Verifique os campos obrigatórios.");
            console.error("Dados inválidos para submissão:", entregaData);
            return;
        }

        console.log("Enviando dados da entrega:", entregaData);

        // Envio para API
        try {
            const responseData = await post("entregas-epi", entregaData);
            if (responseData.success || responseData.id) { // Verifica sucesso ou presença de ID
                 alert(`Entrega registrada com sucesso! ID: ${responseData.id || 'N/A'}`);
                 form.reset();
                 // Limpa Select2
                 $(".searchable-select").val(null).trigger("change.select2");
                 // Limpa campos dependentes e mensagens de erro/sucesso
                 populateSelectOptions(caSelect, [], "id_ca", "numero_ca");
                 populateSelectOptions(loteSelect, [], "id_estoque_lote", "codigo_lote");
                 showFieldError(caSelect, caErrorMessage, null);
                 modeloSuccessMessage.style.display = 'none';
                 validatedCaId = null;
                 validatedFuncionarioId = null;
                 validatedLoteId = null;
            } else {
                 throw new Error(responseData.error || "Falha ao registrar entrega.");
            }
        } catch (error) {
            const errorMessage = error.response?.data?.error || error.message || "Erro desconhecido ao registrar entrega.";
            alert(`Erro: ${errorMessage}`);
            console.error("Erro ao registrar entrega:", error);
        }
    });

    // --- Carregamento Inicial --- 
    async function inicializarPagina() {
        initializeSelect2();
        loadTiposEntrega(); // Carrega tipos estáticos
        await Promise.all([
            popularSelect(epiModelSelect, "modelos-epi", "id_modelo_epi", "nome_epi", "modelosEpi"),
            popularSelect(funcionarioNomeSelect, "funcionarios", "id_funcionario", "nome_funcionario", "funcionarios", {
                relatedSelectId: "id_funcionario_matricula"
            }),
            // Carrega CAs e Lotes gerais no cache, mas não popula os selects inicialmente
            popularSelect(null, "ca", "id_ca", "numero_ca", "cas"),
            popularSelect(null, "estoques", "id_estoque_lote", "codigo_lote", "lotes"),
        ]);
         // Popula matrícula após funcionários carregarem
         populateSelectOptions(funcionarioMatriculaSelect, dadosCache.funcionarios, "id_funcionario", "numero_matricula");
         // Define placeholders iniciais para CAs e Lotes
         populateSelectOptions(caSelect, [], "id_ca", "numero_ca", { placeholderText: "Selecione o Modelo Primeiro" });
         populateSelectOptions(loteSelect, [], "id_estoque_lote", "codigo_lote", { placeholderText: "Selecione o Modelo Primeiro" });
    }

    inicializarPagina();
});

