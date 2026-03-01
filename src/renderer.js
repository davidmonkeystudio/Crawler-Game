// ─── 像素艺术渲染引擎 ────────────────────────────────────

const PALETTE = {
  wall: '#16121e', wallEdge: '#252035', wallMoss: '#1e2818', wallFog: '#0c0a10',
  floor: '#1e1a28', floorAlt: '#1a1622', floorStain: '#17141f', floorFog: '#0e0c12',
  stairsUp: '#40c0a0', stairsFog: '#1a5040',
  chest: '#d0a020', chestFog: '#503810',
  trap: '#c03020', trapFog: '#380810',
  torch: '#ff8020', water: '#2050a0',
  shrine: '#c0a0ff', shop: '#f0c040',
  player: '#60c8ff',
};

class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimap = minimapCanvas;
    this.mctx = minimapCanvas.getContext('2d');
    this.tileSize = TILE_SIZE;
    this.viewW = Math.floor(canvas.width / TILE_SIZE);
    this.viewH = Math.floor(canvas.height / TILE_SIZE);
    this.camX = 0; this.camY = 0;
    this.time = 0;
    this.shakeX = 0; this.shakeY = 0;
    this.shakeIntensity = 0; this.shakeDuration = 0; this.shakeTimer = 0;
    this.hitFlashTimer = 0; this.hitFlashColor = 'rgba(255,60,60,0.3)';
    this._tileRng = [];
    for (let i = 0; i < MAP_W * MAP_H; i++) this._tileRng.push(Math.random());
  }

  shake(intensity = 4, duration = 0.3) {
    this.shakeIntensity = intensity; this.shakeDuration = duration; this.shakeTimer = duration;
  }

  hitFlash(color = 'rgba(255,60,60,0.3)') {
    this.hitFlashTimer = 0.25; this.hitFlashColor = color;
  }

  updateCamera(player, dungeon) {
    this.camX = clamp(player.x - Math.floor(this.viewW / 2), 0, dungeon.width - this.viewW);
    this.camY = clamp(player.y - Math.floor(this.viewH / 2), 0, dungeon.height - this.viewH);
  }

  update(dt) {
    this.time += dt;
    if (this.shakeTimer > 0) {
      this.shakeTimer = Math.max(0, this.shakeTimer - dt);
      const s = this.shakeIntensity * (this.shakeTimer / Math.max(0.001, this.shakeDuration));
      this.shakeX = (Math.random() - 0.5) * s * 2;
      this.shakeY = (Math.random() - 0.5) * s * 2;
    } else { this.shakeX = 0; this.shakeY = 0; }
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
  }

  render(dungeon, player) {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = '#0a080e';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(Math.round(this.shakeX), Math.round(this.shakeY));
    const ts = this.tileSize, camX = this.camX, camY = this.camY;

    // ── 瓦片 ──
    for (let row = 0; row < this.viewH; row++) {
      for (let col = 0; col < this.viewW; col++) {
        const mx = camX + col, my = camY + row;
        if (mx < 0 || my < 0 || mx >= dungeon.width || my >= dungeon.height) continue;
        if (!dungeon.revealed[my][mx]) continue;
        const px = col * ts, py = row * ts;
        this.drawTile(ctx, dungeon.tiles[my][mx], px, py, ts,
          dungeon.visible[my][mx], dungeon.lightMap[my][mx],
          dungeon.tileVariant[my][mx], this._tileRng[my * MAP_W + mx]);
      }
    }

    // ── 地面物品 ──
    for (const io of dungeon.items) {
      if (!dungeon.visible[io.y]?.[io.x]) continue;
      const px = (io.x - camX) * ts, py = (io.y - camY) * ts;
      if (px < -ts || py < -ts || px > this.canvas.width + ts || py > this.canvas.height + ts) continue;
      this.drawGroundItem(ctx, io, px, py, ts);
    }

    // ── 敌人 ──
    for (const e of dungeon.entities) {
      if (!e.alive || !dungeon.visible[e.y]?.[e.x]) continue;
      const px = (e.x - camX) * ts, py = (e.y - camY) * ts;
      if (px < -ts || py < -ts || px > this.canvas.width + ts || py > this.canvas.height + ts) continue;
      this.drawEnemy(ctx, e, px, py, ts);
    }

    // ── 玩家 ──
    this.drawPlayer(ctx, player, (player.x - camX) * ts, (player.y - camY) * ts, ts);

    // ── 粒子 ──
    if (Particles) Particles.render(ctx, camX, camY);

    // ── 光照叠加 ──
    this.renderLightOverlay(ctx, dungeon, camX, camY, ts);

    // ── 受击红闪 ──
    if (this.hitFlashTimer > 0) {
      const alpha = this.hitFlashTimer / 0.25;
      ctx.fillStyle = `rgba(255,40,40,${alpha * 0.4})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // ── 边角暗晕 ──
    this.renderVignette(ctx);
    ctx.restore();

    this.renderMinimap(dungeon, player);
  }

  drawTile(ctx, type, px, py, ts, isVis, light, variant, rng) {
    switch (type) {
      case TILE.WALL: {
        ctx.fillStyle = isVis ? PALETTE.wall : PALETTE.wallFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVis && light > 0.2) {
          ctx.fillStyle = PALETTE.wallEdge;
          ctx.fillRect(px, py, ts, 2); ctx.fillRect(px, py, 2, ts);
          if (rng < 0.10) { // 苔藓
            ctx.fillStyle = PALETTE.wallMoss;
            ctx.fillRect(px + 3, py + 4, 3, 2); ctx.fillRect(px + 8, py + 6, 2, 3);
          } else if (rng < 0.20) { // 裂缝
            ctx.fillStyle = '#1a1520';
            ctx.fillRect(px + 5, py + 3, 1, 6); ctx.fillRect(px + 9, py + 8, 4, 1);
          }
        }
        break;
      }
      case TILE.FLOOR: {
        ctx.fillStyle = isVis ? (variant % 2 === 0 ? PALETTE.floor : PALETTE.floorAlt) : PALETTE.floorFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVis) {
          if (rng < 0.03) { ctx.fillStyle = PALETTE.floorStain; ctx.fillRect(px + 4, py + 4, 5, 4); }
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(px, py, ts, 1); ctx.fillRect(px, py, 1, ts);
        }
        break;
      }
      case TILE.STAIRS: {
        ctx.fillStyle = isVis ? PALETTE.floor : PALETTE.floorFog;
        ctx.fillRect(px, py, ts, ts);
        ctx.fillStyle = isVis ? PALETTE.stairsUp : PALETTE.stairsFog;
        ctx.fillRect(px + 2, py + ts - 4, ts - 4, 2);
        ctx.fillRect(px + 4, py + ts - 7, ts - 8, 2);
        ctx.fillRect(px + 6, py + ts - 10, ts - 12, 2);
        ctx.fillRect(px + 8, py + ts - 13, ts - 16, 2);
        if (isVis) {
          const grd = ctx.createRadialGradient(px+ts/2, py+ts/2, 0, px+ts/2, py+ts/2, ts);
          grd.addColorStop(0, 'rgba(64,192,160,0.25)'); grd.addColorStop(1, 'rgba(64,192,160,0)');
          ctx.fillStyle = grd; ctx.fillRect(px - ts/2, py - ts/2, ts * 2, ts * 2);
        }
        break;
      }
      case TILE.CHEST: {
        ctx.fillStyle = isVis ? PALETTE.floor : PALETTE.floorFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVis) {
          const pulse = Math.sin(this.time * 2.5) * 0.12 + 0.88;
          ctx.fillStyle = `rgba(180,130,15,${pulse})`;
          ctx.fillRect(px + 2, py + 6, ts - 4, ts - 9);
          ctx.fillStyle = '#c09010'; ctx.fillRect(px + 2, py + 6, ts - 4, 4);
          ctx.fillStyle = '#ffe060'; ctx.fillRect(px + 6, py + 8, 4, 3);
          ctx.fillStyle = '#ffa020'; ctx.fillRect(px + 7, py + 9, 2, 2);
          const grd = ctx.createRadialGradient(px+ts/2, py+ts/2, 0, px+ts/2, py+ts/2, ts);
          grd.addColorStop(0, `rgba(240,200,30,${0.18 * pulse})`); grd.addColorStop(1, 'rgba(240,160,0,0)');
          ctx.fillStyle = grd; ctx.fillRect(px - 4, py - 4, ts + 8, ts + 8);
        }
        break;
      }
      case TILE.TRAP: {
        ctx.fillStyle = isVis ? PALETTE.floor : PALETTE.floorFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVis) {
          ctx.fillStyle = PALETTE.trap; ctx.fillRect(px + 4, py + 4, 8, 8);
          ctx.fillStyle = '#ff6050'; ctx.fillRect(px + 6, py + 6, 4, 4);
          ctx.fillStyle = '#ff9080'; ctx.fillRect(px + 7, py + 7, 2, 2);
        }
        break;
      }
      case TILE.TORCH: {
        ctx.fillStyle = isVis ? PALETTE.wall : PALETTE.wallFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVis) {
          const flicker = Math.sin(this.time * 7 + rng * 10) * 0.25 + 0.75;
          ctx.fillStyle = '#605040'; ctx.fillRect(px + 6, py + 8, 4, 6);
          ctx.fillStyle = `rgba(255,${Math.floor(80 + 100*flicker)},0,${flicker})`;
          ctx.fillRect(px + 5, py + 3, 6, 6);
          ctx.fillStyle = `rgba(255,220,100,${flicker * 0.8})`; ctx.fillRect(px + 6, py + 4, 4, 4);
          ctx.fillStyle = `rgba(255,255,200,${flicker * 0.6})`; ctx.fillRect(px + 7, py + 5, 2, 2);
          const grd = ctx.createRadialGradient(px+ts/2, py+ts/2, 0, px+ts/2, py+ts/2, ts * 1.5);
          grd.addColorStop(0, `rgba(255,140,0,${0.12 * flicker})`); grd.addColorStop(1, 'rgba(255,100,0,0)');
          ctx.fillStyle = grd; ctx.fillRect(px - ts, py - ts, ts * 3, ts * 3);
        }
        break;
      }
      case TILE.SHRINE: {
        ctx.fillStyle = isVis ? PALETTE.floor : PALETTE.floorFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVis) {
          const pulse = Math.sin(this.time * 1.8) * 0.2 + 0.8;
          ctx.fillStyle = `rgba(192,160,255,${pulse})`; ctx.fillRect(px + 3, py + 2, 10, 12);
          ctx.fillStyle = `rgba(220,200,255,${pulse * 0.9})`; ctx.fillRect(px + 5, py + 4, 6, 8);
          ctx.fillStyle = `rgba(255,255,255,${pulse * 0.7})`; ctx.fillRect(px + 7, py + 6, 2, 4);
        }
        break;
      }
      case TILE.SHOP: {
        ctx.fillStyle = isVis ? PALETTE.floor : PALETTE.floorFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVis) {
          ctx.fillStyle = PALETTE.shop; ctx.fillRect(px + 2, py + 4, 12, 8);
          ctx.fillStyle = '#a07010'; ctx.fillRect(px + 2, py + 4, 12, 2);
          ctx.fillStyle = '#ffffff'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
          ctx.fillText('$', px + ts/2, py + 11);
        }
        break;
      }
      default: {
        ctx.fillStyle = PALETTE.wallFog; ctx.fillRect(px, py, ts, ts);
      }
    }
  }

  drawGroundItem(ctx, io, px, py, ts) {
    const item = io.item;
    const color = itemDisplayColor(item);
    const float = Math.sin(this.time * 3 + px * 0.1) * 1.5;
    const glow  = Math.sin(this.time * 4 + px * 0.2) * 0.2 + 0.8;

    if (io.isShop && io.price) {
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.fillRect(px, py + ts - 8, ts, 8);
      ctx.fillStyle = '#f0c040'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
      ctx.fillText(`${io.price}g`, px + ts/2, py + ts - 1);
    }

    ctx.globalAlpha = glow;
    ctx.fillStyle = color;
    const fy = float;

    if (item.type === 'weapon') {
      ctx.fillRect(px + ts/2 - 1, py + 3 + fy, 2, 10);
      ctx.fillRect(px + 4, py + 6 + fy, 8, 2);
    } else if (item.type === 'armor') {
      ctx.fillRect(px + 4, py + 4 + fy, 8, 8); ctx.fillRect(px + 5, py + 12 + fy, 6, 2);
    } else if (item.type === 'potion') {
      ctx.fillRect(px + 6, py + 3 + fy, 4, 2);
      ctx.fillRect(px + 4, py + 5 + fy, 8, 7);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(px + 5, py + 6 + fy, 2, 3);
      ctx.fillStyle = color;
    } else if (item.type === 'scroll') {
      ctx.fillStyle = '#d4b060'; ctx.fillRect(px + 4, py + 4 + fy, 8, 9);
      ctx.fillStyle = '#c09040';
      ctx.fillRect(px + 3, py + 4 + fy, 1, 9); ctx.fillRect(px + 12, py + 4 + fy, 1, 9);
      ctx.fillStyle = '#804020';
      ctx.fillRect(px + 5, py + 6 + fy, 6, 1); ctx.fillRect(px + 5, py + 8 + fy, 6, 1);
    } else if (item.type === 'gold') {
      ctx.beginPath(); ctx.arc(px + ts/2, py + ts/2 + fy, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe080'; ctx.fillRect(px + ts/2 - 1, py + ts/2 - 1 + fy, 2, 2);
    } else {
      const cx = px + ts/2, cy = py + ts/2 + fy, r = 5;
      ctx.beginPath(); ctx.moveTo(cx, cy-r); ctx.lineTo(cx+r, cy); ctx.lineTo(cx, cy+r); ctx.lineTo(cx-r, cy); ctx.closePath(); ctx.fill();
    }

    if (item.rarity === 'LEGENDARY') {
      const g = ctx.createRadialGradient(px+ts/2, py+ts/2, 0, px+ts/2, py+ts/2, ts);
      g.addColorStop(0, 'rgba(240,160,32,0.28)'); g.addColorStop(1, 'rgba(240,160,32,0)');
      ctx.fillStyle = g; ctx.fillRect(px - 4, py - 4, ts + 8, ts + 8);
    } else if (item.rarity === 'EPIC') {
      const g = ctx.createRadialGradient(px+ts/2, py+ts/2, 0, px+ts/2, py+ts/2, ts * 0.8);
      g.addColorStop(0, 'rgba(192,64,240,0.18)'); g.addColorStop(1, 'rgba(192,64,240,0)');
      ctx.fillStyle = g; ctx.fillRect(px - 4, py - 4, ts + 8, ts + 8);
    }
    ctx.globalAlpha = 1;
  }

  drawEnemy(ctx, enemy, px, py, ts) {
    if (enemy.hitFlash > 0) {
      enemy.hitFlash = Math.max(0, enemy.hitFlash - 0.016);
      if (Math.floor(enemy.hitFlash * 20) % 2 === 0) ctx.globalAlpha = 0.35;
    }
    if (enemy.sleeping) ctx.globalAlpha = Math.min(ctx.globalAlpha, 0.45);

    // 状态光晕
    if (enemy.statuses) {
      if (enemy.statuses.poison?.turns > 0) { ctx.fillStyle = 'rgba(64,192,64,0.18)'; ctx.fillRect(px, py, ts, ts); }
      if (enemy.statuses.burn?.turns > 0)   { ctx.fillStyle = 'rgba(255,120,0,0.18)';  ctx.fillRect(px, py, ts, ts); }
      if (enemy.statuses.freeze?.turns > 0) { ctx.fillStyle = 'rgba(128,200,255,0.32)'; ctx.fillRect(px, py, ts, ts); }
    }

    this._drawEnemySprite(ctx, enemy, px, py, ts);

    if (enemy.hp < enemy.maxHp) {
      const bw = ts - 2, ratio = enemy.hp / enemy.maxHp;
      ctx.fillStyle = '#300'; ctx.fillRect(px + 1, py - 4, bw, 3);
      ctx.fillStyle = ratio > 0.6 ? '#0c0' : ratio > 0.3 ? '#cc0' : '#c00';
      ctx.fillRect(px + 1, py - 4, Math.round(bw * ratio), 3);
      if (enemy.isBoss) {
        ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
        ctx.fillText('BOSS', px + ts/2, py - 5);
      }
    }

    if (enemy.sleeping) {
      ctx.globalAlpha = 0.8; ctx.fillStyle = '#a0a0ff';
      ctx.font = 'bold 8px monospace'; ctx.textAlign = 'left';
      ctx.fillText('z', px + ts - 5, py + 4);
    }
    ctx.globalAlpha = 1;
  }

  _drawEnemySprite(ctx, enemy, px, py, ts) {
    const t = this.time;
    const bob = Math.sin(t * 3 + enemy.x * 1.3) * 0.5;
    const c = enemy.color;
    switch (enemy.id) {
      case 'bat':
        ctx.fillStyle = c;
        ctx.fillRect(px+2, py+5+bob, 4, 3); ctx.fillRect(px+10, py+5+bob, 4, 3);
        ctx.fillRect(px+5, py+6+bob, 6, 5);
        ctx.fillStyle='#ff4040'; ctx.fillRect(px+6, py+7+bob, 1, 1); ctx.fillRect(px+9, py+7+bob, 1, 1);
        break;
      case 'rat':
        ctx.fillStyle = c;
        ctx.fillRect(px+3, py+8+bob, 9, 5); ctx.fillRect(px+10, py+6+bob, 4, 4);
        ctx.fillRect(px+1, py+10+bob, 3, 2);
        ctx.fillStyle='#ff4040'; ctx.fillRect(px+11, py+7+bob, 1, 1);
        break;
      case 'skeleton':
        ctx.fillStyle='#c8c0b0';
        ctx.fillRect(px+5, py+2+bob, 6, 6); ctx.fillRect(px+6, py+8+bob, 4, 6);
        ctx.fillRect(px+3, py+9+bob, 3, 2); ctx.fillRect(px+10, py+9+bob, 3, 2);
        ctx.fillRect(px+4, py+14+bob, 3, 3); ctx.fillRect(px+9, py+14+bob, 3, 3);
        ctx.fillStyle='#18181a'; ctx.fillRect(px+6, py+4+bob, 2, 2); ctx.fillRect(px+9, py+4+bob, 2, 2);
        break;
      case 'goblin':
        ctx.fillStyle = c;
        ctx.fillRect(px+4, py+4+bob, 8, 6); ctx.fillRect(px+5, py+10+bob, 6, 5);
        ctx.fillRect(px+2, py+10+bob, 3, 4); ctx.fillRect(px+11, py+10+bob, 3, 4);
        ctx.fillStyle='#208020'; ctx.fillRect(px+5, py+12+bob, 6, 3);
        ctx.fillStyle='#ffff00'; ctx.fillRect(px+5, py+6+bob, 2, 2); ctx.fillRect(px+9, py+6+bob, 2, 2);
        break;
      case 'slime': {
        const bw = 10 + Math.sin(t*2)*1.5, bh = 8 - Math.sin(t*2);
        ctx.fillStyle = c; ctx.fillRect(px+ts/2-bw/2, py+ts/2-bh/2+2, bw, bh);
        ctx.fillStyle='#80ffc0'; ctx.fillRect(px+ts/2-3, py+ts/2-1, 2, 2); ctx.fillRect(px+ts/2+1, py+ts/2-1, 2, 2);
        break;
      }
      case 'orc':
        ctx.fillStyle = c;
        ctx.fillRect(px+3, py+3+bob, 10, 8); ctx.fillRect(px+2, py+11+bob, 12, 7);
        ctx.fillRect(px+0, py+11+bob, 3, 5); ctx.fillRect(px+13, py+11+bob, 3, 5);
        ctx.fillStyle='#405040'; ctx.fillRect(px+5, py+5+bob, 2, 2); ctx.fillRect(px+9, py+5+bob, 2, 2);
        ctx.fillStyle='#ffe0c0'; ctx.fillRect(px+5, py+9+bob, 2, 3); ctx.fillRect(px+9, py+9+bob, 2, 3);
        break;
      case 'spider':
        ctx.fillStyle = c; ctx.fillRect(px+5, py+5+bob, 6, 6);
        for (let i=0; i<4; i++) {
          const la = (i-1.5)*0.5;
          ctx.fillRect(px+ts/2+Math.cos(la)*6-1, py+ts/2+Math.sin(la)*4, 2, 3);
        }
        ctx.fillStyle='#ff4040'; ctx.fillRect(px+6, py+7+bob, 1, 1); ctx.fillRect(px+9, py+7+bob, 1, 1);
        break;
      case 'troll':
        ctx.fillStyle = c;
        ctx.fillRect(px+2, py+2+bob, 12, 10); ctx.fillRect(px+1, py+12+bob, 14, 8);
        ctx.fillRect(px+0, py+12+bob, 2, 7); ctx.fillRect(px+14, py+12+bob, 2, 7);
        ctx.fillStyle='#205040'; ctx.fillRect(px+4, py+5+bob, 3, 3); ctx.fillRect(px+9, py+5+bob, 3, 3);
        break;
      case 'ghost':
        ctx.globalAlpha *= 0.55;
        ctx.fillStyle='#c0c0ff';
        ctx.fillRect(px+4, py+2+bob, 8, 10); ctx.fillRect(px+2, py+5+bob, 12, 5);
        ctx.fillRect(px+2, py+12+bob, 2, 3); ctx.fillRect(px+6, py+12+bob, 2, 3); ctx.fillRect(px+10, py+12+bob, 2, 3);
        ctx.fillStyle='#2020c0'; ctx.fillRect(px+6, py+5+bob, 2, 2); ctx.fillRect(px+9, py+5+bob, 2, 2);
        ctx.globalAlpha /= 0.55;
        break;
      case 'demon':
        ctx.fillStyle = c;
        ctx.fillRect(px+3, py+2+bob, 10, 8); ctx.fillRect(px+2, py+10+bob, 12, 7);
        ctx.fillStyle='#ff6020';
        ctx.fillRect(px+4, py+0+bob, 2, 4); ctx.fillRect(px+10, py+0+bob, 2, 4);
        ctx.fillStyle='#ff4040'; ctx.fillRect(px+5, py+5+bob, 2, 2); ctx.fillRect(px+9, py+5+bob, 2, 2);
        break;
      case 'vampire':
        ctx.fillStyle='#1a0008'; ctx.fillRect(px+3, py+2+bob, 10, 13);
        ctx.fillStyle='#e0c0d0'; ctx.fillRect(px+5, py+2+bob, 6, 7);
        ctx.fillStyle='#800040'; ctx.fillRect(px+4, py+9+bob, 8, 5);
        ctx.fillStyle='#ff2020'; ctx.fillRect(px+6, py+4+bob, 1, 2); ctx.fillRect(px+9, py+4+bob, 1, 2);
        ctx.fillStyle='#ffffff'; ctx.fillRect(px+6, py+8+bob, 1, 2); ctx.fillRect(px+9, py+8+bob, 1, 2);
        break;
      case 'lich':
        ctx.fillStyle='#4020a0';
        ctx.fillRect(px+4, py+3+bob, 8, 7); ctx.fillRect(px+5, py+10+bob, 6, 7);
        ctx.fillRect(px+2, py+11+bob, 4, 3);
        ctx.fillStyle='#c0a0ff';
        ctx.fillRect(px+2, py+8+bob, 1, 6); ctx.fillRect(px+1, py+8+bob, 3, 2);
        ctx.fillStyle='#6040c0'; ctx.fillRect(px+5, py+5+bob, 2, 2); ctx.fillRect(px+9, py+5+bob, 2, 2);
        break;
      case 'dragon':
        ctx.fillStyle = c;
        ctx.fillRect(px+2, py+4+bob, 12, 10);
        ctx.fillRect(px+0, py+2+bob, 4, 6); ctx.fillRect(px+12, py+2+bob, 4, 6);
        ctx.fillRect(px+12, py+6+bob, 4, 3);
        ctx.fillRect(px+3, py+2+bob, 6, 5);
        ctx.fillStyle='#ff8020'; ctx.fillRect(px+4, py+3+bob, 1, 2); ctx.fillRect(px+7, py+3+bob, 1, 2);
        ctx.fillStyle='#ffff00'; ctx.fillRect(px+4, py+3+bob, 1, 1); ctx.fillRect(px+7, py+3+bob, 1, 1);
        break;
      case 'stone_guardian':
        ctx.fillStyle='#909098';
        ctx.fillRect(px+1, py+0+bob, 14, 16);
        ctx.fillStyle='#606068';
        ctx.fillRect(px+3, py+2+bob, 4, 4); ctx.fillRect(px+9, py+2+bob, 4, 4);
        ctx.fillStyle='#e040ff';
        ctx.fillRect(px+4, py+3+bob, 2, 2); ctx.fillRect(px+10, py+3+bob, 2, 2);
        ctx.fillStyle='#505060'; ctx.fillRect(px+3, py+8+bob, 10, 2);
        ctx.fillStyle='#404048'; ctx.fillRect(px+6, py+1+bob, 1, 5); ctx.fillRect(px+10, py+6+bob, 3, 1);
        break;
      case 'abyss_lord': {
        ctx.fillStyle='#2a0040'; ctx.fillRect(px+0, py+0+bob, 16, 16);
        ctx.fillStyle='#6010a0'; ctx.fillRect(px+2, py+2+bob, 12, 10);
        ctx.fillStyle='#ff00ff'; ctx.fillRect(px+4, py+4+bob, 3, 3); ctx.fillRect(px+9, py+4+bob, 3, 3);
        ctx.fillStyle='#ffffff'; ctx.fillRect(px+5, py+5+bob, 1, 1); ctx.fillRect(px+10, py+5+bob, 1, 1);
        for (let i=0; i<3; i++) {
          ctx.fillStyle='#5010a0';
          ctx.fillRect(px+2+i*5, py+12+Math.sin(t*2+i)*2+bob, 2, 5);
        }
        const g = ctx.createRadialGradient(px+8, py+8+bob, 0, px+8, py+8+bob, 12);
        g.addColorStop(0, 'rgba(150,0,255,0.2)'); g.addColorStop(1, 'rgba(100,0,200,0)');
        ctx.fillStyle = g; ctx.fillRect(px-4, py-4, 24, 24);
        break;
      }
      default: {
        ctx.fillStyle = enemy.color || '#808080';
        ctx.beginPath(); ctx.arc(px+ts/2, py+ts/2+bob, ts/2-2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.font=`bold ${ts-4}px monospace`;
        ctx.textAlign='center'; ctx.textBaseline='middle';
        ctx.fillText(enemy.symbol||'?', px+ts/2, py+ts/2+1+bob);
        ctx.textBaseline='alphabetic';
      }
    }
  }

  drawPlayer(ctx, player, px, py, ts) {
    const t = this.time;
    const grd = ctx.createRadialGradient(px+ts/2, py+ts/2, 0, px+ts/2, py+ts/2, ts*1.2);
    grd.addColorStop(0, 'rgba(96,200,255,0.16)'); grd.addColorStop(1, 'rgba(96,200,255,0)');
    ctx.fillStyle = grd; ctx.fillRect(px-ts/2, py-ts/2, ts*2, ts*2);

    const cls = CLASSES[player.className];
    const bodyColor = cls ? cls.color : '#60c8ff';
    const bob = Math.sin(t * 5) * 0.6;

    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(px+3, py+ts-2, ts-6, 3);

    // 腿（步行动画）
    const legP = Math.sin(t * 8);
    ctx.fillStyle = '#303048';
    ctx.fillRect(px+4, py+12+bob, 3, 4+(legP>0?1:0));
    ctx.fillRect(px+9, py+12+bob, 3, 4+(legP<0?1:0));

    // 身体+手臂
    ctx.fillStyle = bodyColor;
    ctx.fillRect(px+3, py+8+bob, 10, 6);
    ctx.fillRect(px+0, py+9+bob, 3, 4);
    ctx.fillRect(px+13, py+9+bob, 3, 4);

    // 头
    ctx.fillStyle = '#f0d0b0'; ctx.fillRect(px+4, py+3+bob, 8, 7);

    // 职业头饰
    if (player.className === 'warrior') {
      ctx.fillStyle = '#707080'; ctx.fillRect(px+3, py+1+bob, 10, 5);
      ctx.fillRect(px+2, py+4+bob, 12, 3);
    } else if (player.className === 'mage') {
      ctx.fillStyle = '#6020c0';
      ctx.fillRect(px+4, py+0+bob, 8, 5); ctx.fillRect(px+5, py-2+bob, 4, 4); ctx.fillRect(px+6, py-4+bob, 2, 4);
      ctx.fillStyle='#d090ff'; ctx.fillRect(px+6, py-3+bob, 2, 2);
    } else {
      ctx.fillStyle = '#202028'; ctx.fillRect(px+3, py+2+bob, 10, 4);
    }

    // 眼睛
    ctx.fillStyle='#2040a0'; ctx.fillRect(px+6, py+6+bob, 2, 2); ctx.fillRect(px+10, py+6+bob, 2, 2);
    ctx.fillStyle='#ffffff'; ctx.fillRect(px+6, py+6+bob, 1, 1); ctx.fillRect(px+10, py+6+bob, 1, 1);

    // 武器
    if (player.weapon) {
      ctx.fillStyle = player.weapon.magic ? '#c080ff' : '#a0a0b0';
      ctx.fillRect(px+13, py+7+bob, 2, 8);
      ctx.fillRect(px+11, py+11+bob, 6, 2);
    }

    // 护盾状态
    if (player.hasStatus('shield')) {
      ctx.strokeStyle = 'rgba(192,192,255,0.85)'; ctx.lineWidth = 2;
      ctx.strokeRect(px+1, py+1, ts-2, ts-2);
    }
    if (player.hasStatus('bless')) {
      const pg = ctx.createRadialGradient(px+ts/2, py+ts/2, 0, px+ts/2, py+ts/2, ts);
      pg.addColorStop(0, 'rgba(240,200,40,0.18)'); pg.addColorStop(1, 'rgba(240,200,40,0)');
      ctx.fillStyle = pg; ctx.fillRect(px-4, py-4, ts+8, ts+8);
    }
    if (player.hasStatus('haste')) {
      ctx.strokeStyle = 'rgba(255,255,128,0.7)'; ctx.lineWidth = 1;
      ctx.strokeRect(px, py, ts, ts);
    }
  }

  renderLightOverlay(ctx, dungeon, camX, camY, ts) {
    const pw = this.canvas.width, ph = this.canvas.height;
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const overlay = ctx.createImageData(pw, ph);
    const d = overlay.data;
    for (let row = 0; row < this.viewH; row++) {
      for (let col = 0; col < this.viewW; col++) {
        const mx = camX + col, my = camY + row;
        let brightness = 0.06;
        if (mx >= 0 && my >= 0 && mx < dungeon.width && my < dungeon.height) {
          if (dungeon.visible[my][mx])    brightness = Math.max(0.28, dungeon.lightMap[my][mx]);
          else if (dungeon.revealed[my][mx]) brightness = 0.10;
        }
        const r = Math.floor(brightness * 255);
        const px0 = col * ts, py0 = row * ts;
        for (let dy = 0; dy < ts; dy++) {
          for (let dx = 0; dx < ts; dx++) {
            const idx = ((py0 + dy) * pw + (px0 + dx)) * 4;
            d[idx] = r; d[idx+1] = Math.floor(r*0.94); d[idx+2] = Math.floor(r*1.1); d[idx+3] = 255;
          }
        }
      }
    }
    ctx.putImageData(overlay, 0, 0);
    ctx.restore();
  }

  renderVignette(ctx) {
    const w = this.canvas.width, h = this.canvas.height;
    const grd = ctx.createRadialGradient(w/2, h/2, h*0.3, w/2, h/2, h*0.9);
    grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = grd; ctx.fillRect(0, 0, w, h);
  }

  renderMinimap(dungeon, player) {
    const mctx = this.mctx;
    const mw = this.minimap.width, mh = this.minimap.height;
    const tw = mw / dungeon.width, th = mh / dungeon.height;
    mctx.fillStyle = '#06040a'; mctx.fillRect(0, 0, mw, mh);
    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        if (!dungeon.revealed[y][x]) continue;
        const isVis = dungeon.visible[y][x];
        const tile = dungeon.tiles[y][x];
        let color;
        switch (tile) {
          case TILE.WALL:   color = isVis ? '#2a2040' : '#18142c'; break;
          case TILE.FLOOR:  color = isVis ? '#4a4060' : '#262038'; break;
          case TILE.STAIRS: color = '#40c0a0'; break;
          case TILE.CHEST:  color = '#d0a020'; break;
          case TILE.TRAP:   color = '#c03020'; break;
          case TILE.TORCH:  color = '#ff8020'; break;
          case TILE.SHRINE: color = '#c0a0ff'; break;
          case TILE.SHOP:   color = '#f0c040'; break;
          default:          color = isVis ? '#3a3050' : '#1e1830';
        }
        mctx.fillStyle = color;
        mctx.fillRect(x * tw, y * th, Math.max(1, tw), Math.max(1, th));
      }
    }
    for (const io of dungeon.items) {
      if (!dungeon.visible[io.y]?.[io.x]) continue;
      mctx.fillStyle = itemDisplayColor(io.item);
      mctx.fillRect(io.x * tw, io.y * th, Math.max(1.5, tw), Math.max(1.5, th));
    }
    for (const e of dungeon.entities) {
      if (!e.alive || !dungeon.visible[e.y]?.[e.x]) continue;
      mctx.fillStyle = e.isBoss ? '#ff00ff' : '#ff3030';
      mctx.fillRect(e.x * tw - 0.5, e.y * th - 0.5, Math.max(2, tw+1), Math.max(2, th+1));
    }
    const pulse = Math.sin(this.time * 4) * 0.3 + 0.7;
    mctx.fillStyle = `rgba(96,200,255,${pulse})`;
    mctx.fillRect(player.x * tw - 1, player.y * th - 1, Math.max(2.5, tw+2), Math.max(2.5, th+2));
  }
}
