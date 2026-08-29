/**
 * TriboneraShare — Admin Panel Manager
 * Enables code generation, code revocation, member auditing and user removal.
 */

window.TriboneraAdmin = (function () {
  const adminOverlay = document.getElementById('admin-modal-overlay');
  const btnOpenAdmin = document.getElementById('btn-open-admin');
  const btnCloseAdmin = document.getElementById('btn-close-admin');

  const tabBtnCodes = document.getElementById('tab-btn-codes');
  const tabBtnUsers = document.getElementById('tab-btn-users');
  const tabBtnDatabase = document.getElementById('tab-btn-database');
  const tabCodes = document.getElementById('tab-codes');
  const tabUsers = document.getElementById('tab-users');
  const tabDatabase = document.getElementById('tab-database');
  const supabaseSqlCode = document.getElementById('supabase-sql-code');
  const btnCopySql = document.getElementById('btn-copy-sql');

  const btnGenerateCode = document.getElementById('btn-generate-code');
  const newCodeAlert = document.getElementById('new-code-alert');
  const displayNewCode = document.getElementById('display-new-code');
  const btnCopyCode = document.getElementById('btn-copy-code');

  const tableCodesBody = document.getElementById('table-codes-body');
  const tableUsersBody = document.getElementById('table-users-body');

  function getToken() {
    let token = localStorage.getItem('tribonera_token');
    if (!token) {
      const match = document.cookie.match(/(?:^|;\s*)tribonera_token=([^;]+)/);
      if (match) token = match[1];
    }
    return token;
  }

  function openAdminModal() {
    adminOverlay.classList.remove('hidden');
    loadAdminData();
    loadSupabaseSchema();
  }

  function closeAdminModal() {
    adminOverlay.classList.add('hidden');
  }

  // Switch tabs
  function switchTab(target) {
    [tabBtnCodes, tabBtnUsers, tabBtnDatabase].forEach(b => { if (b) b.classList.remove('active'); });
    [tabCodes, tabUsers, tabDatabase].forEach(c => { if (c) c.classList.add('hidden'); });

    if (target === 'tab-codes') {
      if (tabBtnCodes) tabBtnCodes.classList.add('active');
      if (tabCodes) tabCodes.classList.remove('hidden');
    } else if (target === 'tab-users') {
      if (tabBtnUsers) tabBtnUsers.classList.add('active');
      if (tabUsers) tabUsers.classList.remove('hidden');
    } else if (target === 'tab-database') {
      if (tabBtnDatabase) tabBtnDatabase.classList.add('active');
      if (tabDatabase) tabDatabase.classList.remove('hidden');
    }
  }

  async function loadSupabaseSchema() {
    const token = getToken();
    try {
      const res = await fetch('/api/admin/supabase-schema', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const sql = await res.text();
        if (supabaseSqlCode) supabaseSqlCode.textContent = sql;
      }
    } catch (e) {}
  }

  // Load all admin data from server
  async function loadAdminData() {
    const token = getToken();
    if (!token) {
      if (window.TriboneraApp) {
        window.TriboneraApp.showToast('Sessão não encontrada. Faça login com o código de Administrador.', 'error');
      }
      return;
    }

    try {
      const res = await fetch('/api/admin/data', {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Falha ao carregar dados administrativos.');
      }

      renderCodesTable(data.codes || []);
      renderUsersTable(data.users || []);
    } catch (err) {
      console.error('Erro ao carregar dados do admin:', err);
      if (window.TriboneraApp) {
        window.TriboneraApp.showToast(err.message, 'error');
      }
    }
  }

  // Render Codes Table
  function renderCodesTable(codes = []) {
    tableCodesBody.innerHTML = '';

    if (codes.length === 0) {
      tableCodesBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--text-muted);">Nenhum código cadastrado.</td></tr>';
      return;
    }

    // Sort: Unused codes first, then by creation date
    const sortedCodes = [...codes].sort((a, b) => (a.used === b.used ? 0 : a.used ? 1 : -1));

    sortedCodes.forEach(item => {
      const tr = document.createElement('tr');
      
      const isUnused = !item.used;
      const statusBadge = isUnused 
        ? '<span class="badge-status-pill unused">Disponível</span>'
        : '<span class="badge-status-pill used">Utilizado</span>';

      const usedBy = item.usedBy ? `<strong>${escapeHtml(item.usedBy)}</strong>` : (item.role === 'admin' ? '<span style="color:#ffcc00">Admin Geral</span>' : '<span style="color:var(--text-muted)">—</span>');

      let actionHtml = '—';
      if (isUnused && item.code !== 'FELLMASTER123') {
        actionHtml = `<button class="btn-table-danger" onclick="TriboneraAdmin.revokeCode('${item.code}')">Revogar</button>`;
      }

      tr.innerHTML = `
        <td><strong style="font-family:var(--font-mono); letter-spacing:1px;">${escapeHtml(item.code)}</strong></td>
        <td>${statusBadge}</td>
        <td>${usedBy}</td>
        <td>${actionHtml}</td>
      `;

      tableCodesBody.appendChild(tr);
    });
  }

  // Render Users Table
  function renderUsersTable(users = []) {
    tableUsersBody.innerHTML = '';

    if (users.length === 0) {
      tableUsersBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--text-muted);">Nenhum usuário registrado.</td></tr>';
      return;
    }

    users.forEach(user => {
      const tr = document.createElement('tr');

      const isMeAdmin = user.role === 'admin';
      const roleBadge = isMeAdmin 
        ? '<span style="color:#ffcc00; font-weight:700;">👑 Administrador</span>'
        : '<span style="color:var(--text-muted)">Membro</span>';

      let statusDisplay = user.status;
      if (user.isStreaming) {
        statusDisplay = '<span style="color:var(--status-live); font-weight:700;">🔴 Transmitindo</span>';
      } else if (user.watching) {
        statusDisplay = `<span style="color:var(--status-watching);">👀 Assistindo ${escapeHtml(user.watching)}</span>`;
      } else if (user.isOnline) {
        statusDisplay = '<span style="color:var(--status-online);">🟢 Online</span>';
      } else {
        statusDisplay = '<span style="color:var(--status-offline);">⚫ Offline</span>';
      }

      let actionHtml = '—';
      if (!isMeAdmin) {
        actionHtml = `<button class="btn-table-danger" onclick="TriboneraAdmin.removeUser('${user.code}', '${escapeHtml(user.nickname)}')">Remover Acesso</button>`;
      }

      tr.innerHTML = `
        <td><strong>${escapeHtml(user.nickname)}</strong></td>
        <td><code style="font-family:var(--font-mono);">${escapeHtml(user.code)}</code></td>
        <td>${roleBadge}</td>
        <td>${statusDisplay}</td>
        <td>${actionHtml}</td>
      `;

      tableUsersBody.appendChild(tr);
    });
  }

  // Generate new code
  async function generateNewCode() {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/admin/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar código.');
      }

      displayNewCode.textContent = data.code.code;
      newCodeAlert.classList.remove('hidden');

      loadAdminData();
      if (window.TriboneraApp) {
        window.TriboneraApp.showToast(`Código ${data.code.code} gerado com sucesso!`, 'success');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Revoke code
  async function revokeCode(code) {
    if (!confirm(`Tem certeza que deseja revogar o código ${code}?`)) return;

    const token = getToken();
    try {
      const res = await fetch('/api/admin/revoke-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao revogar código.');

      loadAdminData();
      if (window.TriboneraApp) {
        window.TriboneraApp.showToast(data.message, 'success');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Remove User
  async function removeUser(code, nickname) {
    if (!confirm(`ATENÇÃO: Deseja remover permanentemente o usuário "${nickname}" (${code})?\nO token será invalidado e ele será desconectado na hora.`)) return;

    const token = getToken();
    try {
      const res = await fetch('/api/admin/remove-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ code })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao remover usuário.');

      loadAdminData();
      if (window.TriboneraApp) {
        window.TriboneraApp.showToast(data.message, 'success');
      }
    } catch (err) {
      alert(err.message);
    }
  }

  // Copy code to clipboard
  function copyGeneratedCode() {
    const code = displayNewCode.textContent.trim();
    if (navigator.clipboard && code) {
      navigator.clipboard.writeText(code).then(() => {
        btnCopyCode.textContent = 'Copiado!';
        setTimeout(() => { btnCopyCode.textContent = 'Copiar Código'; }, 2000);
      });
    }
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Setup Event Listeners
  if (btnOpenAdmin) btnOpenAdmin.addEventListener('click', openAdminModal);
  if (btnCloseAdmin) btnCloseAdmin.addEventListener('click', closeAdminModal);
  if (tabBtnCodes) tabBtnCodes.addEventListener('click', () => switchTab('tab-codes'));
  if (tabBtnUsers) tabBtnUsers.addEventListener('click', () => switchTab('tab-users'));
  if (tabBtnDatabase) tabBtnDatabase.addEventListener('click', () => switchTab('tab-database'));
  if (btnGenerateCode) btnGenerateCode.addEventListener('click', generateNewCode);
  if (btnCopyCode) btnCopyCode.addEventListener('click', copyGeneratedCode);
  if (btnCopySql) {
    btnCopySql.addEventListener('click', () => {
      if (supabaseSqlCode && navigator.clipboard) {
        navigator.clipboard.writeText(supabaseSqlCode.textContent).then(() => {
          btnCopySql.textContent = 'Copiado para a área de transferência!';
          setTimeout(() => { btnCopySql.textContent = 'Copiar Script SQL do Supabase'; }, 2500);
        });
      }
    });
  }

  return {
    open: openAdminModal,
    close: closeAdminModal,
    revokeCode,
    removeUser,
    refresh: loadAdminData
  };
})();
