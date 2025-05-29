async function carregarEPIs() {
    try {
      const response = await fetch('http://localhost:3000/api/epis'); // Troque pela sua API real
      if (!response.ok) {
        throw new Error('Erro ao buscar os dados: ' + response.status);
      }
      const epis = await response.json();
  
      const tbody = document.querySelector('table tbody');
      tbody.innerHTML = ''; // limpa tabela
  
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
  
  window.addEventListener('DOMContentLoaded', carregarEPIs);
  