// nouPix · js/butterchurn.js
// ButterChurn visualizer engine (WebGL/Wasm Milkdrop 2 preset renderer).
// Powered by Butterchurn by Jordan Berg (MIT License - see js/vendor/LICENSE-BUTTERCHURN.txt).
// ButterChurn implementation in nouPix contributed by GitHub user MertenAndreas.
// Provides audio-reactive visualizations with line-in/microphone selection and synthetic beat fallback.
// Uses util, model, macros.

/* ---------- helper for butterchurn UMD loading ---------- */
function getButterchurn() {
  if (typeof butterchurn === 'undefined') return null;
  return butterchurn.default || butterchurn;
}

function getButterchurnPresetsLib() {
  if (typeof butterchurnPresets === 'undefined') return {};
  if (typeof butterchurnPresets.getPresets === 'function') return butterchurnPresets.getPresets();
  if (butterchurnPresets.default && typeof butterchurnPresets.default.getPresets === 'function') return butterchurnPresets.default.getPresets();
  return {};
}

/* ---------- audio manager: line-in, microphone and synthetic beat fallback ---------- */
let milkAudioCtx = null;
let milkMicStream = null;
let milkMicSource = null;
let milkGainNode = null;
let milkAnalyser = null;
let milkBeatOsc = null;
let milkBeatGain = null;
let milkBeatTimer = null;
let milkAudioMode = 'beat'; // 'live' or 'beat'
let milkActiveDeviceId = 'beat';
let milkAudioDevices = [];

function ensureMilkAudio() {
  if (milkAudioCtx && milkAudioCtx.state !== 'closed') {
    if (milkAudioCtx.state === 'suspended') milkAudioCtx.resume().catch(() => {});
    return milkAudioCtx;
  }
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    milkAudioCtx = new AudioContextClass();
    milkGainNode = milkAudioCtx.createGain();
    milkGainNode.gain.setValueAtTime(1.0, milkAudioCtx.currentTime);

    // Analyser node for live VU meter and audio reactivity
    milkAnalyser = milkAudioCtx.createAnalyser();
    milkAnalyser.fftSize = 64;
    milkAnalyser.smoothingTimeConstant = 0.5;
    milkGainNode.connect(milkAnalyser);

    // Setup synthetic rhythmic beat generator (simulates kick and bass pulsations at ~125 BPM)
    milkBeatGain = milkAudioCtx.createGain();
    milkBeatGain.gain.setValueAtTime(0.0, milkAudioCtx.currentTime);

    // Low frequency oscillator for rhythmic bass pulse
    milkBeatOsc = milkAudioCtx.createOscillator();
    milkBeatOsc.type = 'sine';
    milkBeatOsc.frequency.setValueAtTime(55, milkAudioCtx.currentTime); // 55 Hz (A1 bass note)
    milkBeatOsc.connect(milkBeatGain);
    milkBeatOsc.start();

    // Pulse trigger for the simulated beat
    let step = 0;
    const bpm = 125, intervalMs = (60 / bpm / 2) * 1000;
    if (milkBeatTimer) clearInterval(milkBeatTimer);
    milkBeatTimer = setInterval(() => {
      if (!milkAudioCtx || milkAudioCtx.state !== 'running') return;
      if (milkAudioMode !== 'beat') return;
      const t = milkAudioCtx.currentTime;
      step = (step + 1) % 4;
      const isKick = step === 0 || step === 2;
      const amp = isKick ? 0.9 : 0.35;
      milkBeatGain.gain.cancelScheduledValues(t);
      milkBeatGain.gain.setValueAtTime(amp, t);
      milkBeatGain.gain.exponentialRampToValueAtTime(0.001, t + (isKick ? 0.18 : 0.08));
    }, intervalMs);

    milkBeatGain.connect(milkGainNode);

    // Enumerate devices initially
    updateMilkAudioDevices();

    return milkAudioCtx;
  } catch (e) {
    return null;
  }
}

