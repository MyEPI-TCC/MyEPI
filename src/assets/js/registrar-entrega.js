import { get, post } from "../../services/api.js"; // Mantendo caminho original

$(document).ready(function () {
    // --- Elementos do Formulário ---
    const form = document.getElementById("form-registro-entrega");
    const epiModelSelect = document.getElementById("id_modelo_epi");
    const loteSelect = document.getElementById("id_lote");
    const caSelect = document.getElementById("id_ca_epi");
    const quantidadeInput = document.getElementById("quantidade");
    const funcionarioMatriculaSelect = document.getElementById("id_funcionario_matricula");
    const funcionarioNomeSelect = document.getElementById("id_funcionario_nome");
    const tipoEntregaSelect = document.getElementById("id_tipo_entrega");
    const dataEntregaInput = document.getElementById("data_entrega");
    const observacoesTextarea = document.getElementById("observacoes");

    // --- Elementos de Scanner ---
    const scanCaBtn = document.getElementById("scan-ca-btn");
    const scanMatriculaBtn = document.getElementById("scan-matricula-btn");
    const scannerModalElement = document.getElementById("scannerModal");
    const scannerModal = scannerModalElement ? new bootstrap.Modal(scannerModalElement) : null;
    const scannerInput = document.getElementById("scanner-input");
    const scannerModalLabel = document.getElementById("scannerModalLabel");
    const scannerModalInstruction = document.getElementById("scannerModalInstruction");
    const scannerLoading = document.getElementById("scanner-loading");
    const scannerSuccess = document.getElementById("scanner-success");
    const scannerError = document.getElementById("scanner-error");
    let currentScanTarget = null; 
    // --- Elementos de Feedback ---
    const caErrorMessage = document.getElementById("ca-error-message");
    const modeloSuccessMessage = document.getElementById("modelo-success-message");
    const loteErrorMessage = document.createElement("div");
    loteErrorMessage.className = "text-danger mt-1";
    loteErrorMessage.style.fontSize = "0.875rem";
    loteErrorMessage.style.display = "none";
    if (loteSelect && loteSelect.parentNode) {
        loteSelect.parentNode.appendChild(loteErrorMessage);
    }
    const matriculaErrorMessage = document.createElement("div");
    matriculaErrorMessage.className = "text-danger mt-1";
    matriculaErrorMessage.style.fontSize = "0.875rem";
    matriculaErrorMessage.style.display = "none";
     if (funcionarioMatriculaSelect && funcionarioMatriculaSelect.parentNode) {
        funcionarioMatriculaSelect.parentNode.appendChild(matriculaErrorMessage);
    }

    // --- Cache e Estado ---
    let dadosCache = {
        modelosEpi: [],
        funcionarios: [],
        cas: [],
        lotes: [], // Cache para todos os lotes
        tiposEntrega: ["Entrega", "Troca", "Devolucao"],
        casPorModeloCache: new Map(),
        lotesPorModeloCache: new Map(), // Cache para lotes filtrados por modelo
        modeloPorCaCache: new Map(),
        funcionarioPorMatriculaCache: new Map(),
        validCaForModel: [],
        validLoteForModel: [], // Guarda os lotes válidos após filtrar
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
        lote: false,
        funcionarioNome: false,
        funcionarioMatricula: false,
    };
    let validatedCaId = null;
    let validatedFuncionarioId = null;
    let validatedLoteId = null;
    let validatedModeloId = null;

    // --- Funções Auxiliares ---

    // Normaliza CA para conter apenas números
    function normalizeCaNumber(caText) {
        if (!caText) return "";
        // Remove tudo que não for dígito
        return caText.replace(/\D/g, 
            '') || "";
    }

    function normalizeMatricula(matriculaText) {
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
        if (!selectElement || !errorElement) return;
        const $selectContainer = $(selectElement).next(".select2-container").find(".select2-selection");
        if (message) {
            errorElement.textContent = message;
            errorElement.style.display = "block";
            selectElement.classList.add("is-invalid");
            if ($selectContainer.length) $selectContainer.addClass("is-invalid");
        } else {
            errorElement.style.display = "none";
            selectElement.classList.remove("is-invalid");
             if ($selectContainer.length) $selectContainer.removeClass("is-invalid");
        }
    }

    // --- Inicialização do Select2 ---
    function initializeSelect2() {
        // Selects comuns
        $("#id_modelo_epi, #id_lote, #id_funcionario_nome").select2({
            theme: "bootstrap-5",
            placeholder: function () { return $(this).data("placeholder") || "Selecione..."; },
            allowClear: true,
            minimumInputLength: 0,
            language: { noResults: () => "Nenhum resultado", searching: () => "Buscando..." },
            escapeMarkup: (markup) => markup
        });

        // Configuração para CA (permite tags e validação flexível)
        $("#id_ca_epi").select2({
            theme: "bootstrap-5",
            placeholder: "Digite/Escaneie CA...",
            allowClear: true,
            tags: true,
            minimumInputLength: 0,
            language: { noResults: () => "CA não encontrado", searching: () => "Buscando CA..." },
            matcher: function (params, data) {
                if ($.trim(params.term) === "") return data;
                if (typeof data.text === "undefined" || !data.id) return null;
                // Compara usando o número normalizado
                const searchTermNormalized = normalizeCaNumber(params.term);
                const optionTextNormalized = normalizeCaNumber(data.text);
                if (optionTextNormalized.includes(searchTermNormalized)) return data;
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

        // Configuração para Matrícula (permite tags)
        $("#id_funcionario_matricula").select2({
            theme: "bootstrap-5",
            placeholder: "Digite/Escaneie Matrícula...",
            allowClear: true,
            tags: true,
            minimumInputLength: 0,
            language: { noResults: () => "Matrícula não encontrada", searching: () => "Buscando..." },
            createTag: function (params) {
                const term = $.trim(params.term);
                if (term === "") return null;
                return { id: term, text: term, newTag: true };
            }
        });
    }

    // --- Funções de Carregamento de Dados ---
    async function popularSelect(selectElement, endpoint, valueField, textField, cacheKey, config = {}) {
        const { forceReload = false, dataMapFn = null } = config;
        // Permite pré-carregar CAs e Lotes sem elemento select visível inicialmente
        if (!selectElement && cacheKey !== 'cas' && cacheKey !== 'lotes') return [];

        if (isLoading[cacheKey] && !forceReload) {
            if(selectElement) populateSelectOptions(selectElement, dadosCache[cacheKey] || [], valueField, textField, config);
            return dadosCache[cacheKey] || [];
        }
        isLoading[cacheKey] = true;
        if(selectElement) toggleLoading(selectElement.id, true);
        try {
            if (!forceReload && dadosCache[cacheKey] && dadosCache[cacheKey].length > 0) {
                if(selectElement) populateSelectOptions(selectElement, dadosCache[cacheKey], valueField, textField, config);
                return dadosCache[cacheKey];
            }
            console.log(`Buscando dados para ${cacheKey} em ${endpoint}`); // Log da chamada
            const response = await get(endpoint);
            console.log(`Resposta para ${cacheKey} de ${endpoint}:`, response); // Log da resposta
            let items = response?.success ? response.data : (Array.isArray(response) ? response : []);
            if (!Array.isArray(items)) {
                console.error(`Formato de dados inválido para ${cacheKey} de ${endpoint}:`, items);
                throw new Error(`Formato de dados inválido para ${cacheKey}`);
            }
            if (dataMapFn) {
                items = items.map(dataMapFn);
            }
            dadosCache[cacheKey] = items;
            if(selectElement) populateSelectOptions(selectElement, items, valueField, textField, config);

            // Preencher caches específicos
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
            console.error(`Erro ao carregar ${cacheKey} de ${endpoint}:`, error);
            if(selectElement) populateSelectOptions(selectElement, [], valueField, textField, { placeholderText: "Erro ao carregar" });
            dadosCache[cacheKey] = [];
            return [];
        } finally {
            isLoading[cacheKey] = false;
            if(selectElement) toggleLoading(selectElement.id, false);
        }
    }

    function populateSelectOptions(selectElement, items, valueField, textField, config = {}) {
        const { placeholderText = "Selecione...", selectedValue = null } = config;
        if (!selectElement) return;
        const $select = $(selectElement);
        const currentValue = selectedValue || $select.val();
        const finalPlaceholder = $select.data("placeholder") || placeholderText;
        selectElement.innerHTML = "";
        const placeholderOption = document.createElement("option");
        placeholderOption.value = "";
        placeholderOption.textContent = finalPlaceholder;
        selectElement.appendChild(placeholderOption);
        items.forEach(item => {
            if (item && typeof item === "object" && item.hasOwnProperty(valueField) && item.hasOwnProperty(textField)) {
                const option = document.createElement("option");
                option.value = item[valueField];
                option.textContent = item[textField];
                option.dataset.item = JSON.stringify(item);
                selectElement.appendChild(option);
            }
        });
        // Define o valor e dispara change.select2 para atualizar a UI do Select2
        $select.val(currentValue).trigger("change.select2");
    }

    // Função para buscar e popular lotes filtrados por modelo
    async function buscarLotesPorModelo(modeloId) {
        if (!modeloId) {
            dadosCache.validLoteForModel = [];
            populateSelectOptions(loteSelect, [], "id_estoque_lote", "codigo_lote", { placeholderText: "Selecione Modelo primeiro..." });
            return [];
        }
        // Tenta usar cache
        if (dadosCache.lotesPorModeloCache.has(modeloId)) {
            const cachedData = dadosCache.lotesPorModeloCache.get(modeloId);
            dadosCache.validLoteForModel = cachedData;
            populateSelectOptions(loteSelect, cachedData, "id_estoque_lote", "codigo_lote");
            return cachedData;
        }
        // Busca na API
        toggleLoading(loteSelect.id, true);
        try {
            const endpoint = `estoques/modelo-epi/${modeloId}`;
            console.log(`Buscando lotes para modelo ${modeloId} em ${endpoint}`); // Log
            const response = await get(endpoint);
            console.log(`Resposta para lotes do modelo ${modeloId}:`, response); // Log
            const data = response.success ? response.data : (Array.isArray(response) ? response : []);
            if (!Array.isArray(data)) {
                 console.error("Resposta inválida para lotes por modelo:", data);
                throw new Error(`Resposta inválida para lotes`);
            }
            dadosCache.lotesPorModeloCache.set(modeloId, data);
            dadosCache.validLoteForModel = data;
            loteSelect.disabled = false; // Re-enable BEFORE populating
            populateSelectOptions(loteSelect, data, "id_estoque_lote", "codigo_lote"); // Populates and triggers change.select2
            return data;
        } catch (error) {
            console.error(`Erro ao buscar lotes para modelo ${modeloId}:`, error);
            dadosCache.validLoteForModel = [];
            loteSelect.disabled = true; // Keep disabled on error
            populateSelectOptions(loteSelect, [], "id_estoque_lote", "codigo_lote", { placeholderText: "Erro ao carregar lotes" });
            return [];
        } finally {
            toggleLoading(loteSelect.id, false);
            // No need to explicitly enable/disable here again, handled in try/catch
            $(loteSelect).trigger("change.select2"); // Ensure visual state is updated
        }
    }

    // Função para buscar e popular CAs filtrados por modelo
    async function buscarCasPorModelo(modeloId) {
        if (!modeloId) {
            dadosCache.validCaForModel = [];
            populateSelectOptions(caSelect, [], "id_ca", "numero_ca", { placeholderText: "Selecione Modelo primeiro..." });
            return [];
        }
        // Tenta usar cache
        if (dadosCache.casPorModeloCache.has(modeloId)) {
            const cachedData = dadosCache.casPorModeloCache.get(modeloId);
            dadosCache.validCaForModel = cachedData;
            populateSelectOptions(caSelect, cachedData, "id_ca", "numero_ca");
            return cachedData;
        }
        // Busca na API
        toggleLoading(caSelect.id, true);
        try {
            const endpoint = `ca/modelo/${modeloId}`;
            console.log(`Buscando CAs para modelo ${modeloId} em ${endpoint}`); // Log
            const response = await get(endpoint);
            console.log(`Resposta para CAs do modelo ${modeloId}:`, response); // Log
            const data = response.success ? response.data : (Array.isArray(response) ? response : []);
            if (!Array.isArray(data)) {
                console.error("Resposta inválida para CAs por modelo:", data);
                throw new Error(`Resposta inválida para CAs`);
            }
            dadosCache.casPorModeloCache.set(modeloId, data);
            dadosCache.validCaForModel = data;
            populateSelectOptions(caSelect, data, "id_ca", "numero_ca");
            return data;
        } catch (error) {
            console.error(`Erro ao buscar CAs para modelo ${modeloId}:`, error);
            dadosCache.validCaForModel = [];
            populateSelectOptions(caSelect, [], "id_ca", "numero_ca", { placeholderText: "Erro ao carregar CAs" });
            return [];
        } finally {
            toggleLoading(caSelect.id, false);
        }
    }

    function loadTiposEntrega() {
        populateSelectOptions(tipoEntregaSelect, dadosCache.tiposEntrega.map(t => ({id: t, nome: t})), "id", "nome");
    }

    // --- Funções de Validação e Processamento --- 

    // Valida CA (considera seleção ou tag digitada)
    function validateCaOption(selectedValue) {
        showFieldError(caSelect, caErrorMessage, null);
        validatedCaId = null;
        if (!selectedValue) return false;

        const modeloId = validatedModeloId || $(epiModelSelect).val();
        if (!modeloId) {
            showFieldError(caSelect, caErrorMessage, "Selecione o Modelo do EPI primeiro.");
            return false;
        }

        const selectedOption = caSelect.querySelector(`option[value="${selectedValue}"]`);
        const isNewTag = selectedOption && selectedOption.dataset.select2Tag === "true";
        const textToValidate = isNewTag ? selectedValue : selectedOption?.textContent;
        const normalizedCaInput = normalizeCaNumber(textToValidate);

        if (!normalizedCaInput) {
             showFieldError(caSelect, caErrorMessage, `Formato de CA inválido: "${textToValidate}".`);
             return false;
        }

        if (!dadosCache.validCaForModel || dadosCache.validCaForModel.length === 0) {
            console.warn("Lista de CAs válidos para o modelo não carregada.");
            // Tenta validar pelo menos se o CA existe no cache geral e pertence ao modelo
            const caGeral = dadosCache.cas.find(ca => normalizeCaNumber(ca.numero_ca) === normalizedCaInput);
            if (caGeral && caGeral.id_modelo_epi == modeloId) {
                validatedCaId = caGeral.id_ca;
                // Se for tag, atualiza o select com o valor correto
                if (isNewTag) {
                    const option = new Option(caGeral.numero_ca, caGeral.id_ca, true, true);
                    $(caSelect).find(`option[value="${selectedValue}"]`).remove();
                    caSelect.appendChild(option);
                    $(caSelect).trigger("change.select2");
                }
                return true;
            }
            showFieldError(caSelect, caErrorMessage, `CA "${normalizedCaInput}" não encontrado ou inválido para este modelo.`);
            return false;
        }

        // Valida contra a lista específica do modelo
        const foundCa = dadosCache.validCaForModel.find(ca => normalizeCaNumber(ca.numero_ca) === normalizedCaInput);
        if (foundCa) {
            validatedCaId = foundCa.id_ca;
             // Se for tag, atualiza o select com o valor correto
            if (isNewTag) {
                const option = new Option(foundCa.numero_ca, foundCa.id_ca, true, true);
                $(caSelect).find(`option[value="${selectedValue}"]`).remove();
                caSelect.appendChild(option);
                $(caSelect).trigger("change.select2");
            }
            return true;
        } else {
            showFieldError(caSelect, caErrorMessage, `CA "${normalizedCaInput}" não é válido para este Modelo.`);
            return false;
        }
    }

    // Valida Lote
    function validateLoteOption(selectedValue) {
        showFieldError(loteSelect, loteErrorMessage, null);
        validatedLoteId = null;
        if (!selectedValue) return false;

        const modeloId = validatedModeloId || $(epiModelSelect).val();
        if (!modeloId) {
            showFieldError(loteSelect, loteErrorMessage, "Selecione o Modelo do EPI primeiro.");
            return false;
        }

        if (!dadosCache.validLoteForModel || dadosCache.validLoteForModel.length === 0) {
            console.warn("Lista de Lotes válidos para o modelo não carregada.");
            // Tenta validar contra o cache geral de lotes, verificando se pertence ao modelo
            const loteGeral = dadosCache.lotes.find(lote => lote.id_estoque_lote == selectedValue);
             if (loteGeral && loteGeral.id_modelo_epi == modeloId) { // Verifica se pertence ao modelo
                validatedLoteId = loteGeral.id_estoque_lote;
                return true;
            }
            showFieldError(loteSelect, loteErrorMessage, "Não foi possível validar o Lote.");
            return false;
        }

        // Valida contra a lista específica do modelo
        const foundLote = dadosCache.validLoteForModel.find(lote => lote.id_estoque_lote == selectedValue);
        if (foundLote) {
            validatedLoteId = foundLote.id_estoque_lote;
            return true;
        } else {
            showFieldError(loteSelect, loteErrorMessage, `Lote selecionado não é válido para este Modelo.`);
            return false;
        }
    }

    // Valida Funcionário (considera seleção ou tag digitada)
    function validateFuncionarioOption(selectedValue, isMatricula) {
        showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, null);
        validatedFuncionarioId = null;
        if (!selectedValue) return false;

        const targetSelect = isMatricula ? funcionarioMatriculaSelect : funcionarioNomeSelect;
        const relatedSelect = isMatricula ? funcionarioNomeSelect : funcionarioMatriculaSelect;
        const selectedOption = targetSelect.querySelector(`option[value="${selectedValue}"]`);
        const isNewTag = selectedOption && selectedOption.dataset.select2Tag === "true";

        if (isNewTag) {
            // A validação de tag acontece em processarScan ou no evento change da matrícula
            return false;
        }

        // Valida se o ID existe no cache
        const foundFunc = dadosCache.funcionarios.find(f => f.id_funcionario == selectedValue);
        if (foundFunc) {
            validatedFuncionarioId = foundFunc.id_funcionario;
            // Sincroniza o outro select (Nome ou Matrícula)
            const relatedValue = foundFunc.id_funcionario;
            if ($(relatedSelect).val() != relatedValue) {
                const updatingFlag = isMatricula ? 'funcionarioNome' : 'funcionarioMatricula';
                isUpdating[updatingFlag] = true;
                $(relatedSelect).val(relatedValue).trigger("change.select2");
                setTimeout(() => isUpdating[updatingFlag] = false, 50);
            }
            return true;
        } else {
            showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, "Funcionário selecionado inválido.");
            return false;
        }
    }

    // --- Processamento de Scan/Tag (Apenas CA e Matrícula) ---
    async function processarScan(codigo, target) {
        console.log(`Processando scan para ${target}: ${codigo}`);
        let success = false;
        let foundItem = null;
        let errorMessage = "Código não encontrado ou inválido.";

        try {
            if (target === "ca") {
                const normalizedCa = normalizeCaNumber(codigo);
                if (!normalizedCa) {
                    errorMessage = "Formato de CA inválido.";
                    throw new Error(errorMessage);
                }
                const modeloIdDoCa = dadosCache.modeloPorCaCache.get(normalizedCa);
                if (modeloIdDoCa) {
                    // Busca os CAs específicos do modelo para obter o ID correto do CA
                    const casDoModelo = await buscarCasPorModelo(modeloIdDoCa);
                    foundItem = casDoModelo.find(ca => normalizeCaNumber(ca.numero_ca) === normalizedCa);
                    if (foundItem) {
                        // Atualiza modelo se necessário
                        if ($(epiModelSelect).val() != modeloIdDoCa) {
                            isUpdating.modelo = true;
                            $(epiModelSelect).val(modeloIdDoCa).trigger("change"); // Dispara change para carregar Lotes/CAs
                            markAsAutoFilled(epiModelSelect);
                            validatedModeloId = modeloIdDoCa;
                            // Espera um pouco para o change do modelo terminar antes de selecionar o CA
                            await new Promise(resolve => setTimeout(resolve, 150));
                            isUpdating.modelo = false;
                        }
                        // Seleciona o CA
                        isUpdating.ca = true;
                        const option = new Option(foundItem.numero_ca, foundItem.id_ca, true, true);
                        $(caSelect).find(`option[value="${codigo}"]`).remove(); // Remove tag temporária se houver
                        caSelect.appendChild(option);
                        $(caSelect).val(foundItem.id_ca).trigger("change.select2");
                        markAsAutoFilled(caSelect);
                        validatedCaId = foundItem.id_ca;
                        showFieldError(caSelect, caErrorMessage, null);
                        success = true;
                        setTimeout(() => isUpdating.ca = false, 50);
                    } else {
                         errorMessage = `CA "${normalizedCa}" encontrado, mas não na lista do modelo ${modeloIdDoCa}.`;
                    }
                } else {
                     errorMessage = `CA "${normalizedCa}" não encontrado no sistema.`;
                     console.warn(errorMessage);
                }
            } else if (target === "matricula") {
                const normalizedMatricula = normalizeMatricula(codigo);
                if (!normalizedMatricula) {
                     errorMessage = "Formato de matrícula inválido.";
                     throw new Error(errorMessage);
                }
                const funcionarioId = dadosCache.funcionarioPorMatriculaCache.get(normalizedMatricula);
                if (funcionarioId) {
                    foundItem = dadosCache.funcionarios.find(f => f.id_funcionario == funcionarioId);
                    if (foundItem) {
                        isUpdating.funcionarioMatricula = true;
                        isUpdating.funcionarioNome = true;
                        // Adiciona opção se não existir (caso venha de scan)
                         if (!funcionarioMatriculaSelect.querySelector(`option[value="${funcionarioId}"]`)) {
                             const optionMat = new Option(foundItem.numero_matricula, funcionarioId, true, true);
                             funcionarioMatriculaSelect.appendChild(optionMat);
                         }
                         if (!funcionarioNomeSelect.querySelector(`option[value="${funcionarioId}"]`)) {
                             const optionNome = new Option(foundItem.nome_funcionario, funcionarioId, true, true);
                             funcionarioNomeSelect.appendChild(optionNome);
                         }
                        $(funcionarioMatriculaSelect).val(funcionarioId).trigger("change.select2");
                        $(funcionarioNomeSelect).val(funcionarioId).trigger("change.select2");
                        markAsAutoFilled(funcionarioMatriculaSelect);
                        markAsAutoFilled(funcionarioNomeSelect);
                        validatedFuncionarioId = funcionarioId;
                        showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, null);
                        success = true;
                        setTimeout(() => {
                            isUpdating.funcionarioMatricula = false;
                            isUpdating.funcionarioNome = false;
                        }, 50);
                    }
                } else {
                     errorMessage = `Funcionário com matrícula "${normalizedMatricula}" não encontrado.`;
                     console.warn(errorMessage);
                }
            }
        } catch (error) {
            console.error(`Erro ao processar scan para ${target}:`, error);
            success = false;
            errorMessage = error.message || errorMessage;
        }

        // Limpa tag temporária do Select2 se existir
        if (target === "ca") $(caSelect).find(`option[value="${codigo}"]`).remove();
        if (target === "matricula") $(funcionarioMatriculaSelect).find(`option[value="${codigo}"]`).remove();

        // Atualiza modal do scanner
        scannerLoading.style.display = "none";
        if (success) {
            scannerSuccess.style.display = "flex";
            setTimeout(() => scannerModal.hide(), 1000); // Fecha modal após sucesso
        } else {
            scannerError.querySelector("span").textContent = errorMessage;
            scannerError.style.display = "flex";
            scannerInput.value = ""; // Limpa input no erro
            scannerInput.focus();
        }

        return success;
    }

    // --- Event Listeners --- 

    // Modelo EPI change
    $(epiModelSelect).on("change", async function (event) {
        // if (isUpdating.modelo) return; // REMOVIDO: Pode impedir atualização após scan
        const modeloId = $(this).val();
        console.log("Modelo EPI selecionado:", modeloId);
        validatedModeloId = modeloId;
        // Limpa e desabilita/habilita campos dependentes
        validatedCaId = null;
        validatedLoteId = null;
        showFieldError(caSelect, caErrorMessage, null);
        showFieldError(loteSelect, loteErrorMessage, null);
        isUpdating.ca = true;
        isUpdating.lote = true;
        $(caSelect).val(null).trigger("change.select2");
        $(loteSelect).val(null).trigger("change.select2");
        caSelect.disabled = !modeloId;
        loteSelect.disabled = !modeloId;
        $(caSelect).trigger("change.select2"); // Atualiza visual do select2
        $(loteSelect).trigger("change.select2");

        if (modeloId) {
            // Busca CAs e Lotes em paralelo
            const [casDoModelo, lotesDoModelo] = await Promise.all([
                buscarCasPorModelo(modeloId),
                buscarLotesPorModelo(modeloId)
            ]);
        } else {
            // Limpa opções se nenhum modelo for selecionado
            populateSelectOptions(caSelect, [], "id_ca", "numero_ca", { placeholderText: "Selecione Modelo primeiro..." });
            populateSelectOptions(loteSelect, [], "id_estoque_lote", "codigo_lote", { placeholderText: "Selecione Modelo primeiro..." });
        }
        setTimeout(() => {
            isUpdating.ca = false;
            isUpdating.lote = false;
        }, 50);
    });

    // CA change
    $(caSelect).on("change", async function (event) {
        if (isUpdating.ca) return;
        const selectedValue = $(this).val();
        if (!selectedValue) {
            validatedCaId = null;
            showFieldError(caSelect, caErrorMessage, null);
        } else {
            const selectedOption = caSelect.querySelector(`option[value="${selectedValue}"]`);
            const isNewTag = selectedOption && selectedOption.dataset.select2Tag === "true";
            if (isNewTag) {
                // Se for tag, tenta processar como se fosse scan/digitação direta
                await processarScan(selectedValue, "ca");
            } else {
                // Se for seleção normal, apenas valida
                validateCaOption(selectedValue);
            }
        }
    });

    // Lote change
    $(loteSelect).on("change", function (event) {
        if (isUpdating.lote) return;
        const selectedValue = $(this).val();
        if (!selectedValue) {
            validatedLoteId = null;
            showFieldError(loteSelect, loteErrorMessage, null);
        } else {
            validateLoteOption(selectedValue);
        }
    });

    // Funcionário Nome change
    $(funcionarioNomeSelect).on("change", function (event) {
        if (isUpdating.funcionarioNome) return;
        const selectedValue = $(this).val();
        validateFuncionarioOption(selectedValue, false);
    });

    // Funcionário Matrícula change (AGORA TRATA TAGS/DIGITAÇÃO)
    $(funcionarioMatriculaSelect).on("change", async function (event) {
        if (isUpdating.funcionarioMatricula) return;
        const selectedValue = $(this).val();
         if (!selectedValue) {
            validatedFuncionarioId = null;
            showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, null);
            // Limpa nome também se matrícula for limpa
            if ($(funcionarioNomeSelect).val()) {
                 isUpdating.funcionarioNome = true;
                 $(funcionarioNomeSelect).val(null).trigger("change.select2");
                 setTimeout(() => isUpdating.funcionarioNome = false, 50);
            }
        } else {
            const selectedOption = funcionarioMatriculaSelect.querySelector(`option[value="${selectedValue}"]`);
            const isNewTag = selectedOption && selectedOption.dataset.select2Tag === "true";
            if (isNewTag) {
                // Se for tag (digitado), tenta encontrar o funcionário pela matrícula
                const normalizedMatricula = normalizeMatricula(selectedValue);
                const funcionarioId = dadosCache.funcionarioPorMatriculaCache.get(normalizedMatricula);
                if (funcionarioId) {
                    const foundFunc = dadosCache.funcionarios.find(f => f.id_funcionario == funcionarioId);
                    if (foundFunc) {
                        validatedFuncionarioId = funcionarioId;
                        isUpdating.funcionarioMatricula = true;
                        isUpdating.funcionarioNome = true;
                        // Remove a tag e adiciona/seleciona a opção correta
                        $(funcionarioMatriculaSelect).find(`option[value="${selectedValue}"]`).remove();
                        const optionMat = new Option(foundFunc.numero_matricula, funcionarioId, true, true);
                        funcionarioMatriculaSelect.appendChild(optionMat);
                        $(funcionarioMatriculaSelect).val(funcionarioId).trigger("change.select2");
                        // Sincroniza o nome
                        $(funcionarioNomeSelect).val(funcionarioId).trigger("change.select2");
                        markAsAutoFilled(funcionarioMatriculaSelect);
                        markAsAutoFilled(funcionarioNomeSelect);
                        showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, null);
                        setTimeout(() => {
                            isUpdating.funcionarioMatricula = false;
                            isUpdating.funcionarioNome = false;
                        }, 50);
                    } else {
                        // Funcionário não encontrado no cache principal (erro)
                        showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, `Erro interno ao buscar dados do funcionário (ID: ${funcionarioId}).`);
                        validatedFuncionarioId = null;
                    }
                } else {
                    // Matrícula digitada não encontrada
                    showFieldError(funcionarioMatriculaSelect, matriculaErrorMessage, `Matrícula "${normalizedMatricula}" não encontrada.`);
                    validatedFuncionarioId = null;
                    // Limpa o nome se a matrícula digitada for inválida
                    if ($(funcionarioNomeSelect).val()) {
                        isUpdating.funcionarioNome = true;
                        $(funcionarioNomeSelect).val(null).trigger("change.select2");
                        setTimeout(() => isUpdating.funcionarioNome = false, 50);
                    }
                }
            } else {
                // Se for seleção normal, apenas valida e sincroniza
                validateFuncionarioOption(selectedValue, true);
            }
        }
    });

    // --- Lógica do Scanner Modal ---
    function openScannerModal(target) {
        currentScanTarget = target;
        let title = "Escanear Código";
        let instruction = "Aponte o leitor para o código ou digite abaixo:";
        let placeholder = "Aguardando leitura...";
        let iconClass = "bi-upc-scan";

        if (target === "ca") {
            title = "Escanear CA";
            instruction = "Aponte para o código de barras do CA ou digite:";
            placeholder = "Número do CA (ex: 12345)";
            iconClass = "bi-upc-scan";
        } else if (target === "matricula") {
            title = "Escanear Matrícula";
            instruction = "Aponte para o código da Matrícula ou digite:";
            placeholder = "Número da Matrícula";
            iconClass = "bi-person-badge";
        } else {
            console.error("Alvo de scan inválido:", target);
            return; // Não abre o modal se o alvo for inválido
        }

        scannerModalLabel.querySelector("span").textContent = title;
        scannerModalLabel.querySelector("i").className = `bi ${iconClass} me-2`;
        scannerModalInstruction.textContent = instruction;
        scannerInput.placeholder = placeholder;
        scannerModal.show();
    }

    if (scannerModalElement) {
        scannerModalElement.addEventListener("shown.bs.modal", () => {
            scannerInput.focus();
            scannerInput.value = "";
            scannerLoading.style.display = "none";
            scannerSuccess.style.display = "none";
            scannerError.style.display = "none";
        });
    }

    let scannerTimeout;
    if (scannerInput) {
        scannerInput.addEventListener("input", () => {
            clearTimeout(scannerTimeout);
            const codigo = scannerInput.value.trim();

            // Limpa status ao digitar
            scannerLoading.style.display = "none";
            scannerSuccess.style.display = "none";
            scannerError.style.display = "none";

            if (codigo.length > 2) { // Trigger após alguns caracteres
                scannerLoading.style.display = "flex";
                scannerTimeout = setTimeout(async () => {
                    // Chama processarScan que agora atualiza o modal internamente
                    await processarScan(codigo, currentScanTarget);
                }, 600); // Delay para permitir digitação/leitura completa
            }
        });
    }

    // Listeners dos botões de scanner (APENAS CA e MATRICULA)
    if (scanCaBtn) scanCaBtn.addEventListener("click", () => openScannerModal("ca"));
    if (scanMatriculaBtn) scanMatriculaBtn.addEventListener("click", () => openScannerModal("matricula"));

    // --- Submissão do Formulário ---
    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Revalidações finais
        validatedModeloId = $(epiModelSelect).val();
        if (!validatedModeloId) {
            alert("Erro: Modelo do EPI não selecionado ou inválido.");
            epiModelSelect.focus();
            return;
        }
        if (!validateLoteOption($(loteSelect).val())) {
             alert(loteErrorMessage.textContent || "Erro: Lote inválido ou não selecionado para este modelo.");
             loteSelect.focus();
             return;
        }
         if (!validateCaOption($(caSelect).val())) {
             alert(caErrorMessage.textContent || "Erro: CA inválido ou não selecionado para este modelo.");
             caSelect.focus();
             return;
        }
        // Valida funcionário pela matrícula selecionada/validada
        if (!validateFuncionarioOption($(funcionarioMatriculaSelect).val(), true)) {
             alert(matriculaErrorMessage.textContent || "Erro: Funcionário inválido ou não selecionado.");
             funcionarioMatriculaSelect.focus();
             return;
        }
        if (!tipoEntregaSelect.value) {
             alert("Erro: Selecione o Tipo de Movimentação.");
             tipoEntregaSelect.focus();
             return;
        }
         if (!dataEntregaInput.value) {
             alert("Erro: Selecione a Data de Entrega.");
             dataEntregaInput.focus();
             return;
        }
         if (!quantidadeInput.value || parseInt(quantidadeInput.value, 10) <= 0) {
             alert("Erro: Insira uma Quantidade válida (maior que zero).");
             quantidadeInput.focus();
             return;
        }

        // Obtém a hora atual no formato HH:MM:SS
        const agora = new Date();
        const horaAtual = [
            agora.getHours().toString().padStart(2, '0'),
            agora.getMinutes().toString().padStart(2, '0'),
            agora.getSeconds().toString().padStart(2, '0')
        ].join(':');

        const entregaData = {
            tipo_movimentacao: tipoEntregaSelect.value,
            data: dataEntregaInput.value,
            hora: horaAtual,
            quantidade: parseInt(quantidadeInput.value, 10),
            descricao: observacoesTextarea.value,
            id_funcionario: parseInt(validatedFuncionarioId, 10),
            id_modelo_epi: parseInt(validatedModeloId, 10),
            id_estoque_lote: parseInt(validatedLoteId, 10),
        };

        console.log("Enviando dados da entrega:", entregaData);

        try {
            // AJUSTAR ENDPOINT SE NECESSÁRIO (ex: "entregas" ou "movimentacoes/saida")
            const response = await post("entregas-epi", entregaData);
            console.log("Resposta do backend:", response); // Adicionado para depuração
            if (response && response.success) { // Verifica se response existe e tem success: true
                // Redireciona para a página de confirmação
                window.location.href = 'confirmacao-entrega.html';
                form.reset();
            } else {
                // Tenta exibir a mensagem de erro do backend, se houver
                const errorMessage = response?.error || response?.message || "Erro desconhecido";
                alert(`Erro ao registrar entrega: ${errorMessage}`);
            }
        } catch (error) {
            console.error("Erro ao enviar formulário:", error);
            alert("Erro de comunicação ao registrar entrega.");
        }
    });

    // --- Inicialização da Página ---
    async function inicializarPagina() {
        initializeSelect2();
        loadTiposEntrega();

        // Carrega dados iniciais
        await Promise.all([
            popularSelect(epiModelSelect, "modelos-epi", "id_modelo_epi", "nome_epi", "modelosEpi"),
            popularSelect(funcionarioNomeSelect, "funcionarios", "id_funcionario", "nome_funcionario", "funcionarios", {
                relatedSelectId: "id_funcionario_matricula",
                dataMapFn: (f) => ({ ...f, numero_matricula: f.numero_matricula || "S/ Matrícula" })
            }),
            popularSelect(funcionarioMatriculaSelect, "funcionarios", "id_funcionario", "numero_matricula", "funcionarios", {
                 relatedSelectId: "id_funcionario_nome",
                 dataMapFn: (f) => ({ ...f, numero_matricula: f.numero_matricula || "S/ Matrícula" })
            }),
            popularSelect(null, "ca", "id_ca", "numero_ca", "cas"), // Pré-carrega CAs para cache        popularSelect(loteSelect, "estoques", "id_estoque_lote", "codigo_lote", { cacheKey: "lotes" }), // Carrega todos os lotes inicialmente
        ]);

        // Desabilita campos dependentes inicialmente (CA)
        // Lote começa habilitado com todos os lotes
        caSelect.disabled = true;
        loteSelect.disabled = false; // Garante que lote esteja habilitado inicialmente
        $(caSelect).trigger("change.select2");
        $(loteSelect).trigger("change.select2");

        console.log("Página de Registro de Entregas inicializada.");
    }

    inicializarPagina();
});

