/**
 * Audio.
 *
 * Sound effects are synthesised with WebAudio so the game ships with a full
 * mix and zero audio files. The moment `assets/manifest.json` lists a real
 * sample for an id, that sample plays instead — same swap rule as the art.
 *
 * Music works the same way: a stage with a generated track in the manifest
 * plays it; a stage without one gets a quiet procedural drone so the scene is
 * never silent.
 */

import { assets } from './assets';

type SfxId =
  | 'hit1' | 'hit2' | 'hit3' | 'slash' | 'block' | 'break' | 'whoosh' | 'cast'
  | 'thunder' | 'ice' | 'blizzard' | 'quake' | 'wave' | 'beam' | 'super'
  | 'ko' | 'land' | 'landHard' | 'thud' | 'grab' | 'throw' | 'clash' | 'shot'
  | 'spit' | 'drain' | 'heal' | 'buff' | 'root' | 'warp'
  | 'pickupHeal' | 'pickupMana' | 'pickupWeapon'
  | 'uiMove' | 'uiSelect' | 'uiBack';

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private music: HTMLAudioElement | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  /** Guards against a hundred identical hits stacking into clipping. */
  private lastPlayed = new Map<string, number>();

  muted = false;
  sfxVolume = 0.7;
  musicVolume = 0.45;

  /** Must be called from a user gesture — browsers require it. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);

    // One second of white noise, reused by every percussive effect.
    const len = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
    if (this.music) this.music.volume = m ? 0 : this.musicVolume;
  }

  // -- music ---------------------------------------------------------------

  playMusic(stageId: string): void {
    const url = assets.musicUrl(stageId);
    this.stopMusic();
    if (!url) return;
    const el = new Audio(url);
    el.loop = true;
    el.volume = this.muted ? 0 : this.musicVolume;
    el.play().catch(() => {
      // Autoplay blocked; the next unlock() call will retry.
    });
    this.music = el;
  }

  stopMusic(): void {
    if (!this.music) return;
    this.music.pause();
    this.music.currentTime = 0;
    this.music = null;
  }

  // -- sfx -----------------------------------------------------------------

  play(id: string): void {
    if (!this.ctx || !this.sfxBus || this.muted) return;
    const now = this.ctx.currentTime;
    const last = this.lastPlayed.get(id) ?? -1;
    if (now - last < 0.035) return;
    this.lastPlayed.set(id, now);

    const url = assets.sfxUrl(id);
    if (url) {
      void this.playSample(url);
      return;
    }
    this.synth(id as SfxId, now);
  }

  private async playSample(url: string): Promise<void> {
    if (!this.ctx || !this.sfxBus) return;
    let buf = this.buffers.get(url);
    if (!buf) {
      try {
        const res = await fetch(url);
        buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
        this.buffers.set(url, buf);
      } catch {
        return;
      }
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.sfxBus);
    src.start();
  }

  /** Percussive noise hit: the backbone of every impact sound. */
  private noise(t: number, dur: number, gain: number, filterHz: number, q = 1): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuffer) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(filterHz, t);
    filter.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Pitched body: gives an impact its weight and an effect its identity. */
  private tone(
    t: number,
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
  ): void {
    if (!this.ctx || !this.sfxBus) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private synth(id: SfxId, t: number): void {
    switch (id) {
      case 'hit1':
        this.noise(t, 0.08, 0.5, 1400, 0.9);
        this.tone(t, 'square', 220, 80, 0.09, 0.16);
        break;
      case 'hit2':
        this.noise(t, 0.13, 0.65, 900, 0.8);
        this.tone(t, 'square', 180, 55, 0.15, 0.24);
        break;
      case 'hit3':
        this.noise(t, 0.22, 0.8, 620, 0.7);
        this.tone(t, 'sawtooth', 150, 38, 0.26, 0.3);
        this.tone(t + 0.01, 'sine', 90, 40, 0.3, 0.22);
        break;
      case 'slash':
        this.noise(t, 0.09, 0.42, 3600, 3);
        this.tone(t, 'triangle', 1500, 500, 0.08, 0.08);
        break;
      case 'block':
        this.noise(t, 0.06, 0.4, 2600, 4);
        this.tone(t, 'square', 420, 260, 0.07, 0.1);
        break;
      case 'break':
        this.noise(t, 0.3, 0.6, 1800, 1.4);
        this.tone(t, 'sawtooth', 500, 90, 0.32, 0.2);
        break;
      case 'whoosh':
        this.noise(t, 0.16, 0.28, 900, 0.6);
        break;
      case 'cast':
        this.tone(t, 'sine', 320, 900, 0.2, 0.16);
        this.tone(t + 0.02, 'triangle', 640, 1500, 0.18, 0.09);
        break;
      case 'shot':
        this.tone(t, 'square', 1200, 320, 0.09, 0.12);
        this.noise(t, 0.05, 0.22, 3000, 2);
        break;
      case 'thunder':
        this.noise(t, 0.42, 0.75, 2400, 0.5);
        this.noise(t + 0.03, 0.5, 0.55, 400, 0.4);
        this.tone(t, 'sawtooth', 700, 60, 0.4, 0.2);
        break;
      case 'ice':
        this.tone(t, 'triangle', 2400, 900, 0.2, 0.12);
        this.noise(t, 0.24, 0.34, 5200, 4);
        break;
      case 'blizzard':
        this.noise(t, 0.9, 0.34, 2600, 0.5);
        break;
      case 'quake':
        this.tone(t, 'sine', 70, 26, 0.55, 0.38);
        this.noise(t, 0.4, 0.5, 220, 0.5);
        break;
      case 'wave':
        this.noise(t, 0.55, 0.4, 700, 0.5);
        this.tone(t, 'sine', 200, 70, 0.5, 0.18);
        break;
      case 'beam':
        this.tone(t, 'sawtooth', 180, 320, 0.7, 0.2);
        this.tone(t, 'sine', 900, 1300, 0.7, 0.1);
        this.noise(t, 0.7, 0.24, 2600, 0.7);
        break;
      case 'super':
        this.tone(t, 'sawtooth', 120, 620, 0.5, 0.22);
        this.tone(t + 0.06, 'square', 300, 1200, 0.45, 0.12);
        this.noise(t + 0.2, 0.4, 0.4, 1800, 0.6);
        break;
      case 'ko':
        this.noise(t, 0.35, 0.75, 700, 0.5);
        this.tone(t, 'sawtooth', 320, 40, 0.5, 0.3);
        break;
      case 'land':
        this.noise(t, 0.08, 0.28, 500, 0.7);
        break;
      case 'landHard':
      case 'thud':
        this.noise(t, 0.16, 0.5, 260, 0.6);
        this.tone(t, 'sine', 120, 44, 0.2, 0.24);
        break;
      case 'grab':
        this.noise(t, 0.06, 0.3, 1200, 1.2);
        break;
      case 'throw':
        this.noise(t, 0.2, 0.4, 800, 0.6);
        this.tone(t, 'square', 300, 90, 0.2, 0.18);
        break;
      case 'clash':
        this.noise(t, 0.24, 0.6, 3200, 2.4);
        this.tone(t, 'triangle', 1800, 600, 0.22, 0.14);
        break;
      case 'spit':
        this.noise(t, 0.12, 0.3, 1600, 1.6);
        break;
      case 'drain':
        this.tone(t, 'sine', 120, 420, 0.6, 0.14);
        break;
      case 'heal':
      case 'pickupHeal':
        this.tone(t, 'sine', 620, 980, 0.22, 0.16);
        this.tone(t + 0.08, 'sine', 980, 1320, 0.22, 0.12);
        break;
      case 'pickupMana':
        this.tone(t, 'triangle', 500, 1100, 0.24, 0.14);
        break;
      case 'pickupWeapon':
        this.tone(t, 'square', 900, 620, 0.12, 0.1);
        break;
      case 'buff':
        this.tone(t, 'sawtooth', 180, 520, 0.4, 0.16);
        break;
      case 'root':
        this.noise(t, 0.3, 0.4, 380, 0.7);
        break;
      case 'warp':
        this.tone(t, 'sine', 1200, 180, 0.22, 0.14);
        this.noise(t, 0.14, 0.24, 2200, 1.4);
        break;
      case 'uiMove':
        this.tone(t, 'square', 720, 720, 0.05, 0.07);
        break;
      case 'uiSelect':
        this.tone(t, 'square', 620, 1240, 0.12, 0.1);
        break;
      case 'uiBack':
        this.tone(t, 'square', 620, 320, 0.12, 0.08);
        break;
      default:
        this.noise(t, 0.06, 0.25, 1200, 1);
        break;
    }
  }
}

export const audio = new AudioEngine();
