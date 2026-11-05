const KEY = 'kk-life-sound';
let enabled = false;
try { enabled = localStorage.getItem(KEY) === '1'; } catch { /* Device settings can be unavailable. */ }
let context;
export const soundEnabled = () => enabled;
export function toggleSound() { enabled = !enabled; try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch { /* Session-only sound is still usable. */ } if (enabled) play('confirm'); return enabled; }
export function play(type = 'step') {
  if (!enabled) return;
  try {
    context ||= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state === 'suspended') context.resume();
    const notes = type === 'confirm' ? [440, 554, 659] : type === 'finish' ? [392, 494, 587, 784] : type === 'spin' ? [330, 440] : [340];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = context.currentTime + index * .09;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.055, at + .012); gain.gain.exponentialRampToValueAtTime(.001, at + .14);
      oscillator.connect(gain); gain.connect(context.destination); oscillator.start(at); oscillator.stop(at + .16);
    });
  } catch { /* Sound is optional when Web Audio is unavailable. */ }
}
