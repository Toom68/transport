type NoiseType = 'white' | 'pink' | 'brown';

interface NoiseLayer {
  type: NoiseType;
  lowpass?: number;
  highpass?: number;
  gain?: number; // relative gain of this layer (0..1), default 1
}

export interface NoiseChannelOptions {
  type: NoiseType;
  lowpass?: number;   // primary lowpass cutoff (Hz)
  highpass?: number;  // optional highpass cutoff (Hz)
  q?: number;
  pan?: number;       // -1 (left) .. 1 (right)
  lfoRate?: number;   // Hz — enables multiplicative LFO modulation
  lfoDepth?: number;  // 0..1 modulation depth
  reverb?: boolean;   // route through a short convolution reverb
  layers?: NoiseLayer[]; // extra summed noise layers (e.g. layered rain)
}

export interface SampleChannelOptions {
  url: string;
  lowpass?: number;   // optional lowpass cutoff (Hz)
  highpass?: number;  // optional highpass cutoff (Hz)
  q?: number;
  pan?: number;       // -1 (left) .. 1 (right)
  reverb?: boolean;   // route through a short convolution reverb
}

export interface OneShotOptions {
  gain?: number;      // playback gain (0..1), default 1
  pan?: number;       // -1 (left) .. 1 (right)
}

interface AudioChannelNode {
  sources: AudioBufferSourceNode[];
  modGain: GainNode;   // multiplicative slot for LFO + bumps (intrinsic 1.0)
  panner: StereoPannerNode;
  gain: GainNode;      // channel volume (ramped; 0 when muted)
  lowpass: BiquadFilterNode;
  lfo?: OscillatorNode;
  lfoDepth?: GainNode;
  bumpTimer?: ReturnType<typeof setTimeout>;
  volume: number;
}

