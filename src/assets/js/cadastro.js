    // Função para buscar endereço pelo CEP
    async function buscarEnderecoPorCep(cep) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        
        if (data.erro) {
          throw new Error('CEP não encontrado');
        }
        
        return data;
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        return null;
      }
    }

    // Função para aplicar máscara no CNPJ
    function aplicarMascaraCNPJ(valor) {
      return valor
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .slice(0, 18);
    }

    // Função para aplicar máscara no CPF
    function aplicarMascaraCPF(valor) {
      return valor
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})/, '$1-$2')
        .slice(0, 14);
    }

    // Função para aplicar máscara no CEP
    function aplicarMascaraCEP(valor) {
      return valor
        .replace(/\D/g, '')
        .replace(/^(\d{5})(\d)/, '$1-$2')
        .slice(0, 9);
    }

    // Função para validar CNPJ
    function validarCNPJ(cnpj) {
      cnpj = cnpj.replace(/[^\d]+/g, '');
      
      if (cnpj.length !== 14) return false;
      
      // Elimina CNPJs conhecidos como inválidos
      if (/^(\d)\1+$/.test(cnpj)) return false;
      
      // Valida DVs
      let tamanho = cnpj.length - 2;
      let numeros = cnpj.substring(0, tamanho);
      let digitos = cnpj.substring(tamanho);
      let soma = 0;
      let pos = tamanho - 7;
      
      for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
      }
      
      let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
      if (resultado != digitos.charAt(0)) return false;
      
      tamanho = tamanho + 1;
      numeros = cnpj.substring(0, tamanho);
      soma = 0;
      pos = tamanho - 7;
      
      for (let i = tamanho; i >= 1; i--) {
        soma += numeros.charAt(tamanho - i) * pos--;
        if (pos < 2) pos = 9;
      }
      
      resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
      if (resultado != digitos.charAt(1)) return false;
      
      return true;
    }

    // Função para validar CPF
    function validarCPF(cpf) {
      cpf = cpf.replace(/[^\d]+/g, '');
      
      if (cpf.length !== 11) return false;
      
      // Elimina CPFs conhecidos como inválidos
      if (/^(\d)\1+$/.test(cpf)) return false;
      
      // Valida 1º dígito
      let soma = 0;
      for (let i = 0; i < 9; i++) {
        soma += parseInt(cpf.charAt(i)) * (10 - i);
      }
      let resto = 11 - (soma % 11);
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(cpf.charAt(9))) return false;
      
      // Valida 2º dígito
      soma = 0;
      for (let i = 0; i < 10; i++) {
        soma += parseInt(cpf.charAt(i)) * (11 - i);
      }
      resto = 11 - (soma % 11);
      if (resto === 10 || resto === 11) resto = 0;
      if (resto !== parseInt(cpf.charAt(10))) return false;
      
      return true;
    }

    // Função para validar email
    function validarEmail(email) {
      const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return regex.test(email);
    }

    // Função para mostrar mensagem de erro
    function mostrarErro(elemento, mensagem) {
      elemento.classList.add('is-invalid');
      
      // Remove mensagem anterior se existir
      const mensagemAnterior = elemento.parentNode.querySelector('.invalid-feedback');
      if (mensagemAnterior) {
        mensagemAnterior.remove();
      }
      
      // Adiciona nova mensagem
      const divMensagem = document.createElement('div');
      divMensagem.className = 'invalid-feedback';
      divMensagem.textContent = mensagem;
      elemento.parentNode.appendChild(divMensagem);
    }

    // Função para remover erro
    function removerErro(elemento) {
      elemento.classList.remove('is-invalid');
      const mensagem = elemento.parentNode.querySelector('.invalid-feedback');
      if (mensagem) {
        mensagem.remove();
      }
    }

    // Event Listeners quando o DOM estiver carregado
    document.addEventListener('DOMContentLoaded', function() {
      const cepInput = document.getElementById('cep');
      const estadoSelect = document.getElementById('estado');
      const cidadeInput = document.getElementById('cidade');
      const cnpjInput = document.getElementById('cnpj');
      const cpfInput = document.getElementById('cpf');
      const emailInput = document.getElementById('email');
      const senhaInput = document.getElementById('senha');
      const confirmarSenhaInput = document.getElementById('confirmar-senha');
      const form = document.querySelector('form');

      // Máscara e busca automática para CEP
      cepInput.addEventListener('input', function(e) {
        let valor = e.target.value;
        e.target.value = aplicarMascaraCEP(valor);
        
        // Busca endereço quando CEP estiver completo
        const cepLimpo = valor.replace(/\D/g, '');
        if (cepLimpo.length === 8) {
          buscarEnderecoPorCep(cepLimpo).then(data => {
            if (data) {
              // Preenche o estado
              estadoSelect.value = data.uf;
              
              // Preenche a cidade
              cidadeInput.value = data.localidade;
              
              removerErro(cepInput);
            } else {
              mostrarErro(cepInput, 'CEP não encontrado');
            }
          });
        }
      });

      // Máscara para CNPJ
      cnpjInput.addEventListener('input', function(e) {
        e.target.value = aplicarMascaraCNPJ(e.target.value);
      });

      // Validação do CNPJ ao sair do campo
      cnpjInput.addEventListener('blur', function(e) {
        const cnpj = e.target.value;
        if (cnpj && !validarCNPJ(cnpj)) {
          mostrarErro(e.target, 'CNPJ inválido');
        } else {
          removerErro(e.target);
        }
      });

      // Máscara para CPF
      cpfInput.addEventListener('input', function(e) {
        e.target.value = aplicarMascaraCPF(e.target.value);
      });

      // Validação do CPF ao sair do campo
      cpfInput.addEventListener('blur', function(e) {
        const cpf = e.target.value;
        if (cpf && !validarCPF(cpf)) {
          mostrarErro(e.target, 'CPF inválido');
        } else {
          removerErro(e.target);
        }
      });

      // Validação do email
      emailInput.addEventListener('blur', function(e) {
        const email = e.target.value;
        if (email && !validarEmail(email)) {
          mostrarErro(e.target, 'Email inválido');
        } else {
          removerErro(e.target);
        }
      });

      // Validação da confirmação de senha
      confirmarSenhaInput.addEventListener('blur', function(e) {
        const senha = senhaInput.value;
        const confirmacao = e.target.value;
        
        if (confirmacao && senha !== confirmacao) {
          mostrarErro(e.target, 'As senhas não coincidem');
        } else {
          removerErro(e.target);
        }
      });

      // Validação geral do formulário
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        let formularioValido = true;
        
        // Validar todos os campos obrigatórios
        const camposObrigatorios = [
          { elemento: document.getElementById('empresa'), nome: 'Nome da Empresa' },
          { elemento: cnpjInput, nome: 'CNPJ' },
          { elemento: cepInput, nome: 'CEP' },
          { elemento: estadoSelect, nome: 'Estado' },
          { elemento: cidadeInput, nome: 'Cidade' },
          { elemento: document.getElementById('representante'), nome: 'Nome do Usuário' },
          { elemento: cpfInput, nome: 'CPF' },
          { elemento: emailInput, nome: 'Email' },
          { elemento: senhaInput, nome: 'Senha' },
          { elemento: confirmarSenhaInput, nome: 'Confirmação de Senha' }
        ];
        
        camposObrigatorios.forEach(campo => {
          if (!campo.elemento.value.trim()) {
            mostrarErro(campo.elemento, `${campo.nome} é obrigatório`);
            formularioValido = false;
          }
        });
        
        // Validações específicas
        if (cnpjInput.value && !validarCNPJ(cnpjInput.value)) {
          mostrarErro(cnpjInput, 'CNPJ inválido');
          formularioValido = false;
        }
        
        if (cpfInput.value && !validarCPF(cpfInput.value)) {
          mostrarErro(cpfInput, 'CPF inválido');
          formularioValido = false;
        }
        
        if (emailInput.value && !validarEmail(emailInput.value)) {
          mostrarErro(emailInput, 'Email inválido');
          formularioValido = false;
        }
        
        if (senhaInput.value !== confirmarSenhaInput.value) {
          mostrarErro(confirmarSenhaInput, 'As senhas não coincidem');
          formularioValido = false;
        }
        
        if (senhaInput.value && senhaInput.value.length < 6) {
          mostrarErro(senhaInput, 'A senha deve ter pelo menos 6 caracteres');
          formularioValido = false;
        }
        
        if (formularioValido) {
          // Aqui você pode processar o formulário
          alert('Formulário válido! Redirecionando...');
          // window.location.href = 'verificacao.html';
        } else {
          // Rola para o primeiro erro
          const primeiroErro = document.querySelector('.is-invalid');
          if (primeiroErro) {
            primeiroErro.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      });
    });
