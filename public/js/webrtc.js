/**
 * TriboneraShare — WebRTC PeerConnection & Screen Streaming Engine
 * Implements high performance browser-native screen capture and P2P WebRTC mesh/star distribution.
 */

window.TriboneraWebRTC = (function () {
  // RTC Configuration with Google Public STUN Servers
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  // Streamer State
  let localStream = null;
  // Map of viewerSocketId => RTCPeerConnection
  const streamerPeerConnections = new Map();

  // Viewer State (when watching someone)
  let viewerPeerConnection = null;
  let currentWatchedStreamerSocketId = null;

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
      ctx.fillText('TriboneraShare — Transmissão Virtual de Demonstração (60 FPS)', winX + 85, winY + 30);

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
   * 1. Start Screen Sharing (getDisplayMedia or fallback test stream)
   */
  async function startScreenCapture(qualityOption = '1080p60', forceVirtual = false) {
    let width = 1920;
    let height = 1080;
    let frameRate = 60;

    switch (qualityOption) {
      case '1080p60':
        width = 1920; height = 1080; frameRate = 60;
        break;
      case '1080p30':
        width = 1920; height = 1080; frameRate = 30;
        break;
      case '720p60':
        width = 1280; height = 720; frameRate = 60;
        break;
      case '720p30':
        width = 1280; height = 720; frameRate = 30;
        break;
    }

    if (forceVirtual) {
      const streamerName = window.TriboneraApp?.getCurrentUser()?.nickname || 'Você';
      localStream = createVirtualScreenStream(width, height, frameRate, streamerName);
      return {
        success: true,
        stream: localStream,
        hasAudio: true,
        resolution: `${height}p`,
        fps: frameRate,
        isVirtual: true
      };
    }

    const displayMediaOptions = {
      video: {
        cursor: 'always',
        displaySurface: 'monitor',
        width: { ideal: width, max: 2560 },
        height: { ideal: height, max: 1440 },
        frameRate: { ideal: frameRate, max: 60 }
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    };

    try {
      // Check if navigator.mediaDevices and getDisplayMedia exist
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
        throw new Error('Captura de tela não suportada neste ambiente');
      }

      localStream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions);

      // Handle user stopping screen share via browser's built-in "Stop sharing" bar
      localStream.getVideoTracks().forEach(track => {
        track.onended = () => {
          if (window.TriboneraApp && typeof window.TriboneraApp.onScreenShareEndedByBrowser === 'function') {
            window.TriboneraApp.onScreenShareEndedByBrowser();
          }
        };
      });

      return {
        success: true,
        stream: localStream,
        hasAudio: localStream.getAudioTracks().length > 0,
        resolution: `${height}p`,
        fps: frameRate,
        isVirtual: false
      };
    } catch (err) {
      console.warn('Tentativa de captura nativa:', err);
      const isPolicyDisallowed = (
        (err.name === 'NotAllowedError' && err.message?.includes('permissions policy')) ||
        err.message?.includes('display-capture') ||
        err.message?.includes('disallowed')
      );

      return {
        success: false,
        isPermissionsPolicyError: isPolicyDisallowed,
        error: isPolicyDisallowed
          ? 'A captura de tela nativa do sistema requer abertura em Nova Aba devido às diretivas de segurança de quadros (iframe) do navegador.'
          : (err.name === 'NotAllowedError' ? 'Permissão de captura de tela cancelada.' : err.message)
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

    const pc = new RTCPeerConnection(rtcConfig);
    streamerPeerConnections.set(viewerSocketId, pc);

    // Add local stream tracks to this viewer's connection
    localStream.getTracks().forEach(track => {
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
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        pc.close();
        streamerPeerConnections.delete(viewerSocketId);
      }
    };

    // Create SDP Offer
    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false
      });
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
    viewerPeerConnection = new RTCPeerConnection(rtcConfig);

    // When remote track arrives, attach to video element
    viewerPeerConnection.ontrack = (event) => {
      if (remoteVideoElement) {
        if (event.streams && event.streams[0]) {
          remoteVideoElement.srcObject = event.streams[0];
        } else {
          const inboundStream = new MediaStream();
          inboundStream.addTrack(event.track);
          remoteVideoElement.srcObject = inboundStream;
        }

        remoteVideoElement.play().catch(e => console.warn('Erro autoplay vídeo:', e));
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
   * 5. Apply Inbound ICE Candidate
   */
  async function handleIceCandidate(fromSocketId, candidate) {
    let targetPc = null;
    
    // Check if we are streamer receiving candidate from viewer
    if (streamerPeerConnections.has(fromSocketId)) {
      targetPc = streamerPeerConnections.get(fromSocketId);
    } 
    // Or if we are viewer receiving candidate from streamer
    else if (viewerPeerConnection && currentWatchedStreamerSocketId === fromSocketId) {
      targetPc = viewerPeerConnection;
    }

    if (targetPc && candidate) {
      try {
        await targetPc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn('Erro ao adicionar ICE candidate:', err);
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
