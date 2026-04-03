// Main application logic
document.addEventListener('DOMContentLoaded', function () {
  // Check authentication
  auth.requireAuth();

  const currentUser = auth.getCurrentUser();
  const userRole = currentUser?.role;

  // Update user info in sidebar
  if (currentUser) {
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userRole').textContent = currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1);
  }

  // Update current date
  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  document.getElementById('currentDate').textContent = currentDate;

  // Load company logo
  loadCompanyLogo();

  // Handle navigation
  handleNavigation();

  // Handle logout
  handleLogout();

  // Handle modal
  handleModal();

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('active');
    });
  }

  // Load initial module
  const initialHash = window.location.hash.slice(1) || 'dashboard';
  loadModule(initialHash);
});

// Load company logo from settings
async function loadCompanyLogo() {
  try {
    const settings = await api.call('/settings', 'GET');
    const logoContainer = document.getElementById('appLogo');

    if (settings.salon && logoContainer) {
      if (settings.salon.logoUrl) {
        // Display logo with salon name below
        logoContainer.innerHTML = `
          <img src="${settings.salon.logoUrl}" alt="Company Logo" style="max-height: 40px; max-width: 200px; object-fit: contain; display: block; margin: 0 auto;">
          <h3 style="margin: 5px 0 0 0; text-align: center; font-size: 14px; font-weight: 500;">${settings.salon.name || 'Salon Manager'}</h3>
        `;
      } else {
        // Display salon name only if no logo
        logoContainer.innerHTML = `<h2>${settings.salon.name || 'Salon Manager'}</h2>`;
      }
    }
  } catch (error) {
    console.log('Could not load company logo:', error);
    // Keep default text if logo loading fails
  }
}

// Handle navigation
function handleNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      const module = this.dataset.module;

      // Update active state
      navLinks.forEach(l => l.classList.remove('active'));
      this.classList.add('active');

      // Update hash
      window.location.hash = module;

      // Load module
      loadModule(module);
    });
  });

  // Handle back/forward browser navigation
  window.addEventListener('hashchange', function () {
    const hash = window.location.hash.slice(1) || 'dashboard';
    loadModule(hash);
  });
}

// Load module
async function loadModule(moduleName) {
  const contentArea = document.getElementById('contentArea');
  const pageTitle = document.getElementById('pageTitle');

  // 🔥 NORMALIZE (/bookings → bookings)
  moduleName = moduleName.replace(/^\/+/, '');


  // Check permissions
  const currentUser = auth.getCurrentUser();
  const userRole = currentUser?.role;

  if (!permissions.canAccessModule(userRole, moduleName)) {
    utils.showToast('Access denied', 'error');
    return;
  }

  // Update page title
  pageTitle.textContent = moduleName.charAt(0).toUpperCase() + moduleName.slice(1);

  // Show loading
  contentArea.innerHTML = '<div class="text-center"><div class="spinner"></div></div>';

  try {
    let loadModuleName = moduleName;
    if (moduleName === 'membership-billing') loadModuleName = 'memberships';
    const modulePath = `/assets/js/modules/${loadModuleName}/${loadModuleName}.js`;
    const module = await import(modulePath);
    if (module.render) {
      await module.render(contentArea);
    }
  } catch (error) {
    console.error('Error loading module:', error);
    const safeName = utils.escapeHtml(moduleName);
    contentArea.innerHTML = `
      <div class="text-center" style="padding: 40px;">
        <h3>Failed to load module</h3>
        <p>The <strong>${safeName}</strong> module could not be loaded.</p>
        <p class="text-muted" style="font-size: 13px;">${utils.escapeHtml(error.message)}</p>
        <button class="btn btn-primary btn-sm" onclick="window.location.hash='dashboard'" style="margin-top: 12px;">Go to Dashboard</button>
      </div>
    `;
  }
}

// Handle logout
function handleLogout() {
  const logoutBtn = document.getElementById('logoutBtn');

  logoutBtn.addEventListener('click', async function () {
    try {
      await api.auth.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear session and redirect
      auth.clearSession();
      api.removeToken();
      window.location.href = '/';
    }
  });
}

// Handle modal
function handleModal() {
  const modal = document.getElementById('modal');
  // Closure handled by window.appUtils.closeModal called via inline onclick
}

// Show modal (title is escaped to prevent XSS, content is trusted HTML from code)
function showModal(title, content, size = null) {
  const modal = document.getElementById('modal');
  if (!modal) return;

  const sizeClass = size === 'large' ? 'modal-large' : (size === 'full' || size === 'xl' ? 'modal-full' : '');
  const safeTitle = utils.escapeHtml(title);

  modal.innerHTML = `
    <div class="modal-content ${sizeClass}">
      <div class="modal-header">
        <h3 id="modalTitle">${safeTitle}</h3>
        <button class="modal-close" aria-label="Close modal">&times;</button>
      </div>
      <div class="modal-body" id="modalBody">
        ${content}
      </div>
    </div>
  `;

  // Attach close via event listener instead of inline onclick
  modal.querySelector('.modal-close').addEventListener('click', closeModal);
  modal.addEventListener('click', function(e) {
    if (e.target === modal) closeModal();
  });

  // Focus trap: focus the modal
  modal.classList.add('active');
  const firstInput = modal.querySelector('input, select, textarea, button:not(.modal-close)');
  if (firstInput) firstInput.focus();
}

// Close modal
function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('active');
}

// Export functions for modules
window.appUtils = {
  showModal,
  closeModal
};