// Read current audio volume level (0.0 to 1.0) for the VU meter (Peak + RMS + FFT)
function getMilkAudioLevel() {
  if (!milkAnalyser) return 0;
  // Read time-domain waveform data (capture true audio amplitude)
  const timeData = new Uint8Array(milkAnalyser.fftSize || 64);
  milkAnalyser.getByteTimeDomainData(timeData);
  let max = 0, sumSq = 0;
  for (let i = 0; i < timeData.length; i++) {
    const v = Math.abs((timeData[i] - 128) / 128);
    if (v > max) max = v;
    sumSq += v * v;
  }
  const rms = Math.sqrt(sumSq / timeData.length);

  // Read frequency data for harmonic/spectral energy
  const freqData = new Uint8Array(milkAnalyser.frequencyBinCount);
  milkAnalyser.getByteFrequencyData(freqData);
  let freqSum = 0;
  for (let i = 0; i < freqData.length; i++) freqSum += freqData[i];
  const freqAvg = freqSum / (freqData.length * 255);

  // Responsive combined level (0.0 to 1.0), boosted for vivid visual readout
  const lvl = Math.max(max * 1.3, rms * 2.8, freqAvg * 2.2);
  return Math.min(1.0, Math.max(0.0, lvl));
}

// Discover all audio input devices (Line-In, Microphones, Mixers, USB audio interfaces)
async function updateMilkAudioDevices() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
  try {
    const list = await navigator.mediaDevices.enumerateDevices();
    const inputs = list.filter(d => d.kind === 'audioinput');
    milkAudioDevices = inputs.map((d, i) => ({
      id: d.deviceId || (i === 0 ? 'default' : `dev-${i}`),
      label: d.label || (i === 0 ? 'Default Audio Input / Line-In' : `Audio Input ${i + 1}`)
    }));
    return milkAudioDevices;
  } catch (e) {
    return [];
  }
}

// Listen for audio hardware plug/unplug
if (typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    updateMilkAudioDevices().then(() => {
      if (typeof ui !== 'undefined' && ui.rightTab === 'content' && typeof renderRight === 'function') {
        renderRight();
      }
    });
  });
}

// Connect to a live audio device (Line-In, microphone, or USB interface)
async function startMilkAudio(deviceId = null) {
  const ctx = ensureMilkAudio();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    toast('Browsers block Line-In on file://. Run with "python noupix.py" (http://127.0.0.1:8080) for hardware audio.', 'warn');
    return false;
  }
  if (!ctx || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('Audio input is not supported in this browser.', 'warn');
    return false;
  }
  try {
    // Release existing audio track before opening a new one
    if (milkMicStream) {
      milkMicStream.getTracks().forEach(t => t.stop());
      milkMicStream = null;
    }
    if (milkMicSource) {
      try { milkMicSource.disconnect(); } catch (e) {}
      milkMicSource = null;
    }

    const constraints = {
      audio: deviceId && deviceId !== 'default' && deviceId !== 'beat' ? { deviceId } : true,
      video: false
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    milkMicStream = stream;
    milkMicSource = ctx.createMediaStreamSource(stream);
    milkMicSource.connect(milkGainNode);
    milkAudioMode = 'live';
    milkActiveDeviceId = deviceId || 'default';

    // Re-enumerate to retrieve full human-readable device labels now that permission was granted
    await updateMilkAudioDevices();

    // Mute simulated beat generator while live audio is active
    if (milkBeatGain) milkBeatGain.gain.setValueAtTime(0.0, ctx.currentTime);

    const dev = milkAudioDevices.find(d => d.id === milkActiveDeviceId);
    toast('Connected audio input: ' + (dev ? dev.label : 'Line-In / Microphone'));
    if (typeof ui !== 'undefined' && ui.rightTab === 'content' && typeof renderRight === 'function') {
      renderRight();
    }
    return true;
  } catch (err) {
    milkAudioMode = 'beat';
    milkActiveDeviceId = 'beat';
    let msg = 'Audio error: ' + err.message;
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      msg = 'Audio access denied. Allow Microphone/Line-In in browser address bar (🔒 icon), then retry.';
    } else if (err.name === 'OverconstrainedError' || err.name === 'NotFoundError') {
      msg = 'Audio device not found or disconnected. Using simulated beat.';
    }
    toast(msg, 'warn');
    if (typeof ui !== 'undefined' && ui.rightTab === 'content' && typeof renderRight === 'function') {
      renderRight();
    }
    return false;
  }
}

