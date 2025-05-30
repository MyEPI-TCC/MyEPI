    // JS opcional para disparar ação ao mudar mês
    document.getElementById('mesSelect').addEventListener('change', function () {
      const mesSelecionado = this.value;
      console.log("Mês selecionado:", mesSelecionado);
      // Aqui você pode chamar o back-end para atualizar os dados
    });
