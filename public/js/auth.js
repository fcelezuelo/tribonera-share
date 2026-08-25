/**
 * TriboneraShare — Client Authentication Logic
 * Manages Code Verification, Nickname Registration, Cookie & LocalStorage Token persistence.
 */

(function () {
  const stepCodeCard = document.getElementById('step-code-card');
  const stepNicknameCard = document.getElementById('step-nickname-card');
  const loadingOverlay = document.getElementById('auth-loading-overlay');

  const formCode = document.getElementById('form-code');
  const inputCode = document.getElementById('input-code');
  const codeLoader = document.getElementById('code-loader');
  const authErrorMsg = document.getElementById('auth-error-msg');
  const authSuccessMsg = document.getElementById('auth-success-msg');
  const savedCodeHint = document.getElementById('saved-code-hint');
  const defaultCodeHelper = document.getElementById('default-code-helper');
  const btnClearSavedCode = document.getElementById('btn-clear-saved-code');

  const formNickname = document.getElementById('form-nickname');
  const inputNickname = document.getElementById('input-nickname');
  const nickLoader = document.getElementById('nick-loader');
  const nickErrorMsg = document.getElementById('nick-error-msg');
  const displayValidCode = document.getElementById('display-valid-code');
  const btnBackCode = document.getElementById('btn-back-code');

  let verifiedCode = '';

  // Helper to read cookie
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Helper to save token in cookie and localStorage, plus cache the login code
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
  }

  // Check and restore cached access code
  function initCachedCode() {
    const cached = localStorage.getItem('tribonera_cached_code');
    if (cached && inputCode) {
      inputCode.value = cached.toUpperCase();
      if (savedCodeHint) savedCodeHint.classList.remove('hidden');
      if (defaultCodeHelper) defaultCodeHelper.classList.add('hidden');
      if (btnClearSavedCode) btnClearSavedCode.classList.remove('hidden');
    }
  }

  if (btnClearSavedCode) {
    btnClearSavedCode.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('tribonera_cached_code');
      inputCode.value = '';
      savedCodeHint.classList.add('hidden');
      defaultCodeHelper.classList.remove('hidden');
      btnClearSavedCode.classList.add('hidden');
      inputCode.focus();
    });
  }

  // Show error
  function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  // Hide error
  function hideError(el) {
    el.textContent = '';
    el.classList.add('hidden');
  }

  // Check if already authenticated on load
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
        // Token invalid or revoked - clear
        localStorage.removeItem('tribonera_token');
        localStorage.removeItem('tribonera_user');
        document.cookie = 'tribonera_token=; max-age=0; path=/';
      }
    } catch (err) {
      console.warn('Auto-login check failed:', err);
    } finally {
      loadingOverlay.classList.add('hidden');
    }
  }

  // Auto uppercase formatting for code input
  inputCode.addEventListener('input', (e) => {
    inputCode.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    hideError(authErrorMsg);
  });

  // Back button in Nickname step
  btnBackCode.addEventListener('click', () => {
    stepNicknameCard.classList.add('hidden');
    stepCodeCard.classList.remove('hidden');
    inputCode.focus();
  });

  // Step 1: Submit Code
  formCode.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(authErrorMsg);
    hideError(authSuccessMsg);

    const code = inputCode.value.trim().toUpperCase();
    if (!code) {
      showError(authErrorMsg, 'Por favor, digite o código de acesso.');
      return;
    }

    codeLoader.classList.remove('hidden');

    try {
      const res = await fetch('/api/auth/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao validar código.');
      }

      if (data.status === 'existing_user') {
        // Existing registered user - login directly!
        saveSession(data.token, data.user, code);
        authSuccessMsg.textContent = `Bem-vindo de volta, ${data.user.nickname}! Redirecionando...`;
        authSuccessMsg.classList.remove('hidden');
        setTimeout(() => {
          window.location.href = '/app';
        }, 600);
      } else if (data.status === 'new_user_required') {
        // First access! Switch to Step 2: Choose permanent nickname
        verifiedCode = data.code;
        localStorage.setItem('tribonera_cached_code', verifiedCode.toUpperCase());
        displayValidCode.textContent = verifiedCode;
        stepCodeCard.classList.add('hidden');
        stepNicknameCard.classList.remove('hidden');
        inputNickname.focus();
      }
    } catch (err) {
      showError(authErrorMsg, err.message);
    } finally {
      codeLoader.classList.add('hidden');
    }
  });

  // Step 2: Submit Nickname for New User
  formNickname.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError(nickErrorMsg);

    const nickname = inputNickname.value.trim();
    if (nickname.length < 2 || nickname.length > 25) {
      showError(nickErrorMsg, 'O Nickname deve ter entre 2 e 25 caracteres.');
      return;
    }

    nickLoader.classList.remove('hidden');

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: verifiedCode,
          nickname: nickname
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao registrar usuário.');
      }

      saveSession(data.token, data.user, verifiedCode);
      window.location.href = '/app';
    } catch (err) {
      showError(nickErrorMsg, err.message);
    } finally {
      nickLoader.classList.add('hidden');
    }
  });

  // Run on start
  initCachedCode();
  checkExistingSession();
})();
