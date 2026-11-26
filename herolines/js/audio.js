'use strict';
// ============================================================================
//  Tiny procedural sound engine (Web Audio). No asset files required.
// ============================================================================
const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  let enabled = true;
  const last = {};
  try { enabled = localStorage.getItem('lb_sound') !== 'off'; } catch (e) { /* ignore */ }

  function unlock() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.5;
    const comp = ac.createDynamicsCompressor();
    master.connect(comp); comp.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(type, f0, f1, dur, vol, delay = 0) {
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.01, vol, dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, filt, f0, f1, delay = 0, q = 1) {
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = filt; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ac.createGain(); env(g, t, 0.005, vol, dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const S = {
    swing: () => noise(0.12, 0.18, 'bandpass', 1800, 600, 0, 2),
    shoot_arrow: () => { noise(0.08, 0.15, 'highpass', 3000, 1500); tone('triangle', 900, 500, 0.06, 0.05); },
    shoot_flame: () => noise(0.18, 0.15, 'lowpass', 1200, 300),
    shoot_ice: () => tone('sine', 1800, 900, 0.12, 0.07),
    kill: () => tone('square', 220, 90, 0.08, 0.04),
    bossdeath: () => { noise(0.8, 0.4, 'lowpass', 600, 60); tone('sawtooth', 120, 40, 0.8, 0.15); },
    income: () => { tone('sine', 1320, 0, 0.12, 0.12); tone('sine', 1760, 0, 0.18, 0.1, 0.07); },
    buy: () => { tone('triangle', 880, 0, 0.08, 0.1); tone('triangle', 1320, 0, 0.12, 0.1, 0.06); },
    send: () => { noise(0.25, 0.15, 'bandpass', 400, 1600, 0, 1.5); tone('triangle', 330, 660, 0.18, 0.06); },
    levelup: () => [523, 659, 784, 1046].forEach((f, i) => tone('triangle', f, 0, 0.25, 0.12, i * 0.08)),
    leak: () => { tone('sawtooth', 200, 70, 0.4, 0.15); tone('square', 150, 60, 0.4, 0.06, 0.05); },
    wave: () => { tone('sawtooth', 147, 0, 0.6, 0.1); tone('sawtooth', 220, 0, 0.6, 0.06, 0.15); },
    bosswave: () => { tone('sawtooth', 98, 0, 1.0, 0.16); tone('sawtooth', 147, 0, 1.0, 0.1, 0.2); noise(1, 0.15, 'lowpass', 200, 80); },
    herodeath: () => { tone('sawtooth', 300, 60, 0.9, 0.15); noise(0.6, 0.2, 'lowpass', 800, 100); },
    potion: () => { for (let i = 0; i < 4; i++) tone('sine', 500 + i * 180, 900 + i * 180, 0.08, 0.06, i * 0.05); },
    boom: () => { noise(0.6, 0.45, 'lowpass', 900, 60); tone('sine', 90, 30, 0.5, 0.3); },
    erupt: () => { noise(0.9, 0.5, 'lowpass', 500, 40); tone('sine', 60, 25, 0.8, 0.4); },
    ice: () => { noise(0.4, 0.18, 'highpass', 5000, 2000); tone('sine', 2400, 1200, 0.3, 0.05); },
    zap: () => { noise(0.2, 0.25, 'bandpass', 3000, 800, 0, 4); tone('sawtooth', 1200, 200, 0.15, 0.05); },
    arrowrain: () => noise(0.2, 0.1, 'highpass', 4000, 2500),
    thunderslam: () => { noise(0.5, 0.45, 'lowpass', 700, 50); tone('sine', 80, 30, 0.4, 0.4); },
    bulwark: () => { tone('triangle', 440, 880, 0.3, 0.12); tone('sine', 660, 0, 0.4, 0.06, 0.1); },
    earthsplitter: () => noise(0.7, 0.3, 'lowpass', 300, 100),
    shadowstep: () => { noise(0.3, 0.25, 'bandpass', 2500, 300, 0, 3); },
    bladefury: () => { for (let i = 0; i < 6; i++) noise(0.1, 0.15, 'bandpass', 2000, 800, i * 0.5, 2); },
    phantom: () => tone('sawtooth', 200, 800, 0.4, 0.08),
    piercing: () => { noise(0.25, 0.25, 'highpass', 2000, 6000); tone('triangle', 1200, 300, 0.25, 0.08); },
    frosttrap: () => noise(0.15, 0.1, 'highpass', 3000, 1500),
    arrowstorm: () => noise(0.5, 0.2, 'highpass', 2000, 5000),
    fireball: () => noise(0.35, 0.25, 'lowpass', 2000, 400),
    flamewave: () => noise(0.7, 0.35, 'bandpass', 600, 200, 0, 0.7),
    meteor: () => tone('sawtooth', 800, 100, 1.2, 0.08),
    frostnova: () => { noise(0.5, 0.3, 'highpass', 6000, 1500); tone('sine', 1600, 400, 0.4, 0.08); },
    blizzard: () => noise(1.2, 0.18, 'highpass', 3000, 6000),
    glacial: () => { noise(1, 0.4, 'highpass', 8000, 800); tone('sine', 220, 110, 1, 0.2); },
    bloodwhirl: () => { noise(0.35, 0.3, 'bandpass', 900, 2500, 0, 2); tone('sawtooth', 180, 90, 0.3, 0.08); },
    frenzy: () => { tone('sawtooth', 110, 220, 0.4, 0.12); noise(0.4, 0.2, 'bandpass', 500, 900, 0, 2); },
    rampage: () => { tone('sawtooth', 80, 160, 0.8, 0.2); noise(0.8, 0.3, 'lowpass', 600, 200); },
  };

  function play(name) {
    if (!enabled || !ac || !S[name]) return;
    const now = performance.now();
    if (last[name] && now - last[name] < 60) return;
    last[name] = now;
    try { S[name](); } catch (e) { /* ignore */ }
  }
  function setEnabled(v) {
    enabled = v;
    try { localStorage.setItem('lb_sound', v ? 'on' : 'off'); } catch (e) { /* ignore */ }
  }
  return { unlock, play, setEnabled, get enabled() { return enabled; } };
})();
