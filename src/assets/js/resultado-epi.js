
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (id) {
    fetch(`/api/epis/${id}`)
      .then(res => res.json())
      .then(data => {
        document.getElementById('nome-epi').textContent = data.nome;
        document.getElementById('categoria-epi').textContent = data.categoria;
        document.getElementById('validade-epi').textContent = data.validade;
        document.getElementById('marca-epi').textContent = data.marca;
        document.getElementById('ca-epi').textContent = data.ca;
        document.getElementById('descricao-epi').textContent = data.descricao;
        document.getElementById('imagem-epi').src = data.imagem;
      });
  }
