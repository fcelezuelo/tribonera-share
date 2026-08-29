/**
 * Concord — Discord-Style Full Platform Orchestrator
 * Real-time Text Chat, WebRTC Voice Mesh, Screen Sharing & Supabase Synchronization.
 */

window.TriboneraApp = (function () {
  // State
  let socket = null;
  let currentUser = null;
  let channels = [];
  let activeChannel = null; // Currently viewed text channel
  let currentVoiceChannel = null; // Currently joined voice room { id, name }
  let voiceRoomsState = {}; // channelId => Array of { socketId, code, nickname, isMuted, isDeafened, isSpeaking }
  let onlineUsersList = [];
  let activeStreamsList = [];
  let typingTimeout = null;
  let streamTimerInterval = null;
  let activeStreamStartTime = null;

  // DOM Elements
  const myAvatarText = document.getElementById('my-avatar-text');
  const myNicknameDisplay = document.getElementById('my-nickname-display');
  const myRoleTag = document.getElementById('my-role-tag');
  const myStatusDot = document.getElementById('my-status-dot');
  const btnOpenAdmin = document.getElementById('btn-open-admin');

  // Channels DOM
  const listTextChannels = document.getElementById('list-text-channels');
  const listVoiceChannels = document.getElementById('list-voice-channels');
  const activeChannelName = document.getElementById('active-channel-name');
  const activeChannelTopic = document.getElementById('active-channel-topic');
  const channelTypeIcon = document.getElementById('channel-type-icon');
  const welcomeChannelTitle = document.getElementById('welcome-channel-title');
  const welcomeChannelName = document.getElementById('welcome-channel-name');

  // Chat DOM
  const chatContainerView = document.getElementById('chat-container-view');
  const stageContainerView = document.getElementById('stage-container-view');
  const btnToggleStageView = document.getElementById('btn-toggle-stage-view');
  const messagesList = document.getElementById('messages-list');
  const chatMessagesScroller = document.getElementById('chat-messages-scroller');
  const chatInputForm = document.getElementById('chat-input-form');
  const chatMessageInput = document.getElementById('chat-message-input');
  const typingIndicatorBar = document.getElementById('typing-indicator-bar');
  const typingUsersText = document.getElementById('typing-users-text');

  // Voice Connection Bar DOM
  const voiceConnectionBar = document.getElementById('voice-connection-bar');
  const voiceCurrentChannelName = document.getElementById('voice-current-channel-name');
  const btnVoiceBarMute = document.getElementById('btn-voice-bar-mute');
  const btnVoiceBarDeafen = document.getElementById('btn-voice-bar-deafen');
  const btnVoiceBarScreen = document.getElementById('btn-voice-bar-screen');
  const btnVoiceBarDisconnect = document.getElementById('btn-voice-bar-disconnect');
  const btnMuteMic = document.getElementById('btn-mute-mic');
  const btnDeafen = document.getElementById('btn-deafen');
  const footerMicIcon = document.getElementById('footer-mic-icon');

  // Screen Share & Stage DOM
  const btnQuickShareScreen = document.getElementById('btn-quick-share-screen');
  const btnStartShare = document.getElementById('btn-start-share');
  const countActiveStreams = document.getElementById('count-active-streams');
  const sidebarStreamsList = document.getElementById('sidebar-streams-list');
  const videoHeaderBar = document.getElementById('video-header-bar');
  const currentStreamerAvatar = document.getElementById('current-streamer-avatar');
  const currentStreamerTitle = document.getElementById('current-streamer-title');
  const currentStreamerSpecs = document.getElementById('current-streamer-specs');
  const currentStreamUptime = document.getElementById('current-stream-uptime');
  const broadcasterHeaderActions = document.getElementById('broadcaster-header-actions');
  const btnHeaderStopShare = document.getElementById('btn-header-stop-share');
  const btnStopWatching = document.getElementById('btn-stop-watching');
  const remoteVideo = document.getElementById('remote-video');
  const localPreviewVideo = document.getElementById('local-preview-video');
  const emptyStageState = document.getElementById('empty-stage-state');

  // Members List DOM
  const countTotalMembers = document.getElementById('count-total-members');
  const countStreaming = document.getElementById('count-streaming');
  const listUsersStreaming = document.getElementById('list-users-streaming');
  const countInVoice = document.getElementById('count-in-voice');
  const listUsersInVoice = document.getElementById('list-users-in-voice');
  const countOnline = document.getElementById('count-online');
  const listUsersOnline = document.getElementById('list-users-online');
  const countOffline = document.getElementById('count-offline');
  const listUsersOffline = document.getElementById('list-users-offline');

  // Create Channel Modal DOM
  const createChannelModal = document.getElementById('create-channel-modal');
  const btnOpenCreateChannel = document.getElementById('btn-open-create-channel');
  const btnCloseCreateChannel = document.getElementById('btn-close-create-channel');
  const btnCancelCreateChannel = document.getElementById('btn-cancel-create-channel');
  const formCreateChannel = document.getElementById('form-create-channel');
  const inputNewChannelName = document.getElementById('input-new-channel-name');
  const inputNewChannelTopic = document.getElementById('input-new-channel-topic');
  const typeCardText = document.getElementById('type-card-text');
  const typeCardVoice = document.getElementById('type-card-voice');
  const newChannelPrefix = document.getElementById('new-channel-prefix');

  // Settings Modal DOM
  const settingsModal = document.getElementById('settings-modal');
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnSettingsLogout = document.getElementById('btn-settings-logout');

  // --- Helpers ---
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${escapeHTML(message)}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp || Date.now());
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `Hoje às ${hours}:${minutes}`;
  }

  // --- App Initialization ---
  async function init() {
    let token = getCookie('tribonera_token') || localStorage.getItem('tribonera_token');
    
    if (!token) {
      window.location.href = '/';
      return;
    }

    try {
      const res = await fetch('/api/auth/verify', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        localStorage.removeItem('tribonera_token');
        window.location.href = '/';
        return;
      }

      currentUser = data.user;
      channels = data.channels || [];
      renderCurrentUserProfile();

      // Connect Socket.IO
      connectSocket(token);

      // Setup Listeners
      setupEventListeners();

      // Default to first text channel
      const defaultTextChannel = channels.find(c => c.type === 'text') || { id: 'geral', name: 'geral', topic: 'Bate-papo principal' };
      selectTextChannel(defaultTextChannel);

    } catch (err) {
      console.error('[Init Error]:', err);
      window.location.href = '/';
    }
  }

  function renderCurrentUserProfile() {
    if (!currentUser) return;
    if (myAvatarText) myAvatarText.textContent = currentUser.nickname.charAt(0).toUpperCase();
    if (myNicknameDisplay) myNicknameDisplay.textContent = currentUser.nickname;
    if (myRoleTag) {
      myRoleTag.textContent = currentUser.role === 'admin' ? '👑 Admin' : '#0001';
    }

    if (currentUser.role === 'admin' && btnOpenAdmin) {
      btnOpenAdmin.classList.remove('hidden');
    }
  }

  // --- Socket.IO & Real-Time Sync ---
  function connectSocket(token) {
    socket = io({
      auth: { token },
      transports: ['websocket', 'polling']
    });

    TriboneraWebRTC.initVoiceSocket(socket);

    socket.on('connect', () => {
      console.log('[Socket Connected] ID:', socket.id);
      if (myStatusDot) myStatusDot.className = 'status-dot online';
    });

    socket.on('init:state', (data) => {
      if (data.channels) {
        channels = data.channels;
        renderChannelsList();
      }
      if (data.voiceRooms) {
        voiceRoomsState = data.voiceRooms;
        renderVoiceRoomsParticipants();
      }
    });

    socket.on('presence:sync', (data) => {
      onlineUsersList = data.onlineUsers || [];
      activeStreamsList = data.activeStreams || [];
      voiceRoomsState = data.voiceRooms || {};
      renderMembersList(onlineUsersList, data.offlineUsers || []);
      renderStreamsList(activeStreamsList);
      renderVoiceRoomsParticipants();
    });

    socket.on('auth:revoked', (data) => {
      alert(data.message || 'Sua sessão foi encerrada pelo administrador.');
      localStorage.removeItem('tribonera_token');
      window.location.href = '/';
    });

    // Channel Events
    socket.on('channel:created', (newChannel) => {
      channels.push(newChannel);
      renderChannelsList();
      showToast(`Novo canal criado: #${newChannel.name}`, 'info');
    });

    socket.on('channel:deleted', ({ channelId }) => {
      channels = channels.filter(c => c.id !== channelId);
      renderChannelsList();
      if (activeChannel && activeChannel.id === channelId) {
        const next = channels.find(c => c.type === 'text');
        if (next) selectTextChannel(next);
      }
    });

    // Chat Events
    socket.on('chat:new-message', (message) => {
      if (activeChannel && message.channel_id === activeChannel.id) {
        appendMessageCard(message);
        if (message.user_code !== currentUser.code && window.TriboneraSound) {
          window.TriboneraSound.play('message');
        }
      }
    });

    socket.on('chat:user-typing', ({ channelId, nickname, isTyping }) => {
      if (activeChannel && channelId === activeChannel.id) {
        if (isTyping) {
          typingIndicatorBar.classList.add('visible');
          typingUsersText.textContent = `${nickname} está digitando...`;
        } else {
          typingIndicatorBar.classList.remove('visible');
          typingUsersText.textContent = '';
        }
      }
    });

    // Voice Channel WebRTC Signaling Handlers
    socket.on('voice:joined-success', ({ channelId, channelName, peers }) => {
      TriboneraWebRTC.joinVoiceChannel(channelId, channelName, peers);
      updateVoiceBarUI(true, channelName);
    });

    socket.on('voice:left-success', () => {
      TriboneraWebRTC.leaveVoiceChannel();
      updateVoiceBarUI(false);
    });

    socket.on('voice:user-joined', (data) => {
      TriboneraWebRTC.handleVoiceUserJoined(data);
      if (window.TriboneraSound) window.TriboneraSound.play('voiceJoin');
    });

    socket.on('voice:user-left', (data) => {
      TriboneraWebRTC.handleVoiceUserLeft(data);
      if (window.TriboneraSound) window.TriboneraSound.play('voiceLeave');
    });

    socket.on('voice:peer-offer', (data) => {
      TriboneraWebRTC.handleVoicePeerOffer(data);
    });

    socket.on('voice:peer-answer', (data) => {
      TriboneraWebRTC.handleVoicePeerAnswer(data);
    });

    socket.on('voice:peer-ice-candidate', (data) => {
      TriboneraWebRTC.handleVoicePeerIceCandidate(data);
    });

    socket.on('voice:user-speaking', ({ code, isSpeaking }) => {
      updateUserSpeakingUI(code, isSpeaking);
    });

    // Screen Share Events
    socket.on('webrtc:new-viewer', (data) => {
      TriboneraWebRTC.handleNewViewer(data);
    });

    socket.on('webrtc:offer', (data) => {
      TriboneraWebRTC.handleStreamerOffer(data);
    });

    socket.on('webrtc:answer', (data) => {
      TriboneraWebRTC.handleViewerAnswer(data);
    });

    socket.on('webrtc:ice-candidate', (data) => {
      TriboneraWebRTC.handleIceCandidate(data);
    });

    socket.on('stream:ended', () => {
      showToast('A transmissão foi encerrada pelo apresentador.', 'info');
      switchToChatView();
    });
  }

  // --- Channel Rendering & Navigation ---
  function renderChannelsList() {
    if (!listTextChannels || !listVoiceChannels) return;

    listTextChannels.innerHTML = '';
    listVoiceChannels.innerHTML = '';

    channels.forEach(ch => {
      const isVoice = ch.type === 'voice';
      const item = document.createElement('div');
      item.className = `channel-item ${activeChannel?.id === ch.id ? 'active' : ''}`;
      item.dataset.id = ch.id;

      item.innerHTML = `
        <div class="channel-item-left">
          <span class="channel-icon">${isVoice ? '🔊' : '#'}</span>
          <span class="channel-title-text">${escapeHTML(ch.name)}</span>
        </div>
      `;

      if (isVoice) {
        // Container for participants under this voice channel
        const container = document.createElement('div');
        container.className = 'voice-channel-wrap';
        container.appendChild(item);

        const usersList = document.createElement('div');
        usersList.className = 'voice-users-list';
        usersList.id = `voice-users-${ch.id}`;
        container.appendChild(usersList);

        item.addEventListener('click', () => joinVoiceRoom(ch));
        listVoiceChannels.appendChild(container);
      } else {
        item.addEventListener('click', () => selectTextChannel(ch));
        listTextChannels.appendChild(item);
      }
    });

    renderVoiceRoomsParticipants();
  }

  function renderVoiceRoomsParticipants() {
    for (const [channelId, participants] of Object.entries(voiceRoomsState)) {
      const container = document.getElementById(`voice-users-${channelId}`);
      if (!container) continue;

      container.innerHTML = '';
      participants.forEach(p => {
        const row = document.createElement('div');
        row.className = 'voice-user-row';
        row.id = `voice-user-${p.code}`;

        row.innerHTML = `
          <div class="voice-user-avatar ${p.isSpeaking ? 'speaking' : ''}" id="v-avatar-${p.code}">
            ${p.nickname.charAt(0).toUpperCase()}
          </div>
          <span class="voice-user-name">${escapeHTML(p.nickname)}</span>
          <div class="voice-user-icons">
            ${p.isMuted ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path></svg>' : ''}
          </div>
        `;
        container.appendChild(row);
      });
    }
  }

  function updateUserSpeakingUI(userCode, isSpeaking) {
    const avatar = document.getElementById(`v-avatar-${userCode}`);
    if (avatar) {
      if (isSpeaking) avatar.classList.add('speaking');
      else avatar.classList.remove('speaking');
    }
  }

  function onSelfSpeaking(speaking) {
    if (currentUser) {
      updateUserSpeakingUI(currentUser.code, speaking);
      if (myAvatarText) {
        if (speaking) myAvatarText.classList.add('speaking');
        else myAvatarText.classList.remove('speaking');
      }
    }
  }

  // --- Text Channel Chat Handling ---
  async function selectTextChannel(channel) {
    if (activeChannel) {
      socket.emit('chat:leave-channel', { channelId: activeChannel.id });
    }

    activeChannel = channel;
    if (activeChannelName) activeChannelName.textContent = channel.name;
    if (activeChannelTopic) activeChannelTopic.textContent = channel.topic || 'Bate-papo da comunidade';
    if (channelTypeIcon) channelTypeIcon.textContent = '#';
    if (welcomeChannelTitle) welcomeChannelTitle.textContent = `Bem-vindo a #${channel.name}!`;
    if (welcomeChannelName) welcomeChannelName.textContent = `#${channel.name}`;
    if (chatMessageInput) chatMessageInput.placeholder = `Conversar em #${channel.name}...`;

    // Highlight in channel sidebar
    document.querySelectorAll('#list-text-channels .channel-item').forEach(el => {
      el.classList.toggle('active', el.dataset.id === channel.id);
    });

    switchToChatView();

    // Join channel in socket
    socket.emit('chat:join-channel', { channelId: channel.id });

    // Load messages history
    try {
      const res = await fetch(`/api/channels/${channel.id}/messages`);
      const data = await res.json();
      renderMessagesList(data.messages || []);
    } catch (err) {
      console.error('[Error fetching messages]:', err);
    }
  }

  function renderMessagesList(messages) {
    if (!messagesList) return;
    messagesList.innerHTML = '';
    messages.forEach(msg => appendMessageCard(msg));
    scrollChatToBottom();
  }

  function appendMessageCard(msg) {
    if (!messagesList) return;

    const card = document.createElement('div');
    card.className = 'message-card';

    const initial = (msg.user_nickname || 'U').charAt(0).toUpperCase();
    const isAdmin = msg.user_code === 'FELLMASTER123' || msg.user_role === 'admin';

    card.innerHTML = `
      <div class="message-avatar">${initial}</div>
      <div class="message-body">
        <div class="message-header-row">
          <span class="message-author">${escapeHTML(msg.user_nickname)}</span>
          ${isAdmin ? '<span class="message-role-badge">ADMIN</span>' : ''}
          <span class="message-timestamp">${formatTime(msg.created_at || msg.createdAt)}</span>
        </div>
        <div class="message-text">${escapeHTML(msg.content)}</div>
      </div>
    `;

    messagesList.appendChild(card);
    scrollChatToBottom();
  }

  function scrollChatToBottom() {
    if (chatMessagesScroller) {
      chatMessagesScroller.scrollTop = chatMessagesScroller.scrollHeight;
    }
  }

  // --- Voice Channel Actions ---
  function joinVoiceRoom(channel) {
    if (currentVoiceChannel && currentVoiceChannel.id === channel.id) {
      return; // Already in this room
    }

    currentVoiceChannel = channel;
    socket.emit('voice:join', { channelId: channel.id, channelName: channel.name });
  }

  function leaveVoiceRoom() {
    if (!currentVoiceChannel) return;
    socket.emit('voice:leave');
    currentVoiceChannel = null;
    updateVoiceBarUI(false);
  }

  function updateVoiceBarUI(isConnected, channelName = '') {
    if (isConnected) {
      voiceConnectionBar.classList.remove('hidden');
      if (voiceCurrentChannelName) voiceCurrentChannelName.textContent = channelName;
    } else {
      voiceConnectionBar.classList.add('hidden');
    }
  }

  // --- View Switcher (Chat vs Video Stage) ---
  function switchToChatView() {
    if (chatContainerView) chatContainerView.classList.remove('hidden');
    if (stageContainerView) stageContainerView.classList.add('hidden');
    if (btnToggleStageView) btnToggleStageView.classList.add('hidden');
  }

  function switchToStageView() {
    if (chatContainerView) chatContainerView.classList.add('hidden');
    if (stageContainerView) stageContainerView.classList.remove('hidden');
    if (btnToggleStageView) btnToggleStageView.classList.remove('hidden');
  }

  // --- Members List Rendering ---
  function renderMembersList(online, offline) {
    if (countTotalMembers) countTotalMembers.textContent = online.length + offline.length;

    const streamingUsers = online.filter(u => u.isStreaming);
    const inVoiceUsers = online.filter(u => u.voiceChannelId && !u.isStreaming);
    const availableUsers = online.filter(u => !u.isStreaming && !u.voiceChannelId);

    if (countStreaming) countStreaming.textContent = streamingUsers.length;
    if (listUsersStreaming) {
      listUsersStreaming.innerHTML = '';
      streamingUsers.forEach(u => listUsersStreaming.appendChild(createMemberCard(u, '🔴 Transmitindo')));
    }

    if (countInVoice) countInVoice.textContent = inVoiceUsers.length;
    if (listUsersInVoice) {
      listUsersInVoice.innerHTML = '';
      inVoiceUsers.forEach(u => listUsersInVoice.appendChild(createMemberCard(u, `🔊 ${u.voiceChannelName || 'Em Voz'}`)));
    }

    if (countOnline) countOnline.textContent = availableUsers.length;
    if (listUsersOnline) {
      listUsersOnline.innerHTML = '';
      availableUsers.forEach(u => listUsersOnline.appendChild(createMemberCard(u, u.watchingStreamerName ? `Assistindo ${u.watchingStreamerName}` : 'Online')));
    }

    if (countOffline) countOffline.textContent = offline.length;
    if (listUsersOffline) {
      listUsersOffline.innerHTML = '';
      offline.forEach(u => listUsersOffline.appendChild(createMemberCard(u, 'Offline')));
    }
  }

  function createMemberCard(user, activity) {
    const div = document.createElement('div');
    div.className = 'user-member-card';
    const initial = user.nickname.charAt(0).toUpperCase();

    div.innerHTML = `
      <div class="member-avatar">${initial}</div>
      <div class="member-info">
        <span class="member-nick">${escapeHTML(user.nickname)}</span>
        <span class="member-activity">${escapeHTML(activity)}</span>
      </div>
    `;
    return div;
  }

  function renderStreamsList(streams) {
    if (countActiveStreams) countActiveStreams.textContent = streams.length;
    if (!sidebarStreamsList) return;

    sidebarStreamsList.innerHTML = '';
    if (streams.length === 0) {
      sidebarStreamsList.innerHTML = '<div class="empty-channels-note">Nenhuma tela transmitida agora.</div>';
      return;
    }

    streams.forEach(st => {
      const row = document.createElement('div');
      row.className = 'channel-item';
      row.innerHTML = `
        <div class="channel-item-left">
          <span class="pulse-dot-red"></span>
          <span class="channel-title-text">${escapeHTML(st.title)}</span>
        </div>
        <span class="badge-live-tag" style="font-size:10px;">AO VIVO</span>
      `;
      row.addEventListener('click', () => {
        switchToStageView();
        TriboneraWebRTC.handleNewViewer({ streamerSocketId: st.streamerSocketId });
      });
      sidebarStreamsList.appendChild(row);
    });
  }

  // --- Event Listeners Setup ---
  function setupEventListeners() {
    // Chat Message Submission
    if (chatInputForm) {
      chatInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const content = chatMessageInput.value.trim();
        if (!content || !activeChannel) return;

        socket.emit('chat:send-message', {
          channelId: activeChannel.id,
          content
        });

        chatMessageInput.value = '';
        socket.emit('chat:typing', { channelId: activeChannel.id, isTyping: false });
      });

      chatMessageInput.addEventListener('input', () => {
        if (!activeChannel) return;
        socket.emit('chat:typing', { channelId: activeChannel.id, isTyping: true });
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          socket.emit('chat:typing', { channelId: activeChannel.id, isTyping: false });
        }, 1500);
      });
    }

    // Voice Bar Controls
    if (btnVoiceBarDisconnect) {
      btnVoiceBarDisconnect.addEventListener('click', leaveVoiceRoom);
    }

    if (btnVoiceBarMute) {
      btnVoiceBarMute.addEventListener('click', () => {
        const isMuted = TriboneraWebRTC.setMicMuted(!TriboneraWebRTC.isMicMuted());
        btnVoiceBarMute.classList.toggle('active', isMuted);
        btnMuteMic.classList.toggle('active', isMuted);
        showToast(isMuted ? 'Microfone mutado' : 'Microfone ativado', 'info');
      });
    }

    if (btnMuteMic) {
      btnMuteMic.addEventListener('click', () => {
        const isMuted = TriboneraWebRTC.setMicMuted(!TriboneraWebRTC.isMicMuted());
        btnMuteMic.classList.toggle('active', isMuted);
        btnVoiceBarMute.classList.toggle('active', isMuted);
      });
    }

    if (btnVoiceBarDeafen || btnDeafen) {
      const toggleDeaf = () => {
        const isDeaf = TriboneraWebRTC.setDeafened(!TriboneraWebRTC.isDeafened());
        if (btnVoiceBarDeafen) btnVoiceBarDeafen.classList.toggle('active', isDeaf);
        if (btnDeafen) btnDeafen.classList.toggle('active', isDeaf);
        showToast(isDeaf ? 'Áudio desativado (Deafened)' : 'Áudio reativado', 'info');
      };
      if (btnVoiceBarDeafen) btnVoiceBarDeafen.addEventListener('click', toggleDeaf);
      if (btnDeafen) btnDeafen.addEventListener('click', toggleDeaf);
    }

    // Screen Share Launch
    if (btnQuickShareScreen || btnStartShare || btnVoiceBarScreen) {
      const startShareHandler = async () => {
        switchToStageView();
        const ok = await TriboneraWebRTC.startScreenCapture(socket, 60, '1080p', true, false);
        if (ok) {
          showToast('Transmissão de tela iniciada com sucesso!', 'success');
        }
      };
      if (btnQuickShareScreen) btnQuickShareScreen.addEventListener('click', startShareHandler);
      if (btnStartShare) btnStartShare.addEventListener('click', startShareHandler);
      if (btnVoiceBarScreen) btnVoiceBarScreen.addEventListener('click', startShareHandler);
    }

    // Switch View Back & Forth
    if (btnToggleStageView) {
      btnToggleStageView.addEventListener('click', () => {
        if (stageContainerView.classList.contains('hidden')) {
          switchToStageView();
        } else {
          switchToChatView();
        }
      });
    }

    // Create Channel Modal Handlers
    if (btnOpenCreateChannel) {
      btnOpenCreateChannel.addEventListener('click', () => {
        createChannelModal.classList.remove('hidden');
        inputNewChannelName.focus();
      });
    }

    document.querySelectorAll('.btn-add-channel').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type || 'text';
        createChannelModal.classList.remove('hidden');
        if (type === 'voice') {
          typeCardVoice.click();
        } else {
          typeCardText.click();
        }
      });
    });

    if (btnCloseCreateChannel) btnCloseCreateChannel.addEventListener('click', () => createChannelModal.classList.add('hidden'));
    if (btnCancelCreateChannel) btnCancelCreateChannel.addEventListener('click', () => createChannelModal.classList.add('hidden'));

    if (typeCardText && typeCardVoice) {
      typeCardText.addEventListener('click', () => {
        typeCardText.classList.add('active');
        typeCardVoice.classList.remove('active');
        newChannelPrefix.textContent = '#';
        typeCardText.querySelector('input').checked = true;
      });

      typeCardVoice.addEventListener('click', () => {
        typeCardVoice.classList.add('active');
        typeCardText.classList.remove('active');
        newChannelPrefix.textContent = '🔊';
        typeCardVoice.querySelector('input').checked = true;
      });
    }

    if (formCreateChannel) {
      formCreateChannel.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = inputNewChannelName.value.trim().toLowerCase().replace(/\s+/g, '-');
        const topic = inputNewChannelTopic.value.trim();
        const type = document.querySelector('input[name="channel_type"]:checked')?.value || 'text';

        if (!name) return;

        try {
          const res = await fetch('/api/channels', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, topic, type })
          });
          const data = await res.json();

          if (res.ok) {
            createChannelModal.classList.add('hidden');
            inputNewChannelName.value = '';
            inputNewChannelTopic.value = '';
            showToast(`Canal criado com sucesso!`, 'success');
          } else {
            alert(data.error || 'Erro ao criar canal.');
          }
        } catch (err) {
          console.error('Error creating channel:', err);
        }
      });
    }

    // Settings Modal
    if (btnOpenSettings) {
      btnOpenSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    }
    if (btnCloseSettings) {
      btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    }
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    }
    if (btnSettingsLogout) {
      btnSettingsLogout.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        localStorage.removeItem('tribonera_token');
        window.location.href = '/';
      });
    }
  }

  // Self speaking trigger from WebRTC VAD
  return {
    init,
    onSelfSpeaking,
    showToast,
    getSocket: () => socket
  };
})();

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.TriboneraApp.init();
});
