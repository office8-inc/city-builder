/**
 * Sound manager using Web Audio API.
 * Procedural sounds — no external audio files needed.
 */

let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let bgmGain: GainNode | null = null;
let seGain: GainNode | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioCtx.destination);

    bgmGain = audioCtx.createGain();
    bgmGain.gain.value = 0.3;
    bgmGain.connect(masterGain);

    seGain = audioCtx.createGain();
    seGain.gain.value = 0.5;
    seGain.connect(masterGain);
  }
  return audioCtx;
}

export function setMasterVolume(v: number) {
  getCtx();
  if (masterGain) masterGain.gain.value = Math.max(0, Math.min(1, v));
}

export function setBGMVolume(v: number) {
  getCtx();
  if (bgmGain) bgmGain.gain.value = Math.max(0, Math.min(1, v));
}

export function setSEVolume(v: number) {
  getCtx();
  if (seGain) seGain.gain.value = Math.max(0, Math.min(1, v));
}

/** Short click/build sound effect */
export function playBuildSound() {
  const ctx = getCtx();
  if (!seGain) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
  osc.connect(gain);
  gain.connect(seGain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.15);
}

/** Notification ding */
export function playNotificationSound() {
  const ctx = getCtx();
  if (!seGain) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
  osc.connect(gain);
  gain.connect(seGain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.3);
}

/** Error buzz */
export function playErrorSound() {
  const ctx = getCtx();
  if (!seGain) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(seGain);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

/** Train clickety-clack rhythm based on speed */
let trainSoundInterval: ReturnType<typeof setInterval> | null = null;

export function startTrainSound(speed: number) {
  stopTrainSound();
  if (speed <= 0) return;

  const ctx = getCtx();
  if (!seGain) return;

  const interval = Math.max(80, 600 / speed);
  trainSoundInterval = setInterval(() => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150 + Math.random() * 30, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(seGain!);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  }, interval);
}

export function stopTrainSound() {
  if (trainSoundInterval) {
    clearInterval(trainSoundInterval);
    trainSoundInterval = null;
  }
}

/** Ambient city hum */
let ambientNode: OscillatorNode | null = null;
let ambientGain: GainNode | null = null;

export function startAmbient() {
  const ctx = getCtx();
  if (!bgmGain || ambientNode) return;

  ambientNode = ctx.createOscillator();
  ambientGain = ctx.createGain();
  ambientNode.type = 'sine';
  ambientNode.frequency.value = 80;
  ambientGain.gain.value = 0.02;
  ambientNode.connect(ambientGain);
  ambientGain.connect(bgmGain);
  ambientNode.start();
}

export function stopAmbient() {
  if (ambientNode) {
    ambientNode.stop();
    ambientNode.disconnect();
    ambientNode = null;
  }
  if (ambientGain) {
    ambientGain.disconnect();
    ambientGain = null;
  }
}

/** Resume audio context (must be called from user gesture) */
export function resumeAudio() {
  const ctx = getCtx();
  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}
