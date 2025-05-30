  document.getElementById('recuperarSenhaForm').addEventListener('submit', function(e) {
    const email = document.getElementById('email').value.trim();
    
    
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    if (!regex.test(email)) {
      e.preventDefault();
      alert("Por favor, insira um e-mail válido. Exemplo: usuario@dominio.com");
      return;
    }
  });

