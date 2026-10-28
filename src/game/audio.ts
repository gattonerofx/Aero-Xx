import { ActiveWeaponId, MusicThemeId, SfxPresetId, TrackId } from './types';

/**
 * Studio-grade Multi-Theme & Multi-SFX Web Audio Synthesizer for AERO-X:
 * 1. Separate Music Bus (`musicVolume`) and Sound FX Bus (`sfxVolume`)
 * 2. 5 Selectable Procedural Electronic Music Themes:
 *    - 'cyber_techno' (136 BPM Driving Acid & Warehouse Techno)
 *    - 'synthwave_outrun' (124 BPM Analog Outrun Synthwave)
 *    - 'hyper_trance' (140 BPM Euphoric Supersaw Trance)
 *    - 'dark_electro' (130 BPM Industrial Cyberpunk Electro)
 *    - 'liquid_dnb' (172 BPM High-Speed Liquid Drum & Bass)
 * 3. 5 Selectable Sound FX Variants (`SfxPresetId`):
 *    - 'quantum_clean', 'plasma_overdrive', 'arcade_synth', 'titan_heavy', 'crystalline_harmonic'
 */
class AeroAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBusGain: GainNode | null = null;
  private sfxBusGain: GainNode | null = null;

  private musicDelay: DelayNode | null = null;
  private sfxDelay: DelayNode | null = null;

  // Multi-Layer Anti-Gravity Turbine Nodes
  private subOsc: OscillatorNode | null = null;
  private bodyOsc: OscillatorNode | null = null;
  private turbineOsc: OscillatorNode | null = null;
  private windNode: AudioBufferSourceNode | null = null;

  private engineFilter: BiquadFilterNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  private subGain: GainNode | null = null;
  private bodyGain: GainNode | null = null;
  private turbineGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private engineMasterGain: GainNode | null = null;

  // Procedural Electronic Soundtrack & Main MP3 Theme State
  private proThemeAudio: HTMLAudioElement | null = null;
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicMode: 'off' | 'ambient' | 'race' = 'ambient';
  private nextNoteTime = 0;

  private musicVolume = 0.65;
  private sfxVolume = 0.75;
  private musicTheme: MusicThemeId = 'pro_theme';
  private sfxPreset: SfxPresetId = 'quantum_clean';
  private muted = false;
  private engineRunning = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        if (this.musicTheme === 'pro_theme') {
          this.syncProThemePlayback();
        } else if (this.musicMode !== 'off') {
          this.startMusic(this.musicMode);
        }
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
    }
  }

  private ensureProThemeAudio(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    if (!this.proThemeAudio) {
      const audio = new Audio('/assets/aistudio/music-theme-pro_57207915.mp3');
      audio.loop = true;
      audio.preload = 'auto';
      this.proThemeAudio = audio;
    }
    return this.proThemeAudio;
  }

  private syncProThemePlayback() {
    const audio = this.ensureProThemeAudio();
    if (!audio) return;

    const shouldPlay =
      this.musicTheme === 'pro_theme' &&
      this.musicMode !== 'off' &&
      !this.muted &&
      this.musicVolume > 0.005;

    const modeGain = this.musicMode === 'ambient' ? 0.85 : 1.0;
    audio.volume = this.muted ? 0 : Math.max(0, Math.min(1, this.musicVolume * modeGain));

    if (shouldPlay) {
      if (audio.paused) {
        audio.play().catch(() => {
          // Will automatically start on first user gesture
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
      }
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.setupMasterBus(this.ctx);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private setupMasterBus(ctx: AudioContext) {
    this.masterGain = ctx.createGain();
    this.masterGain.gain.value = this.muted ? 0 : 1.0;
    this.masterGain.connect(ctx.destination);

    // Separate Music & SFX buses
    this.musicBusGain = ctx.createGain();
    this.musicBusGain.gain.value = this.muted ? 0 : this.musicVolume;
    this.musicBusGain.connect(this.masterGain);

    this.sfxBusGain = ctx.createGain();
    this.sfxBusGain.gain.value = this.muted ? 0 : this.sfxVolume;
    this.sfxBusGain.connect(this.masterGain);

    // Stereo-style echo bus for Music arpeggios & leads
    this.musicDelay = ctx.createDelay(1.0);
    this.musicDelay.delayTime.value = 0.22;
    const musicFeedback = ctx.createGain();
    musicFeedback.gain.value = 0.28;
    const musicEchoFilter = ctx.createBiquadFilter();
    musicEchoFilter.type = 'lowpass';
    musicEchoFilter.frequency.value = 2200;
    this.musicDelay.connect(musicEchoFilter);
    musicEchoFilter.connect(musicFeedback);
    musicFeedback.connect(this.musicDelay);
    this.musicDelay.connect(this.musicBusGain);

    // Stereo-style echo bus for SFX chimes
    this.sfxDelay = ctx.createDelay(1.0);
    this.sfxDelay.delayTime.value = 0.19;
    const sfxFeedback = ctx.createGain();
    sfxFeedback.gain.value = 0.24;
    const sfxEchoFilter = ctx.createBiquadFilter();
    sfxEchoFilter.type = 'lowpass';
    sfxEchoFilter.frequency.value = 2400;
    this.sfxDelay.connect(sfxEchoFilter);
    sfxEchoFilter.connect(sfxFeedback);
    sfxFeedback.connect(this.sfxDelay);
    this.sfxDelay.connect(this.sfxBusGain);

    // Pre-generate 2 seconds of smooth pink-tinted white noise for aerodynamic wind & percussion
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0,
      b1 = 0,
      b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = (b0 + b1 + b2 + white * 0.18) * 0.35;
    }
    this.noiseBuffer = buffer;
  }

  public setSettings(
    sfxVolume: number,
    muted: boolean,
    musicVolume = this.musicVolume,
    musicTheme: MusicThemeId = this.musicTheme,
    sfxPreset: SfxPresetId = this.sfxPreset
  ) {
    this.sfxVolume = Math.max(0, Math.min(1, sfxVolume));
    this.musicVolume = Math.max(0, Math.min(1, musicVolume));
    this.muted = muted;
    const themeChanged = this.musicTheme !== musicTheme;
    this.musicTheme = musicTheme;

    const presetChanged = this.sfxPreset !== sfxPreset;
    this.sfxPreset = sfxPreset;

    this.syncProThemePlayback();
    if (themeChanged && this.musicTheme !== 'pro_theme' && this.musicMode !== 'off') {
      this.startMusic(this.musicMode);
    }

    if (this.ctx) {
      const now = this.ctx.currentTime;
      if (this.masterGain) {
        this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1.0, now, 0.05);
      }
      if (this.musicBusGain) {
        this.musicBusGain.gain.setTargetAtTime(this.muted ? 0 : this.musicVolume, now, 0.05);
      }
      if (this.sfxBusGain) {
        this.sfxBusGain.gain.setTargetAtTime(this.muted ? 0 : this.sfxVolume, now, 0.05);
      }
      if (presetChanged) {
        this.applyEngineOscillatorTypes();
      }
    }

    if (this.muted && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  private applyEngineOscillatorTypes() {
    if (!this.subOsc || !this.bodyOsc || !this.turbineOsc) return;
    try {
      switch (this.sfxPreset) {
        case 'plasma_overdrive':
          this.subOsc.type = 'triangle';
          this.bodyOsc.type = 'sawtooth';
          this.turbineOsc.type = 'sawtooth';
          break;
        case 'arcade_synth':
          this.subOsc.type = 'square';
          this.bodyOsc.type = 'square';
          this.turbineOsc.type = 'triangle';
          break;
        case 'titan_heavy':
          this.subOsc.type = 'sine';
          this.bodyOsc.type = 'sawtooth';
          this.turbineOsc.type = 'triangle';
          break;
        case 'crystalline_harmonic':
          this.subOsc.type = 'sine';
          this.bodyOsc.type = 'sine';
          this.turbineOsc.type = 'triangle';
          break;
        case 'quantum_clean':
        default:
          this.subOsc.type = 'sine';
          this.bodyOsc.type = 'triangle';
          this.turbineOsc.type = 'sine';
          break;
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Plays a short signature preview of the currently selected Sound FX Preset.
   */
  public playSfxPreview(presetOverride?: SfxPresetId) {
    if (presetOverride) {
      this.sfxPreset = presetOverride;
      this.applyEngineOscillatorTypes();
    }
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain || this.muted || this.sfxVolume <= 0.01) return;
    this.playRingPass(3, true);
  }

  /**
   * Starts the smooth multi-layered anti-gravity turbine & aerodynamic wind engine
   * plus the background electronic race music.
   */
  public startEngine() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    this.engineRunning = true;
    this.startMusic('race');

    if (this.subOsc) {
      this.applyEngineOscillatorTypes();
      if (this.engineMasterGain) {
        this.engineMasterGain.gain.setTargetAtTime(1.0, ctx.currentTime, 0.15);
      }
      return;
    }

    try {
      this.engineMasterGain = ctx.createGain();
      this.engineMasterGain.gain.value = 1.0;
      this.engineMasterGain.connect(this.sfxBusGain);

      this.engineFilter = ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 220;
      this.engineFilter.Q.value = 0.9;
      this.engineFilter.connect(this.engineMasterGain);

      // 1. Sub-Bass Levitation Hum
      this.subOsc = ctx.createOscillator();
      this.subOsc.frequency.value = 55;
      this.subGain = ctx.createGain();
      this.subGain.gain.value = 0.055;
      this.subOsc.connect(this.subGain);
      this.subGain.connect(this.engineFilter);

      // 2. Mid-Bass Core
      this.bodyOsc = ctx.createOscillator();
      this.bodyOsc.frequency.value = 110;
      this.bodyGain = ctx.createGain();
      this.bodyGain.gain.value = 0.032;
      this.bodyOsc.connect(this.bodyGain);
      this.bodyGain.connect(this.engineFilter);

      // 3. High-Speed Turbine Whir
      this.turbineOsc = ctx.createOscillator();
      this.turbineOsc.frequency.value = 220;
      this.turbineGain = ctx.createGain();
      this.turbineGain.gain.value = 0.01;
      this.turbineOsc.connect(this.turbineGain);
      this.turbineGain.connect(this.engineMasterGain);

      this.applyEngineOscillatorTypes();

      // 4. Aerodynamic Air-Rush / Slipstream Whoosh
      if (this.noiseBuffer) {
        this.windNode = ctx.createBufferSource();
        this.windNode.buffer = this.noiseBuffer;
        this.windNode.loop = true;

        this.windFilter = ctx.createBiquadFilter();
        this.windFilter.type = 'bandpass';
        this.windFilter.frequency.value = 260;
        this.windFilter.Q.value = 1.1;

        this.windGain = ctx.createGain();
        this.windGain.gain.value = 0.015;

        this.windNode.connect(this.windFilter);
        this.windFilter.connect(this.windGain);
        this.windGain.connect(this.engineMasterGain);
        this.windNode.start();
      }

      this.subOsc.start();
      this.bodyOsc.start();
      this.turbineOsc.start();
    } catch {
      // Ignore audio autoplay blocks
    }
  }

  public updateEngine(speedKmh: number, isBoosting: boolean, weatherIntensity = 0) {
    if (
      !this.ctx ||
      !this.subOsc ||
      !this.bodyOsc ||
      !this.turbineOsc ||
      !this.engineFilter ||
      !this.subGain ||
      !this.bodyGain ||
      !this.turbineGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    const norm = Math.min(1.35, Math.max(0, speedKmh / 1050));
    const boostAdd = isBoosting ? 0.22 : 0;

    // Preset-specific pitch & harmonic multipliers
    const pitchScale =
      this.sfxPreset === 'titan_heavy'
        ? 0.74
        : this.sfxPreset === 'crystalline_harmonic'
        ? 1.28
        : this.sfxPreset === 'arcade_synth'
        ? 1.12
        : 1.0;

    const harmonicRatio =
      this.sfxPreset === 'crystalline_harmonic'
        ? 2.75
        : this.sfxPreset === 'plasma_overdrive'
        ? 1.502
        : 1.995;

    const subFreq = (52 + norm * 48 + (isBoosting ? 14 : 0)) * pitchScale;
    const bodyFreq = subFreq * harmonicRatio;
    const turbineFreq =
      (195 + Math.pow(norm, 1.25) * 340 + (isBoosting ? 110 : 0)) * pitchScale;

    this.subOsc.frequency.setTargetAtTime(subFreq, now, 0.1);
    this.bodyOsc.frequency.setTargetAtTime(bodyFreq, now, 0.1);
    this.turbineOsc.frequency.setTargetAtTime(turbineFreq, now, 0.12);

    const filterCutoff =
      this.sfxPreset === 'plasma_overdrive'
        ? 280 + norm * 620 + (isBoosting ? 420 : 0)
        : 180 + norm * 380 + (isBoosting ? 240 : 0);

    this.engineFilter.frequency.setTargetAtTime(filterCutoff, now, 0.1);

    const activeScale = this.engineRunning && !this.muted ? 1 : 0;
    const subBoost = this.sfxPreset === 'titan_heavy' ? 1.35 : 1.0;
    const bodyScale =
      this.sfxPreset === 'arcade_synth' || this.sfxPreset === 'plasma_overdrive' ? 0.65 : 1.0;

    this.subGain.gain.setTargetAtTime(
      (0.045 + norm * 0.035) * subBoost * activeScale,
      now,
      0.08
    );
    this.bodyGain.gain.setTargetAtTime(
      (0.024 + norm * 0.025 + boostAdd * 0.02) * bodyScale * activeScale,
      now,
      0.08
    );
    this.turbineGain.gain.setTargetAtTime(
      (0.006 + norm * 0.022 + boostAdd * 0.018) * activeScale,
      now,
      0.1
    );

    if (this.windFilter && this.windGain) {
      const stormAirFreq = weatherIntensity * 320;
      const stormAirGain = weatherIntensity * 0.018;
      this.windFilter.frequency.setTargetAtTime(
        220 + norm * 780 + stormAirFreq + (isBoosting ? 380 : 0),
        now,
        0.12
      );
      this.windGain.gain.setTargetAtTime(
        (0.012 + norm * 0.048 + stormAirGain + boostAdd * 0.035) * activeScale,
        now,
        0.1
      );
    }
  }

  public stopEngine() {
    this.engineRunning = false;
    if (this.engineMasterGain && this.ctx) {
      this.engineMasterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.12);
    }
    this.musicMode = 'ambient';
    this.syncProThemePlayback();
    if (this.ctx) {
      this.startMusic('ambient');
    }
  }

  private getThemeBpm(): number {
    switch (this.musicTheme) {
      case 'pro_theme':
        return 174;
      case 'cyber_techno':
        return 136;
      case 'synthwave_outrun':
        return 124;
      case 'hyper_trance':
        return 140;
      case 'dark_electro':
        return 130;
      case 'liquid_dnb':
        return 172;
      default:
        return 132;
    }
  }

  /**
   * Starts or switches the main MP3 theme or procedural electronic soundtrack.
   */
  public startMusic(mode: 'ambient' | 'race') {
    this.musicMode = mode;
    this.syncProThemePlayback();

    const ctx = this.ensureContext();
    if (!ctx || !this.musicBusGain) return;

    if (this.musicTimer !== null) return;
    this.nextNoteTime = ctx.currentTime + 0.05;
    this.musicStep = 0;

    const scheduleLoop = () => {
      if (!this.ctx || this.musicMode === 'off') return;
      const bpm = this.getThemeBpm();
      const secondsPer16th = 60 / bpm / 4;
      while (this.nextNoteTime < this.ctx.currentTime + 0.18) {
        this.triggerMusicStep(this.musicStep, this.nextNoteTime, secondsPer16th);
        this.nextNoteTime += secondsPer16th;
        this.musicStep = (this.musicStep + 1) % 64;
      }
      this.musicTimer = window.setTimeout(scheduleLoop, 40);
    };

    scheduleLoop();
  }

  private triggerMusicStep(step: number, time: number, stepDur: number) {
    if (this.musicTheme === 'pro_theme') {
      this.syncProThemePlayback();
      return;
    }
    if (this.muted || this.musicVolume <= 0.01 || !this.ctx || !this.musicBusGain) return;

    switch (this.musicTheme) {
      case 'cyber_techno':
        this.stepCyberTechno(step, time, stepDur);
        break;
      case 'synthwave_outrun':
        this.stepSynthwaveOutrun(step, time, stepDur);
        break;
      case 'hyper_trance':
        this.stepHyperTrance(step, time, stepDur);
        break;
      case 'dark_electro':
        this.stepDarkElectro(step, time, stepDur);
        break;
      case 'liquid_dnb':
        this.stepLiquidDnb(step, time, stepDur);
        break;
    }
  }

  /**
   * THEME 1: CYBER TECHNO (136 BPM)
   * Driving 4x4 warehouse kick, resonant TB-303 acid bassline, syncopated minor chord stabs, crisp hats.
   */
  private stepCyberTechno(step: number, time: number, stepDur: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const isRace = this.musicMode === 'race';

    // Dark minor techno chord stabs on syncopated steps (0, 3, 6, 10, 14)
    const stabSteps = [0, 3, 6, 10, 14];
    if (stabSteps.includes(s)) {
      const chords = [
        [146.83, 220.0, 261.63, 349.23], // Dm7
        [130.81, 196.0, 246.94, 311.13], // Cm7
        [116.54, 174.61, 220.0, 277.18], // Bbm7
        [130.81, 196.0, 233.08, 329.63], // C7sus4
      ];
      const chord = chords[bar];
      for (const f of chord) {
        this.playMusicChordStab(f, time, stepDur * 1.6, isRace ? 0.022 : 0.015, 'sawtooth', 950);
      }
    }

    // 16th Acid 303 Bassline
    const acidPattern = [
      73.42, 73.42, 146.83, 73.42, 87.31, 73.42, 110.0, 73.42,
      73.42, 146.83, 130.81, 73.42, 87.31, 110.0, 146.83, 174.61,
    ];
    const barShift = bar === 2 ? 0.8909 : bar === 3 ? 0.9438 : 1.0;
    const acidFreq = acidPattern[s] * barShift;
    const accent = s === 0 || s === 2 || s === 6 || s === 9 || s === 14;
    this.playAcidBass(
      acidFreq,
      time,
      stepDur * 0.92,
      isRace ? (accent ? 0.068 : 0.045) : 0.026,
      accent ? 1850 : 680
    );

    if (isRace) {
      // 4x4 Warehouse Kick
      if (s % 4 === 0) {
        this.playMusicKick(time, 0.13, 135, 38);
      }
      // Clap/Snare on 4 & 12
      if (s === 4 || s === 12) {
        this.playMusicSnare(time, 0.045, 0.12);
      }
      // Off-beat open hi-hat (2, 6, 10, 14) + 16th ghost shaker
      if (s % 4 === 2) {
        this.playMusicHat(time, 0.036, 0.11, 5200);
      } else if (s % 2 === 1) {
        this.playMusicHat(time, 0.014, 0.04, 7200);
      }
    }
  }

  /**
   * THEME 2: NEON SYNTHWAVE (124 BPM)
   * Lush analog pads, rolling octave bassline, gated 80s snare, soaring Outrun arpeggio lead.
   */
  private stepSynthwaveOutrun(step: number, time: number, stepDur: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const isRace = this.musicMode === 'race';

    // Warm Chorus Pad on beat 0 of each bar (Am -> Fmaj7 -> C -> G)
    if (s === 0) {
      const padChords = [
        [220.0, 261.63, 329.63, 392.0], // Am7
        [174.61, 220.0, 261.63, 329.63], // Fmaj7
        [130.81, 196.0, 246.94, 329.63], // Cmaj7
        [196.0, 246.94, 293.66, 392.0], // G6
      ];
      for (const f of padChords[bar]) {
        this.playMusicPadNote(f, time, stepDur * 16, 0.024, 'sawtooth');
      }
    }

    // Soaring Outrun Lead Arpeggio
    const arpScale = [
      [440.0, 523.25, 659.25, 783.99, 880.0, 783.99, 659.25, 523.25],
      [349.23, 440.0, 523.25, 659.25, 880.0, 659.25, 523.25, 440.0],
      [392.0, 523.25, 659.25, 783.99, 1046.5, 783.99, 659.25, 523.25],
      [392.0, 493.88, 587.33, 783.99, 987.77, 783.99, 587.33, 493.88],
    ];
    if (s % 2 === 0) {
      const leadFreq = arpScale[bar][(s >> 1) % 8];
      this.playMusicPluck(leadFreq, time, stepDur * 2.2, isRace ? 0.036 : 0.024, 'sawtooth', true);
    }

    // Rolling 16th Octave Synthwave Bass
    if (isRace) {
      const roots = [55.0, 43.65, 65.41, 49.0]; // A1, F1, C2, G1
      const r = roots[bar];
      const bassFreq = s % 2 === 0 ? r : r * 2;
      this.playAcidBass(bassFreq, time, stepDur * 0.9, 0.058, 580);

      if (s % 4 === 0) {
        this.playMusicKick(time, 0.11, 118, 42);
      }
      if (s === 4 || s === 12) {
        // Gated 80s Reverb Snare
        this.playMusicSnare(time, 0.055, 0.22);
      }
      if (s % 2 === 0) {
        this.playMusicHat(time, 0.018, 0.05, 6200);
      }
    }
  }

  /**
   * THEME 3: HYPER TRANCE (140 BPM)
   * Euphoric high-velocity supersaw plucks, rolling triplet/offbeat bass, uplifting progression.
   */
  private stepHyperTrance(step: number, time: number, stepDur: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const isRace = this.musicMode === 'race';

    // F#m -> D -> A -> E progression
    const tranceChords = [
      [185.0, 220.0, 277.18, 369.99], // F#m
      [146.83, 220.0, 293.66, 369.99], // Dmaj7
      [220.0, 277.18, 329.63, 440.0], // A
      [164.81, 246.94, 329.63, 415.3], // E
    ];

    // Rhythmic Trance Gate Pluck Chords on steps 0, 3, 6, 8, 11, 14
    if ([0, 3, 6, 8, 11, 14].includes(s)) {
      for (const f of tranceChords[bar]) {
        this.playMusicChordStab(f, time, stepDur * 1.8, isRace ? 0.022 : 0.016, 'sawtooth', 1650);
      }
    }

    // High Euphoric Trance Lead Hook
    const leadArp = [
      739.99, 880.0, 1108.73, 880.0, 987.77, 880.0, 739.99, 659.25,
      739.99, 880.0, 1108.73, 1318.5, 1108.73, 987.77, 880.0, 739.99,
    ];
    this.playMusicPluck(
      leadArp[s],
      time,
      stepDur * 1.5,
      isRace ? 0.028 : 0.018,
      'triangle',
      true
    );

    if (isRace) {
      const bassRoots = [46.25, 73.42, 55.0, 82.41]; // F#1, D2, A1, E2
      // Off-beat rolling trance bass (steps 1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15)
      if (s % 4 !== 0) {
        const bFreq = s % 4 === 2 ? bassRoots[bar] * 2 : bassRoots[bar];
        this.playAcidBass(bFreq, time, stepDur * 0.85, 0.06, 920);
      }
      if (s % 4 === 0) {
        this.playMusicKick(time, 0.125, 130, 44);
      }
      if (s === 4 || s === 12) {
        this.playMusicSnare(time, 0.04, 0.14);
      }
      if (s % 4 === 2) {
        this.playMusicHat(time, 0.038, 0.12, 5800);
      }
    }
  }

  /**
   * THEME 4: DARK ELECTRO / CYBERPUNK INDUSTRIAL (130 BPM)
   * Syncopated electro breakbeat, aggressive Phrygian sawtooth bass growl, razor synth hooks.
   */
  private stepDarkElectro(step: number, time: number, stepDur: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const isRace = this.musicMode === 'race';

    // Aggressive E Phrygian Dominant Bass Riff (E, F, G#, A, B, C, D)
    const electroRiff = [
      41.2, 41.2, 82.41, 43.65, 41.2, 51.91, 55.0, 41.2,
      41.2, 82.41, 61.74, 55.0, 51.91, 43.65, 41.2, 82.41,
    ];
    const freq = electroRiff[s] * (bar === 3 ? 1.122 : 1.0);
    this.playAcidBass(
      freq,
      time,
      stepDur * 0.95,
      isRace ? 0.072 : 0.035,
      s % 3 === 0 ? 2100 : 750
    );

    // Cyberpunk Brass/Lead Hook on steps 0, 6, 10, 12
    if ([0, 6, 10, 12].includes(s)) {
      const hookNotes = [329.63, 349.23, 415.3, 440.0];
      const note = hookNotes[(bar + (s >> 2)) % 4];
      this.playMusicChordStab(note, time, stepDur * 2.4, 0.032, 'sawtooth', 1800);
      this.playMusicChordStab(note * 1.5, time, stepDur * 2.4, 0.022, 'sawtooth', 1800);
    }

    if (isRace) {
      // Syncopated Electro Kick (steps 0, 3, 6, 10)
      if (s === 0 || s === 3 || s === 6 || s === 10) {
        this.playMusicKick(time, 0.135, 140, 36);
      }
      // Hard Industrial Snare on 4 & 12 (+ fill on 15 in bar 3)
      if (s === 4 || s === 12 || (bar === 3 && s === 15)) {
        this.playMusicSnare(time, 0.065, 0.16);
      }
      // Metallic 16th Electro Hats
      if (s % 2 === 0) {
        this.playMusicHat(time, 0.025, 0.06, 4800);
      }
    }
  }

  /**
   * THEME 5: LIQUID DRUM & BASS (172 BPM)
   * High-velocity two-step breakbeat (kick on 0 & 10, snare on 4 & 12), deep warm sub-glide, liquid pads & bells.
   */
  private stepLiquidDnb(step: number, time: number, stepDur: number) {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const isRace = this.musicMode === 'race';

    // Lush Liquid DnB Chords (Fm9 -> Dbmaj7 -> Bbm7 -> C7sus4)
    if (s === 0) {
      const dnbChords = [
        [174.61, 207.65, 261.63, 311.13, 392.0], // Fm9
        [138.59, 174.61, 207.65, 261.63, 349.23], // Dbmaj7
        [116.54, 174.61, 207.65, 277.18, 349.23], // Bbm7
        [130.81, 174.61, 196.0, 233.08, 311.13], // C7sus4
      ];
      for (const f of dnbChords[bar]) {
        this.playMusicPadNote(f, time, stepDur * 16, 0.02, 'triangle');
      }
    }

    // Crystalline Liquid Bell Melody
    if (s % 2 === 0) {
      const bellNotes = [
        [523.25, 622.25, 783.99, 698.46, 523.25, 622.25, 880.0, 783.99],
        [415.3, 523.25, 698.46, 622.25, 523.25, 415.3, 698.46, 622.25],
        [466.16, 523.25, 698.46, 622.25, 523.25, 466.16, 783.99, 698.46],
        [523.25, 587.33, 698.46, 783.99, 880.0, 783.99, 698.46, 587.33],
      ];
      const note = bellNotes[bar][(s >> 1) % 8];
      this.playMusicPluck(note, time, stepDur * 2.5, 0.028, 'sine', true);
    }

    if (isRace) {
      // Deep Reese / Sub-Bass Glide on steps 0, 6, 10
      if (s === 0 || s === 6 || s === 10) {
        const subRoots = [43.65, 69.3, 58.27, 65.41]; // F1, Db2, Bb1, C2
        this.playAcidBass(subRoots[bar], time, stepDur * 5.2, 0.075, 320);
      }

      // Authentic Two-Step DnB Breakbeat: Kick on 0 & 10, Snare on 4 & 12
      if (s === 0 || s === 10) {
        this.playMusicKick(time, 0.125, 132, 44);
      }
      if (s === 4 || s === 12) {
        this.playMusicSnare(time, 0.06, 0.11);
      }
      // Fast 16th Rolling Breakbeat Shakers
      this.playMusicHat(time, s % 2 === 0 ? 0.024 : 0.014, 0.04, 6800);
    }
  }

  private playMusicPadNote(
    freq: number,
    time: number,
    dur: number,
    peakGain: number,
    type: OscillatorType = 'triangle'
  ) {
    if (!this.ctx || !this.musicBusGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(620, time);
      filter.frequency.linearRampToValueAtTime(1250, time + dur * 0.5);
      filter.frequency.linearRampToValueAtTime(520, time + dur);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peakGain, time + dur * 0.25);
      gain.gain.linearRampToValueAtTime(0.0001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBusGain);

      osc.start(time);
      osc.stop(time + dur + 0.05);
    } catch {
      // Ignore
    }
  }

  private playMusicChordStab(
    freq: number,
    time: number,
    dur: number,
    peakGain: number,
    type: OscillatorType,
    cutoff: number
  ) {
    if (!this.ctx || !this.musicBusGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.Q.value = 2.4;
      filter.frequency.setValueAtTime(cutoff, time);
      filter.frequency.exponentialRampToValueAtTime(260, time + dur);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peakGain, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBusGain);
      if (this.musicDelay) {
        gain.connect(this.musicDelay);
      }

      osc.start(time);
      osc.stop(time + dur + 0.02);
    } catch {
      // Ignore
    }
  }

  private playMusicPluck(
    freq: number,
    time: number,
    dur: number,
    peakGain: number,
    type: OscillatorType = 'sine',
    useEcho = true
  ) {
    if (!this.ctx || !this.musicBusGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, time);
      filter.frequency.exponentialRampToValueAtTime(480, time + dur);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(peakGain, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBusGain);
      if (useEcho && this.musicDelay) {
        gain.connect(this.musicDelay);
      }

      osc.start(time);
      osc.stop(time + dur + 0.02);
    } catch {
      // Ignore
    }
  }

  private playAcidBass(
    freq: number,
    time: number,
    dur: number,
    peakGain: number,
    cutoffPeak: number
  ) {
    if (!this.ctx || !this.musicBusGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.Q.value = 3.6;
      filter.frequency.setValueAtTime(cutoffPeak, time);
      filter.frequency.exponentialRampToValueAtTime(110, time + dur);

      gain.gain.setValueAtTime(0.001, time);
      gain.gain.linearRampToValueAtTime(peakGain, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBusGain);

      osc.start(time);
      osc.stop(time + dur + 0.02);
    } catch {
      // Ignore
    }
  }

  private playMusicKick(time: number, peakGain: number, startFreq = 130, endFreq = 40) {
    if (!this.ctx || !this.musicBusGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startFreq, time);
      osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.14);

      gain.gain.setValueAtTime(peakGain, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

      osc.connect(gain);
      gain.connect(this.musicBusGain);
      osc.start(time);
      osc.stop(time + 0.18);
    } catch {
      // Ignore
    }
  }

  private playMusicSnare(time: number, peakGain: number, dur = 0.14) {
    if (!this.ctx || !this.musicBusGain || !this.noiseBuffer) return;
    try {
      // Tone body
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(195, time);
      osc.frequency.exponentialRampToValueAtTime(95, time + 0.08);
      oscGain.gain.setValueAtTime(peakGain * 0.7, time);
      oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.09);
      osc.connect(oscGain);
      oscGain.connect(this.musicBusGain);
      osc.start(time);
      osc.stop(time + 0.1);

      // Crisp snare wires
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 2400;
      filter.Q.value = 0.9;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(peakGain, time);
      gain.gain.exponentialRampToValueAtTime(0.0008, time + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBusGain);
      src.start(time);
      src.stop(time + dur + 0.02);
    } catch {
      // Ignore
    }
  }

  private playMusicHat(time: number, peakGain: number, dur = 0.06, hpFreq = 5800) {
    if (!this.ctx || !this.musicBusGain || !this.noiseBuffer) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = hpFreq;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(peakGain, time);
      gain.gain.exponentialRampToValueAtTime(0.0005, time + dur);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBusGain);
      src.start(time);
      src.stop(time + dur + 0.01);
    } catch {
      // Ignore
    }
  }

  // ============================================================================
  // SOUND FX SYNTHESIS ENGINE (WITH 5 DISTINCT SFX PRESETS)
  // ============================================================================

  private getPresetWaveform(): OscillatorType {
    switch (this.sfxPreset) {
      case 'plasma_overdrive':
        return 'sawtooth';
      case 'arcade_synth':
        return 'square';
      case 'titan_heavy':
        return 'triangle';
      case 'crystalline_harmonic':
      case 'quantum_clean':
      default:
        return 'sine';
    }
  }

  private getPresetPitchMult(): number {
    switch (this.sfxPreset) {
      case 'titan_heavy':
        return 0.72;
      case 'crystalline_harmonic':
        return 1.32;
      case 'arcade_synth':
        return 1.15;
      case 'plasma_overdrive':
        return 1.05;
      case 'quantum_clean':
      default:
        return 1.0;
    }
  }

  private playSfxNote(
    freq: number,
    time: number,
    dur: number,
    peakGain: number,
    useEcho = false,
    overrideType?: OscillatorType
  ) {
    if (!this.ctx || !this.sfxBusGain) return;
    try {
      const adjFreq = freq * this.getPresetPitchMult();
      const waveType = overrideType || this.getPresetWaveform();
      const gainScale =
        waveType === 'square' || waveType === 'sawtooth' ? peakGain * 0.62 : peakGain;

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = waveType;
      osc.frequency.setValueAtTime(adjFreq, time);

      if (this.sfxPreset === 'arcade_synth') {
        // Quick retro pitch arpeggio blip
        osc.frequency.setValueAtTime(adjFreq * 0.85, time);
        osc.frequency.setValueAtTime(adjFreq, time + 0.025);
      } else if (this.sfxPreset === 'plasma_overdrive') {
        osc.frequency.exponentialRampToValueAtTime(adjFreq * 1.08, time + dur * 0.5);
      }

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(
        this.sfxPreset === 'plasma_overdrive' ? 3200 : 2600,
        time
      );
      filter.frequency.exponentialRampToValueAtTime(420, time + dur);

      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.linearRampToValueAtTime(gainScale, time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxBusGain);
      if (useEcho && this.sfxDelay) {
        gain.connect(this.sfxDelay);
      }

      osc.start(time);
      osc.stop(time + dur + 0.02);

      // Crystalline FM bell overtone layer
      if (this.sfxPreset === 'crystalline_harmonic') {
        const bellOsc = this.ctx.createOscillator();
        const bellGain = this.ctx.createGain();
        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(adjFreq * 2.756, time);
        bellGain.gain.setValueAtTime(0.0001, time);
        bellGain.gain.linearRampToValueAtTime(gainScale * 0.42, time + 0.008);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.75);
        bellOsc.connect(bellGain);
        bellGain.connect(this.sfxBusGain);
        bellOsc.start(time);
        bellOsc.stop(time + dur);
      }
    } catch {
      // Ignore
    }
  }

  private playSfxSubImpact(freq: number, time: number, dur: number, peakGain: number) {
    if (!this.ctx || !this.sfxBusGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = this.sfxPreset === 'plasma_overdrive' ? 'sawtooth' : 'sine';
      const mult = this.sfxPreset === 'titan_heavy' ? 0.8 : 1.0;
      osc.frequency.setValueAtTime(freq * mult, time);
      osc.frequency.exponentialRampToValueAtTime(36 * mult, time + dur);

      const g = this.sfxPreset === 'titan_heavy' ? peakGain * 1.3 : peakGain;
      gain.gain.setValueAtTime(g, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

      osc.connect(gain);
      gain.connect(this.sfxBusGain);
      osc.start(time);
      osc.stop(time + dur + 0.02);
    } catch {
      // Ignore
    }
  }

  /**
   * Speaks a phrase in a futuristic electronic announcer voice.
   */
  public speakElectronic(text: string, pitch = 0.86, rate = 1.04) {
    if (this.muted || this.sfxVolume <= 0.01 || typeof window === 'undefined') return;
    const ctx = this.ensureContext();

    if (ctx && this.sfxBusGain) {
      const now = ctx.currentTime;
      this.playSfxNote(293.66, now, 0.22, 0.035, true);
      this.playSfxNote(440.0, now + 0.04, 0.26, 0.03, true);
    }

    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const preferred =
          voices.find(
            (v) =>
              /en/i.test(v.lang) &&
              /Google|Samantha|Daniel|Alex|Victoria|Microsoft/i.test(v.name)
          ) || voices.find((v) => /en/i.test(v.lang));
        if (preferred) {
          utter.voice = preferred;
        }
        utter.pitch = pitch;
        utter.rate = rate;
        utter.volume = Math.min(1, this.sfxVolume * 0.95);
        window.speechSynthesis.speak(utter);
      } catch {
        // Ignore if blocked
      }
    }
  }

  public announceCircuitIntro(trackId: TrackId) {
    const sectorText =
      trackId === 'city'
        ? 'Welcome to Neo-Metropolis Sector 4 Mark 2. Wet neon skyway active. Anti-gravity turbines online.'
        : trackId === 'city_v1'
        ? 'Welcome to Neo-Metropolis Sector 4. Rain squall detected. Anti-gravity turbines online.'
        : trackId === 'lava_v2'
        ? 'Welcome to Obsidian Rift Mark 2. Textured basalt sector active. Plasma thrusters online.'
        : 'Welcome to Caldera Prime Surge. Volcanic ash storm active. Geothermal viaduct online.';
    this.speakElectronic(sectorText, 0.85, 1.04);
  }

  public playPreCountdownLock() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    this.playSfxSubImpact(95, now, 0.38, 0.085);
    this.playSfxNote(220.0, now, 0.35, 0.055, true);
    this.playSfxNote(293.66, now + 0.14, 0.4, 0.065, true);
  }

  public playBoostPad() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    this.playSfxSubImpact(115, now, 0.28, 0.09);
    this.playSfxNote(293.66, now, 0.28, 0.09, true);
    this.playSfxNote(440.0, now + 0.04, 0.3, 0.085, true);
    this.playSfxNote(587.33, now + 0.08, 0.34, 0.08, true);

    if (this.noiseBuffer) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.Q.value = this.sfxPreset === 'plasma_overdrive' ? 3.2 : 1.8;
        filter.frequency.setValueAtTime(320, now);
        filter.frequency.exponentialRampToValueAtTime(1850, now + 0.28);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxBusGain);
        src.start(now);
        src.stop(now + 0.34);
      } catch {
        // Ignore
      }
    }
  }

  public playRingPass(chain: number, isOrange: boolean) {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    const scale = [587.33, 698.46, 783.99, 880.0, 1046.5, 1174.66];
    const root = scale[Math.min(scale.length - 1, Math.max(0, chain - 1))];
    const fifth = root * 1.498;

    this.playSfxNote(root, now, 0.32, 0.095, true);
    this.playSfxNote(fifth, now + 0.045, 0.36, 0.075, true);
    if (isOrange) {
      this.playSfxNote(root * 2, now + 0.09, 0.4, 0.065, true);
    }
  }

  public playBonusActivate() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    this.playSfxSubImpact(125, now, 0.38, 0.12);
    const notes = [293.66, 349.23, 440.0, 587.33, 880.0];
    notes.forEach((f, idx) => {
      this.playSfxNote(f, now + idx * 0.035, 0.45, 0.075, true);
    });
  }

  public playWallHit() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;
    this.playSfxSubImpact(120, now, 0.16, 0.12);
    if (this.sfxPreset === 'arcade_synth' || this.sfxPreset === 'plasma_overdrive') {
      this.playSfxNote(145, now, 0.12, 0.065, false);
    }
  }

  public playVehicleCollision(intensity = 0.7) {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;
    const scale = Math.max(0.35, Math.min(1.0, intensity));

    this.playSfxSubImpact(135, now, 0.22, 0.14 * scale);
    this.playSfxNote(185.0, now, 0.18, 0.075 * scale, true);
    this.playSfxNote(277.18, now + 0.015, 0.22, 0.06 * scale, true);
  }

  public playCountdown(num: number) {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    if (num === 3) {
      this.playSfxSubImpact(110, now, 0.35, 0.13);
      this.playSfxNote(293.66, now, 0.38, 0.11, true);
      this.playSfxNote(440.0, now + 0.02, 0.36, 0.085, true);
      this.playSfxNote(587.33, now + 0.04, 0.4, 0.08, true);
      this.speakElectronic('Three!', 0.82, 1.08);
    } else if (num === 2) {
      this.playSfxSubImpact(120, now, 0.35, 0.14);
      this.playSfxNote(349.23, now, 0.38, 0.115, true);
      this.playSfxNote(523.25, now + 0.02, 0.36, 0.09, true);
      this.playSfxNote(698.46, now + 0.04, 0.4, 0.085, true);
      this.speakElectronic('Two!', 0.88, 1.08);
    } else if (num === 1) {
      this.playSfxSubImpact(130, now, 0.38, 0.15);
      this.playSfxNote(440.0, now, 0.4, 0.12, true);
      this.playSfxNote(659.25, now + 0.02, 0.38, 0.095, true);
      this.playSfxNote(880.0, now + 0.04, 0.44, 0.09, true);
      this.speakElectronic('One!', 0.94, 1.08);
    } else if (num === 0) {
      this.playSfxSubImpact(146.83, now, 0.55, 0.17);
      this.playSfxNote(587.33, now, 0.65, 0.13, true);
      this.playSfxNote(739.99, now + 0.025, 0.65, 0.11, true);
      this.playSfxNote(880.0, now + 0.05, 0.7, 0.115, true);
      this.playSfxNote(1174.66, now + 0.075, 0.75, 0.11, true);
      this.speakElectronic('Engage!', 0.98, 1.08);
    }
  }

  public playLapComplete(finalLap: boolean) {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    const arpeggio = finalLap
      ? [587.33, 739.99, 880.0, 1174.66]
      : [440.0, 523.25, 659.25, 880.0];
    arpeggio.forEach((f, idx) => {
      this.playSfxNote(f, now + idx * 0.06, 0.42, 0.09, true);
    });

    if (finalLap) {
      this.speakElectronic('Circuit complete. Well done, pilot.', 0.88, 1.04);
    }
  }

  public playWeaponFire(weapon: ActiveWeaponId) {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    if (weapon === 'missile') {
      // Tactical lock-on chirp + rocket ignition whoosh
      this.playSfxNote(880, now, 0.09, 0.09, false, 'square');
      this.playSfxNote(1318.5, now + 0.07, 0.11, 0.095, true, 'square');
      this.playSfxSubImpact(140, now + 0.05, 0.35, 0.14);
      if (this.noiseBuffer) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(480, now);
          filter.frequency.exponentialRampToValueAtTime(2200, now + 0.38);
          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
          src.connect(filter);
          filter.connect(gain);
          gain.connect(this.sfxBusGain);
          src.start(now);
          src.stop(now + 0.44);
        } catch {
          // Ignore
        }
      }
    } else if (weapon === 'laser') {
      // High-energy coherent beam discharge
      this.playSfxSubImpact(165, now, 0.42, 0.12);
      this.playSfxNote(1046.5, now, 0.55, 0.095, true, 'sawtooth');
      this.playSfxNote(1567.98, now + 0.03, 0.65, 0.08, true, 'sawtooth');
    } else if (weapon === 'shockwave') {
      // Radial EMP bass detonation + harmonic ring sweep
      this.playSfxSubImpact(190, now, 0.55, 0.19);
      this.playSfxNote(220, now, 0.48, 0.11, true, 'sawtooth');
      this.playSfxNote(440, now + 0.04, 0.52, 0.095, true, 'triangle');
      this.playSfxNote(880, now + 0.08, 0.56, 0.08, true, 'sine');
    } else if (weapon === 'mines') {
      // Metallic rear deployment clunk + armed proximity beacon beep
      this.playSfxSubImpact(125, now, 0.22, 0.13);
      this.playSfxNote(523.25, now + 0.04, 0.14, 0.085, false, 'triangle');
      this.playSfxNote(783.99, now + 0.12, 0.18, 0.09, true, 'sine');
    }
  }

  public playWeaponHit() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    this.playSfxSubImpact(155, now, 0.34, 0.17);
    this.playSfxNote(196.0, now, 0.24, 0.1, true, 'sawtooth');
    this.playSfxNote(138.59, now + 0.04, 0.28, 0.09, true, 'square');
  }

  public playShieldDeflect() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    this.playSfxNote(659.25, now, 0.24, 0.09, true, 'sine');
    this.playSfxNote(987.77, now + 0.03, 0.28, 0.085, true, 'triangle');
    this.playSfxNote(1318.5, now + 0.06, 0.32, 0.08, true, 'sine');
  }

  public playVehicleExplosion() {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBusGain) return;
    const now = ctx.currentTime;

    // Massive multi-stage sub-bass detonation + filtered noise blast
    this.playSfxSubImpact(210, now, 0.85, 0.26);
    this.playSfxSubImpact(115, now + 0.12, 0.95, 0.24);
    this.playSfxNote(146.83, now, 0.55, 0.14, true, 'sawtooth');
    this.playSfxNote(98.0, now + 0.08, 0.68, 0.13, true, 'sawtooth');

    if (this.noiseBuffer) {
      try {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1600, now);
        filter.frequency.exponentialRampToValueAtTime(140, now + 1.05);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxBusGain);
        src.start(now);
        src.stop(now + 1.15);
      } catch {
        // Ignore
      }
    }
  }
}

export const audioEngine = new AeroAudioEngine();

