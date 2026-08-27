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
  const checkboxMicStartMuted = document.getElementById('checkbox-mic-start-muted');
  const micMuteStartupRow = document.getElementById('mic-mute-startup-row');
  const btnSidebarToggleSysAudio = document.getElementById('btn-sidebar-toggle-sysaudio');
  const sidebarSysAudioIcon = document.getElementById('sidebar-sysaudio-icon');
  const sidebarSysAudioText = document.getElementById('sidebar-sysaudio-text');
  const btnSidebarToggleMic = document.getElementById('btn-sidebar-toggle-mic');
  const sidebarMicIcon = document.getElementById('sidebar-mic-icon');
  const sidebarMicText = document.getElementById('sidebar-mic-text');
  const myStreamTimer = document.getElementById('my-stream-timer');
  const myStreamSpecs = document.getElementById('my-stream-specs');
  const countActiveStreams = document.getElementById('count-active-streams');
  const sidebarStreamsList = document.getElementById('sidebar-streams-list');
  const emptyChannelsNote = document.getElementById('empty-channels-note');
  const headerStreamsBar = document.getElementById('header-streams-bar');

  // Permission / Screen Options Modal
  const permissionModal = document.getElementById('permission-modal');
  const btnClosePermissionModal = document.getElementById('btn-close-permission-modal');

  // Screen & Window Source Picker Modal
  const screenPickerModal = document.getElementById('screen-picker-modal');
  const btnCloseScreenPicker = document.getElementById('btn-close-screen-picker');
  const btnCancelScreenPicker = document.getElementById('btn-cancel-screen-picker');
  const btnConfirmStartStream = document.getElementById('btn-confirm-start-stream');
  const pickerTabScreens = document.getElementById('picker-tab-screens');
  const pickerTabWindows = document.getElementById('picker-tab-windows');
  const pickerSourcesGrid = document.getElementById('picker-sources-grid');
  const modalStreamQuality = document.getElementById('modal-stream-quality');
  const modalOptSysAudio = document.getElementById('modal-opt-sys-audio');
  const modalOptMicAudio = document.getElementById('modal-opt-mic-audio');
  const modalOptMicStartMuted = document.getElementById('modal-opt-mic-start-muted');
  const micMutedStartWrap = document.getElementById('mic-muted-start-wrap');

  // Update Center & Live Sincronization Modal Elements
  const updateModal = document.getElementById('update-modal');
  const btnCloseUpdateModal = document.getElementById('btn-close-update-modal');
  const btnCloseUpdateFooter = document.getElementById('btn-close-update-footer');
  const btnCheckUpdates = document.getElementById('btn-check-updates');
  const btnModalCheckUpdates = document.getElementById('btn-modal-check-updates');
  const btnModalForceReload = document.getElementById('btn-modal-force-reload');
  const updateModalVersion = document.getElementById('update-modal-version');
  const updateModalEnvironment = document.getElementById('update-modal-environment');
  const updateModalServerStatus = document.getElementById('update-modal-server-status');
  const updateModalServerUrl = document.getElementById('update-modal-server-url');
  const updateCheckStatusText = document.getElementById('update-check-status-text');
  const checkUpdatesSpinner = document.getElementById('check-updates-spinner');
  const checkUpdatesIcon = document.getElementById('check-updates-icon');
  const checkUpdatesBtnText = document.getElementById('check-updates-btn-text');
  const globalUpdateBanner = document.getElementById('global-update-banner');
  const updateBannerTitle = document.getElementById('update-banner-title');
  const updateBannerDesc = document.getElementById('update-banner-desc');
  const btnBannerReload = document.getElementById('btn-banner-reload');
  const btnBannerDismiss = document.getElementById('btn-banner-dismiss');
  const footerUpdateDot = document.getElementById('footer-update-dot');
  const footerVersionTag = document.getElementById('footer-version-tag');

  // Stage & Video
  const videoHeaderBar = document.getElementById('video-header-bar');
  const currentStreamerAvatar = document.getElementById('current-streamer-avatar');
  const currentStreamerTitle = document.getElementById('current-streamer-title');
  const currentStreamerSpecs = document.getElementById('current-streamer-specs');
  const currentStreamUptime = document.getElementById('current-stream-uptime');
  const liveAudioStatusPill = document.getElementById('live-audio-status-pill');
  const liveAudioStatusText = document.getElementById('live-audio-status-text');
  const equalizerAnim = document.getElementById('equalizer-anim');
  const btnStreamerSysAudioToggle = document.getElementById('btn-streamer-sysaudio-toggle');
  const iconSysAudioState = document.getElementById('icon-sysaudio-state');
  const btnStreamerMicToggle = document.getElementById('btn-streamer-mic-toggle');
  const iconMicState = document.getElementById('icon-mic-state');
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
            showUpdateBanner(`Nova Versão (${info.version}) Disponível!`, 'Baixando pacote em segundo plano...');
            showToast(`🚀 Baixando nova versão (${info.version}) em segundo plano...`, 'info');
          } else if (info.status === 'downloaded') {
            showUpdateBanner(`Versão (${info.version}) Pronta!`, 'Clique em Recarregar para aplicar a nova versão.');
            showToast(`✨ Nova versão (${info.version}) pronta para instalar!`, 'success');
          }
        });
      }

      // Check initial version status & start background checker
      checkVersionAndUpdate(false);
      setInterval(() => {
        checkVersionAndUpdate(false);
      }, 120000);
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

      // If we are watching a stream, update its viewer list & info
      if (currentWatchedStream) {
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

    // Initial state from server
    socket.on('init:state', (data) => {
      if (data && Array.isArray(data.activeStreams)) {
        activeStreamsList = data.activeStreams;
        renderActiveStreamsSidebar(data.activeStreams);
        renderHeaderStreams(data.activeStreams);
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
      console.log(`Offer WebRTC recebida de ${fromNickname} (${fromSocketId})`);
      
      const streamInfo = activeStreamsList.find(s => s.streamerSocketId === fromSocketId || s.streamerName === fromNickname);
      const streamerName = streamInfo?.streamerName || fromNickname || 'Transmissão';
      const resolution = streamInfo?.resolution || '1080p';
      const fps = streamInfo?.fps || 60;
      const startedAt = streamInfo?.startedAt || Date.now();
      const hasAudio = streamInfo ? streamInfo.hasAudio : true;

      currentWatchedStream = {
        streamerSocketId: fromSocketId,
        streamerName: streamerName,
        resolution: resolution,
        fps: fps,
        hasAudio: hasAudio,
        startedAt: startedAt,
        viewers: streamInfo?.viewers || []
      };

      myStatusDot.className = 'status-indicator watching';
      footerUserStatus.textContent = `👀 Assistindo ${streamerName}`;

      emptyStageState.classList.add('hidden');
      localPreviewVideo.classList.add('hidden');
      remoteVideo.classList.remove('hidden');
      videoHeaderBar.classList.remove('hidden');
      viewersBar.classList.remove('hidden');
      videoControlsOverlay.classList.remove('hidden');
      if (btnStreamerMuteAudio) btnStreamerMuteAudio.classList.add('hidden');
      if (btnStreamerSysAudioToggle) btnStreamerSysAudioToggle.classList.add('hidden');
      if (btnStreamerMicToggle) btnStreamerMicToggle.classList.add('hidden');
      if (glassViewersBadge) glassViewersBadge.classList.remove('hidden');
      if (glassLatencyBadge) glassLatencyBadge.classList.remove('hidden');

      currentStreamerAvatar.textContent = streamerName.charAt(0).toUpperCase();
      currentStreamerAvatar.className = `streamer-avatar ${getAvatarColorClass(streamerName)}`;
      currentStreamerTitle.textContent = `Tela de ${streamerName}`;
      currentStreamerSpecs.textContent = `${resolution} • ${fps} FPS • WebRTC Direct`;

      if (streamTimerInterval) clearInterval(streamTimerInterval);
      streamStartTime = startedAt;
      updateStreamTimer();
      streamTimerInterval = setInterval(updateStreamTimer, 1000);

      updateLiveAudioStatus(hasAudio, false);

      remoteVideo.muted = false;
      remoteVideo.volume = 1;

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
  let selectedDesktopSourceId = null;
  let cachedDesktopSources = [];
  let currentPickerType = 'screen';

  async function openScreenPickerModal() {
    if (isCurrentlyStreaming) return;

    if (screenPickerModal) {
      screenPickerModal.classList.remove('hidden');
    }

    // Sync options from sidebar or defaults
    if (modalStreamQuality && selectQuality) {
      modalStreamQuality.value = selectQuality.value || '1080p60';
    }
    if (modalOptSysAudio && checkboxSystemAudio) {
      modalOptSysAudio.checked = checkboxSystemAudio.checked;
    }
    if (modalOptMicAudio && checkboxMicAudio) {
      modalOptMicAudio.checked = checkboxMicAudio.checked;
    }
    if (modalOptMicStartMuted && checkboxMicStartMuted) {
      modalOptMicStartMuted.checked = checkboxMicStartMuted.checked;
    }
    if (micMutedStartWrap && modalOptMicAudio) {
      micMutedStartWrap.style.display = modalOptMicAudio.checked ? 'block' : 'none';
    }

    selectedDesktopSourceId = null;

    // Check if Electron desktopCapturer is available
    if (window.electronAPI && typeof window.electronAPI.getDesktopSources === 'function') {
      if (pickerSourcesGrid) {
        pickerSourcesGrid.innerHTML = `
          <div class="sources-loading-state">
            <div class="spinner"></div>
            <span>Buscando telas e janelas disponíveis no seu computador...</span>
          </div>
        `;
      }

      try {
        cachedDesktopSources = await window.electronAPI.getDesktopSources();
        renderPickerSources(currentPickerType);
      } catch (err) {
        console.error('Erro ao buscar desktop sources:', err);
        if (pickerSourcesGrid) {
          pickerSourcesGrid.innerHTML = `
            <div class="sources-empty-state">
              <span>⚠️ Não foi possível listar as janelas automaticamente. O seletor do sistema será aberto ao confirmar.</span>
            </div>
          `;
        }
      }
    } else {
      // In standard browser environment
      if (pickerSourcesGrid) {
        pickerSourcesGrid.innerHTML = `
          <div class="source-card selected" data-source-id="browser_display">
            <div class="source-card-thumb-wrap">
              <span class="source-card-thumb-placeholder">🖥️</span>
              <div class="source-selected-badge">✓</div>
            </div>
            <div class="source-card-info">
              <span class="source-card-name">Escolher Tela / Janela no Navegador</span>
            </div>
          </div>
        `;
      }
    }
  }

  function renderPickerSources(type = 'screen') {
    if (!pickerSourcesGrid) return;
    currentPickerType = type;

    // Update active tab button
    if (pickerTabScreens && pickerTabWindows) {
      if (type === 'screen') {
        pickerTabScreens.classList.add('active');
        pickerTabWindows.classList.remove('active');
      } else {
        pickerTabWindows.classList.add('active');
        pickerTabScreens.classList.remove('active');
      }
    }

    pickerSourcesGrid.innerHTML = '';

    const filtered = cachedDesktopSources.filter(s => {
      const isScreen = s.id.startsWith('screen:');
      return type === 'screen' ? isScreen : !isScreen;
    });

    if (filtered.length === 0) {
      pickerSourcesGrid.innerHTML = `
        <div class="sources-empty-state">
          <span>Nenhuma ${type === 'screen' ? 'tela' : 'janela de aplicativo'} detectada no momento.</span>
        </div>
      `;
      return;
    }

    filtered.forEach((source, index) => {
      const isSelected = selectedDesktopSourceId ? (selectedDesktopSourceId === source.id) : (index === 0);
      if (isSelected && !selectedDesktopSourceId) {
        selectedDesktopSourceId = source.id;
      }

      const card = document.createElement('div');
      card.className = `source-card ${isSelected ? 'selected' : ''}`;
      card.setAttribute('data-source-id', source.id);

      card.innerHTML = `
        <div class="source-card-thumb-wrap">
          ${source.thumbnail ? `<img class="source-card-thumb" src="${source.thumbnail}" alt="${escapeHtml(source.name)}" />` : `<span class="source-card-thumb-placeholder">${type === 'screen' ? '🖥️' : '🪟'}</span>`}
          ${isSelected ? `<div class="source-selected-badge">✓</div>` : ''}
        </div>
        <div class="source-card-info">
          ${source.appIcon ? `<img class="source-app-icon" src="${source.appIcon}" alt="" />` : ''}
          <span class="source-card-name" title="${escapeHtml(source.name)}">${escapeHtml(source.name)}</span>
        </div>
      `;

      card.addEventListener('click', () => {
        selectedDesktopSourceId = source.id;
        document.querySelectorAll('.source-card').forEach(c => {
          c.classList.remove('selected');
          const badge = c.querySelector('.source-selected-badge');
          if (badge) badge.remove();
        });
        card.classList.add('selected');
        const thumbWrap = card.querySelector('.source-card-thumb-wrap');
        if (thumbWrap && !card.querySelector('.source-selected-badge')) {
          const badge = document.createElement('div');
          badge.className = 'source-selected-badge';
          badge.textContent = '✓';
          thumbWrap.appendChild(badge);
        }
      });

      pickerSourcesGrid.appendChild(card);
    });
  }

  function closeScreenPickerModal() {
    if (screenPickerModal) {
      screenPickerModal.classList.add('hidden');
    }
  }

  async function executeStartScreenShare() {
    if (isCurrentlyStreaming) return;

    // Leave any watched stream first
    if (currentWatchedStream) {
      leaveCurrentStream();
    }

    const quality = modalStreamQuality ? modalStreamQuality.value : (selectQuality ? selectQuality.value : '1080p60');
    const audioOptions = {
      systemAudio: modalOptSysAudio ? modalOptSysAudio.checked : true,
      micAudio: modalOptMicAudio ? modalOptMicAudio.checked : false,
      micStartMuted: modalOptMicStartMuted ? modalOptMicStartMuted.checked : true
    };

    closeScreenPickerModal();

    const result = await TriboneraWebRTC.startScreenCapture(quality, audioOptions, selectedDesktopSourceId);

    if (!result.success) {
      if (result.isPermissionsPolicyError) {
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
    localPreviewVideo.srcObject = result.stream;
    localPreviewVideo.classList.remove('hidden');
    localPreviewVideo.play().catch(err => console.warn('Erro ao reproduzir preview local:', err));
    remoteVideo.classList.add('hidden');
    emptyStageState.classList.add('hidden');
    videoHeaderBar.classList.remove('hidden');
    viewersBar.classList.remove('hidden');
    videoControlsOverlay.classList.remove('hidden');
    if (glassViewersBadge) glassViewersBadge.classList.remove('hidden');
    if (glassLatencyBadge) glassLatencyBadge.classList.remove('hidden');

    // Update Stage Top Bar for Broadcaster
    currentStreamerAvatar.textContent = currentUser.nickname.charAt(0).toUpperCase();
    currentStreamerAvatar.className = `streamer-avatar ${getAvatarColorClass(currentUser.nickname)}`;
    currentStreamerTitle.textContent = `Sua Transmissão (${currentUser.nickname})`;
    currentStreamerSpecs.textContent = `${result.resolution} • ${result.fps} FPS • Direct P2P`;

    // Show separate audio buttons in stage header
    if (btnStreamerSysAudioToggle) btnStreamerSysAudioToggle.classList.remove('hidden');
    if (btnStreamerMicToggle) btnStreamerMicToggle.classList.remove('hidden');

    updateAudioControlsUI();

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

  function startScreenShare() {
    openScreenPickerModal();
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
    if (btnStreamerSysAudioToggle) btnStreamerSysAudioToggle.classList.add('hidden');
    if (btnStreamerMicToggle) btnStreamerMicToggle.classList.add('hidden');

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

  function updateAudioControlsUI() {
    const isSysMuted = TriboneraWebRTC.isSysAudioMuted();
    const isMicMuted = TriboneraWebRTC.isMicAudioMuted();
    const hasMic = TriboneraWebRTC.hasMicActive();

    // 1. Sidebar Fast Controls
    if (sidebarSysAudioIcon && sidebarSysAudioText && btnSidebarToggleSysAudio) {
      if (isSysMuted) {
        sidebarSysAudioIcon.textContent = '🔇';
        sidebarSysAudioText.textContent = 'PC (Mutado)';
        btnSidebarToggleSysAudio.classList.add('muted');
      } else {
        sidebarSysAudioIcon.textContent = '🔊';
        sidebarSysAudioText.textContent = 'Som PC';
        btnSidebarToggleSysAudio.classList.remove('muted');
      }
    }

    if (sidebarMicIcon && sidebarMicText && btnSidebarToggleMic) {
      if (!hasMic) {
        sidebarMicIcon.textContent = '🎙️';
        sidebarMicText.textContent = 'Mic (Desativado)';
        btnSidebarToggleMic.classList.add('muted');
      } else if (isMicMuted) {
        sidebarMicIcon.textContent = '🔇';
        sidebarMicText.textContent = 'Mic (Mutado)';
        btnSidebarToggleMic.classList.add('muted');
      } else {
        sidebarMicIcon.textContent = '🎙️';
        sidebarMicText.textContent = 'Mic (Voz)';
        btnSidebarToggleMic.classList.remove('muted');
      }
    }

    // 2. Stage Header Fast Buttons
    if (btnStreamerSysAudioToggle && iconSysAudioState) {
      iconSysAudioState.textContent = isSysMuted ? '🔇' : '🔊';
      if (isSysMuted) {
        btnStreamerSysAudioToggle.classList.add('muted-stage-btn');
        btnStreamerSysAudioToggle.title = 'Desmutar Som do PC';
      } else {
        btnStreamerSysAudioToggle.classList.remove('muted-stage-btn');
        btnStreamerSysAudioToggle.title = 'Mutar Som do PC';
      }
    }

    if (btnStreamerMicToggle && iconMicState) {
      iconMicState.textContent = (isMicMuted || !hasMic) ? '🔇' : '🎙️';
      if (isMicMuted || !hasMic) {
        btnStreamerMicToggle.classList.add('muted-stage-btn');
        btnStreamerMicToggle.title = hasMic ? 'Desmutar Microfone' : 'Microfone não incluído na captura';
      } else {
        btnStreamerMicToggle.classList.remove('muted-stage-btn');
        btnStreamerMicToggle.title = 'Mutar Microfone';
      }
    }

    // 3. Stage Live Audio Status Pill
    if (liveAudioStatusPill && liveAudioStatusText) {
      if (isSysMuted && (isMicMuted || !hasMic)) {
        liveAudioStatusPill.className = 'live-status-pill audio-pill audio-muted';
        liveAudioStatusText.textContent = '🔇 Áudio Geral Mutado';
        if (equalizerAnim) equalizerAnim.classList.add('paused');
      } else {
        liveAudioStatusPill.className = 'live-status-pill audio-pill audio-active';
        let parts = [];
        if (!isSysMuted) parts.push('🔊 PC');
        if (hasMic && !isMicMuted) parts.push('🎙️ Mic');
        liveAudioStatusText.textContent = parts.join(' + ') + ' Ativo';
        if (equalizerAnim) equalizerAnim.classList.remove('paused');
      }
    }
  }

  function updateLiveAudioStatus(hasAudio, isMuted) {
    if (!liveAudioStatusPill || !liveAudioStatusText) return;
    if (!hasAudio) {
      liveAudioStatusPill.className = 'live-status-pill audio-pill audio-muted';
      liveAudioStatusText.textContent = '🔇 Sem Áudio';
      if (equalizerAnim) equalizerAnim.classList.add('paused');
    } else if (isMuted) {
      liveAudioStatusPill.className = 'live-status-pill audio-pill audio-muted';
      liveAudioStatusText.textContent = '🔇 Áudio Mutado';
      if (equalizerAnim) equalizerAnim.classList.add('paused');
    } else {
      liveAudioStatusPill.className = 'live-status-pill audio-pill audio-active';
      liveAudioStatusText.textContent = '🔊 Som Ao Vivo';
      if (equalizerAnim) equalizerAnim.classList.remove('paused');
    }
  }

  // --- Watching Streams (Viewer) ---
  function watchStreamByCode(streamerCode) {
    const stream = activeStreamsList.find(s => s.streamerCode === streamerCode || s.streamerSocketId === streamerCode);
    if (stream) {
      watchStream(stream);
    } else {
      socket.emit('stream:join-viewer', { streamerSocketId: streamerCode });
    }
  }

  function watchStream(stream) {
    if (!stream) return;
    if (isCurrentlyStreaming) {
      if (!confirm('Você está transmitindo no momento. Deseja encerrar sua transmissão para assistir a de ' + (stream.streamerName || 'outro usuário') + '?')) {
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
    if (btnStreamerMuteAudio) btnStreamerMuteAudio.classList.add('hidden');
    if (btnStreamerSysAudioToggle) btnStreamerSysAudioToggle.classList.add('hidden');
    if (btnStreamerMicToggle) btnStreamerMicToggle.classList.add('hidden');
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
    // Broadcaster PC / System Audio Toggle Handler
    const handleToggleSysAudio = () => {
      if (!isCurrentlyStreaming) return;
      const isMuted = TriboneraWebRTC.toggleSystemAudioMute();
      updateAudioControlsUI();
      showToast(isMuted ? '🔇 Som do PC mutado na transmissão' : '🔊 Som do PC ativado na transmissão', 'info');
    };

    // Broadcaster Microphone Toggle Handler
    const handleToggleMic = () => {
      if (!isCurrentlyStreaming) return;
      if (!TriboneraWebRTC.hasMicActive()) {
        showToast('Microfone não foi selecionado antes de iniciar a transmissão.', 'warning');
        return;
      }
      const isMuted = TriboneraWebRTC.toggleMicrophoneMute();
      updateAudioControlsUI();
      showToast(isMuted ? '🔇 Microfone mutado' : '🎙️ Microfone ativado na transmissão', 'info');
    };

    if (btnStreamerSysAudioToggle) btnStreamerSysAudioToggle.addEventListener('click', handleToggleSysAudio);
    if (btnSidebarToggleSysAudio) btnSidebarToggleSysAudio.addEventListener('click', handleToggleSysAudio);
    if (btnStreamerMicToggle) btnStreamerMicToggle.addEventListener('click', handleToggleMic);
    if (btnSidebarToggleMic) btnSidebarToggleMic.addEventListener('click', handleToggleMic);

    // Dynamic visibility for "Iniciar microfone mutado" checkbox
    if (checkboxMicAudio && micMuteStartupRow) {
      const syncMicRow = () => {
        if (checkboxMicAudio.checked) {
          micMuteStartupRow.classList.remove('hidden');
        } else {
          micMuteStartupRow.classList.add('hidden');
        }
      };
      checkboxMicAudio.addEventListener('change', syncMicRow);
      syncMicRow();
    }

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

  // Logout
  // --- Update Center & Dynamic Live Sync ---
  let currentAppVersion = '1.0.3';
  let isCheckingUpdate = false;

  function openUpdateModal() {
    if (!updateModal) return;
    updateModal.classList.remove('hidden');

    // Update environment info
    if (updateModalEnvironment) {
      if (window.electronAPI && window.electronAPI.isElectron) {
        updateModalEnvironment.textContent = '🖥️ Aplicativo Desktop (Electron)';
      } else {
        updateModalEnvironment.textContent = '🌐 Navegador Web / PWA';
      }
    }

    if (updateModalServerUrl) {
      updateModalServerUrl.textContent = window.location.origin;
    }

    checkVersionAndUpdate(false);
  }

  function closeUpdateModal() {
    if (updateModal) {
      updateModal.classList.add('hidden');
    }
  }

  function showUpdateBanner(title, desc) {
    if (!globalUpdateBanner) return;
    if (title && updateBannerTitle) updateBannerTitle.textContent = title;
    if (desc && updateBannerDesc) updateBannerDesc.textContent = desc;
    globalUpdateBanner.classList.remove('hidden');

    if (footerUpdateDot) {
      footerUpdateDot.classList.add('has-update');
      footerUpdateDot.title = 'Nova atualização disponível!';
    }
  }

  function dismissUpdateBanner() {
    if (globalUpdateBanner) {
      globalUpdateBanner.classList.add('hidden');
    }
  }

  async function checkVersionAndUpdate(isManual = false) {
    if (isManual && isCheckingUpdate) return;
    if (isManual) {
      isCheckingUpdate = true;
      if (checkUpdatesSpinner) checkUpdatesSpinner.classList.remove('hidden');
      if (checkUpdatesIcon) checkUpdatesIcon.classList.add('hidden');
      if (checkUpdatesBtnText) checkUpdatesBtnText.textContent = 'Verificando...';
      if (updateCheckStatusText) updateCheckStatusText.textContent = 'Consultando servidor na nuvem e repositório...';
    }

    try {
      const res = await fetch('/api/version?t=' + Date.now(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Servidor não respondeu ao status de versão');
      const data = await res.json();

      currentAppVersion = data.version || '1.0.3';
      if (footerVersionTag) footerVersionTag.textContent = `v${currentAppVersion}`;
      if (updateModalVersion) updateModalVersion.textContent = `v${currentAppVersion}`;
      if (updateModalServerStatus) {
        updateModalServerStatus.textContent = '🟢 Online & Sincronizado';
        updateModalServerStatus.className = 'update-stat-val text-green';
      }

      // Check stored build timestamp to see if fresh changes occurred
      const lastKnownBuild = localStorage.getItem('concord_known_build_time');
      if (data.buildTime && lastKnownBuild && Number(lastKnownBuild) < Number(data.buildTime)) {
        showUpdateBanner('Nova Atualização do Concord!', 'Novas correções e recursos foram aplicados no servidor.');
      }
      if (data.buildTime) {
        localStorage.setItem('concord_known_build_time', String(data.buildTime));
      }

      // Check Electron native updater if available
      if (window.electronAPI && typeof window.electronAPI.checkForUpdates === 'function') {
        window.electronAPI.checkForUpdates().then(result => {
          console.log('[AutoUpdater] Resposta:', result);
        }).catch(() => {});
      }

      if (isManual) {
        setTimeout(() => {
          isCheckingUpdate = false;
          if (checkUpdatesSpinner) checkUpdatesSpinner.classList.add('hidden');
          if (checkUpdatesIcon) checkUpdatesIcon.classList.remove('hidden');
          if (checkUpdatesBtnText) checkUpdatesBtnText.textContent = 'Verificar Novamente';
          if (updateCheckStatusText) {
            updateCheckStatusText.innerHTML = `✅ <strong>Você já está na versão mais recente (${currentAppVersion})!</strong> Todos os componentes, áudio e vídeo estão 100% sincronizados.`;
          }
          showToast(`✅ Aplicativo atualizado (v${currentAppVersion})!`, 'success');
        }, 600);
      }
    } catch (err) {
      console.warn('Aviso ao consultar versão:', err);
      if (isManual) {
        isCheckingUpdate = false;
        if (checkUpdatesSpinner) checkUpdatesSpinner.classList.add('hidden');
        if (checkUpdatesIcon) checkUpdatesIcon.classList.remove('hidden');
        if (checkUpdatesBtnText) checkUpdatesBtnText.textContent = 'Tentar Novamente';
        if (updateCheckStatusText) {
          updateCheckStatusText.textContent = '⚠️ Não foi possível verificar agora. Verifique a conexão do servidor.';
        }
        showToast('Não foi possível verificar no momento.', 'info');
      }
    }
  }

  function forceReloadApp() {
    showToast('⚡ Recarregando e sincronizando...', 'info');
    setTimeout(() => {
      if (window.electronAPI && typeof window.electronAPI.reloadApp === 'function') {
        window.electronAPI.reloadApp();
      } else {
        window.location.reload();
      }
    }, 350);
  }

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
  if (btnStartShare) btnStartShare.addEventListener('click', startScreenShare);
  if (btnEmptyStartShare) btnEmptyStartShare.addEventListener('click', startScreenShare);
  if (btnStopShare) btnStopShare.addEventListener('click', stopScreenShare);
  if (btnStopWatching) btnStopWatching.addEventListener('click', () => leaveCurrentStream(true));
  if (btnLogout) btnLogout.addEventListener('click', logout);

  // Screen & Window Picker Modal Listeners
  if (btnCloseScreenPicker) btnCloseScreenPicker.addEventListener('click', closeScreenPickerModal);
  if (btnCancelScreenPicker) btnCancelScreenPicker.addEventListener('click', closeScreenPickerModal);
  if (btnConfirmStartStream) btnConfirmStartStream.addEventListener('click', executeStartScreenShare);
  if (pickerTabScreens) pickerTabScreens.addEventListener('click', () => renderPickerSources('screen'));
  if (pickerTabWindows) pickerTabWindows.addEventListener('click', () => renderPickerSources('window'));
  if (modalOptMicAudio && micMutedStartWrap) {
    modalOptMicAudio.addEventListener('change', () => {
      micMutedStartWrap.style.display = modalOptMicAudio.checked ? 'block' : 'none';
    });
  }
  if (screenPickerModal) {
    screenPickerModal.addEventListener('click', (e) => {
      if (e.target === screenPickerModal) closeScreenPickerModal();
    });
  }

  // Update Center Modal Listeners
  if (btnCheckUpdates) btnCheckUpdates.addEventListener('click', openUpdateModal);
  if (btnCloseUpdateModal) btnCloseUpdateModal.addEventListener('click', closeUpdateModal);
  if (btnCloseUpdateFooter) btnCloseUpdateFooter.addEventListener('click', closeUpdateModal);
  if (btnModalCheckUpdates) btnModalCheckUpdates.addEventListener('click', () => checkVersionAndUpdate(true));
  if (btnModalForceReload) btnModalForceReload.addEventListener('click', forceReloadApp);
  if (btnBannerReload) btnBannerReload.addEventListener('click', forceReloadApp);
  if (btnBannerDismiss) btnBannerDismiss.addEventListener('click', dismissUpdateBanner);
  if (updateModal) {
    updateModal.addEventListener('click', (e) => {
      if (e.target === updateModal) closeUpdateModal();
    });
  }

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
