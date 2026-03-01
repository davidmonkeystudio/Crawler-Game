// ─── Web Audio 程序化音效引擎 ────────────────────────────

class AudioEngine {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this._init();
  }

  _init() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.3;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.0;
      this.sfxGain.connect(this.master);
      this.enabled = true;
    } catch (e) { /* AudioContext not available */ }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _t() { return this.ctx ? this.ctx.currentTime : 0; }

  _osc(freq, type, start, dur, gainVal, dest) {
    if (!this.enabled) return;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    g.connect(dest || this.sfxGain);
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.connect(g);
    osc.start(start);
    osc.stop(start + dur + 0.01);
    return osc;
  }

  _noise(start, dur, gainVal, hpFreq = 0, dest) {
    if (!this.enabled) return;
    const bufSize = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, start);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    if (hpFreq > 0) {
      const flt = this.ctx.createBiquadFilter();
      flt.type = 'highpass';
      flt.frequency.value = hpFreq;
      src.connect(flt);
      flt.connect(g);
    } else {
      src.connect(g);
    }
    g.connect(dest || this.sfxGain);
    src.start(start);
  }

  // ── 玩家攻击成功 ──
  playHit() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.15);
    this._noise(t, 0.05, 0.12, 800);
  }

  // ── 受到伤害 ──
  playPlayerHurt() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    this._osc(180, 'sine', t, 0.15, 0.2);
    this._noise(t, 0.08, 0.15, 200);
  }

  // ── 暴击 ──
  playCrit() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    this._osc(400, 'square', t, 0.05, 0.15);
    this._osc(600, 'sawtooth', t + 0.03, 0.08, 0.12);
    this._noise(t, 0.06, 0.2, 1200);
  }

  // ── 敌人死亡 ──
  playEnemyDeath() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(250, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.5);
    this._noise(t, 0.12, 0.1, 300);
  }

  // ── 玩家死亡 ──
  playPlayerDeath() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    [200, 150, 110, 80].forEach((freq, i) => {
      this._osc(freq, 'sawtooth', t + i * 0.18, 0.5, 0.1);
    });
    this._noise(t + 0.1, 0.3, 0.12, 100);
  }

  // ── 拾取物品 ──
  playPickup() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    [440, 554, 659].forEach((freq, i) => {
      this._osc(freq, 'sine', t + i * 0.07, 0.15, 0.08);
    });
  }

  // ── 拾取金币 ──
  playGold() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    [880, 1100, 1320].forEach((freq, i) => {
      this._osc(freq, 'sine', t + i * 0.04, 0.08, 0.05);
    });
  }

  // ── 升级 ──
  playLevelUp() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    const scale = [261.6, 329.6, 392, 523.3, 659.3, 783.9];
    scale.forEach((freq, i) => {
      this._osc(freq, 'sine', t + i * 0.09, 0.3, 0.09);
    });
    this._noise(t + 0.3, 0.1, 0.04, 2000);
  }

  // ── 脚步声 ──
  playStep() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    this._noise(t, 0.02, 0.025, 300);
  }

  // ── 下楼 ──
  playStairs() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    [220, 277, 330, 415, 494, 587, 698].forEach((freq, i) => {
      this._osc(freq, 'sine', t + i * 0.07, 0.2, 0.07);
    });
  }

  // ── 开宝箱 ──
  playChestOpen() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    [330, 415, 494, 587, 698, 880].forEach((freq, i) => {
      this._osc(freq, 'sine', t + i * 0.06, 0.25, 0.07);
    });
  }

  // ── 使用药水 ──
  playPotion() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    this._osc(440, 'sine', t, 0.08, 0.08);
    this._osc(660, 'sine', t + 0.06, 0.12, 0.07);
    this._osc(880, 'sine', t + 0.12, 0.08, 0.05);
  }

  // ── 踩陷阱 ──
  playTrap() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    this._noise(t, 0.15, 0.25, 0);
    this._osc(80, 'sawtooth', t, 0.2, 0.18);
  }

  // ── Boss 吼叫 ──
  playBossRoar() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, t);
    osc.frequency.setValueAtTime(70, t + 0.15);
    osc.frequency.setValueAtTime(45, t + 0.35);
    osc.frequency.setValueAtTime(30, t + 0.55);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.25, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.8);
    this._noise(t, 0.4, 0.1, 0);
  }

  // ── 魔法卷轴 ──
  playScroll() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(2640, t + 0.2);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    osc.connect(g); g.connect(this.sfxGain);
    osc.start(t); osc.stop(t + 0.3);
    this._noise(t + 0.05, 0.15, 0.04, 2000);
  }

  // ── 状态效果 ──
  playPoison() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    this._osc(110, 'sawtooth', t, 0.18, 0.06);
    this._osc(140, 'sawtooth', t + 0.06, 0.12, 0.04);
  }

  playFreeze() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    this._noise(t, 0.08, 0.06, 3000);
    this._osc(1200, 'sine', t, 0.12, 0.05);
    this._osc(900, 'sine', t + 0.06, 0.1, 0.03);
  }

  playBurn() {
    if (!this.enabled) return;
    this.resume();
    const t = this._t();
    this._noise(t, 0.12, 0.08, 800);
    this._osc(200, 'sawtooth', t, 0.1, 0.06);
  }
}

// 全局音频实例（game.js 初始化时赋值）
let Audio = null;
