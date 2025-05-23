const cnpjInput = document.getElementById("cnpj");
    const cepInput = document.getElementById("cep");
    const cpfInput = document.getElementById("cpf");

    function mascararCNPJ(valor) {
      return valor
        .replace(/\D/g, '')
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2')
        .slice(0, 18);
    }

    function mascararCEP(valor) {
      return valor
        .replace(/\D/g, '')
        .replace(/^(\d{5})(\d)/, '$1-$2')
        .slice(0, 9);
    }

    function mascararCPF(valor) {
      return valor
        .replace(/\D/g, '')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1-$2')
        .slice(0, 14);
    }

    cnpjInput.addEventListener("input", () => {
      cnpjInput.value = mascararCNPJ(cnpjInput.value);
    });

    cepInput.addEventListener("input", () => {
      cepInput.value = mascararCEP(cepInput.value);
    });

    cpfInput.addEventListener("input", () => {
      cpfInput.value = mascararCPF(cpfInput.value);
    });