/**
 * TriboneraShare — Web Audio Sound Effects Synthesizer
 * Zero-asset, low-latency, cross-browser synthesized audio cues.
 */

window.TriboneraSound = (function () {
  let audioCtx = null;
  let isMuted = localStorage.getItem('tribonera_sound_muted') === 'true';
  const listeners = [];

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  // Pre-unlock AudioContext on first user click or tap anywhere
  function unlockAudio() {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  window.addEventListener('click', unlockAudio, { once: true });
  window.addEventListener('keydown', unlockAudio, { once: true });
  window.addEventListener('touchstart', unlockAudio, { once: true });

  /**
   * 1. 'ding': Delicate crystalline two-tone chime for new user connections
   */
  function playDing() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.001, now);
    masterGain.gain.linearRampToValueAtTime(0.18, now + 0.015);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
    masterGain.connect(ctx.destination);

    // Note 1: E6 (~1318.5 Hz)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.5, now);
    osc1.frequency.exponentialRampToValueAtTime(1318.5, now + 0.5);

    // Note 2: B6 (~1975.5 Hz) subtle harmonic sparkle
    const osc2 = ctx.createOscillator();
    const osc2Gain = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975.5, now + 0.06);
    osc2Gain.gain.setValueAtTime(0.001, now);
    osc2Gain.gain.linearRampToValueAtTime(0.08, now + 0.07);
    osc2Gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

    osc1.connect(masterGain);
    osc2.connect(osc2Gain);
    osc2Gain.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.65);
    osc2.start(now + 0.06);
    osc2.stop(now + 0.65);
  }

  /**
   * 2. 'pop': Bubbly frequency-sweep chord for live status / stream started
   */
  function playPop() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Pop bubble transient (pitch drop)
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(320, now);
    popOsc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
    popOsc.frequency.exponentialRampToValueAtTime(587.3, now + 0.12);

    popGain.gain.setValueAtTime(0.001, now);
    popGain.gain.linearRampToValueAtTime(0.22, now + 0.02);
    popGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    popOsc.connect(popGain);
    popGain.connect(ctx.destination);

    // Harmonic ring overtone (A5 ~880Hz + E6 ~1318Hz)
    const ringOsc = ctx.createOscillator();
    const ringGain = ctx.createGain();
    ringOsc.type = 'triangle';
    ringOsc.frequency.setValueAtTime(880, now + 0.03);

    ringGain.gain.setValueAtTime(0.001, now);
    ringGain.gain.linearRampToValueAtTime(0.12, now + 0.05);
    ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    ringOsc.connect(ringGain);
    ringGain.connect(ctx.destination);

    popOsc.start(now);
    popOsc.stop(now + 0.3);
    ringOsc.start(now + 0.03);
    ringOsc.stop(now + 0.45);
  }

  /**
   * 3. 'liveStart': Upbeat ascending triad (C5 -> E5 -> G5) when user starts broadcasting
   */
  function playLiveStart() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    const now = ctx.currentTime;

    notes.forEach((freq, idx) => {
      const startTime = now + idx * 0.08;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.16, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.42);
    });
  }

  /**
   * 4. 'leave': Gentle soft descending tone (G4 -> E4) when stream stops or leaving
   */
  function playLeave() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(329.6, now + 0.25);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.14, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.38);
  }

  /**
   * 5. 'click': Subtle tactile micro-tap for UI feedback
   */
  function playClick() {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.025);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.04);
  }

  function play(name) {
    if (isMuted) return;
    try {
      if (name === 'ding') playDing();
      else if (name === 'pop') playPop();
      else if (name === 'liveStart') playLiveStart();
      else if (name === 'leave') playLeave();
      else if (name === 'click') playClick();
    } catch (err) {
      console.warn('Audio synthesis error:', err);
    }
  }

  function setMuted(muted) {
    isMuted = !!muted;
    localStorage.setItem('tribonera_sound_muted', isMuted ? 'true' : 'false');
    listeners.forEach(fn => fn(isMuted));
  }

  function toggleMute() {
    setMuted(!isMuted);
    if (!isMuted) {
      play('pop');
    }
    return isMuted;
  }

  function onMuteChange(fn) {
    if (typeof fn === 'function') {
      listeners.push(fn);
      fn(isMuted);
    }
  }

  return {
    play,
    get isMuted() { return isMuted; },
    setMuted,
    toggleMute,
    onMuteChange
  };
})();