// Connect to System / Tab audio via browser getDisplayMedia (Loopback without extra cables)
async function startMilkSystemAudio() {
  const ctx = ensureMilkAudio();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  if (typeof window !== 'undefined' && window.location && window.location.protocol === 'file:') {
    toast('Browsers block media capture on file://. Run with "python noupix.py" (http://127.0.0.1:8080).', 'warn');
    return false;
  }
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    toast('System / Tab audio loopback (getDisplayMedia) is not supported in this browser.', 'warn');
    return false;
  }
  try {
    if (milkMicStream) {
      milkMicStream.getTracks().forEach(t => t.stop());
      milkMicStream = null;
    }
    if (milkMicSource) {
      try { milkMicSource.disconnect(); } catch (e) {}
      milkMicSource = null;
    }

    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    });

    const audioTracks = stream.getAudioTracks();
    if (!audioTracks || !audioTracks.length) {
      // User didn't check the "Share audio" box in the browser dialog
      stream.getTracks().forEach(t => t.stop());
      toast('No audio stream captured. Be sure to check "Share audio" (or "Share tab audio") in the browser dialog.', 'warn');
      return false;
    }

    // Stop video tracks immediately so GPU/CPU is not wasted on video frames
    stream.getVideoTracks().forEach(t => t.stop());

    milkMicStream = stream;
    milkMicSource = ctx.createMediaStreamSource(stream);
    milkMicSource.connect(milkGainNode);
    milkAudioMode = 'live';
    milkActiveDeviceId = 'system';

    if (milkBeatGain) milkBeatGain.gain.setValueAtTime(0.0, ctx.currentTime);

    audioTracks[0].onended = () => {
      setMilkAudioMode('beat');
      toast('System audio loopback stopped. Reverted to beat generator.');
    };

    toast('Connected to System / Tab audio loopback!');
    if (typeof ui !== 'undefined' && ui.rightTab === 'content' && typeof renderRight === 'function') {
      renderRight();
    }
    return true;
  } catch (err) {
    if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
      toast('System audio loopback error: ' + err.message, 'warn');
    }
    return false;
  }
}

// Switch audio mode: 'beat', 'system', or specific device ID
function setMilkAudioMode(mode, deviceId = null) {
  if (mode === 'beat' || deviceId === 'beat') {
    if (milkMicStream) {
      milkMicStream.getTracks().forEach(t => t.stop());
      milkMicStream = null;
    }
    if (milkMicSource) {
      try { milkMicSource.disconnect(); } catch (e) {}
      milkMicSource = null;
    }
    milkAudioMode = 'beat';
    milkActiveDeviceId = 'beat';
    toast('Switched to simulated beat generator');
    if (typeof ui !== 'undefined' && ui.rightTab === 'content' && typeof renderRight === 'function') {
      renderRight();
    }
  } else if (mode === 'system' || deviceId === 'system') {
    startMilkSystemAudio();
  } else {
    startMilkAudio(deviceId || (mode === 'default' ? null : mode));
  }
}

/* ---------- preset catalog and management ---------- */
const customMilkPresets = new Map(); // preset name -> preset object

function getAllMilkPresetNames() {
  const lib = getButterchurnPresetsLib();
  const names = Object.keys(lib);
  for (const k of customMilkPresets.keys()) {
    if (!names.includes(k)) names.push(k);
  }
  return names.sort();
}

function getMilkPresetObject(name) {
  if (customMilkPresets.has(name)) return customMilkPresets.get(name);
  const lib = getButterchurnPresetsLib();
  if (name && lib[name]) return lib[name];
  const first = Object.keys(lib)[0];
  return first ? lib[first] : null;
}

function milkColorToRgb(c) {
  if (Array.isArray(c)) {
    return [
      clamp(numOr(c[0], 1), 0, 1),
      clamp(numOr(c[1], 1), 0, 1),
      clamp(numOr(c[2], 1), 0, 1),
      clamp(numOr(c[3], 1), 0, 1)
    ];
  }
  if (typeof c === 'string' && typeof fromHex === 'function') {
    const h = fromHex(c);
    if (h) return [h[0], h[1], h[2], 1];
  }
  return [1, 1, 1, 1];
}

