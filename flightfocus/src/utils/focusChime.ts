import type { FocusAlertConfig } from '@/types/simulation';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playBell(ctx: AudioContext, gainNode: GainNode) {
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
  oscGain.gain.setValueAtTime(0, ctx.currentTime);
  oscGain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.01);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
  osc.connect(oscGain);
  oscGain.connect(gainNode);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 1.5);
}

function playChime(ctx: AudioContext, gainNode: GainNode) {
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    const start = ctx.currentTime + i * 0.15;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);
    oscGain.gain.setValueAtTime(0, start);
    oscGain.gain.linearRampToValueAtTime(0.2, start + 0.02);
    oscGain.gain.exponentialRampToValueAtTime(0.001, start + 0.8);
    osc.connect(oscGain);
    oscGain.connect(gainNode);
    osc.start(start);
    osc.stop(start + 0.8);
  });
}

function playSoft(ctx: AudioContext, gainNode: GainNode) {
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  oscGain.gain.setValueAtTime(0, ctx.currentTime);
  oscGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
  oscGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 1.0);
  oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
  osc.connect(oscGain);
  oscGain.connect(gainNode);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 2.0);
}

export function playFocusChime(config: FocusAlertConfig) {
  if (!config.soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.5;
    gainNode.connect(ctx.destination);

    switch (config.chimeType) {
      case 'bell':
        playBell(ctx, gainNode);
        break;
      case 'chime':
        playChime(ctx, gainNode);
        break;
      case 'soft':
        playSoft(ctx, gainNode);
        break;
    }
  } catch (e) {
    // Audio context may not be available
  }
}

export function previewChime(chimeType: FocusAlertConfig['chimeType']) {
  try {
    const ctx = getAudioContext();
    const gainNode = ctx.createGain();
    gainNode.gain.value = 0.5;
    gainNode.connect(ctx.destination);

    switch (chimeType) {
      case 'bell':
        playBell(ctx, gainNode);
        break;
      case 'chime':
        playChime(ctx, gainNode);
        break;
      case 'soft':
        playSoft(ctx, gainNode);
        break;
    }
  } catch (e) {
    // Audio context may not be available
  }
}
