document.getElementById('epiForm').addEventListener('submit', function(event) {
  event.preventDefault(); // impede envio automático

  const form = event.target;
  let isValid = true;

  form.querySelectorAll('.form-control').forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('is-invalid');
      isValid = false;
    } else {
      input.classList.remove('is-invalid');
    }
  });

  if (isValid) {
    // Redireciona somente se todos os campos estiverem preenchidos
    window.location.href = "./adicionar-epi.html";
  }
});