// Inspect what parameters a specific Milkdrop preset defines & utilizes
function getMilkPresetParams(name) {
  const pObj = getMilkPresetObject(name);
  if (!pObj) {
    return {
      hasWave: false, hasOB: false, hasIB: false, hasMV: false,
      hasDecay: true, decay: 0.98,
      hasGamma: true, gammaadj: 1.5,
      hasWarp: false, warp: 0.01,
      hasInvert: false, hasSolarize: false, hasDarkenCenter: false
    };
  }
  const bv = pObj.baseVals || {};
  const fe = pObj.frame_eqs_str || '';

  // Waveform
  const hasWave = (bv.wave_mode != null && bv.wave_mode !== 0) || (bv.wave_a != null && bv.wave_a > 0.001) || fe.includes('wave_r') || fe.includes('wave_mode');
  const wave_mode = bv.wave_mode ?? 0;
  const wave_rgb = [numOr(bv.wave_r, 1), numOr(bv.wave_g, 1), numOr(bv.wave_b, 1), numOr(bv.wave_a, 1)];
  const wave_scale = numOr(bv.wave_scale, 1.0);

  // Outer border
  const hasOB = (bv.ob_size != null && bv.ob_size > 0.0001) || (bv.ob_a != null && bv.ob_a > 0.0001) || fe.includes('ob_r') || fe.includes('ob_size');
  const ob_rgb = [numOr(bv.ob_r, 0), numOr(bv.ob_g, 0), numOr(bv.ob_b, 0), numOr(bv.ob_a, 1)];
  const ob_size = numOr(bv.ob_size, 0.01);

  // Inner border
  const hasIB = (bv.ib_size != null && bv.ib_size > 0.0001) || (bv.ib_a != null && bv.ib_a > 0.0001) || fe.includes('ib_r') || fe.includes('ib_size');
  const ib_rgb = [numOr(bv.ib_r, 0), numOr(bv.ib_g, 0), numOr(bv.ib_b, 0), numOr(bv.ib_a, 1)];
  const ib_size = numOr(bv.ib_size, 0.01);

  // Motion vectors / Grid
  const hasMV = (bv.mv_a != null && bv.mv_a > 0.0001) || (bv.mv_l != null && bv.mv_l > 0.0001) || fe.includes('mv_r');
  const mv_rgb = [numOr(bv.mv_r, 0.5), numOr(bv.mv_g, 0.5), numOr(bv.mv_b, 0.5), numOr(bv.mv_a, 1)];

  // Decay (motion trails)
  const hasDecay = bv.decay != null || fe.includes('decay');
  const decay = numOr(bv.decay, 0.98);

  // Gamma / Brightness
  const hasGamma = bv.gammaadj != null || fe.includes('gammaadj');
  const gammaadj = numOr(bv.gammaadj, 1.5);

  // Warp
  const hasWarp = (bv.warp != null && bv.warp > 0.0001) || fe.includes('warp');
  const warp = numOr(bv.warp, 0.01);

  // Invert / Solarize / Darken Center
  const hasInvert = bv.invert != null || fe.includes('invert');
  const hasSolarize = bv.solarize != null || fe.includes('solarize');
  const hasDarkenCenter = bv.darken_center != null || fe.includes('darken_center');

  return {
    hasWave, wave_mode, wave_rgb, wave_scale,
    hasOB, ob_rgb, ob_size,
    hasIB, ib_rgb, ib_size,
    hasMV, mv_rgb,
    hasDecay, decay,
    hasGamma, gammaadj,
    hasWarp, warp,
    hasInvert, hasSolarize, hasDarkenCenter
  };
}