const NOISE_BUFFER_SECONDS = 8;

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private channels: Map<string, AudioChannelNode> = new Map();
  private reverbIR: AudioBuffer | null = null;
  private sampleBuffers: Map<string, AudioBuffer> = new Map();

  async initialize(): Promise<void> {
    if (this.context) return;
    this.context = new AudioContext();

    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = 0.25;

    // Master bus compressor — glues layers and prevents clipping.
    this.compressor = this.context.createDynamicsCompressor();
    this.compressor.threshold.value = -18;
    this.compressor.knee.value = 24;
    this.compressor.ratio.value = 3;
    this.compressor.attack.value = 0.01;
    this.compressor.release.value = 0.3;

    this.masterGain.connect(this.compressor);
    this.compressor.connect(this.context.destination);

    this.reverbIR = this.buildImpulseResponse(0.45, 2.2);
  }

  async resume(): Promise<void> {
    if (this.context?.state === 'suspended') {
      await this.context.resume();
    }
  }

  private fillBuffer(data: Float32Array, type: NoiseType): void {
    const n = data.length;
    switch (type) {
      case 'white':
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
        break;
      case 'pink': {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < n; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
        break;
      }
      case 'brown': {
        let last = 0;
        for (let i = 0; i < n; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (last + 0.02 * white) / 1.02;
          last = data[i];
          data[i] *= 1.2;
        }
        break;
      }
    }
  }

  private createNoiseBuffer(type: NoiseType): AudioBuffer {
    const ctx = this.context!;
    const size = ctx.sampleRate * NOISE_BUFFER_SECONDS;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    this.fillBuffer(buffer.getChannelData(0), type);
    return buffer;
  }

  private buildImpulseResponse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.context!;
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  private makeSource(type: NoiseType): AudioBufferSourceNode {
    const ctx = this.context!;
    const src = ctx.createBufferSource();
    src.buffer = this.createNoiseBuffer(type);
    src.loop = true;
    return src;
  }

  private makeLayerChain(layer: NoiseLayer, dest: AudioNode): AudioBufferSourceNode {
    const ctx = this.context!;
    const src = this.makeSource(layer.type);
    let node: AudioNode = src;

    if (layer.highpass) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = layer.highpass;
      node.connect(hp);
      node = hp;
    }
    if (layer.lowpass) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = layer.lowpass;
      node.connect(lp);
      node = lp;
    }
    if (layer.gain !== undefined && layer.gain !== 1) {
      const g = ctx.createGain();
      g.gain.value = layer.gain;
      node.connect(g);
      node = g;
    }
    node.connect(dest);
    return src;
  }

  /**
   * Create a (possibly layered) noise channel with optional LFO, reverb and panning.
   * Signal flow: sources -> [filters] -> modGain -> [reverb mix] -> panner -> gain -> master
   */
  createNoiseChannel(id: string, typeOrOptions: NoiseType | NoiseChannelOptions): void {
    if (!this.context || !this.masterGain) return;
    const ctx = this.context;
    const opts: NoiseChannelOptions =
      typeof typeOrOptions === 'string' ? { type: typeOrOptions } : typeOrOptions;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const panner = ctx.createStereoPanner();
    panner.pan.value = opts.pan ?? 0;

    const modGain = ctx.createGain();
    modGain.gain.value = 1;

    // modGain -> (reverb mix) -> panner -> gain -> master
    if (opts.reverb && this.reverbIR) {
      const convolver = ctx.createConvolver();
      convolver.buffer = this.reverbIR;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      const dry = ctx.createGain();
      dry.gain.value = 0.7;
      modGain.connect(dry);
      modGain.connect(convolver);
      convolver.connect(wet);
      dry.connect(panner);
      wet.connect(panner);
    } else {
      modGain.connect(panner);
    }
    panner.connect(gain);
    gain.connect(this.masterGain);

    // Primary source chain into modGain.
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = opts.lowpass ?? 600;
    lowpass.Q.value = opts.q ?? 0.6;

    const sources: AudioBufferSourceNode[] = [];
    const mainSrc = this.makeSource(opts.type);
    let head: AudioNode = mainSrc;
    if (opts.highpass) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = opts.highpass;
      head.connect(hp);
      head = hp;
    }
    head.connect(lowpass);
    lowpass.connect(modGain);
    sources.push(mainSrc);

    // Extra layers (e.g. layered rain) feed straight into modGain.
    if (opts.layers) {
      for (const layer of opts.layers) {
        sources.push(this.makeLayerChain(layer, modGain));
      }
    }

    const channel: AudioChannelNode = {
      sources,
      modGain,
      panner,
      gain,
      lowpass,
      volume: 0,
    };

    // Optional LFO — multiplicative modulation on modGain.
    if (opts.lfoRate && opts.lfoDepth) {
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = opts.lfoRate;
      const depth = ctx.createGain();
      depth.gain.value = opts.lfoDepth;
      lfo.connect(depth);
      depth.connect(modGain.gain);
      lfo.start();
      channel.lfo = lfo;
      channel.lfoDepth = depth;
    }

    for (const s of sources) s.start();
    this.channels.set(id, channel);
  }

  /**
   * Fetch + decode an audio file, caching the decoded buffer by URL.
   * Returns null on any failure (missing file, network block, decode error).
   */
  private async loadSampleBuffer(url: string): Promise<AudioBuffer | null> {
    if (!this.context) return null;
    const cached = this.sampleBuffers.get(url);
    if (cached) return cached;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buffer = await this.context.decodeAudioData(arr);
      this.sampleBuffers.set(url, buffer);
      return buffer;
    } catch {
      return null;
    }
  }

  /** Preload a one-shot/sample file so the first trigger is gap-free. */
  async loadSample(url: string): Promise<boolean> {
    return (await this.loadSampleBuffer(url)) !== null;
  }

  /**
   * Create a looping sample-backed channel that shares the same routing as
   * noise channels (modGain -> [reverb] -> panner -> gain -> master), so all
   * existing volume / pan / filter / bump controls work unchanged.
   * Returns false if the sample could not be loaded (caller can fall back).
   */
  async createSampleChannel(id: string, opts: SampleChannelOptions): Promise<boolean> {
    if (!this.context || !this.masterGain) return false;
    const buffer = await this.loadSampleBuffer(opts.url);
    if (!buffer) return false;
    const ctx = this.context;

    const gain = ctx.createGain();
    gain.gain.value = 0;

    const panner = ctx.createStereoPanner();
    panner.pan.value = opts.pan ?? 0;

    const modGain = ctx.createGain();
    modGain.gain.value = 1;

    if (opts.reverb && this.reverbIR) {
      const convolver = ctx.createConvolver();
      convolver.buffer = this.reverbIR;
      const wet = ctx.createGain();
      wet.gain.value = 0.5;
      const dry = ctx.createGain();
      dry.gain.value = 0.7;
      modGain.connect(dry);
      modGain.connect(convolver);
      convolver.connect(wet);
      dry.connect(panner);
      wet.connect(panner);
    } else {
      modGain.connect(panner);
    }
    panner.connect(gain);
    gain.connect(this.masterGain);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = opts.lowpass ?? 20000;
    lowpass.Q.value = opts.q ?? 0.6;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    let head: AudioNode = src;
    if (opts.highpass) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = opts.highpass;
      head.connect(hp);
      head = hp;
    }
    head.connect(lowpass);
    lowpass.connect(modGain);

    src.start();
    this.channels.set(id, { sources: [src], modGain, panner, gain, lowpass, volume: 0 });
    return true;
  }

  /**
   * Play a one-shot sample (chime, takeoff, landing, thunder crack) routed
   * straight to the master bus. No-op if the sample isn't available.
   */
  async playOneShot(url: string, opts: OneShotOptions = {}): Promise<void> {
    if (!this.context || !this.masterGain) return;
    const buffer = await this.loadSampleBuffer(url);
    if (!buffer) return;
    const ctx = this.context;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1;

    const panner = ctx.createStereoPanner();
    panner.pan.value = opts.pan ?? 0;

    src.connect(g);
    g.connect(panner);
    panner.connect(this.masterGain);

    src.onended = () => {
      try { src.disconnect(); g.disconnect(); panner.disconnect(); } catch { /* noop */ }
    };
    src.start();
  }

  setChannelVolume(id: string, volume: number, fadeTime = 0.5): void {
    const ch = this.channels.get(id);
    if (!ch || !this.context) return;
    ch.volume = volume;
    ch.gain.gain.linearRampToValueAtTime(volume, this.context.currentTime + fadeTime);
  }

  setChannelFilter(id: string, frequency: number): void {
    const ch = this.channels.get(id);
    if (!ch || !this.context) return;
    ch.lowpass.frequency.linearRampToValueAtTime(frequency, this.context.currentTime + 0.3);
  }

  setChannelPan(id: string, pan: number): void {
    const ch = this.channels.get(id);
    if (!ch || !this.context) return;
    ch.panner.pan.linearRampToValueAtTime(pan, this.context.currentTime + 0.4);
  }

  /**
   * Schedule occasional multiplicative "bumps" on a channel (e.g. turbulence jolts).
   * Re-arms itself until cancelled via cancelRandomBumps / dispose.
   */
  scheduleRandomBumps(id: string, minMs = 8000, maxMs = 30000, intensity = 1.7): void {
    const ch = this.channels.get(id);
    if (!ch || !this.context) return;
    this.cancelRandomBumps(id);

    const arm = () => {
      const wait = minMs + Math.random() * (maxMs - minMs);
      ch.bumpTimer = setTimeout(() => {
        if (!this.context) return;
        const now = this.context.currentTime;
        const g = ch.modGain.gain;
        const peak = 1 + (intensity - 1) * (0.6 + Math.random() * 0.4);
        g.cancelScheduledValues(now);
        g.setValueAtTime(1, now);
        g.linearRampToValueAtTime(peak, now + 0.25);
        g.linearRampToValueAtTime(1, now + 1.4);
        arm();
      }, wait);
    };
    arm();
  }

  cancelRandomBumps(id: string): void {
    const ch = this.channels.get(id);
    if (ch?.bumpTimer) {
      clearTimeout(ch.bumpTimer);
      ch.bumpTimer = undefined;
    }
  }

  setMasterVolume(volume: number): void {
    if (!this.masterGain || !this.context) return;
    this.masterGain.gain.linearRampToValueAtTime(volume, this.context.currentTime + 0.3);
  }

  hasChannel(id: string): boolean {
    return this.channels.has(id);
  }

  dispose(): void {
    this.channels.forEach((ch) => {
      if (ch.bumpTimer) clearTimeout(ch.bumpTimer);
      ch.sources.forEach((s) => {
        try { s.stop(); } catch { /* noop */ }
      });
      try { ch.lfo?.stop(); } catch { /* noop */ }
    });
    this.channels.clear();
    this.sampleBuffers.clear();
    this.context?.close();
    this.context = null;
  }
}

export const audioEngine = new AudioEngine();
