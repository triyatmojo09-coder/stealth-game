// SHADOW PROTOCOL — procedural sound effects.
// One job: every sound the game makes, synthesized with WebAudio. No audio
// files, no network: oscillators and filtered noise, created on first input.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.lastStep = 0;
  }

  // Browsers only allow audio after a user gesture; call this from input.
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone(freq, dur, type, gain, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(gain || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur, gain, filterFreq) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 800;
    const g = this.ctx.createGain();
    g.gain.value = gain || 0.05;
    src.connect(filter).connect(g).connect(this.ctx.destination);
    src.start(t);
  }

  // Soft footstep; sneaking steps are quieter and lower. Throttled by caller.
  step(sneaking) {
    const now = performance.now();
    if (now - this.lastStep < (sneaking ? 320 : 240)) return;
    this.lastStep = now;
    this.noise(0.07, sneaking ? 0.015 : 0.035, sneaking ? 300 : 500);
  }

  coin() {
    this.tone(2100, 0.09, 'triangle', 0.06);
    this.tone(2800, 0.12, 'triangle', 0.05);
  }

  coinLand() {
    this.tone(1400, 0.05, 'square', 0.04);
    this.noise(0.05, 0.03, 3000);
  }

  pickup() {
    this.tone(660, 0.1, 'sine', 0.07);
    setTimeout(() => this.tone(990, 0.14, 'sine', 0.07), 90);
  }

  intel() {
    [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.16, 'sine', 0.08), i * 100));
  }

  door() {
    this.noise(0.35, 0.05, 400);
    this.tone(180, 0.3, 'sawtooth', 0.02, 320);
  }

  alert() {
    this.tone(220, 0.16, 'square', 0.07);
    setTimeout(() => this.tone(330, 0.2, 'square', 0.07), 140);
  }

  alarm() {
    this.tone(440, 0.14, 'sawtooth', 0.06, 620);
    setTimeout(() => this.tone(440, 0.14, 'sawtooth', 0.06, 620), 180);
  }

  takedown() {
    this.noise(0.18, 0.09, 250);
    this.tone(140, 0.2, 'sine', 0.08, 60);
  }

  caught() {
    [392, 311, 233].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sawtooth', 0.07), i * 160));
  }

  win() {
    [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, 'triangle', 0.08), i * 110));
  }
}