// Built-in presets curated for nouPix
const BUTTERCHURN_BUILTINS = [
  { id: 'm-desert-rose', name: 'Desert Rose', preset: '_Geiss - Desert Rose 2' },
  { id: 'm-liquid-fire', name: 'Liquid Fire', preset: 'Cope - The Neverending Explosion of Red Liquid Fire' },
  { id: 'm-cubetrace', name: 'Cubetrace', preset: 'Eo.S. + Phat - cubetrace - v2' },
  { id: 'm-skylight', name: 'Skylight', preset: 'Eo.S. + Zylot - skylight (Stained Glass Majesty mix)' },
  { id: 'm-artifact', name: 'Artifact', preset: '_Geiss - Artifact 01' },
  { id: 'm-hurricane', name: 'Hurricane', preset: '_Rovastar + Geiss - Hurricane Nightmare (Posterize Mix)' },
  { id: 'm-mother-pearl', name: 'Mother of Pearl', preset: 'cope + martin - mother-of-pearl' },
  { id: 'm-potion', name: 'Potion Spirits', preset: 'Aderrasi - Potion of Spirits' },
];
const MILKDROP_BUILTINS = BUTTERCHURN_BUILTINS;

/* ---------- visualizer runtime and rendering ---------- */
let milkOffscreen = null; // WebGL canvas where butterchurn renders
let milkCanvas = null;    // 2D canvas of size TW x TH matching mixer scale
let milkCtx = null;
let milkVisualizer = null;
let milkActivePreset = '';
let milkLastW = 0, milkLastH = 0;
let milkConnectedAudio = false;

function ensureMilkVisualizer(w, h) {
  const bc = getButterchurn();
  if (!bc || typeof bc.createVisualizer !== 'function') return null;
  const ctx = ensureMilkAudio();
  if (!milkOffscreen) {
    milkOffscreen = document.createElement('canvas');
    milkCanvas = document.createElement('canvas');
    milkCtx = milkCanvas.getContext('2d');
  }
  // Match composition size in milkCanvas
  const compW = Math.max(project ? project.settings.compW : 800, THUMB);
  const compH = Math.max(project ? project.settings.compH : 600, THUMB);
  if (milkCanvas.width !== compW || milkCanvas.height !== compH) {
    milkCanvas.width = compW;
    milkCanvas.height = compH;
  }
  const rw = Math.max(64, Math.min(1280, Math.round(w) || 400));
  const rh = Math.max(64, Math.min(720, Math.round(h) || 300));
  if (!milkVisualizer) {
    milkOffscreen.width = rw;
    milkOffscreen.height = rh;
    try {
      milkVisualizer = bc.createVisualizer(ctx, milkOffscreen, {
        width: rw,
        height: rh,
        pixelRatio: 1,
        textureRatio: 1,
        meshWidth: 32,
        meshHeight: 24,
      });
      if (milkGainNode && !milkConnectedAudio) {
        milkVisualizer.connectAudio(milkGainNode);
        milkConnectedAudio = true;
      }
      // Immediately load initial preset
      const pObj = getMilkPresetObject('_Geiss - Desert Rose 2');
      if (pObj) {
        try { milkVisualizer.loadPreset(pObj, 0.0); milkActivePreset = '_Geiss - Desert Rose 2'; } catch (e) {}
      }
    } catch (e) {
      console.error('Butterchurn createVisualizer failed:', e);
      milkVisualizer = null;
      return null;
    }
  } else if (Math.abs(rw - milkLastW) > 16 || Math.abs(rh - milkLastH) > 16) {
    milkOffscreen.width = rw;
    milkOffscreen.height = rh;
    try {
      milkVisualizer.setRendererSize(rw, rh, {
        meshWidth: 32,
        meshHeight: 24,
        pixelRatio: 1,
        textureRatio: 1
      });
    } catch (e) {
      console.warn('Butterchurn setRendererSize failed:', e);
    }
  }
  milkLastW = rw; milkLastH = rh;
  return milkVisualizer;
}

// Preset cycling and transition
function checkMilkCycle(src) {
  if (!src.cycle || src.cycle <= 0) return;
  const now = clockT;
  if (!src._lastCycle) src._lastCycle = now;
  if (now - src._lastCycle >= src.cycle) {
    src._lastCycle = now;
    cycleMilkPreset(src);
  }
}

function cycleMilkPreset(src, dir = 1) {
  const all = getAllMilkPresetNames();
  if (!all.length) return;
  let idx = all.indexOf(src.preset);
  if (idx < 0) idx = 0;
  else idx = (idx + dir + all.length) % all.length;
  src.preset = all[idx];
  loadMilkPreset(src, src.preset, src.transition ?? 2.5);
  commitSoft();
  if (typeof ui !== 'undefined' && ui.rightTab === 'content' && typeof renderRight === 'function') {
    renderRight();
  }
}

