// ─── 像素风格渲染器 ─────────────────────────────────────

const COLORS = {
  // 地图瓦片
  wall:        '#1a1520',
  wallEdge:    '#2a2035',
  wallFog:     '#0d0d10',
  floor:       '#2a2430',
  floorAlt:    '#252030',
  floorFog:    '#151318',
  door:        '#806040',
  stairs:      '#40c0a0',
  stairsFog:   '#1a5040',
  chest:       '#d0a020',
  chestFog:    '#503810',
  trap:        '#c03020',
  trapFog:     '#3a0810',

  // 玩家
  player:      '#60c8ff',
  playerGlow:  '#60c8ff40',

  // 背景格子条纹（视差效果）
  gridLine:    '#ffffff04',
};

// 各类型敌人颜色已在 entities.js 中定义

class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimap = minimapCanvas;
    this.mctx = minimapCanvas.getContext('2d');

    this.tileSize = TILE_SIZE; // 16px
    this.viewW = Math.floor(canvas.width / this.tileSize);
    this.viewH = Math.floor(canvas.height / this.tileSize);

    // 视口偏移（以地图格子为单位）
    this.camX = 0;
    this.camY = 0;

    // 动画时间
    this.time = 0;

    // 伤害特效列表
    this.effects = [];
  }

  update(dt) {
    this.time += dt;
    // 更新特效
    this.effects = this.effects.filter(e => {
      e.life -= dt;
      return e.life > 0;
    });
  }

  addDamageEffect(x, y, text, color) {
    this.effects.push({ x, y, text, color: color || '#ff4040', life: 0.8, maxLife: 0.8 });
  }

  // 更新摄像机，使玩家居中
  updateCamera(player, dungeon) {
    const targetX = player.x - Math.floor(this.viewW / 2);
    const targetY = player.y - Math.floor(this.viewH / 2);
    this.camX = clamp(targetX, 0, dungeon.width - this.viewW);
    this.camY = clamp(targetY, 0, dungeon.height - this.viewH);
  }

  render(dungeon, player) {
    const ctx = this.ctx;
    const ts = this.tileSize;

    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // 绘制瓦片
    for (let row = 0; row < this.viewH; row++) {
      for (let col = 0; col < this.viewW; col++) {
        const mx = this.camX + col;
        const my = this.camY + row;
        if (mx < 0 || my < 0 || mx >= dungeon.width || my >= dungeon.height) continue;

        const px = col * ts;
        const py = row * ts;
        const isVisible = dungeon.visible[my][mx];
        const isRevealed = dungeon.revealed[my][mx];

        if (!isRevealed) continue;

        this.drawTile(ctx, dungeon.tiles[my][mx], px, py, ts, isVisible);
      }
    }

    // 绘制地面物品
    for (const itemObj of dungeon.items) {
      if (!dungeon.visible[itemObj.y][itemObj.x]) continue;
      const px = (itemObj.x - this.camX) * ts;
      const py = (itemObj.y - this.camY) * ts;
      if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) continue;
      this.drawItem(ctx, itemObj.item, px, py, ts);
    }

    // 绘制敌人
    for (const enemy of dungeon.entities) {
      if (!enemy.alive) continue;
      if (!dungeon.visible[enemy.y][enemy.x]) continue;
      const px = (enemy.x - this.camX) * ts;
      const py = (enemy.y - this.camY) * ts;
      if (px < -ts || py < -ts || px >= this.canvas.width || py >= this.canvas.height) continue;
      this.drawEnemy(ctx, enemy, px, py, ts);
    }

    // 绘制玩家
    {
      const px = (player.x - this.camX) * ts;
      const py = (player.y - this.camY) * ts;
      this.drawPlayer(ctx, px, py, ts);
    }

    // 绘制特效（伤害数字等）
    this.drawEffects(ctx);

    // 渲染小地图
    this.renderMinimap(dungeon, player);
  }

  drawTile(ctx, type, px, py, ts, isVisible) {
    const dim = isVisible ? 1 : 0.35;

    switch (type) {
      case TILE.WALL: {
        ctx.fillStyle = isVisible ? COLORS.wall : COLORS.wallFog;
        ctx.fillRect(px, py, ts, ts);
        // 顶部亮边（像素风格）
        if (isVisible) {
          ctx.fillStyle = COLORS.wallEdge;
          ctx.fillRect(px, py, ts, 2);
          ctx.fillRect(px, py, 2, ts);
        }
        break;
      }
      case TILE.FLOOR: {
        const alt = ((px + py) / ts) % 2 === 0;
        ctx.fillStyle = isVisible
          ? (alt ? COLORS.floor : COLORS.floorAlt)
          : COLORS.floorFog;
        ctx.fillRect(px, py, ts, ts);
        // 格子纹
        if (isVisible) {
          ctx.fillStyle = COLORS.gridLine;
          ctx.fillRect(px, py, ts, 1);
          ctx.fillRect(px, py, 1, ts);
        }
        break;
      }
      case TILE.DOOR: {
        ctx.fillStyle = isVisible ? COLORS.door : '#3a2010';
        ctx.fillRect(px, py, ts, ts);
        if (isVisible) {
          ctx.fillStyle = '#a08050';
          ctx.fillRect(px + 3, py + 2, ts - 6, ts - 4);
        }
        break;
      }
      case TILE.STAIRS: {
        ctx.fillStyle = isVisible ? COLORS.floor : COLORS.floorFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVisible) {
          // 楼梯符号
          ctx.fillStyle = COLORS.stairs;
          this.drawStairs(ctx, px, py, ts);
        } else {
          ctx.fillStyle = COLORS.stairsFog;
          this.drawStairs(ctx, px, py, ts);
        }
        break;
      }
      case TILE.CHEST: {
        ctx.fillStyle = isVisible ? COLORS.floor : COLORS.floorFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVisible) {
          this.drawChest(ctx, px, py, ts);
        }
        break;
      }
      case TILE.TRAP: {
        ctx.fillStyle = isVisible ? COLORS.floor : COLORS.floorFog;
        ctx.fillRect(px, py, ts, ts);
        if (isVisible) {
          ctx.fillStyle = COLORS.trap;
          ctx.fillRect(px + 5, py + 5, 6, 6);
          ctx.fillStyle = '#ff6050';
          ctx.fillRect(px + 6, py + 6, 4, 4);
        }
        break;
      }
    }
  }

  drawStairs(ctx, px, py, ts) {
    // 三步楼梯图案
    ctx.fillRect(px + 2, py + ts - 4, ts - 4, 2);
    ctx.fillRect(px + 4, py + ts - 7, ts - 8, 2);
    ctx.fillRect(px + 6, py + ts - 10, ts - 12, 2);
  }

  drawChest(ctx, px, py, ts) {
    // 宝箱：金色方块 + 暗盖
    const pulse = Math.sin(this.time * 3) * 0.15 + 0.85;
    ctx.fillStyle = `rgba(200, 150, 20, ${pulse})`;
    ctx.fillRect(px + 2, py + 5, ts - 4, ts - 8);
    ctx.fillStyle = '#a07810';
    ctx.fillRect(px + 2, py + 5, ts - 4, 4);
    // 锁扣
    ctx.fillStyle = '#fff';
    ctx.fillRect(px + ts / 2 - 1, py + 7, 2, 2);
  }

  drawItem(ctx, item, px, py, ts) {
    const color = itemDisplayColor(item);
    // 闪烁效果
    const glow = (Math.sin(this.time * 4 + px) * 0.3 + 0.7);

    ctx.globalAlpha = glow;
    ctx.fillStyle = color;
    // 简单的菱形图标
    ctx.beginPath();
    ctx.moveTo(px + ts / 2, py + 3);
    ctx.lineTo(px + ts - 3, py + ts / 2);
    ctx.lineTo(px + ts / 2, py + ts - 3);
    ctx.lineTo(px + 3, py + ts / 2);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  drawEnemy(ctx, enemy, px, py, ts) {
    const alive = enemy.alive;
    if (!alive) return;

    // 睡眠状态半透明
    if (enemy.sleeping) ctx.globalAlpha = 0.5;

    // 敌人主体（圆形）
    ctx.fillStyle = enemy.color;
    ctx.beginPath();
    ctx.arc(px + ts / 2, py + ts / 2, ts / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // 边框
    ctx.strokeStyle = '#ffffff30';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 绘制符号（像素字体太小用内置）
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${ts - 4}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(enemy.symbol, px + ts / 2, py + ts / 2 + 1);

    // HP 条（仅当受伤时显示）
    if (enemy.hp < enemy.maxHp) {
      const barW = ts - 2;
      const ratio = enemy.hp / enemy.maxHp;
      ctx.fillStyle = '#300';
      ctx.fillRect(px + 1, py - 3, barW, 2);
      ctx.fillStyle = ratio > 0.5 ? '#0c0' : ratio > 0.25 ? '#cc0' : '#c00';
      ctx.fillRect(px + 1, py - 3, Math.round(barW * ratio), 2);
    }

    // 睡眠标记
    if (enemy.sleeping) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#8080ff';
      ctx.font = '8px monospace';
      ctx.fillText('z', px + ts - 3, py + 2);
    }

    ctx.globalAlpha = 1;
  }

  drawPlayer(ctx, px, py, ts) {
    // 光晕
    const glow = Math.sin(this.time * 2) * 0.15 + 0.85;
    const grad = ctx.createRadialGradient(
      px + ts / 2, py + ts / 2, 0,
      px + ts / 2, py + ts / 2, ts
    );
    grad.addColorStop(0, `rgba(96, 200, 255, ${0.3 * glow})`);
    grad.addColorStop(1, 'rgba(96, 200, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(px - ts / 2, py - ts / 2, ts * 2, ts * 2);

    // 玩家主体
    ctx.fillStyle = COLORS.player;
    // 身体（像素人形）
    ctx.fillRect(px + 5, py + 4, 6, 6);  // 头
    ctx.fillRect(px + 4, py + 10, 8, 5); // 身体
    ctx.fillRect(px + 2, py + 10, 3, 4); // 左臂
    ctx.fillRect(px + 11, py + 10, 3, 4);// 右臂
    ctx.fillRect(px + 4, py + 15, 3, 4); // 左腿（动画）
    ctx.fillRect(px + 9, py + 15, 3, 4); // 右腿

    // 眼睛
    ctx.fillStyle = '#001';
    ctx.fillRect(px + 6, py + 6, 1, 2);
    ctx.fillRect(px + 9, py + 6, 1, 2);
  }

  drawEffects(ctx) {
    for (const eff of this.effects) {
      const t = 1 - eff.life / eff.maxLife;
      const alpha = 1 - t;
      const worldX = eff.x;
      const worldY = eff.y;
      const px = (worldX - this.camX) * this.tileSize + this.tileSize / 2;
      const py = (worldY - this.camY) * this.tileSize - t * 20;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = eff.color;
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(eff.text, px, py);
      ctx.globalAlpha = 1;
    }
  }

  renderMinimap(dungeon, player) {
    const mctx = this.mctx;
    const mw = this.minimap.width;
    const mh = this.minimap.height;
    const tw = mw / dungeon.width;
    const th = mh / dungeon.height;

    mctx.fillStyle = '#000';
    mctx.fillRect(0, 0, mw, mh);

    for (let y = 0; y < dungeon.height; y++) {
      for (let x = 0; x < dungeon.width; x++) {
        if (!dungeon.revealed[y][x]) continue;
        const tile = dungeon.tiles[y][x];
        const isVisible = dungeon.visible[y][x];
        let color;
        switch (tile) {
          case TILE.WALL:   color = isVisible ? '#2a203a' : '#1a1525'; break;
          case TILE.FLOOR:  color = isVisible ? '#4a4060' : '#2a2040'; break;
          case TILE.STAIRS: color = '#40c0a0'; break;
          case TILE.CHEST:  color = '#d0a020'; break;
          case TILE.TRAP:   color = '#c03020'; break;
          default:          color = '#3a3050';
        }
        mctx.fillStyle = color;
        mctx.fillRect(x * tw, y * th, Math.max(1, tw), Math.max(1, th));
      }
    }

    // 敌人标记
    for (const e of dungeon.entities) {
      if (!e.alive) continue;
      if (!dungeon.visible[e.y][e.x]) continue;
      mctx.fillStyle = '#ff4040';
      mctx.fillRect(e.x * tw, e.y * th, Math.max(1.5, tw), Math.max(1.5, th));
    }

    // 玩家标记
    mctx.fillStyle = '#60c8ff';
    mctx.fillRect(player.x * tw - 1, player.y * th - 1, Math.max(2, tw + 1), Math.max(2, th + 1));
  }
}
