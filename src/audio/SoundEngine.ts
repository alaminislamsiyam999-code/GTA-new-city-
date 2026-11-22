import { VehicleCategory, WeatherType } from '../types/game';

export const RADIO_STATIONS = [
  '98.4 Neon Pulse',
  '102.7 Bay Breeze',
  '106.1 Metro Bass',
  'Radio Off',
] as const;

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private skidNoiseNode: AudioBufferSourceNode | null = null;
  private skidFilter: BiquadFilterNode | null = null;
  private skidGain: GainNode | null = null;

  private rainGain: GainNode | null = null;
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private radioStep = 0;
  private radioTimer: number | null = null;
  private activeStationIdx = 0;
  private inVehicle = false;
  private isIndoor = false;

  private masterVol = 0.75;
  private musicVol = 0.45;
  private sfxVol = 0.8;

  public unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();

      this.masterGain.gain.value = this.masterVol;
      this.sfxGain.gain.value = this.sfxVol;
      this.musicGain.gain.value = this.musicVol;

      this.sfxGain.connect(this.masterGain);
      this.musicGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.createNoiseBuffer();
      this.setupContinuousNodes();
      this.startRadioLoop();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setVolumes(master: number, music: number, sfx: number): void {
    this.masterVol = master;
    this.musicVol = music;
    this.sfxVol = sfx;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(master, this.ctx.currentTime, 0.05);
    }
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05);
    }
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
    }
  }

  public getStationName(): string {
    return RADIO_STATIONS[this.activeStationIdx];
  }

  public nextRadioStation(): string {
    this.activeStationIdx = (this.activeStationIdx + 1) % RADIO_STATIONS.length;
    this.playUiClick(740);
    return this.getStationName();
  }

  public setIndoorAcoustics(indoor: boolean): void {
    this.isIndoor = indoor;
  }

  private createNoiseBuffer(): void {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const length = sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
  }

  private setupContinuousNodes(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;

    // Engine dual-oscillator synth
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';
    this.engineOsc1.frequency.value = 55;
    this.engineOsc2.frequency.value = 110;

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 260;
    this.engineGain.gain.value = 0;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // Tire skid loop
    this.skidNoiseNode = this.ctx.createBufferSource();
    this.skidNoiseNode.buffer = this.noiseBuffer;
    this.skidNoiseNode.loop = true;
    this.skidFilter = this.ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1350;
    this.skidFilter.Q.value = 4.5;
    this.skidGain = this.ctx.createGain();
    this.skidGain.gain.value = 0;

    this.skidNoiseNode.connect(this.skidFilter);
    this.skidFilter.connect(this.skidGain);
    this.skidGain.connect(this.sfxGain);
    this.skidNoiseNode.start();

    // Rain loop
    const rainSource = this.ctx.createBufferSource();
    rainSource.buffer = this.noiseBuffer;
    rainSource.loop = true;
    const rainFilter = this.ctx.createBiquadFilter();
    rainFilter.type = 'bandpass';
    rainFilter.frequency.value = 950;
    rainFilter.Q.value = 0.7;
    this.rainGain = this.ctx.createGain();
    this.rainGain.gain.value = 0;
    rainSource.connect(rainFilter);
    rainFilter.connect(this.rainGain);
    this.rainGain.connect(this.sfxGain);
    rainSource.start();

    // Police siren
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 650;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.sfxGain);
    this.sirenOsc.start();
  }

  public updateContinuous(params: {
    inVehicle: boolean;
    category: VehicleCategory;
    rpm: number; // 0..1
    skidIntensity: number; // 0..1
    weather: WeatherType;
    wantedLevel: number;
    nearestPoliceDist: number;
    paused: boolean;
  }): void {
    this.inVehicle = params.inVehicle && !params.paused;
    if (!this.ctx || !this.engineGain || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter) return;

    const now = this.ctx.currentTime;
    if (params.paused) {
      this.engineGain.gain.setTargetAtTime(0, now, 0.06);
      this.skidGain?.gain.setTargetAtTime(0, now, 0.06);
      this.sirenGain?.gain.setTargetAtTime(0, now, 0.06);
      this.rainGain?.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    if (params.inVehicle && params.category !== 'bicycle') {
      let baseFreq = 48;
      let maxFreq = 195;
      if (params.category === 'supercar' || params.category === 'sports') {
        baseFreq = 64;
        maxFreq = 270;
      } else if (params.category === 'motorcycle') {
        baseFreq = 78;
        maxFreq = 320;
      } else if (params.category === 'helicopter') {
        baseFreq = 32;
        maxFreq = 62;
      } else if (params.category === 'truck' || params.category === 'bus') {
        baseFreq = 36;
        maxFreq = 120;
      }
      const f1 = baseFreq + (maxFreq - baseFreq) * Math.min(1, Math.max(0.05, params.rpm));
      this.engineOsc1.frequency.setTargetAtTime(f1, now, 0.04);
      this.engineOsc2.frequency.setTargetAtTime(f1 * 1.5, now, 0.04);
      this.engineFilter.frequency.setTargetAtTime(220 + params.rpm * 950, now, 0.05);
      this.engineGain.gain.setTargetAtTime(0.11 + params.rpm * 0.09, now, 0.06);
    } else {
      this.engineGain.gain.setTargetAtTime(0, now, 0.08);
    }

    if (this.skidGain) {
      const skidVol = params.inVehicle ? Math.min(0.16, params.skidIntensity * 0.18) : 0;
      this.skidGain.gain.setTargetAtTime(skidVol, now, 0.04);
    }

    if (this.rainGain) {
      const outdoorFactor = this.isIndoor ? 0.22 : 1.0;
      const targetRain =
        params.weather === 'thunderstorm'
          ? 0.14 * outdoorFactor
          : params.weather === 'rain'
          ? 0.085 * outdoorFactor
          : 0;
      this.rainGain.gain.setTargetAtTime(targetRain, now, 0.25);
    }

    if (this.sirenGain && this.sirenOsc) {
      if (params.wantedLevel > 0 && params.nearestPoliceDist < 120) {
        const atten = Math.max(0, 1 - params.nearestPoliceDist / 120);
        const wail = 660 + Math.sin(now * 5.2) * 230;
        this.sirenOsc.frequency.setTargetAtTime(wail, now, 0.03);
        this.sirenGain.gain.setTargetAtTime(atten * 0.085 * (this.isIndoor ? 0.35 : 1), now, 0.08);
      } else {
        this.sirenGain.gain.setTargetAtTime(0, now, 0.1);
      }
    }
  }

  private startRadioLoop(): void {
    if (this.radioTimer !== null) return;
    const scales: Record<number, number[]> = {
      0: [110, 130.81, 146.83, 164.81, 196.0, 220, 261.63, 293.66], // Neon Pulse A-minor synthwave
      1: [130.81, 164.81, 196.0, 246.94, 261.63, 329.63, 392.0, 493.88], // Bay Breeze Cmaj7 chill
      2: [82.41, 98.0, 110.0, 123.47, 164.81, 196.0, 220.0, 246.94], // Metro Bass E-minor electro
    };

    this.radioTimer = window.setInterval(() => {
      if (!this.ctx || !this.musicGain) return;
      if (!this.inVehicle || this.activeStationIdx === 3) return;
      if (this.ctx.state !== 'running') return;

      const scale = scales[this.activeStationIdx] || scales[0];
      const step = this.radioStep % 16;
      this.radioStep++;

      const now = this.ctx.currentTime;

      // Bass note on 8th pulses
      if (step % 2 === 0) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        osc.type = this.activeStationIdx === 1 ? 'sine' : 'sawtooth';
        const bassIdx = step < 8 ? 0 : step < 12 ? 2 : 1;
        osc.frequency.setValueAtTime(scale[bassIdx] * 0.5, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(this.activeStationIdx === 2 ? 420 : 310, now);

        g.gain.setValueAtTime(0.14, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.21);

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.22);
      }

      // Lead arpeggio / chord pluck
      if (step % 3 === 0 || step === 7 || step === 14) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = this.activeStationIdx === 0 ? 'triangle' : 'sine';
        const note = scale[(step * 3 + this.activeStationIdx) % scale.length] * 2;
        osc.frequency.setValueAtTime(note, now);
        g.gain.setValueAtTime(0.065, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
        osc.connect(g);
        g.connect(this.musicGain);
        osc.start(now);
        osc.stop(now + 0.36);
      }
    }, 185);
  }

  public playFootstep(surface: 'concrete' | 'grass' | 'indoor'): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = surface === 'indoor' ? 'highpass' : 'bandpass';
    filter.frequency.value = surface === 'grass' ? 550 : surface === 'indoor' ? 1400 : 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(surface === 'indoor' ? 0.055 : 0.04, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.07);
  }

  public playHorn(isEmergency = false): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const freqs = isEmergency ? [620, 880] : [392, 493.88];
    freqs.forEach((f) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);
      g.gain.setValueAtTime(0.11, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  public playCollision(intensity = 0.6): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340 + intensity * 400, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(Math.min(0.32, 0.1 + intensity * 0.24), now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.28);
  }

  public playMelee(hit = false): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = hit ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(hit ? 175 : 260, now);
    osc.frequency.exponentialRampToValueAtTime(hit ? 52 : 90, now + 0.13);
    g.gain.setValueAtTime(hit ? 0.22 : 0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playDoor(open = true): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(open ? 220 : 300, now);
    osc.frequency.exponentialRampToValueAtTime(open ? 330 : 170, now + 0.14);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  public playElevatorDing(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [783.99, 1046.5].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      g.gain.setValueAtTime(0.12, now + idx * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.55);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.56);
    });
  }

  public playCashSound(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    [880, 1174.66, 1567.98].forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      g.gain.setValueAtTime(0.11, now + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.26);
    });
  }

  public playMissionFanfare(): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const chord = [523.25, 659.25, 783.99, 1046.5];
    chord.forEach((freq, idx) => {
      if (!this.ctx || !this.sfxGain) return;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      g.gain.setValueAtTime(0.14, now + idx * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.75);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.78);
    });
  }

  public playThunder(): void {
    if (!this.ctx || !this.sfxGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(190, now);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.28, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 1.45);
  }

  public playUiClick(pitch = 620): void {
    if (!this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    g.gain.setValueAtTime(0.06, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}