function randomMilkPreset(src) {
  const all = getAllMilkPresetNames();
  if (!all.length) return;
  const current = src.preset;
  let next = current;
  for (let i = 0; i < 5 && next === current; i++) {
    next = all[Math.floor(Math.random() * all.length)];
  }
  src.preset = next;
  loadMilkPreset(src, next, src.transition ?? 2.5);
  commitSoft();
  if (typeof ui !== 'undefined' && ui.rightTab === 'content' && typeof renderRight === 'function') {
    renderRight();
  }
}

let milkCurrentOverrides = null;

function hookMilkEquationRunner(runner) {
  if (!runner || runner._nouHooked) return;
  const origRun = runner.runFrameEquations;
  runner.runFrameEquations = function(t) {
    origRun.call(this, t);
    const ov = milkCurrentOverrides;
    if (ov && this.mdVSFrame) {
      if (ov.decay != null) this.mdVSFrame.decay = ov.decay;
      if (ov.gammaadj != null) this.mdVSFrame.gammaadj = ov.gammaadj;
      if (ov.wave_mode != null) this.mdVSFrame.wave_mode = ov.wave_mode;
      if (ov.wave_r != null) this.mdVSFrame.wave_r = ov.wave_r;
      if (ov.wave_g != null) this.mdVSFrame.wave_g = ov.wave_g;
      if (ov.wave_b != null) this.mdVSFrame.wave_b = ov.wave_b;
      if (ov.wave_a != null) this.mdVSFrame.wave_a = ov.wave_a;
      if (ov.wave_scale != null) this.mdVSFrame.wave_scale = ov.wave_scale;
      if (ov.ob_size != null) this.mdVSFrame.ob_size = ov.ob_size;
      if (ov.ob_r != null) this.mdVSFrame.ob_r = ov.ob_r;
      if (ov.ob_g != null) this.mdVSFrame.ob_g = ov.ob_g;
      if (ov.ob_b != null) this.mdVSFrame.ob_b = ov.ob_b;
      if (ov.ib_size != null) this.mdVSFrame.ib_size = ov.ib_size;
      if (ov.ib_r != null) this.mdVSFrame.ib_r = ov.ib_r;
      if (ov.ib_g != null) this.mdVSFrame.ib_g = ov.ib_g;
      if (ov.ib_b != null) this.mdVSFrame.ib_b = ov.ib_b;
      if (ov.mv_r != null) this.mdVSFrame.mv_r = ov.mv_r;
      if (ov.mv_g != null) this.mdVSFrame.mv_g = ov.mv_g;
      if (ov.mv_b != null) this.mdVSFrame.mv_b = ov.mv_b;
      if (ov.warp != null) this.mdVSFrame.warp = ov.warp;
      if (ov.invert != null) this.mdVSFrame.invert = ov.invert ? 1 : 0;
      if (ov.solarize != null) this.mdVSFrame.solarize = ov.solarize ? 1 : 0;
      if (ov.darken_center != null) this.mdVSFrame.darken_center = ov.darken_center ? 1 : 0;
    }
  };
  runner._nouHooked = true;
}

function loadMilkPreset(src, presetName, blendTime = 2.0) {
  const viz = ensureMilkVisualizer(milkLastW || 400, milkLastH || 300);
  if (!viz) return;
  const pObj = getMilkPresetObject(presetName);
  if (!pObj) return;
  try {
    viz.loadPreset(pObj, blendTime);
    milkActivePreset = presetName;
    if (viz.renderer) {
      if (viz.renderer.presetEquationRunner) hookMilkEquationRunner(viz.renderer.presetEquationRunner);
      if (viz.renderer.prevPresetEquationRunner) hookMilkEquationRunner(viz.renderer.prevPresetEquationRunner);
    }
  } catch (e) {
    console.warn('Preset load failed:', e);
  }
}

