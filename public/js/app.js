/**
 * TriboneraShare — Main Application Orchestrator
 * Coordinates Socket.IO real-time presence, WebRTC stream switching, UI updates, and player controls.
 */

window.TriboneraApp = (function () {
  // Elements
  const myAvatarText = document.getElementById('my-avatar-text');
  const myNicknameDisplay = document.getElementById('my-nickname-display');
  const myRoleTag = document.getElementById('my-role-tag');
  const myStatusDot = document.getElementById('my-status-dot');
  const btnLogout = document.getElementById('btn-logout');
  const btnOpenAdmin = document.getElementById('btn-open-admin');

  // Sidebar Controls
  const viewNotStreaming = document.getElementById('view-not-streaming');
  const viewIsStreaming = document.getElementById('view-is-streaming');
  const btnStartShare = document.getElementById('btn-start-share');
  const btnEmptyStartShare = document.getElementById('btn-empty-start-share');
  const btnStopShare = document.getElementById('btn-stop-share');
  const selectQuality = document.getElementById('select-stream-quality');
  const checkboxSystemAudio = document.getElementById('checkbox-system-audio');
  const checkboxMicAudio = document.getElementById('checkbox-mic-audio');
  const myStreamTimer = document.getElementById('my-stream-timer');
  const myStreamSpecs = document.getElementById('my-stream-specs');
  const countActiveStreams = document.getElementById('count-active-streams');
  const sidebarStreamsList = document.getElementById('sidebar-streams-list');
  const emptyChannelsNote = document.getElementById('empty-channels-note');
  const headerStreamsBar = document.getElementById('header-streams-bar');

  // Permission / Screen Options Modal
  const permissionModal = document.getElementById('permission-modal');
  const btnClosePermissionModal = document.getElementById('btn-close-permission-modal');

  // Stage & Video
  const videoHeaderBar = document.getElementById('video-header-bar');
  const currentStreamerAvatar = document.getElementById('current-streamer-avatar');
  const currentStreamerTitle = document.getElementById('current-streamer-title');
  const currentStreamerSpecs = document.getElementById('current-streamer-specs');
  const currentStreamUptime = document.getElementById('current-stream-uptime');
  const liveAudioStatusPill = document.getElementById('live-audio-status-pill');
  const liveAudioStatusText = document.getElementById('live-audio-status-text');
  const equalizerAnim = document.getElementById('equalizer-anim');
  const broadcasterHeaderActions = document.getElementById('broadcaster-header-actions');
  const btnStreamerMuteAudio = document.getElementById('btn-streamer-mute-audio');
  const streamerAudioToggleLabel = document.getElementById('streamer-audio-toggle-label');
  const iconStreamerAudioState = document.getElementById('icon-streamer-audio-state');
  const btnHeaderStopShare = document.getElementById('btn-header-stop-share');
  const btnSidebarMuteAudio = document.getElementById('btn-sidebar-mute-audio');
  const sidebarAudioStatusLabel = document.getElementById('sidebar-audio-status-label');
  const sidebarAudioIcon = document.getElementById('sidebar-audio-icon');
  const btnScreenshotVideo = document.getElementById('btn-screenshot-video');
  const btnStopWatching = document.getElementById('btn-stop-watching');
  const btnStatsToggle = document.getElementById('btn-stats-toggle');
  const btnCloseStats = document.getElementById('btn-close-stats');
  const statsHud = document.getElementById('stats-hud');
  const remoteVideo = document.getElementById('remote-video');
  const localPreviewVideo = document.getElementById('local-preview-video');
  const emptyStageState = document.getElementById('empty-stage-state');
  const videoControlsOverlay = document.getElementById('video-controls-overlay');
  const viewersBar = document.getElementById('viewers-bar');
  const viewersCountNum = document.getElementById('viewers-count-num');
  const viewersChipsContainer = document.getElementById('viewers-chips-container');
  const stageStreamTabs = document.getElementById('stage-stream-tabs');
  const glassViewersBadge = document.getElementById('glass-viewers-badge');
  const glassViewersAvatars = document.getElementById('glass-viewers-avatars');
  const glassViewersCount = document.getElementById('glass-viewers-count');
  const glassLatencyBadge = document.getElementById('glass-latency-badge');

  // Minimal Stream Footer Elements
  const btnDockScreenshot = document.getElementById('btn-dock-screenshot');
  const btnDockPip = document.getElementById('btn-dock-pip');
  const btnDockFullscreen = document.getElementById('btn-dock-fullscreen');
  const footerQualityTag = document.getElementById('footer-quality-tag');
  const footerAudioTag = document.getElementById('footer-audio-tag');

  // Mobile Drawer & Navigation Elements
  const btnMobileSidebarToggle = document.getElementById('btn-mobile-sidebar-toggle');
  const btnMobileUsersToggle = document.getElementById('btn-mobile-users-toggle');
  const mobileDrawerOverlay = document.getElementById('mobile-drawer-overlay');
  const sidebarChannels = document.getElementById('sidebar-channels');
  const sidebarUsers = document.getElementById('sidebar-users');
  const mobileBottomNav = document.getElementById('mobile-bottom-nav');
  const navBtnStage = document.getElementById('nav-btn-stage');
  const navBtnChannels = document.getElementById('nav-btn-channels');
  const navBtnMembers = document.getElementById('nav-btn-members');

  // Video Controls
  const btnToggleAudio = document.getElementById('btn-toggle-audio');
  const iconVolumeHigh = document.getElementById('icon-volume-high');
  const iconVolumeMuted = document.getElementById('icon-volume-muted');
  const volumeSlider = document.getElementById('volume-slider');
  const btnPip = document.getElementById('btn-pip');
  const btnFullscreen = document.getElementById('btn-fullscreen');

  // User List Sidebar
  const countTotalMembers = document.getElementById('count-total-members');
  const groupStreaming = document.getElementById('group-streaming');
  const countStreaming = document.getElementById('count-streaming');
  const listUsersStreaming = document.getElementById('list-users-streaming');
  const countOnline = document.getElementById('count-online');
  const listUsersOnline = document.getElementById('list-users-online');
  const countOffline = document.getElementById('count-offline');
  const listUsersOffline = document.getElementById('list-users-offline');
  const footerUserName = document.getElementById('footer-user-name');
  const footerUserStatus = document.getElementById('footer-user-status');
  const toastContainer = document.getElementById('toast-container');
  const btnToggleSound = document.getElementById('btn-toggle-sound');

  // Application State
  let socket = null;
  let currentUser = null;
  let isCurrentlyStreaming = false;
  let currentWatchedStream = null; // { streamerSocketId, streamerName, ... }
  let activeStreamsList = [];
  let streamTimerInterval = null;
  let streamStartTime = null;

  function getToken() {
    return localStorage.getItem('tribonera_token');
  }

  // --- Rich Real-Time Notifications & Toasts ---
  function showNotification({
    title = '',
    message = '',
    type = 'info',
    avatarText = '',
    actionBtn = null,
    duration = 4500
  }) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Main Wrapper
    const mainWrap = document.createElement('div');
    mainWrap.className = 'toast-main';

    // Icon or Avatar
    const iconWrap = document.createElement('div');
    iconWrap.className = 'toast-icon-wrap';

    if (avatarText) {
      iconWrap.textContent = avatarText.slice(0, 2).toUpperCase();
    } else if (type === 'user-join') {
      iconWrap.innerHTML = '👋';
    } else if (type === 'live') {
      iconWrap.innerHTML = '🔴';
    } else if (type === 'success') {
      iconWrap.innerHTML = '✓';
    } else if (type === 'error') {
      iconWrap.innerHTML = '⚠️';
    } else {
      iconWrap.innerHTML = 'ℹ️';
    }
    mainWrap.appendChild(iconWrap);

    // Content container
    const contentWrap = document.createElement('div');
    contentWrap.className = 'toast-content';

    if (title) {
      const titleEl = document.createElement('div');
      titleEl.className = 'toast-title';
      titleEl.textContent = title;
      contentWrap.appendChild(titleEl);
    }

    const messageEl = document.createElement('div');
    messageEl.className = 'toast-message';
    messageEl.innerHTML = message;
    contentWrap.appendChild(messageEl);

    mainWrap.appendChild(contentWrap);

    // Dismiss Button
    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'toast-dismiss';
    dismissBtn.setAttribute('aria-label', 'Fechar');
    dismissBtn.innerHTML = '&times;';
    mainWrap.appendChild(dismissBtn);

    toast.appendChild(mainWrap);

    // Optional Interactive Action Row
    if (actionBtn && typeof actionBtn.onClick === 'function') {
      const actionRow = document.createElement('div');
      actionRow.className = 'toast-action-row';

      const btn = document.createElement('button');
      btn.className = 'toast-btn-action';
      btn.textContent = actionBtn.text || 'Assistir';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissToast();
        actionBtn.onClick();
      });
      actionRow.appendChild(btn);
      toast.appendChild(actionRow);
    }

    // Progress Bar
    const progressEl = document.createElement('div');
    progressEl.className = 'toast-progress';
    toast.appendChild(progressEl);

    toastContainer.appendChild(toast);

    // Dismiss logic with timer and hover pause
    let remainingTime = duration;
    let startTime = Date.now();
    let timeoutId = null;
    let progressAnim = null;

    function startTimer() {
      startTime = Date.now();
      progressEl.style.transition = `transform ${remainingTime}ms linear`;
      progressEl.style.transform = 'scaleX(0)';

      timeoutId = setTimeout(() => {
        dismissToast();
      }, remainingTime);
    }

    function pauseTimer() {
      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;
      remainingTime = Math.max(0, remainingTime - elapsed);
      const computedWidth = progressEl.getBoundingClientRect().width;
      const totalWidth = toast.getBoundingClientRect().width;
      const scale = totalWidth > 0 ? (computedWidth / totalWidth) : 0;
      progressEl.style.transition = 'none';
      progressEl.style.transform = `scaleX(${scale})`;
    }

    toast.addEventListener('mouseenter', pauseTimer);
    toast.addEventListener('mouseleave', () => {
      if (remainingTime > 0) startTimer();
    });

    dismissBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissToast();
    });

    function dismissToast() {
      clearTimeout(timeoutId);
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(60px) scale(0.95)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => {
        try { toast.remove(); } catch (e) {}
      }, 250);
    }

    // Initialize progress & timer
    progressEl.style.transform = 'scaleX(1)';
    requestAnimationFrame(() => {
      startTimer();
    });

    return { dismiss: dismissToast };
  }

  function showToast(message, type = 'info') {
    return showNotification({
      message: escapeHtml(message),
      type
    });
  }

  // --- Initial Verification & Socket Connection ---
  async function init() {
    const token = getToken();
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const res = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        localStorage.removeItem('tribonera_token');
        document.cookie = 'tribonera_token=; max-age=0; path=/';
        window.location.href = '/';
        return;
      }

      const data = await res.json();
      currentUser = data.user;
      setupUserProfileUI(currentUser);
      connectSocket(token);

      // Listener para notificações do Electron AutoUpdater
      if (window.electronAPI && typeof window.electronAPI.onUpdaterMessage === 'function') {
        window.electronAPI.onUpdaterMessage((info) => {
          if (info.status === 'available') {
            showToast(`🚀 Baixando nova versão (${info.version}) em segundo plano...`, 'info');
          } else if (info.status === 'downloaded') {
            showToast(`✨ Nova versão (${info.version}) pronta para instalar!`, 'success');
          }
        });
      }
    } catch (err) {
      console.error('Erro na inicialização:', err);
      showToast('Erro de conexão com o servidor.', 'error');
    }
  }

  function setupUserProfileUI(user) {
    myAvatarText.textContent = user.nickname.charAt(0).toUpperCase();
    myNicknameDisplay.textContent = user.nickname;
    footerUserName.textContent = user.nickname;

    if (user.role === 'admin') {
      myRoleTag.textContent = 'Admin';
      myRoleTag.style.color = '#ffcc00';
      btnOpenAdmin.classList.remove('hidden');
    } else {
      myRoleTag.textContent = 'Membro';
    }
  }

  // --- Socket.IO Event Setup ---
  function connectSocket(token) {
    socket = io({
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('Conectado ao Concord via Socket.IO');
      myStatusDot.className = 'status-indicator online';
      footerUserStatus.textContent = '🟢 Online';
    });

    socket.on('connect_error', (err) => {
      console.error('Erro de conexão do Socket:', err);
      showToast(err.message || 'Falha de autenticação no socket.', 'error');
      if (err.message.includes('Token')) {
        setTimeout(() => { window.location.href = '/'; }, 1500);
      }
    });

    // Revocation Event (forced logout by admin)
    socket.on('auth:revoked', (data) => {
      alert(data.message || 'Seu acesso foi revogado pelo Administrador.');
      localStorage.removeItem('tribonera_token');
      document.cookie = 'tribonera_token=; max-age=0; path=/';
      window.location.href = '/';
    });

    // Real-Time Presence Synchronization
    socket.on('presence:sync', (data) => {
      activeStreamsList = data.activeStreams || [];
      renderPresence(data);
      renderActiveStreamsSidebar(data.activeStreams || []);
      renderHeaderStreams(data.activeStreams || []);

      // If we are streaming, update the viewer list of our own stream
      if (isCurrentlyStreaming) {
        const myStreamData = activeStreamsList.find(s => s.streamerCode === currentUser.code || s.streamerSocketId === socket.id);
        if (myStreamData) {
          updateViewersList(myStreamData.viewers || []);
        } else {
          updateViewersList([]);
        }
      } else if (currentWatchedStream) {
        // If we are watching a stream, update its viewer list & info
        const streamData = activeStreamsList.find(s => s.streamerSocketId === currentWatchedStream.streamerSocketId);
        if (streamData) {
          updateViewersList(streamData.viewers || []);
        }
      }
    });

    // Real-Time Notification when a new user connects / logs in
    socket.on('user:joined', (user) => {
      if (user && user.code !== currentUser.code) {
        if (window.TriboneraSound) {
          TriboneraSound.play('ding');
        }
        showNotification({
          title: 'Comunidade',
          message: `<strong>${escapeHtml(user.nickname)}</strong> has joined the community`,
          avatarText: user.nickname ? user.nickname.charAt(0).toUpperCase() : '👤',
          type: 'user-join',
          duration: 5000
        });
      }
    });

    // Real-Time Notification when another user starts streaming
    socket.on('stream:started', (stream) => {
      if (stream && stream.streamerCode !== currentUser.code) {
        if (window.TriboneraSound) {
          TriboneraSound.play('pop');
        }
        showNotification({
          title: 'Transmissão Ao Vivo 🔴',
          message: `<strong>${escapeHtml(stream.streamerName)}</strong> is now live!`,
          avatarText: stream.streamerName ? stream.streamerName.charAt(0).toUpperCase() : '🔴',
          type: 'live',
          duration: 6500,
          actionBtn: {
            text: 'Assistir',
            onClick: () => {
              watchStream(stream);
            }
          }
        });
      }
    });

    // Stream ended notification
    socket.on('stream:ended', (data) => {
      if (currentWatchedStream && currentWatchedStream.streamerSocketId === data.streamerSocketId) {
        showToast(`A transmissão de ${data.streamerName} foi encerrada.`, 'info');
        leaveCurrentStream();
      }
    });

    // --- WebRTC Signaling Events ---
    socket.on('webrtc:new-viewer', ({ viewerSocketId, viewerNickname }) => {
      console.log(`Espectador ${viewerNickname} entrou na sua transmissão`);
      TriboneraWebRTC.handleNewViewer(viewerSocketId, socket);
      showToast(`👀 ${viewerNickname} começou a assistir sua tela!`);
    });

    socket.on('webrtc:offer', ({ fromSocketId, fromNickname, offer }) => {
      console.log(`Offer WebRTC recebida de ${fromNickname}`);
      TriboneraWebRTC.handleStreamerOffer(fromSocketId, offer, socket, remoteVideo);
    });

    socket.on('webrtc:answer', ({ fromSocketId, answer }) => {
      TriboneraWebRTC.handleViewerAnswer(fromSocketId, answer);
    });

    socket.on('webrtc:ice-candidate', ({ fromSocketId, candidate }) => {
      TriboneraWebRTC.handleIceCandidate(fromSocketId, candidate);
    });

    socket.on('webrtc:viewer-left', ({ viewerSocketId }) => {
      TriboneraWebRTC.handleViewerDisconnected(viewerSocketId);
    });
  }

  // --- Render Presence & User List (Right Sidebar) ---
  function renderPresence(data) {
    const { onlineUsers = [], offlineUsers = [], activeStreams = [], totalRegistered = 0 } = data;

    countTotalMembers.textContent = totalRegistered;

    // 1. Streaming Section
    listUsersStreaming.innerHTML = '';
    const streamingUsers = onlineUsers.filter(u => u.isStreaming);
    countStreaming.textContent = streamingUsers.length;

    if (streamingUsers.length === 0) {
      groupStreaming.classList.add('hidden');
    } else {
      groupStreaming.classList.remove('hidden');
      streamingUsers.forEach(u => {
        const row = createMemberRow(u, 'streaming');
        listUsersStreaming.appendChild(row);
      });
    }

    // 2. Online Section
    listUsersOnline.innerHTML = '';
    const onlineNonStreaming = onlineUsers.filter(u => !u.isStreaming);
    countOnline.textContent = onlineNonStreaming.length;

    onlineNonStreaming.forEach(u => {
      const row = createMemberRow(u, 'online');
      listUsersOnline.appendChild(row);
    });

    // 3. Offline Section
    listUsersOffline.innerHTML = '';
    countOffline.textContent = offlineUsers.length;

    offlineUsers.forEach(u => {
      const row = createMemberRow(u, 'offline');
      listUsersOffline.appendChild(row);
    });
  }

  function getAvatarColorClass(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % 6;
    return `avatar-theme-${index}`;
  }

  function createMemberRow(user, type) {
    const row = document.createElement('div');
    row.className = `member-row ${type === 'offline' ? 'offline-member' : ''}`;

    const initial = user.nickname.charAt(0).toUpperCase();
    const isAdmin = user.role === 'admin';
    const avatarTheme = getAvatarColorClass(user.nickname || 'User');

    let statusText = 'Online';
    let statusClass = 'online';
    let activityText = '';

    if (type === 'streaming') {
      statusText = '🔴 Transmitindo';
      statusClass = 'streaming';
      activityText = '<span class="member-status-activity streaming-text">🔴 Transmitindo Tela</span>';
    } else if (user.watchingStreamerName) {
      statusText = `Assistindo ${user.watchingStreamerName}`;
      statusClass = 'watching';
      activityText = `<span class="member-status-activity watching-text">👀 Assistindo ${escapeHtml(user.watchingStreamerName)}</span>`;
    } else if (type === 'online') {
      statusText = 'Online';
      statusClass = 'online';
      activityText = '<span class="member-status-activity">Disponível</span>';
    } else {
      statusText = 'Offline';
      statusClass = 'offline';
      activityText = '<span class="member-status-activity">Desconectado</span>';
    }

    const actionBtn = (type === 'streaming' && user.code !== currentUser.code)
      ? `<button class="member-action-btn" onclick="TriboneraApp.watchStreamByCode('${user.code}')">Assistir</button>`
      : '';

    row.innerHTML = `
      <div class="member-left">
        <div class="member-avatar-wrap">
          <div class="member-avatar ${avatarTheme}">${initial}</div>
          <span class="status-indicator ${statusClass}"></span>
        </div>
        <div class="member-meta">
          <span class="member-nickname ${isAdmin ? 'admin-nick' : ''}">${escapeHtml(user.nickname)} ${isAdmin ? '👑' : ''}</span>
          ${activityText}
        </div>
      </div>
      ${actionBtn}
    `;

    // Click on streamer in list switches to watching
    if (type === 'streaming' && user.code !== currentUser.code) {
      row.addEventListener('click', (e) => {
        if (!e.target.classList.contains('member-action-btn')) {
          watchStreamByCode(user.code);
        }
      });
    }

    return row;
  }

  // --- Render Active Streams in Left Sidebar & Header ---
  function renderActiveStreamsSidebar(streams) {
    countActiveStreams.textContent = streams.length;
    sidebarStreamsList.innerHTML = '';

    if (streams.length === 0) {
      sidebarStreamsList.appendChild(emptyChannelsNote);
      emptyChannelsNote.classList.remove('hidden');
      return;
    }

    emptyChannelsNote.classList.add('hidden');

    streams.forEach(stream => {
      const isMe = stream.streamerCode === currentUser.code;
      const isWatchingThis = currentWatchedStream && currentWatchedStream.streamerSocketId === stream.streamerSocketId;

      const row = document.createElement('div');
      row.className = `channel-stream-row ${isWatchingThis ? 'watching' : ''}`;
      row.innerHTML = `
        <div class="channel-left-info">
          <svg class="live-channel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span class="channel-streamer-nick">${escapeHtml(stream.streamerName)} ${isMe ? '(Você)' : ''}</span>
        </div>
        <span class="channel-watching-badge">AO VIVO (${stream.viewersCount || 0})</span>
      `;

      row.addEventListener('click', () => {
        if (!isMe) {
          watchStream(stream);
        }
      });

      sidebarStreamsList.appendChild(row);
    });
  }

  function renderHeaderStreams(streams) {
    headerStreamsBar.innerHTML = '';
    if (streams.length <= 1) return;

    streams.forEach(stream => {
      const isMe = stream.streamerCode === currentUser.code;
      const isWatching = currentWatchedStream && currentWatchedStream.streamerSocketId === stream.streamerSocketId;

      const pill = document.createElement('button');
      pill.className = `stream-tab-pill ${isWatching ? 'active' : ''}`;
      pill.innerHTML = `
        <span class="pulse-dot" style="width:6px; height:6px;"></span>
        <span>${escapeHtml(stream.streamerName)} ${isMe ? '(Sua tela)' : ''}</span>
        <span style="font-size:10px; opacity:0.8;">(${stream.viewersCount || 0})</span>
      `;

      pill.addEventListener('click', () => {
        if (!isMe) {
          watchStream(stream);
        }
      });

      headerStreamsBar.appendChild(pill);
    });
  }

  // --- Screen Sharing Actions (Broadcaster) ---
  async function handleStartShareClick() {
    if (isCurrentlyStreaming) return;

    // If running inside Electron, show the visual Screen/Window Picker (like Discord)
    if (window.electronAPI && typeof window.electronAPI.getDesktopSources === 'function') {
      openDesktopPickerModal();
    } else {
      startScreenShare();
    }
  }

  async function openDesktopPickerModal() {
    const pickerModal = document.getElementById('desktop-picker-modal');
    const sourcesGrid = document.getElementById('picker-sources-grid');
    const tabScreens = document.getElementById('tab-picker-screens');
    const tabWindows = document.getElementById('tab-picker-windows');
    const btnClosePicker = document.getElementById('btn-close-picker-modal');

    if (!pickerModal || !sourcesGrid) {
      startScreenShare();
      return;
    }

    pickerModal.classList.remove('hidden');
    sourcesGrid.innerHTML = '<div style="color:var(--text-muted); padding:20px; grid-column: 1/-1; text-align:center;">Carregando telas e janelas...</div>';

    let allSources = [];
    let currentTab = 'screens';

    try {
      allSources = await window.electronAPI.getDesktopSources();
    } catch (err) {
      console.error('Erro ao obter fontes do Electron:', err);
      pickerModal.classList.add('hidden');
      startScreenShare();
      return;
    }

    function renderSources() {
      sourcesGrid.innerHTML = '';
      const filtered = allSources.filter(src => {
        if (currentTab === 'screens') return src.id.startsWith('screen:');
        return src.id.startsWith('window:');
      });

      if (filtered.length === 0) {
        sourcesGrid.innerHTML = `<div style="color:var(--text-muted); padding:30px; grid-column: 1/-1; text-align:center;">Nenhuma ${currentTab === 'screens' ? 'tela extra' : 'janela'} encontrada.</div>`;
        return;
      }

      filtered.forEach(src => {
        const item = document.createElement('div');
        item.className = 'picker-source-item';
        item.innerHTML = `
          <img class="picker-source-thumb" src="${src.thumbnail}" alt="${escapeHtml(src.name)}" />
          <div class="picker-source-name-wrap">
            ${src.appIcon ? `<img class="picker-source-app-icon" src="${src.appIcon}" alt="" />` : ''}
            <span class="picker-source-title" title="${escapeHtml(src.name)}">${escapeHtml(src.name)}</span>
          </div>
        `;

        item.addEventListener('click', async () => {
          pickerModal.classList.add('hidden');
          if (typeof window.electronAPI.selectDesktopSource === 'function') {
            await window.electronAPI.selectDesktopSource(src.id);
          }
          startScreenShare();
        });

        sourcesGrid.appendChild(item);
      });
    }

    if (tabScreens) {
      tabScreens.onclick = () => {
        currentTab = 'screens';
        tabScreens.classList.add('active');
        if (tabWindows) tabWindows.classList.remove('active');
        renderSources();
      };
    }

    if (tabWindows) {
      tabWindows.onclick = () => {
        currentTab = 'windows';
        tabWindows.classList.add('active');
        if (tabScreens) tabScreens.classList.remove('active');
        renderSources();
      };
    }

    if (btnClosePicker) {
      btnClosePicker.onclick = () => pickerModal.classList.add('hidden');
    }

    pickerModal.onclick = (e) => {
      if (e.target === pickerModal) pickerModal.classList.add('hidden');
    };

    renderSources();
  }

  async function startScreenShare() {
    if (isCurrentlyStreaming) return;

    // Leave any watched stream first
    if (currentWatchedStream) {
      leaveCurrentStream();
    }

    const quality = selectQuality ? selectQuality.value : '1080p60';
    const audioOptions = {
      systemAudio: checkboxSystemAudio ? checkboxSystemAudio.checked : true,
      micAudio: checkboxMicAudio ? checkboxMicAudio.checked : false
    };

    const result = await TriboneraWebRTC.startScreenCapture(quality, audioOptions);

    if (!result.success) {
      if (result.isPermissionsPolicyError) {
        // Open options modal so user can launch in New Tab for direct OS capture
        openPermissionModal();
        return;
      }
      if (result.error) showToast(result.error, 'error');
      return;
    }

    closePermissionModal();

    isCurrentlyStreaming = true;
    myStatusDot.className = 'status-indicator streaming';
    footerUserStatus.textContent = '🔴 Transmitindo';

    // Show local preview
    localPreviewVideo.muted = true;
    localPreviewVideo.playsInline = true;
    localPreviewVideo.srcObject = result.stream;
    localPreviewVideo.classList.remove('hidden');
    try {
      const playPromise = localPreviewVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => console.warn('Erro ao reproduzir preview local:', err));
      }
    } catch (e) {
      console.warn('Erro play preview local:', e);
    }
    remoteVideo.classList.add('hidden');
    emptyStageState.classList.add('hidden');
    videoHeaderBar.classList.remove('hidden');
    viewersBar.classList.remove('hidden');
    videoControlsOverlay.classList.remove('hidden');
    if (glassViewersBadge) glassViewersBadge.classList.remove('hidden');
    if (glassLatencyBadge) glassLatencyBadge.classList.remove('hidden');

    // Stage and Actions Visibility for Broadcaster
    if (broadcasterHeaderActions) broadcasterHeaderActions.classList.remove('hidden');
    if (btnStopWatching) btnStopWatching.classList.add('hidden');

    // Update Stage Top Bar for Broadcaster
    currentStreamerAvatar.textContent = currentUser.nickname.charAt(0).toUpperCase();
    currentStreamerAvatar.className = `streamer-avatar ${getAvatarColorClass(currentUser.nickname)}`;
    currentStreamerTitle.textContent = `Sua Transmissão (${currentUser.nickname})`;
    currentStreamerSpecs.textContent = `${result.resolution} • ${result.fps} FPS • Direct P2P`;

    // Audio status & controls synchronization
    updateStreamerMuteButtonUI(false, result.hasAudio);
    updateLiveAudioStatus(result.hasAudio, false);
    updateViewersList([]);

    if (footerQualityTag) footerQualityTag.textContent = `${result.resolution} ${result.fps} FPS`;
    if (footerAudioTag) footerAudioTag.textContent = result.hasAudio ? '🔊 Som Ativo' : '🔇 Sem Áudio';

    // Update left sidebar controls
    viewNotStreaming.classList.add('hidden');
    viewIsStreaming.classList.remove('hidden');
    myStreamSpecs.textContent = `${result.resolution} @ ${result.fps} FPS ${result.hasAudio ? '• 🔊 Áudio' : ''}`;

    // Start stream timer
    streamStartTime = Date.now();
    updateStreamTimer();
    streamTimerInterval = setInterval(updateStreamTimer, 1000);

    // Notify server via Socket.IO
    socket.emit('stream:start', {
      title: `Tela de ${currentUser.nickname}`,
      resolution: result.resolution,
      fps: result.fps,
      hasAudio: result.hasAudio
    });

    if (window.TriboneraSound) {
      TriboneraSound.play('liveStart');
    }

    showToast('Transmissão iniciada com sucesso!', 'success');
  }

  function openPermissionModal() {
    if (permissionModal) {
      permissionModal.classList.remove('hidden');
    }
  }

  function closePermissionModal() {
    if (permissionModal) {
      permissionModal.classList.add('hidden');
    }
  }

  function stopScreenShare() {
    if (!isCurrentlyStreaming) return;

    isCurrentlyStreaming = false;
    TriboneraWebRTC.stopStreaming();

    if (streamTimerInterval) {
      clearInterval(streamTimerInterval);
      streamTimerInterval = null;
    }
    streamStartTime = null;

    localPreviewVideo.srcObject = null;
    localPreviewVideo.classList.add('hidden');

    viewIsStreaming.classList.add('hidden');
    viewNotStreaming.classList.remove('hidden');
    if (broadcasterHeaderActions) broadcasterHeaderActions.classList.add('hidden');

    myStatusDot.className = 'status-indicator online';
    footerUserStatus.textContent = '🟢 Online';

    if (!currentWatchedStream) {
      videoHeaderBar.classList.add('hidden');
      viewersBar.classList.add('hidden');
      videoControlsOverlay.classList.add('hidden');
      statsHud.classList.add('hidden');
      if (glassViewersBadge) glassViewersBadge.classList.add('hidden');
      if (glassLatencyBadge) glassLatencyBadge.classList.add('hidden');
      emptyStageState.classList.remove('hidden');
    }

    socket.emit('stream:stop');
    if (window.TriboneraSound) {
      TriboneraSound.play('leave');
    }
    showToast('Transmissão encerrada.');
  }

  function onScreenShareEndedByBrowser() {
    stopScreenShare();
  }

  function handleToggleStreamAudio() {
    if (!isCurrentlyStreaming) return;
    const hasAudio = TriboneraWebRTC.hasAudioTrack ? TriboneraWebRTC.hasAudioTrack() : false;
    if (!hasAudio) {
      showToast('Esta transmissão foi iniciada sem captura de áudio.', 'info');
      updateStreamerMuteButtonUI(true, false);
      updateLiveAudioStatus(false, false);
      return;
    }

    const result = TriboneraWebRTC.toggleStreamAudioMute();
    const isMuted = result.isMuted;
    updateStreamerMuteButtonUI(isMuted, true);
    updateLiveAudioStatus(true, isMuted);
    showToast(isMuted ? 'Áudio da transmissão mutado.' : 'Áudio da transmissão ativado.', 'info');
  }

  function updateStreamTimer() {
    if (!streamStartTime) {
      if (currentStreamUptime) currentStreamUptime.textContent = '00:00:00';
      if (myStreamTimer) myStreamTimer.textContent = '00:00';
      return;
    }
    const diff = Math.floor((Date.now() - streamStartTime) / 1000);
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    
    if (currentStreamUptime) {
      currentStreamUptime.textContent = `${h}:${m}:${s}`;
    }
    if (myStreamTimer) {
      myStreamTimer.textContent = `${m}:${s}`;
    }
  }

  function updateLiveAudioStatus(hasAudio, isMuted) {
    if (footerAudioTag) {
      footerAudioTag.textContent = (!hasAudio || isMuted) ? '🔇 Sem Áudio' : '🔊 Som Ativo';
    }

    if (!liveAudioStatusPill || !liveAudioStatusText) return;
    
    if (!hasAudio) {
      liveAudioStatusPill.className = 'live-audio-status-pill audio-off';
      liveAudioStatusText.textContent = '🔇 Sem Áudio';
      if (equalizerAnim) equalizerAnim.classList.add('paused');
    } else if (isMuted) {
      liveAudioStatusPill.className = 'live-audio-status-pill audio-off';
      liveAudioStatusText.textContent = '🔇 Áudio Mutado';
      if (equalizerAnim) equalizerAnim.classList.add('paused');
    } else {
      liveAudioStatusPill.className = 'live-audio-status-pill audio-on';
      liveAudioStatusText.textContent = '🔊 Som do Sistema Ativo';
      if (equalizerAnim) equalizerAnim.classList.remove('paused');
    }
  }

  function updateStreamerMuteButtonUI(isMuted, hasAudio = true) {
    const iconHighSVG = `
      <svg class="audio-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
      </svg>
    `;
    const iconMutedSVG = `
      <svg class="audio-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;flex-shrink:0;">
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
        <line x1="23" y1="9" x2="17" y2="15"></line>
        <line x1="17" y1="9" x2="23" y2="15"></line>
      </svg>
    `;

    // 1. Update Video Header Button (Discord-styled)
    if (btnStreamerMuteAudio) {
      if (!hasAudio) {
        btnStreamerMuteAudio.classList.add('muted');
        btnStreamerMuteAudio.innerHTML = `${iconMutedSVG}<span>Sem Áudio</span>`;
        btnStreamerMuteAudio.setAttribute('title', 'Nenhum áudio foi capturado nesta transmissão');
      } else if (isMuted) {
        btnStreamerMuteAudio.classList.add('muted');
        btnStreamerMuteAudio.innerHTML = `${iconMutedSVG}<span>Desmutar Som</span>`;
        btnStreamerMuteAudio.setAttribute('title', 'Clique para desmutar som da transmissão');
      } else {
        btnStreamerMuteAudio.classList.remove('muted');
        btnStreamerMuteAudio.innerHTML = `${iconHighSVG}<span>Mutar Som</span>`;
        btnStreamerMuteAudio.setAttribute('title', 'Clique para mutar som da transmissão');
      }
    }

    // 2. Update Left Sidebar Quick Action Pill (mirrored state)
    if (btnSidebarMuteAudio) {
      if (!hasAudio) {
        btnSidebarMuteAudio.classList.add('muted');
        btnSidebarMuteAudio.innerHTML = `${iconMutedSVG}<span>Sem Áudio</span>`;
        btnSidebarMuteAudio.setAttribute('title', 'Nenhum áudio foi capturado');
      } else if (isMuted) {
        btnSidebarMuteAudio.classList.add('muted');
        btnSidebarMuteAudio.innerHTML = `${iconMutedSVG}<span>Áudio Mutado (Ativar)</span>`;
        btnSidebarMuteAudio.setAttribute('title', 'Clique para desmutar som da transmissão');
      } else {
        btnSidebarMuteAudio.classList.remove('muted');
        btnSidebarMuteAudio.innerHTML = `${iconHighSVG}<span>Som Ativo (Mutar)</span>`;
        btnSidebarMuteAudio.setAttribute('title', 'Clique para mutar som da transmissão');
      }
    }
  }

  // --- Watching Streams (Viewer) ---
  function watchStreamByCode(streamerCode) {
    const stream = activeStreamsList.find(s => s.streamerCode === streamerCode);
    if (stream) {
      watchStream(stream);
    }
  }

  function watchStream(stream) {
    if (isCurrentlyStreaming) {
      if (!confirm('Você está transmitindo no momento. Deseja encerrar sua transmissão para assistir a de ' + stream.streamerName + '?')) {
        return;
      }
      stopScreenShare();
    }

    // If already watching another stream, leave it first
    if (currentWatchedStream && currentWatchedStream.streamerSocketId !== stream.streamerSocketId) {
      leaveCurrentStream(false);
    }

    currentWatchedStream = stream;
    myStatusDot.className = 'status-indicator watching';
    footerUserStatus.textContent = `👀 Assistindo ${stream.streamerName}`;

    // Update Stage UI
    emptyStageState.classList.add('hidden');
    localPreviewVideo.classList.add('hidden');
    remoteVideo.classList.remove('hidden');
    videoHeaderBar.classList.remove('hidden');
    viewersBar.classList.remove('hidden');
    videoControlsOverlay.classList.remove('hidden');
    if (broadcasterHeaderActions) broadcasterHeaderActions.classList.add('hidden');
    if (btnStopWatching) btnStopWatching.classList.remove('hidden');
    if (glassViewersBadge) glassViewersBadge.classList.remove('hidden');
    if (glassLatencyBadge) glassLatencyBadge.classList.remove('hidden');

    currentStreamerAvatar.textContent = stream.streamerName.charAt(0).toUpperCase();
    currentStreamerAvatar.className = `streamer-avatar ${getAvatarColorClass(stream.streamerName)}`;
    currentStreamerTitle.textContent = `Tela de ${stream.streamerName}`;
    currentStreamerSpecs.textContent = `${stream.resolution} • ${stream.fps} FPS • WebRTC Direct`;

    // Start Live Timer synchronized with streamer startedAt
    if (streamTimerInterval) clearInterval(streamTimerInterval);
    streamStartTime = stream.startedAt || Date.now();
    updateStreamTimer();
    streamTimerInterval = setInterval(updateStreamTimer, 1000);

    // Audio status indicator
    updateLiveAudioStatus(stream.hasAudio, false);

    if (footerQualityTag) footerQualityTag.textContent = `${stream.resolution} ${stream.fps} FPS`;
    if (footerAudioTag) footerAudioTag.textContent = stream.hasAudio ? '🔊 Som Ativo' : '🔇 Sem Áudio';

    // Ensure audio volume is at 100% and unmuted for remote playback
    remoteVideo.muted = false;
    remoteVideo.volume = 1;
    if (volumeSlider) volumeSlider.value = 1;
    if (iconVolumeHigh) iconVolumeHigh.classList.remove('hidden');
    if (iconVolumeMuted) iconVolumeMuted.classList.add('hidden');

    updateViewersList(stream.viewers || []);

    // Emit to server to join viewer room and trigger WebRTC Offer
    socket.emit('stream:join-viewer', {
      streamerSocketId: stream.streamerSocketId
    });

    renderActiveStreamsSidebar(activeStreamsList);
    renderHeaderStreams(activeStreamsList);
  }

  function leaveCurrentStream(showEmpty = true) {
    if (!currentWatchedStream) return;

    const previousStreamerSocketId = currentWatchedStream.streamerSocketId;
    currentWatchedStream = null;

    TriboneraWebRTC.stopWatching();

    if (streamTimerInterval) {
      clearInterval(streamTimerInterval);
      streamTimerInterval = null;
    }
    streamStartTime = null;

    if (socket) {
      socket.emit('stream:leave-viewer', {
        streamerSocketId: previousStreamerSocketId
      });
    }

    if (window.TriboneraSound) {
      TriboneraSound.play('leave');
    }

    videoHeaderBar.classList.add('hidden');
    viewersBar.classList.add('hidden');
    videoControlsOverlay.classList.add('hidden');
    statsHud.classList.add('hidden');
    remoteVideo.classList.add('hidden');
    if (glassViewersBadge) glassViewersBadge.classList.add('hidden');
    if (glassLatencyBadge) glassLatencyBadge.classList.add('hidden');

    if (showEmpty && !isCurrentlyStreaming) {
      emptyStageState.classList.remove('hidden');
      myStatusDot.className = 'status-indicator online';
      footerUserStatus.textContent = '🟢 Online';
    }

    renderActiveStreamsSidebar(activeStreamsList);
    renderHeaderStreams(activeStreamsList);
  }

  function updateViewersList(viewers = []) {
    viewersCountNum.textContent = viewers.length;
    viewersChipsContainer.innerHTML = '';

    if (glassViewersCount) {
      glassViewersCount.textContent = `${viewers.length} Espectador${viewers.length === 1 ? '' : 'es'}`;
    }
    if (glassViewersAvatars) {
      glassViewersAvatars.innerHTML = '';
      const previewViewers = viewers.slice(0, 3);
      previewViewers.forEach(v => {
        const nick = v.nickname || v;
        const mini = document.createElement('div');
        mini.className = `glass-mini-avatar ${getAvatarColorClass(nick)}`;
        mini.textContent = nick.charAt(0).toUpperCase();
        glassViewersAvatars.appendChild(mini);
      });
      if (viewers.length > 3) {
        const extra = document.createElement('div');
        extra.className = 'glass-mini-avatar avatar-theme-4';
        extra.textContent = `+${viewers.length - 3}`;
        glassViewersAvatars.appendChild(extra);
      }
    }

    if (viewers.length === 0) {
      viewersChipsContainer.innerHTML = '<span class="empty-viewers-text">Nenhum espectador no momento</span>';
      return;
    }

    viewers.forEach(v => {
      const chip = document.createElement('span');
      chip.className = 'viewer-name-chip';
      chip.textContent = v.nickname || v;
      viewersChipsContainer.appendChild(chip);
    });
  }

  // --- Video Controls ---
  function setupVideoControls() {
    // High Definition Screenshot Capture
    function handleScreenshot() {
      try {
        const activeVideo = isCurrentlyStreaming ? localPreviewVideo : remoteVideo;
        if (!activeVideo || activeVideo.classList.contains('hidden') || !activeVideo.videoWidth) {
          showToast('Nenhum vídeo ativo para capturar print.', 'error');
          return;
        }
        const filename = TriboneraWebRTC.captureVideoScreenshot(activeVideo);
        showToast(`📸 Captura salva com sucesso: ${filename}`, 'success');
        if (window.TriboneraSound) {
          TriboneraSound.play('mention');
        }
      } catch (err) {
        showToast(err.message || 'Erro ao capturar screenshot.', 'error');
      }
    }

    if (btnScreenshotVideo) {
      btnScreenshotVideo.addEventListener('click', handleScreenshot);
    }
    if (btnDockScreenshot) {
      btnDockScreenshot.addEventListener('click', handleScreenshot);
    }

    // Audio Mute Toggle for Viewers
    if (btnToggleAudio) {
      btnToggleAudio.addEventListener('click', () => {
        if (remoteVideo.muted) {
          remoteVideo.muted = false;
          iconVolumeHigh.classList.remove('hidden');
          iconVolumeMuted.classList.add('hidden');
          volumeSlider.value = remoteVideo.volume || 1;
        } else {
          remoteVideo.muted = true;
          iconVolumeHigh.classList.add('hidden');
          iconVolumeMuted.classList.remove('hidden');
          volumeSlider.value = 0;
        }
      });
    }

    // Volume Slider
    if (volumeSlider) {
      volumeSlider.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        remoteVideo.volume = val;
        if (val === 0) {
          remoteVideo.muted = true;
          iconVolumeHigh.classList.add('hidden');
          iconVolumeMuted.classList.remove('hidden');
        } else {
          remoteVideo.muted = false;
          iconVolumeHigh.classList.remove('hidden');
          iconVolumeMuted.classList.add('hidden');
        }
      });
    }

    // Picture-in-Picture
    const handlePipToggle = async () => {
      try {
        const activeVideo = isCurrentlyStreaming ? localPreviewVideo : remoteVideo;
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (activeVideo && activeVideo.srcObject) {
          await activeVideo.requestPictureInPicture();
        }
      } catch (err) {
        console.warn('PiP não suportado ou negado:', err);
      }
    };

    if (btnPip) btnPip.addEventListener('click', handlePipToggle);
    if (btnDockPip) btnDockPip.addEventListener('click', handlePipToggle);

    // Fullscreen Toggle
    const handleFullscreenToggle = () => {
      const viewport = document.getElementById('video-viewport');
      if (!document.fullscreenElement) {
        viewport.requestFullscreen().catch(e => console.warn(e));
      } else {
        document.exitFullscreen().catch(e => console.warn(e));
      }
    };

    if (btnFullscreen) btnFullscreen.addEventListener('click', handleFullscreenToggle);
    if (btnDockFullscreen) btnDockFullscreen.addEventListener('click', handleFullscreenToggle);

    // Stats HUD Toggle
    if (btnStatsToggle) {
      btnStatsToggle.addEventListener('click', () => {
        statsHud.classList.toggle('hidden');
      });
    }
    if (btnCloseStats) {
      btnCloseStats.addEventListener('click', () => {
        statsHud.classList.add('hidden');
      });
    }
  }

  // --- Mobile Navigation & Drawers ---
  function setupMobileNavigation() {
    function closeAllMobileDrawers() {
      if (sidebarChannels) sidebarChannels.classList.remove('mobile-drawer-open');
      if (sidebarUsers) sidebarUsers.classList.remove('mobile-drawer-open');
      if (mobileDrawerOverlay) mobileDrawerOverlay.classList.add('hidden');
    }

    function updateMobileNavActive(activeTab) {
      if (navBtnStage) navBtnStage.classList.toggle('active', activeTab === 'stage');
      if (navBtnChannels) navBtnChannels.classList.toggle('active', activeTab === 'channels');
      if (navBtnMembers) navBtnMembers.classList.toggle('active', activeTab === 'members');
    }

    if (btnMobileSidebarToggle) {
      btnMobileSidebarToggle.addEventListener('click', () => {
        if (sidebarUsers) sidebarUsers.classList.remove('mobile-drawer-open');
        const isOpen = sidebarChannels.classList.toggle('mobile-drawer-open');
        if (isOpen) {
          if (mobileDrawerOverlay) mobileDrawerOverlay.classList.remove('hidden');
          updateMobileNavActive('channels');
        } else {
          if (mobileDrawerOverlay) mobileDrawerOverlay.classList.add('hidden');
          updateMobileNavActive('stage');
        }
      });
    }

    if (btnMobileUsersToggle) {
      btnMobileUsersToggle.addEventListener('click', () => {
        if (sidebarChannels) sidebarChannels.classList.remove('mobile-drawer-open');
        const isOpen = sidebarUsers.classList.toggle('mobile-drawer-open');
        if (isOpen) {
          if (mobileDrawerOverlay) mobileDrawerOverlay.classList.remove('hidden');
          updateMobileNavActive('members');
        } else {
          if (mobileDrawerOverlay) mobileDrawerOverlay.classList.add('hidden');
          updateMobileNavActive('stage');
        }
      });
    }

    if (mobileDrawerOverlay) {
      mobileDrawerOverlay.addEventListener('click', () => {
        closeAllMobileDrawers();
        updateMobileNavActive('stage');
      });
    }

    if (navBtnStage) {
      navBtnStage.addEventListener('click', () => {
        closeAllMobileDrawers();
        updateMobileNavActive('stage');
      });
    }

    if (navBtnChannels) {
      navBtnChannels.addEventListener('click', () => {
        if (sidebarUsers) sidebarUsers.classList.remove('mobile-drawer-open');
        if (sidebarChannels) sidebarChannels.classList.add('mobile-drawer-open');
        if (mobileDrawerOverlay) mobileDrawerOverlay.classList.remove('hidden');
        updateMobileNavActive('channels');
      });
    }

    if (navBtnMembers) {
      navBtnMembers.addEventListener('click', () => {
        if (sidebarChannels) sidebarChannels.classList.remove('mobile-drawer-open');
        if (sidebarUsers) sidebarUsers.classList.add('mobile-drawer-open');
        if (mobileDrawerOverlay) mobileDrawerOverlay.classList.remove('hidden');
        updateMobileNavActive('members');
      });
    }
  }

  // --- Sound Effects Toggle & Preferences ---
  function setupSoundControl() {
    if (!btnToggleSound || !window.TriboneraSound) return;

    function updateSoundUI(muted) {
      const iconOn = btnToggleSound.querySelector('.icon-sound-on');
      const iconOff = btnToggleSound.querySelector('.icon-sound-off');
      if (muted) {
        btnToggleSound.classList.add('muted');
        btnToggleSound.title = 'Efeitos Sonoros: Silenciados (Clique para ativar)';
        if (iconOn) iconOn.classList.add('hidden');
        if (iconOff) iconOff.classList.remove('hidden');
      } else {
        btnToggleSound.classList.remove('muted');
        btnToggleSound.title = 'Efeitos Sonoros: Ativados (Clique para silenciar)';
        if (iconOn) iconOn.classList.remove('hidden');
        if (iconOff) iconOff.classList.add('hidden');
      }
    }

    TriboneraSound.onMuteChange(updateSoundUI);

    btnToggleSound.addEventListener('click', () => {
      const isMuted = TriboneraSound.toggleMute();
      showToast(isMuted ? 'Efeitos sonoros silenciados' : 'Efeitos sonoros ativados', 'info');
    });
  }

  // --- Version & Auto-Update Manager ---
  function setupVersionAndUpdateManager() {
    const btnVersionBadge = document.getElementById('btn-version-badge');
    const displayAppVersion = document.getElementById('display-app-version');
    const versionStatusDot = document.getElementById('version-status-dot');
    const updateModal = document.getElementById('update-modal');
    const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
    const modalAppVersion = document.getElementById('modal-app-version');
    const modalAppPlatform = document.getElementById('modal-app-platform');
    const modalUpdateStatus = document.getElementById('modal-update-status');
    const btnCheckForUpdatesAction = document.getElementById('btn-check-for-updates-action');
    const btnForceReloadAction = document.getElementById('btn-force-reload-action');
    const btnApplyUpdateAction = document.getElementById('btn-apply-update-action');

    const isElectron = !!(window.electronAPI && window.electronAPI.isElectron);

    async function loadVersionData() {
      let ver = '1.0.4';
      let platform = isElectron ? 'Desktop (Electron)' : 'Web (Navegador)';

      // Puxa a versão atualizada diretamente do endpoint /api/version (lido do package.json)
      try {
        const res = await fetch('/api/version');
        if (res.ok) {
          const data = await res.json();
          if (data && data.version) ver = data.version;
        }
      } catch (e) {}

      if (isElectron && typeof window.electronAPI.getAppInfo === 'function') {
        try {
          const info = await window.electronAPI.getAppInfo();
          if (info && info.platform) platform = `Desktop (${info.platform})`;
          if (info && info.version) ver = info.version;
        } catch (e) {}
      }

      if (displayAppVersion) displayAppVersion.textContent = `v${ver}`;
      if (modalAppVersion) modalAppVersion.textContent = `v${ver}`;
      if (modalAppPlatform) modalAppPlatform.textContent = platform;
    }

    loadVersionData();

    // Listen to updater messages from Electron
    if (isElectron && typeof window.electronAPI.onUpdaterMessage === 'function') {
      window.electronAPI.onUpdaterMessage((msg) => {
        if (!msg) return;
        if (msg.status === 'available') {
          if (versionStatusDot) versionStatusDot.className = 'version-dot has-update';
          if (btnVersionBadge) btnVersionBadge.classList.add('update-ready');
          if (modalUpdateStatus) {
            modalUpdateStatus.textContent = `Nova versão ${msg.version || ''} sendo baixada...`;
            modalUpdateStatus.style.color = '#FEE75C';
          }
          showToast(`Nova versão do Concord (${msg.version || ''}) encontrada!`, 'info');
        } else if (msg.status === 'downloaded') {
          if (versionStatusDot) versionStatusDot.className = 'version-dot has-update';
          if (btnVersionBadge) btnVersionBadge.classList.add('update-ready');
          if (modalUpdateStatus) {
            modalUpdateStatus.textContent = `Versão ${msg.version || ''} pronta para instalar`;
            modalUpdateStatus.style.color = 'var(--status-online)';
          }
          if (btnApplyUpdateAction) {
            btnApplyUpdateAction.classList.remove('hidden');
          }
          showToast('Atualização baixada. Reinicie para aplicar.', 'success');
        }
      });
    }

    if (btnVersionBadge && updateModal) {
      btnVersionBadge.addEventListener('click', () => {
        updateModal.classList.remove('hidden');
        loadVersionData();
      });
    }

    if (btnCloseUpdateModal && updateModal) {
      btnCloseUpdateModal.addEventListener('click', () => {
        updateModal.classList.add('hidden');
      });
    }

    if (updateModal) {
      updateModal.addEventListener('click', (e) => {
        if (e.target === updateModal) {
          updateModal.classList.add('hidden');
        }
      });
    }

    if (btnCheckForUpdatesAction) {
      btnCheckForUpdatesAction.addEventListener('click', async () => {
        btnCheckForUpdatesAction.disabled = true;
        btnCheckForUpdatesAction.innerHTML = '<span>Verificando...</span>';

        if (isElectron && typeof window.electronAPI.checkForUpdates === 'function') {
          try {
            const res = await window.electronAPI.checkForUpdates();
            if (res && res.success) {
              showToast('Verificação concluída. Se houver nova versão, ela será baixada em segundo plano.', 'info');
            } else {
              showToast(res.message || 'Você já está na versão mais recente.', 'success');
            }
          } catch (err) {
            showToast('Erro ao checar atualizações: ' + err.message, 'error');
          }
        } else {
          try {
            const res = await fetch('/api/version');
            const data = await res.json();
            showToast(`Versão online confirmada: v${data.version || '1.0.1'}`, 'success');
          } catch (e) {
            showToast('Conectado ao servidor.', 'info');
          }
        }

        setTimeout(() => {
          btnCheckForUpdatesAction.disabled = false;
          btnCheckForUpdatesAction.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
            </svg>
            <span>Verificar Atualizações Agora</span>
          `;
        }, 1200);
      });
    }

    if (btnForceReloadAction) {
      btnForceReloadAction.addEventListener('click', () => {
        showToast('Recarregando e sincronizando...', 'info');
        setTimeout(() => {
          if (isElectron && typeof window.electronAPI.reloadApp === 'function') {
            window.electronAPI.reloadApp();
          } else {
            window.location.reload();
          }
        }, 300);
      });
    }

    if (btnApplyUpdateAction) {
      btnApplyUpdateAction.addEventListener('click', () => {
        if (isElectron && typeof window.electronAPI.quitAndInstall === 'function') {
          window.electronAPI.quitAndInstall();
        }
      });
    }
  }

  // --- Audio Unmute Prompt Handling ---
  function setupUnmuteControls() {
    const btnUnmute = document.getElementById('btn-unmute-prompt');
    const remoteVid = document.getElementById('remote-video');

    if (btnUnmute) {
      btnUnmute.addEventListener('click', () => {
        if (window.TriboneraWebRTC && typeof window.TriboneraWebRTC.unmuteViewerAudio === 'function') {
          window.TriboneraWebRTC.unmuteViewerAudio();
        }
        showToast('Áudio ativado!', 'success');
      });
    }

    if (remoteVid) {
      remoteVid.addEventListener('click', () => {
        if (remoteVid.muted && window.TriboneraWebRTC && typeof window.TriboneraWebRTC.unmuteViewerAudio === 'function') {
          window.TriboneraWebRTC.unmuteViewerAudio();
          showToast('Áudio ativado!', 'success');
        }
      });
    }
  }

  // Logout
  async function logout() {
    if (!confirm('Deseja sair da sua conta?')) return;

    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}

    localStorage.removeItem('tribonera_token');
    localStorage.removeItem('tribonera_user');
    document.cookie = 'tribonera_token=; max-age=0; path=/';
    window.location.href = '/';
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

  // Event Listeners
  if (btnStartShare) btnStartShare.addEventListener('click', handleStartShareClick);
  if (btnEmptyStartShare) btnEmptyStartShare.addEventListener('click', handleStartShareClick);
  if (btnStopShare) btnStopShare.addEventListener('click', stopScreenShare);
  if (btnHeaderStopShare) btnHeaderStopShare.addEventListener('click', stopScreenShare);
  if (btnStreamerMuteAudio) btnStreamerMuteAudio.addEventListener('click', handleToggleStreamAudio);
  if (btnSidebarMuteAudio) btnSidebarMuteAudio.addEventListener('click', handleToggleStreamAudio);
  if (btnStopWatching) btnStopWatching.addEventListener('click', () => leaveCurrentStream(true));
  if (btnLogout) btnLogout.addEventListener('click', logout);

  if (btnClosePermissionModal) {
    btnClosePermissionModal.addEventListener('click', closePermissionModal);
  }
  if (permissionModal) {
    permissionModal.addEventListener('click', (e) => {
      if (e.target === permissionModal) closePermissionModal();
    });
  }

  setupVideoControls();
  setupSoundControl();
  setupMobileNavigation();
  setupVersionAndUpdateManager();
  setupUnmuteControls();
  init();

  return {
    watchStream,
    watchStreamByCode,
    leaveCurrentStream,
    showToast,
    showNotification,
    onScreenShareEndedByBrowser
  };
})();
