// Device-only preferences. No audio files, and no AudioContext until a gesture.
export class LoungeAudio {
  context = null;
  enabled = true;
  volume = .7;
  voices = 0;
  lastPin = 0;
  constructor() {
    try {
      const stored = JSON.parse(localStorage.getItem('kk-lounge-audio'));
      if (stored) {
        this.enabled = stored.enabled !== false;
        this.volume = Math.max(0, Math.min(1, Number(stored.volume) || 0));
      }
    } catch { /* Defaults also work in private mode. */ }
  }
  save() {
    try { localStorage.setItem('kk-lounge-audio', JSON.stringify({ enabled: this.enabled, volume: this.volume })); } catch {}
  }
  async unlock() {
    if (!this.enabled) return;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!this.context) {
      this.context = new Audio();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 5;
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
  }
  set(enabled, volume) {
    this.enabled = enabled;
    this.volume = volume;
    this.master?.gain.setTargetAtTime(enabled ? volume : 0, this.context.currentTime, .025);
    this.save();
  }
  tone(freq, duration = .12, amplitude = .2, delay = 0, type = 'sine', pan = 0) {
    const ctx = this.context;
    if (!this.enabled || !ctx || ctx.state !== 'running' || this.voices >= 18) return;
    this.voices++;
    const time = ctx.currentTime + delay, osc = ctx.createOscillator(), gain = ctx.createGain();
    const stereo = ctx.createStereoPanner();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * .78, time + duration);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(amplitude, time + .003);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    stereo.pan.value = Math.max(-.7, Math.min(.7, pan));
    osc.connect(gain); gain.connect(stereo); stereo.connect(this.master);
    osc.start(time); osc.stop(time + duration + .02);
    osc.onended = () => { this.voices--; osc.disconnect(); gain.disconnect(); stereo.disconnect(); };
  }
  pin(row, strength, x) {
    if (!this.context || this.context.currentTime - this.lastPin < .024) return;
    this.lastPin = this.context.currentTime;
    const pitch = 880 * 2 ** (row / 24) * (1 + (Math.random() - .5) * .028);
    const amp = Math.min(.19, .035 + strength * .018);
    this.tone(pitch, .105, amp, 0, 'sine', (x - 300) / 350);
    this.tone(pitch * 2.01, .055, amp * .22, 0, 'sine', (x - 300) / 350);
  }
  ui() { this.tone(620, .05, .07); }
  drop() { this.tone(410, .1, .13); this.tone(820, .08, .06, .025); }
  land(multiplier) {
    this.tone(230, .12, .15);
    if (multiplier > 1) [659, 830, 988, 1318].forEach((f, i) => this.tone(f, .28, .12, i * .075));
    else if (multiplier >= 1) [523, 659].forEach((f, i) => this.tone(f, .18, .1, i * .065));
    else this.tone(440, .16, .07, .04);
  }
  claim() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, .24, .13, i * .06)); }
}
