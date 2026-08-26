/**
 * TriboneraShare — WebRTC PeerConnection & Screen Streaming Engine
 * Implements high performance browser-native screen capture and P2P WebRTC mesh/star distribution.
 */

window.TriboneraWebRTC = (function () {
  // RTC Configuration with Multiple Global STUN and Public Free TURN Servers for NAT Traversal
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
      {
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp'
        ],
        username: 'openrelay',
        credential: 'openrelay'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // Streamer State
  let localStream = null;
  // Map of viewerSocketId => RTCPeerConnection
  const streamerPeerConnections = new Map();
  // Map of viewerSocketId => RTCIceCandidate[] (queue for candidates received before remoteDescription)
  const streamerIceCandidateQueues = new Map();

  // Viewer State (when watching someone)
  let viewerPeerConnection = null;
  let currentWatchedStreamerSocketId = null;
  const viewerIceCandidateQueue = [];

  // Stats calculation interval
  let statsInterval = null;

  // Canvas animation frame loop for virtual demo stream
  let demoAnimationId = null;
  let demoAudioCtx = null;

  /**
   * Generates a high-definition 60 FPS simulated screen feed with animated graphics & audio
   * Allows full WebRTC testing even inside restricted preview iframes.
   */
  function createVirtualScreenStream(width = 1920, height = 1080, fps = 60, streamerNick = 'Você') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    let frame = 0;
    const particles = Array.from({ length: 30 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 4,
      vy: (Math.random() - 0.5) * 4,
      radius: Math.random() * 5 + 2,
      color: ['#5865F2', '#38BDF8', '#EC4899', '#22C55E'][Math.floor(Math.random() * 4)]
    }));

    function draw() {
      frame++;
      // Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, width, height);
      bgGrad.addColorStop(0, '#111216');
      bgGrad.addColorStop(0.5, '#1e1f22');
      bgGrad.addColorStop(1, '#0f1013');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 60;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Moving glowing particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Simulated Sleek Interface Mockup Window
      const winW = width * 0.75;
      const winH = height * 0.7;
      const winX = (width - winW) / 2;
      const winY = (height - winH) / 2;

      ctx.fillStyle = 'rgba(43, 45, 49, 0.9)';
      ctx.strokeStyle = 'rgba(88, 101, 242, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, winH, 16);
      ctx.fill();
      ctx.stroke();

      // Window Header
      ctx.fillStyle = 'rgba(35, 36, 40, 0.95)';
      ctx.beginPath();
      ctx.roundRect(winX, winY, winW, 48, [16, 16, 0, 0]);
      ctx.fill();

      // Window dots
      ctx.fillStyle = '#EF4444';
      ctx.beginPath(); ctx.arc(winX + 24, winY + 24, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F59E0B';
      ctx.beginPath(); ctx.arc(winX + 44, winY + 24, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#22C55E';
      ctx.beginPath(); ctx.arc(winX + 64, winY + 24, 6, 0, Math.PI * 2); ctx.fill();

      // Window Title
      ctx.fillStyle = '#F2F3F5';
      ctx.font = 'bold 16px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('Concord — Transmissão Virtual de Demonstração (60 FPS)', winX + 85, winY + 30);

      // Central Content: Animated Live Soundwaves & Game HUD
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0] + '.' + String(Math.floor(now.getMilliseconds() / 10)).padStart(2, '0');

      // Live Badge
      ctx.fillStyle = '#EF4444';
      ctx.beginPath();
      ctx.roundRect(winX + 40, winY + 80, 80, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 12px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('🔴 AO VIVO', winX + 50, winY + 98);

      // Streamer Nick & Clock
      ctx.fillStyle = '#DBDEE1';
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Streamer: ${streamerNick} • Horário: ${timeStr}`, winX + 135, winY + 98);

      // Audio / Video animated bars
      const numBars = 36;
      const barSpacing = (winW - 80) / numBars;
      for (let i = 0; i < numBars; i++) {
        const barHeight = Math.abs(Math.sin((frame * 0.05) + (i * 0.25))) * (winH * 0.35) + 15;
        const barX = winX + 40 + (i * barSpacing);
        const barY = winY + winH - 60 - barHeight;

        const grad = ctx.createLinearGradient(0, barY, 0, barY + barHeight);
        grad.addColorStop(0, '#5865F2');
        grad.addColorStop(1, '#38BDF8');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(barX, barY, barSpacing - 4, barHeight, 4);
        ctx.fill();
      }

      // Specs Banner
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath();
      ctx.roundRect(winX + 40, winY + 125, winW - 80, 50, 8);
      ctx.fill();

      ctx.fillStyle = '#22C55E';
      ctx.font = 'bold 13px "JetBrains Mono", monospace';
      ctx.fillText(`✔ WebRTC P2P Direct Stream • Resolução: ${width}x${height} • Taxa: ${fps} FPS`, winX + 56, winY + 155);

      demoAnimationId = requestAnimationFrame(draw);
    }

    draw();

    const stream = canvas.captureStream(fps);

    // Generate simulated silent/subtle WebAudio tone track
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        demoAudioCtx = new AudioCtx();
        const osc = demoAudioCtx.createOscillator();
        const gain = demoAudioCtx.createGain();
        gain.gain.value = 0.001; // subtle audible test signal
        osc.connect(gain);
        const dst = demoAudioCtx.createMediaStreamDestination();
        gain.connect(dst);
        osc.start();
        dst.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      }
    } catch (e) {
      console.warn('Simulated audio init note:', e);
    }

    return stream;
  }

  /**
   * 1. Start Screen Sharing (getDisplayMedia)
   */
  async function startScreenCapture(qualityOption = '1080p30', includeAudio = true) {
    let width = 1920;
    let height = 1080;
    let frameRate = 30;

    switch (qualityOption) {
      case '1440p30':
        width = 2560; height = 1440; frameRate = 30;
        break;
      case '1080p30':
        width = 1920; height = 1080; frameRate = 30;
        break;
      case '720p30':
        width = 1280; height = 720; frameRate = 30;
        break;
      default:
        width = 1920; height = 1080; frameRate = 30;
        break;
    }

    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        throw new Error('Captura de tela não suportada neste ambiente ou navegador.');
      }

      let capturedStream = null;

      if (includeAudio) {
        // Standard W3C DisplayMedia options with audio requested
        const displayMediaOptions = {
          video: {
            cursor: 'always',
            width: { ideal: width, max: 2560 },
            height: { ideal: height, max: 1440 },
            frameRate: { ideal: frameRate, max: 30 }
          },
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
            suppressLocalAudioPlayback: false
          },
          systemAudio: 'include',
          selfBrowserSurface: 'exclude',
          surfaceSwitching: 'include'
        };

        try {
          capturedStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);
        } catch (optErr) {
          console.warn('Tentativa com opções estendidas de áudio falhou, tentando audio: true básico:', optErr);
          if (optErr.name !== 'NotAllowedError') {
            capturedStream = await navigator.mediaDevices.getDisplayMedia({
              video: {
                cursor: 'always',
                width: { ideal: width },
                height: { ideal: height },
                frameRate: { ideal: frameRate }
              },
              audio: true
            });
          } else {
            throw optErr;
          }
        }
      } else {
        // Pure video capture without audio device constraints (works with any Window / Monitor)
        capturedStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            width: { ideal: width },
            height: { ideal: height },
            frameRate: { ideal: frameRate }
          },
          audio: false
        });
      }

      if (!capturedStream) {
        throw new Error('Não foi possível obter o stream de tela.');
      }

      localStream = capturedStream;

      // Ensure all tracks are enabled
      localStream.getTracks().forEach(track => {
        track.enabled = true;
        console.log(`[WebRTC] Trilha capturada: kind=${track.kind}, label=${track.label}, enabled=${track.enabled}`);
      });

      // Handle user stopping screen share via browser's built-in "Stop sharing" bar
      localStream.getVideoTracks().forEach(track => {
        track.onended = () => {
          if (window.TriboneraApp && typeof window.TriboneraApp.onScreenShareEndedByBrowser === 'function') {
            window.TriboneraApp.onScreenShareEndedByBrowser();
          }
        };
      });

      const audioTracksCount = localStream.getAudioTracks().length;

      return {
        success: true,
        stream: localStream,
        hasAudio: audioTracksCount > 0,
        resolution: `${height}p`,
        fps: frameRate
      };
    } catch (err) {
      console.warn('Tentativa de captura de tela:', err);
      const isPolicyDisallowed = (
        (err.name === 'NotAllowedError' && err.message?.includes('permissions policy')) ||
        err.message?.includes('display-capture') ||
        err.message?.includes('disallowed')
      );

      let errorMsg = err.message || 'Erro ao iniciar transmissão';
      if (err.name === 'NotAllowedError' && !isPolicyDisallowed) {
        errorMsg = 'Permissão de captura cancelada pelo usuário.';
      } else if (err.message && (err.message.includes('Could not start audio source') || err.name === 'AbortError' || err.name === 'NotReadableError')) {
        errorMsg = 'Esta janela individual não suporta captura de áudio no Chrome. Selecione uma "Aba do Chrome" / "Tela Inteira" para som, ou desmarque "Incluir Áudio do Sistema" para transmitir esta janela.';
      }

      return {
        success: false,
        isPermissionsPolicyError: isPolicyDisallowed,
        error: isPolicyDisallowed
          ? 'A captura de tela nativa do sistema requer abertura em Nova Aba devido às diretivas de segurança de quadros (iframe) do navegador.'
          : errorMsg
      };
    }
  }

  /**
   * 2. Streamer creates WebRTC PeerConnection for a new viewer
   */
  async function handleNewViewer(viewerSocketId, socket) {
    if (!localStream) {
      console.warn('Tentativa de conectar espectador sem stream local ativa.');
      return;
    }

    // Close any previous peer connection for this viewer
    if (streamerPeerConnections.has(viewerSocketId)) {
      try {
        streamerPeerConnections.get(viewerSocketId).close();
      } catch (e) {}
      streamerPeerConnections.delete(viewerSocketId);
    }
    streamerIceCandidateQueues.set(viewerSocketId, []);

    const pc = new RTCPeerConnection(rtcConfig);
    streamerPeerConnections.set(viewerSocketId, pc);

    // Add all local tracks (video and audio) to RTCPeerConnection
    localStream.getTracks().forEach(track => {
      console.log(`[WebRTC] Streamer adicionando trilha ${track.kind} (${track.label}) ao PeerConnection para espectador ${viewerSocketId}`);
      pc.addTrack(track, localStream);
    });

    // Handle ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', {
          targetSocketId: viewerSocketId,
          candidate: event.candidate
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log(`Streamer->Viewer [${viewerSocketId}] Connection State:`, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        try { pc.close(); } catch (e) {}
        streamerPeerConnections.delete(viewerSocketId);
        streamerIceCandidateQueues.delete(viewerSocketId);
      }
    };

    // Create standard SDP Offer with audio and video
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('webrtc:offer', {
        targetSocketId: viewerSocketId,
        offer: pc.localDescription
      });
    } catch (err) {
      console.error('Erro ao criar Offer para o espectador:', err);
    }
  }

  /**
   * 3. Streamer receives Answer from Viewer
   */
  async function handleViewerAnswer(viewerSocketId, answer) {
    const pc = streamerPeerConnections.get(viewerSocketId);
    if (pc && pc.signalingState !== 'closed') {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Drain any buffered ICE candidates received before remoteDescription was set
        const queue = streamerIceCandidateQueues.get(viewerSocketId) || [];
        while (queue.length > 0) {
          const cand = queue.shift();
          try {
            await pc.addIceCandidate(cand);
          } catch (e) {
            console.warn('Erro ao aplicar candidato na fila do streamer:', e);
          }
        }
      } catch (err) {
        console.error('Erro ao aplicar Answer do espectador:', err);
      }
    }
  }

  /**
   * 4. Viewer receives Offer from Streamer and creates Answer
   */
  async function handleStreamerOffer(streamerSocketId, offer, socket, remoteVideoElement) {
    // If watching another stream, close it
    stopWatching();

    currentWatchedStreamerSocketId = streamerSocketId;
    viewerIceCandidateQueue.length = 0;
    viewerPeerConnection = new RTCPeerConnection(rtcConfig);

    // When remote track arrives, attach to video element and trigger play
    viewerPeerConnection.ontrack = (event) => {
      console.log(`[WebRTC] Viewer recebeu trilha: kind=${event.track.kind}, id=${event.track.id}, streams=${event.streams?.length}`);

      if (event.track.kind === 'audio') {
        event.track.enabled = true;
      }

      if (remoteVideoElement) {
        if (event.streams && event.streams[0]) {
          if (remoteVideoElement.srcObject !== event.streams[0]) {
            remoteVideoElement.srcObject = event.streams[0];
          }
        } else {
          if (!remoteVideoElement.srcObject) {
            remoteVideoElement.srcObject = new MediaStream();
          }
          remoteVideoElement.srcObject.addTrack(event.track);
        }

        // Handle playback and browser autoplay restrictions
        const playPromise = remoteVideoElement.play();
        if (playPromise !== undefined) {
          playPromise.catch(err => {
            console.warn('Autoplay com som bloqueado pelo navegador, silenciando para iniciar reprodução:', err);
            remoteVideoElement.muted = true;
            remoteVideoElement.play().catch(e => console.error('Falha ao reproduzir vídeo:', e));
          });
        }
      }
    };

    // Relay ICE Candidate
    viewerPeerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc:ice-candidate', {
          targetSocketId: streamerSocketId,
          candidate: event.candidate
        });
      }
    };

    viewerPeerConnection.onconnectionstatechange = () => {
      console.log('Viewer WebRTC State:', viewerPeerConnection?.connectionState);
      if (viewerPeerConnection?.connectionState === 'connected') {
        startStatsMonitoring(viewerPeerConnection);
      } else if (viewerPeerConnection?.connectionState === 'disconnected' || viewerPeerConnection?.connectionState === 'failed') {
        stopStatsMonitoring();
      }
    };

    try {
      await viewerPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Drain any buffered ICE candidates received before remote description
      while (viewerIceCandidateQueue.length > 0) {
        const cand = viewerIceCandidateQueue.shift();
        try {
          await viewerPeerConnection.addIceCandidate(cand);
        } catch (e) {
          console.warn('Erro ao aplicar candidato na fila do viewer:', e);
        }
      }

      const answer = await viewerPeerConnection.createAnswer();
      await viewerPeerConnection.setLocalDescription(answer);

      socket.emit('webrtc:answer', {
        targetSocketId: streamerSocketId,
        answer: viewerPeerConnection.localDescription
      });
    } catch (err) {
      console.error('Erro ao processar Offer do streamer:', err);
    }
  }

  /**
   * 5. Apply Inbound ICE Candidate with Queuing
   */
  async function handleIceCandidate(fromSocketId, candidate) {
    if (!candidate) return;
    const rtcCand = new RTCIceCandidate(candidate);

    // Check if we are streamer receiving candidate from viewer
    if (streamerPeerConnections.has(fromSocketId)) {
      const pc = streamerPeerConnections.get(fromSocketId);
      if (pc.remoteDescription && pc.remoteDescription.type) {
        try {
          await pc.addIceCandidate(rtcCand);
        } catch (err) {
          console.warn('Erro ao adicionar ICE candidate no streamer:', err);
        }
      } else {
        // Queue until setRemoteDescription completes
        if (!streamerIceCandidateQueues.has(fromSocketId)) {
          streamerIceCandidateQueues.set(fromSocketId, []);
        }
        streamerIceCandidateQueues.get(fromSocketId).push(rtcCand);
      }
    } 
    // Or if we are viewer receiving candidate from streamer
    else if (viewerPeerConnection && currentWatchedStreamerSocketId === fromSocketId) {
      if (viewerPeerConnection.remoteDescription && viewerPeerConnection.remoteDescription.type) {
        try {
          await viewerPeerConnection.addIceCandidate(rtcCand);
        } catch (err) {
          console.warn('Erro ao adicionar ICE candidate no viewer:', err);
        }
      } else {
        viewerIceCandidateQueue.push(rtcCand);
      }
    }
  }

  /**
   * 6. Viewer disconnected cleanup for streamer
   */
  function handleViewerDisconnected(viewerSocketId) {
    if (streamerPeerConnections.has(viewerSocketId)) {
      try {
        streamerPeerConnections.get(viewerSocketId).close();
      } catch (e) {}
      streamerPeerConnections.delete(viewerSocketId);
      streamerIceCandidateQueues.delete(viewerSocketId);
    }
  }

  /**
   * 7. Stop Streaming (cleanup all peer connections and local media)
   */
  function stopStreaming() {
    if (demoAnimationId) {
      cancelAnimationFrame(demoAnimationId);
      demoAnimationId = null;
    }

    if (demoAudioCtx) {
      try {
        demoAudioCtx.close();
      } catch (e) {}
      demoAudioCtx = null;
    }

    for (const [, pc] of streamerPeerConnections.entries()) {
      try {
        pc.close();
      } catch (e) {}
    }
    streamerPeerConnections.clear();

    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop();
      });
      localStream = null;
    }
  }

  /**
   * 8. Stop Watching (cleanup viewer peer connection)
   */
  function stopWatching() {
    stopStatsMonitoring();

    if (viewerPeerConnection) {
      try {
        viewerPeerConnection.close();
      } catch (e) {}
      viewerPeerConnection = null;
    }
    currentWatchedStreamerSocketId = null;

    const remoteVideo = document.getElementById('remote-video');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
    }
  }

  /**
   * 9. WebRTC Stats Real-Time Monitoring
   */
  function startStatsMonitoring(pc) {
    stopStatsMonitoring();
    const statRes = document.getElementById('stat-resolution');
    const statFps = document.getElementById('stat-fps');
    const statRtt = document.getElementById('stat-rtt');

    statsInterval = setInterval(async () => {
      if (!pc || pc.connectionState !== 'connected') return;

      try {
        const stats = await pc.getStats();
        stats.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.frameWidth && report.frameHeight && statRes) {
              statRes.textContent = `${report.frameWidth}x${report.frameHeight}`;
            }
            if (report.framesPerSecond && statFps) {
              statFps.textContent = `${Math.round(report.framesPerSecond)} FPS`;
            }
          }
          if (report.type === 'candidate-pair' && report.currentRoundTripTime && statRtt) {
            statRtt.textContent = `${Math.round(report.currentRoundTripTime * 1000)} ms`;
          }
        });
      } catch (e) {}
    }, 1500);
  }

  function stopStatsMonitoring() {
    if (statsInterval) {
      clearInterval(statsInterval);
      statsInterval = null;
    }
  }

  return {
    startScreenCapture,
    handleNewViewer,
    handleViewerAnswer,
    handleStreamerOffer,
    handleIceCandidate,
    handleViewerDisconnected,
    stopStreaming,
    stopWatching,
    getLocalStream: () => localStream,
    getCurrentWatchedStreamerSocketId: () => currentWatchedStreamerSocketId
  };
})();
