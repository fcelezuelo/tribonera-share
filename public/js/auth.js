/**
 * Concord — Client Authentication Logic
 * Manages Login, Invite-Code Gated Registration with Password, and Supabase Session Integration.
 */

(function () {
  const loadingOverlay = document.getElementById('auth-loading-overlay');
  const supabaseStatusPill = document.getElementById('supabase-status-pill');
  const supabaseStatusText = document.getElementById('supabase-status-text');

  // Tabs
  const tabBtnLogin = document.getElementById('tab-btn-login');
  const tabBtnRegister = document.getElementById('tab-btn-register');
  const tabContentLogin = document.getElementById('tab-content-login');
  const tabContentRegister = document.getElementById('tab-content-register');
  const linkGoToRegister = document.getElementById('link-go-to-register');
  const linkGoToLogin = document.getElementById('link-go-to-login');

  // Login Form elements
  const formLogin = document.getElementById('form-login');
  const loginIdentifier = document.getElementById('login-identifier');
  const loginPassword = document.getElementById('login-password');
  const btnToggleLoginPass = document.getElementById('btn-toggle-login-pass');
  const loginLoader = document.getElementById('login-loader');
  const loginErrorMsg = document.getElementById('login-error-msg');
  const loginSuccessMsg = document.getElementById('login-success-msg');

  // Register Form elements
  const formRegister = document.getElementById('form-register');
  const regCode = document.getElementById('reg-code');
  const regNickname = document.getElementById('reg-nickname');
  const regPassword = document.getElementById('reg-password');
  const regConfirmPassword = document.getElementById('reg-confirm-password');
  const btnToggleRegPass = document.getElementById('btn-toggle-reg-pass');
  const regCodeStatus = document.getElementById('reg-code-status');
  const regLoader = document.getElementById('reg-loader');
  const regErrorMsg = document.getElementById('reg-error-msg');
  const regSuccessMsg = document.getElementById('reg-success-msg');

  // Cookie helper
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Session persistence
  function saveSession(token, user, code) {
    if (token) {
      localStorage.setItem('tribonera_token', token);
      localStorage.setItem('tribonera_user', JSON.stringify(user));
      document.cookie = `tribonera_token=${token}; max-age=${365 * 24 * 60 * 60}; path=/; SameSite=Lax`;
    }
    const codeToSave = code || (user && user.code);
    if (codeToSave) {
      localStorage.setItem('tribonera_cached_code', codeToSave.toUpperCase());
    }
    if (user && user.username) {
      localStorage.setItem('tribonera_cached_username', user.username);
    }
  }

  // Show / Hide messages
  function showError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError(el) {
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  }

  function showSuccess(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // Setup Password Visibility Toggle
  function setupPassToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPass = input.type === 'password';
      input.type = isPass ? 'text' : 'password';

      const iconOpen = btn.querySelector('.icon-eye-open');
      const iconClosed = btn.querySelector('.icon-eye-closed');

      if (isPass) {
        if (iconOpen) iconOpen.classList.add('hidden');
        if (iconClosed) iconClosed.classList.remove('hidden');
        btn.title = 'Ocultar senha';
      } else {
        if (iconOpen) iconOpen.classList.remove('hidden');
        if (iconClosed) iconClosed.classList.add('hidden');
        btn.title = 'Mostrar senha';
      }
      input.focus();
    });
  }

  setupPassToggle(btnToggleLoginPass, loginPassword);
  setupPassToggle(btnToggleRegPass, regPassword);

  // Tab switching logic
  function switchTab(tab) {
    hideError(loginErrorMsg);
    hideError(loginSuccessMsg);
    hideError(regErrorMsg);
    hideError(regSuccessMsg);

    if (tab === 'login') {
      tabBtnLogin.classList.add('active');
      tabBtnRegister.classList.remove('active');
      tabContentLogin.classList.remove('hidden');
      tabContentRegister.classList.add('hidden');
      if (loginIdentifier) loginIdentifier.focus();
    } else {
      tabBtnRegister.classList.add('active');
      tabBtnLogin.classList.remove('active');
      tabContentRegister.classList.remove('hidden');
      tabContentLogin.classList.add('hidden');
      if (regCode) regCode.focus();
    }
  }

  if (tabBtnLogin) tabBtnLogin.addEventListener('click', () => switchTab('login'));
  if (tabBtnRegister) tabBtnRegister.addEventListener('click', () => switchTab('register'));
  if (linkGoToRegister) linkGoToRegister.addEventListener('click', () => switchTab('register'));
  if (linkGoToLogin) linkGoToLogin.addEventListener('click', () => switchTab('login'));

  // Format code input uppercase
  if (regCode) {
    regCode.addEventListener('input', (e) => {
      regCode.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      hideError(regErrorMsg);
    });
  }

  // Restore cached credentials hint
  function initCachedState() {
    const cachedUser = localStorage.getItem('tribonera_cached_username') || localStorage.getItem('tribonera_cached_code');
    if (cachedUser && loginIdentifier) {
      loginIdentifier.value = cachedUser;
    }
  }

  // Check version and Supabase status
  async function checkSupabaseStatus() {
    try {
      const res = await fetch('/api/version');
      if (res.ok) {
        const data = await res.json();
        if (data.supabase && data.supabase.configured) {
          if (supabaseStatusText) supabaseStatusText.textContent = 'Supabase Cloud Conectado';
          if (supabaseStatusPill) supabaseStatusPill.classList.add('connected');
        } else {
          if (supabaseStatusText) supabaseStatusText.textContent = 'Supabase Engine Ativo (Local/Cloud)';
        }
      }
    } catch (err) {
      console.warn('Status check notice:', err);
    }
  }

  // Check existing session on load
  async function checkExistingSession() {
    const token = getCookie('tribonera_token') || localStorage.getItem('tribonera_token');
    if (!token) return;

    loadingOverlay.classList.remove('hidden');

    try {
      const res = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data = await res.json();
        saveSession(token, data.user);
        window.location.href = '/app';
        return;
      } else {
        localStorage.removeItem('tribonera_token');
        localStorage.removeItem('tribonera_user');
        document.cookie = 'tribonera_token=; max-age=0; path=/';
      }
    } catch (err) {
      console.warn('Auto-login session check error:', err);
    } finally {
      loadingOverlay.classList.add('hidden');
    }
  }

  // 1. Submit Login Form
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError(loginErrorMsg);
      hideError(loginSuccessMsg);

      const identifier = loginIdentifier.value.trim();
      const password = loginPassword ? loginPassword.value : '';

      if (!identifier) {
        showError(loginErrorMsg, 'Por favor, informe seu usuário ou código de acesso.');
        return;
      }

      const isMasterAdminCode = identifier.toUpperCase() === 'FELLMASTER123';
      if (!isMasterAdminCode && !password) {
        showError(loginErrorMsg, 'Por favor, digite sua senha.');
        if (loginPassword) loginPassword.focus();
        return;
      }

      loginLoader.classList.remove('hidden');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password: password || 'admin' })
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.isUnusedInvite) {
            showError(loginErrorMsg, data.error);
            setTimeout(() => {
              switchTab('register');
              if (regCode) regCode.value = identifier.toUpperCase();
              if (regNickname) regNickname.focus();
            }, 1200);
            return;
          }
          throw new Error(data.error || 'Falha ao autenticar.');
        }

        saveSession(data.token, data.user);
        showSuccess(loginSuccessMsg, `Login realizado com sucesso! Bem-vindo, ${data.user.nickname}.`);

        setTimeout(() => {
          window.location.href = '/app';
        }, 400);
      } catch (err) {
        showError(loginErrorMsg, err.message);
      } finally {
        loginLoader.classList.add('hidden');
      }
    });
  }

  // 2. Submit Register Form (Requires Admin Invite Code)
  if (formRegister) {
    formRegister.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideError(regErrorMsg);
      hideError(regSuccessMsg);

      const code = regCode.value.trim().toUpperCase();
      const nickname = regNickname.value.trim();
      const password = regPassword.value;
      const confirmPassword = regConfirmPassword.value;

      if (!code) {
        showError(regErrorMsg, 'Código de convite gerado pelo Administrador é obrigatório.');
        return;
      }

      if (nickname.length < 2 || nickname.length > 25) {
        showError(regErrorMsg, 'O Nickname deve ter entre 2 e 25 caracteres.');
        return;
      }

      if (password.length < 4) {
        showError(regErrorMsg, 'A Senha deve conter pelo menos 4 caracteres.');
        return;
      }

      if (password !== confirmPassword) {
        showError(regErrorMsg, 'As senhas informadas não coincidem.');
        return;
      }

      regLoader.classList.remove('hidden');

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            nickname,
            password,
            confirmPassword
          })
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || 'Falha no registro.');
        }

        saveSession(data.token, data.user, code);
        showSuccess(regSuccessMsg, `Conta criada com sucesso! Redirecionando...`);

        setTimeout(() => {
          window.location.href = '/app';
        }, 500);
      } catch (err) {
        showError(regErrorMsg, err.message);
      } finally {
        regLoader.classList.add('hidden');
      }
    });
  }

  // Start
  initCachedState();
  checkSupabaseStatus();
  checkExistingSession();
})();
