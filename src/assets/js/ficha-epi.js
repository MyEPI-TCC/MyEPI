  // Função para buscar os dados da API e atualizar a tabela
  async function carregarEPIs() {
    try {
      // Troque a URL abaixo pela URL correta da API do backend do seu colega
      const response = await fetch('http://localhost:3000/api/epis');
      if (!response.ok) {
        throw new Error('Erro ao buscar os dados: ' + response.status);
      }
      const epis = await response.json();

      const tbody = document.querySelector('table tbody');
      tbody.innerHTML = ''; // limpa tabela antes de preencher

      epis.forEach(epi => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${epi.nome}</td>
          <td>${epi.categoria}</td>
          <td>${epi.marca}</td>
          <td>${epi.ca}</td>
          <td>${epi.validade}</td>
        `;
        tbody.appendChild(tr);
      });

    } catch (error) {
      console.error('Erro:', error);
    }
  }

  // Chama a função quando a página carregar
  window.addEventListener('DOMContentLoaded', carregarEPIs);