// Draw one frame of Milkdrop for the zone mixer
function renderMilkdrop(src, L, w, h) {
  const viz = ensureMilkVisualizer(w, h);
  if (!viz) return null;
  // Make sure audio context is alive on user action
  if (milkAudioCtx && milkAudioCtx.state === 'suspended') {
    milkAudioCtx.resume().catch(() => {});
  }
  // Audio sensitivity / gain from source or Speed/Intensity macros
  if (milkGainNode) {
    const userGain = src.gain ?? 1.0;
    const speedMult = project && project.macros && project.macros.speed ? project.macros.speed.v : 1;
    milkGainNode.gain.setValueAtTime(userGain * speedMult, milkAudioCtx ? milkAudioCtx.currentTime : 0);
  }
  // Check preset update
  const presetName = src.preset || (src.builtin && (MILKDROP_BUILTINS.find(b => b.id === src.builtin) || {}).preset) || '_Geiss - Desert Rose 2';
  if (milkActivePreset !== presetName) {
    loadMilkPreset(src, presetName, 0.0);
  }
  checkMilkCycle(src);

  // Read layer and source parameter overrides
  const p = (L && L.params && L.params[src.id]) || src.params || {};
  const ov = {};
  if (p.decay != null) ov.decay = Number(p.decay);
  if (p.gammaadj != null) ov.gammaadj = Number(p.gammaadj);
  if (p.wave_mode != null && p.wave_mode !== '') ov.wave_mode = Number(p.wave_mode);
  if (p.wave_scale != null) ov.wave_scale = Number(p.wave_scale);
  if (p.wave_color) {
    const c = milkColorToRgb(p.wave_color);
    ov.wave_r = c[0]; ov.wave_g = c[1]; ov.wave_b = c[2];
    if (c[3] != null) ov.wave_a = c[3];
  }
  if (p.ob_color) {
    const c = milkColorToRgb(p.ob_color);
    ov.ob_r = c[0]; ov.ob_g = c[1]; ov.ob_b = c[2];
  }
  if (p.ob_size != null) ov.ob_size = Number(p.ob_size);
  if (p.ib_color) {
    const c = milkColorToRgb(p.ib_color);
    ov.ib_r = c[0]; ov.ib_g = c[1]; ov.ib_b = c[2];
  }
  if (p.ib_size != null) ov.ib_size = Number(p.ib_size);
  if (p.mv_color) {
    const c = milkColorToRgb(p.mv_color);
    ov.mv_r = c[0]; ov.mv_g = c[1]; ov.mv_b = c[2];
  }
  if (p.warp != null) ov.warp = Number(p.warp);
  if (p.invert != null) ov.invert = !!p.invert;
  if (p.solarize != null) ov.solarize = !!p.solarize;
  if (p.darken_center != null) ov.darken_center = !!p.darken_center;

  milkCurrentOverrides = ov;
  if (viz.renderer) {
    if (viz.renderer.presetEquationRunner) hookMilkEquationRunner(viz.renderer.presetEquationRunner);
    if (viz.renderer.prevPresetEquationRunner) hookMilkEquationRunner(viz.renderer.prevPresetEquationRunner);
  }

  try {
    viz.render();
  } catch (e) {
    console.error('ButterChurn render failed:', e);
    return null;
  }

  // Blit rendered frame into milkCanvas (which is sized TW x TH for the mixer)
  const top = milkCanvas.height - h;
  milkCtx.clearRect(0, top, w, h);

  // Apply color grading filters (Hue Shift, Saturation, Brightness)
  const hue = numOr(p.hue, 0);
  const sat = numOr(p.sat, 100);
  const bright = numOr(p.bright, 100);

  if (hue !== 0 || sat !== 100 || bright !== 100) {
    milkCtx.filter = `hue-rotate(${hue}deg) saturate(${sat}%) brightness(${bright}%)`;
  } else {
    milkCtx.filter = 'none';
  }

  try {
    milkCtx.drawImage(milkOffscreen, 0, top, w, h);
  } catch (e) {
    return null;
  }
  milkCtx.filter = 'none';

  // Apply stage color macro tinting if enabled
  let tintRgb = null;
  if (p.tintMode === 'color1' && project && project.macros && project.macros.color1 && project.macros.color1.on) {
    tintRgb = typeof macroRgb === 'function' ? macroRgb(project.macros.color1) : null;
  } else if (p.tintMode === 'color2' && project && project.macros && project.macros.color2 && project.macros.color2.on) {
    tintRgb = typeof macroRgb === 'function' ? macroRgb(project.macros.color2) : null;
  } else if (p.tintMode === 'custom' && p.tintColor) {
    tintRgb = milkColorToRgb(p.tintColor);
  }

  if (tintRgb) {
    milkCtx.save();
    milkCtx.globalCompositeOperation = p.tintBlend || 'color';
    milkCtx.fillStyle = `rgb(${Math.round(tintRgb[0] * 255)}, ${Math.round(tintRgb[1] * 255)}, ${Math.round(tintRgb[2] * 255)})`;
    milkCtx.fillRect(0, top, w, h);
    milkCtx.restore();
  }

  return milkCanvas;
}

