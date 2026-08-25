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

  /**
   * 1. Start Screen Sharing (getDisplayMedia)
   */
  async function startScreenCapture(qualityOption = '1080p60') {
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
        fps: frameRate
      };
    } catch (err) {
      console.error('Falha ao capturar tela:', err);
      return {
        success: false,
        error: err.name === 'NotAllowedError' ? 'Permissão de captura de tela cancelada.' : err.message
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
