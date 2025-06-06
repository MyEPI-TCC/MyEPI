function toggleSidebar() {
      const sidebar = document.getElementById('sidebar');
      sidebar.classList.toggle('show');
    }

    // Fecha o sidebar quando clicar fora dele no mobile
    document.addEventListener('click', function(event) {
      const sidebar = document.getElementById('sidebar');
      const menuBtn = document.querySelector('.btn-menu');
      
      if (window.innerWidth <= 768) {
        if (!sidebar.contains(event.target) && !menuBtn.contains(event.target)) {
          sidebar.classList.remove('show');
        }
      }
    });