// Dedicated cache for Milkdrop preset preview canvases
const milkThumbCanvases = new Map();

function getMilkPresetThumbnail(src) {
  const id = src.id || src.name;
  let c = milkThumbCanvases.get(id);
  if (!c) {
    c = document.createElement('canvas');
    c.width = THUMB;
    c.height = THUMB;
    const ctx = c.getContext('2d');
    
    // Hash preset name to generate a pleasant, distinct colour theme
    const name = src.preset || src.name || 'ButterChurn';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 45 + (Math.abs(hash >> 3) % 60)) % 360;
    
    // Gradient background
    const grad = ctx.createLinearGradient(0, 0, THUMB, THUMB);
    grad.addColorStop(0, `hsl(${h1}, 65%, 15%)`);
    grad.addColorStop(1, `hsl(${h2}, 75%, 8%)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, THUMB, THUMB);

    // Decorative waveform / geometric curves
    ctx.strokeStyle = `hsl(${h1}, 80%, 65%)`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const cy = THUMB / 2;
    for (let x = 0; x < THUMB; x += 2) {
      const angle = (x / THUMB) * Math.PI * 4 + (hash % 10);
      const amp = Math.sin(angle) * (THUMB * 0.22) * Math.sin((x / THUMB) * Math.PI);
      if (x === 0) ctx.moveTo(x, cy + amp);
      else ctx.lineTo(x, cy + amp);
    }
    ctx.stroke();

    // Subtle center glow
    const radial = ctx.createRadialGradient(THUMB / 2, THUMB / 2, 2, THUMB / 2, THUMB / 2, THUMB / 2);
    radial.addColorStop(0, `hsla(${h2}, 90%, 60%, 0.35)`);
    radial.addColorStop(1, 'transparent');
    ctx.fillStyle = radial;
    ctx.fillRect(0, 0, THUMB, THUMB);

    // Compact preset badge text
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.font = '600 9px monospace';
    ctx.textAlign = 'center';
    const label = (src.name || 'ButterChurn').replace(/^(ButterChurn|Milkdrop):\s*/i, '').slice(0, 14);
    ctx.fillText(label, THUMB / 2, THUMB - 8);

    milkThumbCanvases.set(id, c);
  }
  return c;
}

// Draw preview thumbnail into THUMB x THUMB
function drawMilkThumb(src, still) {
  // If this preset is currently playing in the active visualizer, use the live frame
  const presetName = src.preset || (src.builtin && (MILKDROP_BUILTINS.find(b => b.id === src.builtin) || {}).preset) || '_Geiss - Desert Rose 2';
  if (milkVisualizer && milkActivePreset === presetName && milkCanvas) {
    return milkCanvas;
  }
  // Otherwise, return a dedicated static thumbnail canvas without reconfiguring or thrashing the main visualizer
  return getMilkPresetThumbnail(src);
}

// ButterChurn API aliases for consistency
const renderButterchurn = renderMilkdrop;
const getButterchurnPresetParams = getMilkPresetParams;
const loadButterchurnPreset = loadMilkPreset;
const cycleButterchurnPreset = cycleMilkPreset;
const randomButterchurnPreset = randomMilkPreset;
const getAllButterchurnPresetNames = getAllMilkPresetNames;
