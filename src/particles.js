// ─── 粒子特效系统 ────────────────────────────────────────

class Particle {
  constructor(wx, wy, vx, vy, color, size, life, gravity = 0, fade = true) {
    this.wx = wx; this.wy = wy;   // 世界像素坐标
    this.vx = vx; this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.gravity = gravity;
    this.fade = fade;
  }

  update(dt) {
    this.wx += this.vx * dt;
    this.wy += this.vy * dt;
    this.vy += this.gravity * dt;
    this.vx *= (1 - dt * 3);
    this.life -= dt;
  }

  get alpha() { return this.fade ? Math.max(0, this.life / this.maxLife) : 1; }
  get alive() { return this.life > 0; }
}

class DamageNumber {
  constructor(wx, wy, text, color) {
    this.wx = wx; this.wy = wy;
    this.text = text;
    this.color = color;
    this.life = 0.9;
    this.maxLife = 0.9;
    this.vy = -60;
  }

  update(dt) {
    this.wy += this.vy * dt;
    this.vy += dt * 30;
    this.life -= dt;
  }

  get alive() { return this.life > 0; }
  get alpha() { return Math.min(1, this.life / this.maxLife * 2); }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
    this.damageNums = [];
  }

  // 世界瓦片坐标 → 世界像素坐标（瓦片中心）
  _tc(tx, ty) {
    return {
      x: (tx + 0.5) * TILE_SIZE,
      y: (ty + 0.5) * TILE_SIZE,
    };
  }

  emit(type, tx, ty, opts = {}) {
    const { x, y } = this._tc(tx, ty);
    const ots = opts.offsetX || 0;
    const oty = opts.offsetY || 0;
    switch (type) {
      case 'blood':    this._blood(x + ots, y + oty); break;
      case 'death':    this._death(x + ots, y + oty, opts.color); break;
      case 'magic':    this._magic(x + ots, y + oty); break;
      case 'gold':     this._gold(x + ots, y + oty); break;
      case 'levelup':  this._levelup(x + ots, y + oty); break;
      case 'fire':     this._fire(x + ots, y + oty); break;
      case 'ice':      this._ice(x + ots, y + oty); break;
      case 'poison':   this._poison(x + ots, y + oty); break;
      case 'dust':     this._dust(x + ots, y + oty); break;
      case 'sparks':   this._sparks(x + ots, y + oty); break;
      case 'heal':     this._heal(x + ots, y + oty); break;
      case 'boss':     this._boss(x + ots, y + oty, opts.color); break;
    }
  }

  addDamage(tx, ty, amount, crit = false, type = 'phys') {
    const { x, y } = this._tc(tx, ty);
    const color = crit ? '#ffff40' :
                  type === 'fire'   ? '#ff8020' :
                  type === 'ice'    ? '#80d0ff' :
                  type === 'poison' ? '#40e040' : '#ff4040';
    const text = crit ? `${amount}!` : `${amount}`;
    this.damageNums.push(new DamageNumber(x, y - 8, text, color));
  }

  addText(tx, ty, text, color = '#ffffff') {
    const { x, y } = this._tc(tx, ty);
    this.damageNums.push(new DamageNumber(x, y - 8, text, color));
  }

  _burst(wx, wy, count, colors, speedMin, speedMax, sizeMin, sizeMax, life, gravity = 60) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randInt(speedMin, speedMax);
      this.particles.push(new Particle(
        wx, wy,
        Math.cos(angle) * speed, Math.sin(angle) * speed,
        randChoice(colors), randInt(sizeMin, sizeMax),
        life * (0.5 + Math.random() * 0.5),
        gravity
      ));
    }
  }

  _blood(wx, wy) {
    this._burst(wx, wy, randInt(5, 10),
      ['#c02020', '#e03030', '#901010', '#ff2020'],
      30, 90, 2, 4, 0.5, 80);
  }

  _death(wx, wy, color) {
    const base = color || '#e04040';
    this._burst(wx, wy, randInt(14, 22),
      [base, '#ffffff', '#ffff40', '#ff8040'],
      50, 140, 3, 6, 0.8, 60);
    // 额外的向上漂浮粒子
    for (let i = 0; i < 6; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI;
      const speed = randInt(20, 50);
      this.particles.push(new Particle(
        wx, wy, Math.cos(angle) * speed, Math.sin(angle) * speed - 40,
        '#ffffff', randInt(2, 4), 0.6, -20
      ));
    }
  }

  _magic(wx, wy) {
    this._burst(wx, wy, randInt(8, 14),
      ['#d0a0ff', '#a060ff', '#8040d0', '#ffffff', '#ff80ff'],
      20, 70, 2, 4, 0.6, -20);
  }

  _gold(wx, wy) {
    this._burst(wx, wy, randInt(4, 8),
      ['#f0c040', '#ffd060', '#ffaa20'],
      20, 55, 2, 4, 0.5, 60);
  }

  _levelup(wx, wy) {
    const count = 35;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const speed = randInt(80, 180);
      this.particles.push(new Particle(
        wx, wy,
        Math.cos(angle) * speed, Math.sin(angle) * speed - 30,
        randChoice(['#f0c040', '#ffffff', '#80c0ff', '#ff80ff', '#80ff80']),
        randInt(3, 6), randInt(8, 14) * 0.1, 30
      ));
    }
    // 向上的星星
    for (let i = 0; i < 12; i++) {
      this.particles.push(new Particle(
        wx + (Math.random() - 0.5) * 40, wy,
        (Math.random() - 0.5) * 30, -randInt(60, 120),
        randChoice(['#f0c040', '#ffffff']),
        randInt(2, 4), 1.0, -30
      ));
    }
  }

  _fire(wx, wy) {
    for (let i = 0; i < randInt(8, 14); i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
      const speed = randInt(40, 100);
      this.particles.push(new Particle(
        wx, wy,
        Math.cos(angle) * speed * 0.5, -speed,
        randChoice(['#ff4000', '#ff8000', '#ffff00', '#ff2000', '#ff6000']),
        randInt(2, 5), randInt(3, 7) * 0.1, -80
      ));
    }
  }

  _ice(wx, wy) {
    this._burst(wx, wy, randInt(8, 14),
      ['#80d0ff', '#c0e8ff', '#ffffff', '#4090c0', '#a0d0ff'],
      25, 70, 2, 4, 0.4, 0);
  }

  _poison(wx, wy) {
    this._burst(wx, wy, randInt(5, 10),
      ['#40c040', '#20a020', '#60d060', '#80ff80'],
      15, 45, 2, 3, 0.6, 20);
  }

  _dust(wx, wy) {
    this._burst(wx, wy, randInt(2, 5),
      ['#6a6060', '#504848', '#7a7070'],
      5, 25, 1, 2, 0.25, 0);
  }

  _sparks(wx, wy) {
    this._burst(wx, wy, randInt(5, 10),
      ['#ffffaa', '#ffffff', '#ffdd40', '#ffaa00'],
      45, 110, 1, 3, 0.3, 100);
  }

  _heal(wx, wy) {
    for (let i = 0; i < 10; i++) {
      const x = wx + (Math.random() - 0.5) * 20;
      const y = wy + (Math.random() - 0.5) * 20;
      this.particles.push(new Particle(
        x, y, (Math.random() - 0.5) * 20, -randInt(30, 60),
        randChoice(['#40ff80', '#80ff80', '#20c060']),
        randInt(2, 4), 0.7, -20
      ));
    }
  }

  _boss(wx, wy, color) {
    const base = color || '#e04040';
    this._burst(wx, wy, 40,
      [base, '#ffffff', '#ffff00', '#ff8000'],
      80, 200, 3, 8, 1.2, 50);
  }

  update(dt) {
    for (const p of this.particles) p.update(dt);
    this.particles = this.particles.filter(p => p.alive);
    for (const d of this.damageNums) d.update(dt);
    this.damageNums = this.damageNums.filter(d => d.alive);
  }

  render(ctx, camX, camY) {
    // 渲染粒子
    for (const p of this.particles) {
      const sx = p.wx - camX * TILE_SIZE;
      const sy = p.wy - camY * TILE_SIZE;
      if (sx < -10 || sy < -10 || sx > 1000 || sy > 1000) continue;
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(sx - p.size / 2, sy - p.size / 2, p.size, p.size);
    }

    // 渲染伤害数字
    for (const d of this.damageNums) {
      const sx = d.wx - camX * TILE_SIZE;
      const sy = d.wy - camY * TILE_SIZE;
      if (sx < -50 || sy < -50 || sx > 1000 || sy > 1000) continue;
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = d.color;
      const sz = d.text.includes('!') ? 14 : 11;
      ctx.font = `bold ${sz}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(d.text, sx, sy);
    }

    ctx.globalAlpha = 1;
  }
}

// 全局粒子实例（game.js 初始化时赋值）
let Particles = null;
