// ─── 主游戏逻辑 ─────────────────────────────────────────

const VISION_RADIUS = 8;
const MAX_FLOOR = 10;

class Game {
  constructor() {
    this.state = 'title'; // title | class_select | playing | perk_select | gameover | won
    this.player = null;
    this.dungeon = null;
    this.renderer = null;
    this.ui = null;

    this.lastTime = 0;
    this.animFrame = null;

    this._setupDOMButtons();
    this._setupKeyboard();
    this._setupEvents();

    this.loop = this.loop.bind(this);
  }

  _setupDOMButtons() {
    document.getElementById('start-btn').addEventListener('click', () => this._startClassSelect());
    document.getElementById('help-btn').addEventListener('click', () => {
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('help-screen').classList.remove('hidden');
    });
    document.getElementById('help-back-btn').addEventListener('click', () => {
      document.getElementById('help-screen').classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
    });
    document.getElementById('restart-btn').addEventListener('click', () => this._startClassSelect());
    document.getElementById('menu-btn').addEventListener('click', () => this._returnToMenu());
    document.getElementById('mute-btn')?.addEventListener('click', () => this._toggleMute());
  }

  _setupKeyboard() {
    document.addEventListener('keydown', e => this._handleKey(e));
  }

  _setupEvents() {
    EventBus.on('reveal_map', () => {
      if (!this.dungeon) return;
      for (let y = 0; y < this.dungeon.height; y++)
        for (let x = 0; x < this.dungeon.width; x++)
          this.dungeon.revealed[y][x] = true;
      this.ui.addMessage('地图完全揭示！', 'item');
    });

    EventBus.on('teleport_player', () => {
      if (!this.dungeon || !this.player) return;
      const rooms = this.dungeon.rooms.filter(r =>
        !(r.cx === this.player.x && r.cy === this.player.y)
      );
      if (rooms.length === 0) return;
      const room = randChoice(rooms);
      this.player.x = room.cx; this.player.y = room.cy;
      this.dungeon.computeVisibility(this.player.x, this.player.y, this.player.visionRadius);
      this.renderer.updateCamera(this.player, this.dungeon);
      if (Particles) Particles.emit('magic', this.player.x, this.player.y);
      this.ui.addMessage('瞬间传送！', 'item');
    });

    EventBus.on('scroll_aoe', ({ damage, radius, type, name }) => {
      if (!this.dungeon || !this.player) return;
      let killed = 0, total = 0;
      for (const enemy of this.dungeon.entities) {
        if (!enemy.alive) continue;
        if (dist(enemy.x, enemy.y, this.player.x, this.player.y) <= radius) {
          // 火焰对不死免疫无效
          if (type === 'fire' && enemy.fireImmune) continue;
          enemy.hp -= damage;
          total++;
          if (Particles) Particles.emit(type === 'fire' ? 'fire' : 'ice', enemy.x, enemy.y);
          if (enemy.hp <= 0) {
            enemy.alive = false;
            this.player.gold += enemy.gold;
            this.player.killCount++;
            const xpMsgs = this.player.addXP(enemy.xp);
            this.ui.addMessages(xpMsgs);
            killed++;
            if (Particles) Particles.emit('death', enemy.x, enemy.y, { color: enemy.color });
          }
        }
      }
      if (this.renderer) this.renderer.shake(5, 0.4);
      if (Audio) Audio.playScroll();
      this.ui.addMessage(`${name}！影响 ${total} 个目标，击杀 ${killed} 只。`, 'combat');
    });

    EventBus.on('sleep_all_enemies', () => {
      if (!this.dungeon) return;
      let count = 0;
      for (const enemy of this.dungeon.entities) {
        if (!enemy.alive) continue;
        if (this.dungeon.visible[enemy.y]?.[enemy.x]) {
          enemy.sleeping = true;
          enemy.chasing = false;
          count++;
        }
      }
      this.ui.addMessage(`宁静卷轴！${count} 只可见敌人陷入沉睡！`, 'item');
    });

    EventBus.on('curse_enemies', () => {
      if (!this.dungeon || !this.player) return;
      const room = this.dungeon.getRoomAt(this.player.x, this.player.y);
      let count = 0;
      for (const enemy of this.dungeon.entities) {
        if (!enemy.alive) continue;
        const inRoom = room ? room.contains(enemy.x, enemy.y) : dist(enemy.x, enemy.y, this.player.x, this.player.y) <= 5;
        if (inRoom) {
          if (!enemy.statuses) enemy.statuses = {};
          enemy.statuses.curse = { turns: 6 };
          count++;
        }
      }
      this.ui.addMessage(`诅咒卷轴！${count} 只敌人受到诅咒，攻防降低！`, 'combat');
    });
  }

  // ── 职业选择 ──────────────────────────────────────────
  async _startClassSelect() {
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('help-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    this.state = 'class_select';

    const ui = this.ui || (this.ui = new UI());
    const chosenClass = await ui.showClassSelect();
    this._startGame(chosenClass);
  }

  _startGame(className = 'warrior') {
    document.getElementById('class-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    // 初始化音效和粒子
    Audio = new AudioEngine();
    Particles = new ParticleSystem();

    this.player = new Player(className);
    if (!this.ui) this.ui = new UI();

    const canvas = document.getElementById('game-canvas');
    const minimap = document.getElementById('minimap-canvas');
    this.renderer = new Renderer(canvas, minimap);

    this._enterFloor(1);
    this.state = 'playing';

    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.lastTime = performance.now();
    this.animFrame = requestAnimationFrame(this.loop);
  }

  _enterFloor(floorNum) {
    this.dungeon = new Dungeon(floorNum);
    this.player.floor = floorNum;
    this.player.x = this.dungeon.playerStart.x;
    this.player.y = this.dungeon.playerStart.y;

    this.dungeon.computeVisibility(this.player.x, this.player.y, this.player.visionRadius);
    this.renderer.updateCamera(this.player, this.dungeon);

    const cls = CLASSES[this.player.className];
    if (floorNum === 1) {
      this.ui.addMessage(`${cls.icon} ${cls.name} 踏入了深渊...`, 'level');
      this.ui.addMessage('方向键/WASD 移动，撞击敌人攻击。', 'info');
      this.ui.addMessage('G 拾取，1-5 使用背包，E 快速装备。', 'info');
      this.ui.addMessage('P 神龛祈祷，? 帮助。', 'info');
    } else {
      const isBoss = floorNum % 5 === 0;
      this.ui.addMessage(`进入第 ${floorNum} 层...${isBoss ? ' ⚠ Boss 楼层！' : ''}`, 'info');
    }

    // 天赋：拾荒者——每层开始获得随机道具
    if (this.player.hasPerk('scavenger') && floorNum > 1) {
      const item = generateLoot(floorNum);
      if (this.player.canPickup()) {
        this.player.addItem(item);
        this.ui.addMessage(`天赋·拾荒者：获得 ${item.icon||''} ${item.name}`, 'item');
      }
    }

    // 检查神龛房间
    const startRoom = this.dungeon.rooms[0];
    if (startRoom) {
      const shopRoom = this.dungeon.rooms.find(r => r.type === ROOM_TYPE.SHOP);
      if (shopRoom) this.ui.addMessage('📍 发现了商店！', 'info');
      const shrineRoom = this.dungeon.rooms.find(r => r.type === ROOM_TYPE.SHRINE);
      if (shrineRoom) this.ui.addMessage('📍 发现了神龛！', 'info');
    }

    // Boss 房间出现时播放 Boss 音效
    if (floorNum % 5 === 0) {
      setTimeout(() => { if (Audio) Audio.playBossRoar(); }, 800);
    }
  }

  _returnToMenu() {
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    this.state = 'title';
    if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null; }
  }

  _toggleMute() {
    if (Audio) {
      const btn = document.getElementById('mute-btn');
      if (Audio.master.gain.value > 0) {
        Audio.master.gain.value = 0;
        if (btn) btn.textContent = '🔇';
      } else {
        Audio.master.gain.value = 0.3;
        if (btn) btn.textContent = '🔊';
      }
    }
  }

  // ── 主循环 ────────────────────────────────────────────
  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    if ((this.state === 'playing' || this.state === 'perk_select') && this.renderer) {
      if (Particles) Particles.update(dt);
      this.renderer.update(dt);
      this.renderer.render(this.dungeon, this.player);
      this.ui.updateStats(this.player);
    }

    this.animFrame = requestAnimationFrame(this.loop);
  }

  // ── 键盘处理 ──────────────────────────────────────────
  _handleKey(e) {
    if (this.state !== 'playing') return;

    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();

    const dirs = {
      'ArrowUp':[0,-1], 'w':[0,-1], 'W':[0,-1],
      'ArrowDown':[0,1], 's':[0,1], 'S':[0,1],
      'ArrowLeft':[-1,0], 'a':[-1,0], 'A':[-1,0],
      'ArrowRight':[1,0], 'd':[1,0], 'D':[1,0],
    };

    if (dirs[e.key]) {
      const [dx, dy] = dirs[e.key];
      this._tryMove(dx, dy);
      return;
    }

    if (e.key === 'g' || e.key === 'G') { this._pickupItem(); return; }
    if (e.key === 'e' || e.key === 'E') { this._tryEquip(); return; }
    if (e.key === 'p' || e.key === 'P') { this._useShrineIfOn(); return; }
    if (e.key === '?' || e.key === '/') { this._toggleHelp(); return; }
    if (e.key >= '1' && e.key <= '9') { this._useItem(parseInt(e.key) - 1); return; }
    if (e.key === '.' || e.key === ' ') { this._endPlayerTurn(); return; }
  }

  _tryMove(dx, dy) {
    // 状态检查：冰冻/眩晕跳过回合
    if (this.player.hasStatus('freeze') || this.player.hasStatus('stun')) {
      this.ui.addMessage('你被束缚，无法行动！', 'info');
      this._endPlayerTurn();
      return;
    }

    const nx = this.player.x + dx, ny = this.player.y + dy;
    if (!this.dungeon.isWalkable(nx, ny)) return;

    // 攻击敌人
    const enemy = this.dungeon.getEntityAt(nx, ny);
    if (enemy) {
      const msgs = playerAttack(this.player, enemy);
      this.ui.addMessages(msgs);
      if (this.renderer) {
        // 受到反击时屏幕震动
        const hasDmg = msgs.some(m => m.type === 'danger');
        if (hasDmg) this.renderer.shake(3, 0.2);
        if (!this.player.isAlive()) this.renderer.shake(8, 0.5);
      }
      if (!this.player.isAlive()) { this._gameOver(); return; }
      this._checkLevelUp();
      this._endPlayerTurn();
      return;
    }

    // 移动
    this.player.x = nx; this.player.y = ny;
    if (Audio) Audio.playStep();

    const tile = this.dungeon.tiles[ny][nx];

    // 楼梯
    if (tile === TILE.STAIRS) {
      this._descend();
      return;
    }

    // 陷阱
    if (tile === TILE.TRAP) {
      const msgs = stepOnTrap(this.player);
      this.ui.addMessages(msgs);
      this.dungeon.tiles[ny][nx] = TILE.FLOOR;
      if (this.renderer) this.renderer.shake(3, 0.2);
      if (this.renderer) this.renderer.hitFlash();
      if (!this.player.isAlive()) { this._gameOver(); return; }
    }

    // 商店瓦片
    if (tile === TILE.SHOP) {
      this.ui.showShopNotice();
    }

    // 神龛瓦片
    if (tile === TILE.SHRINE) {
      this.ui.showShrineNotice();
    }

    // 自动拾取金币
    const itemObj = this.dungeon.getItemAt(nx, ny);
    if (itemObj && itemObj.item.type === 'gold' && !itemObj.isShop) {
      this.player.gold += itemObj.item.amount;
      if (Particles) Particles.emit('gold', nx, ny);
      if (Audio) Audio.playGold();
      this.ui.addMessage(`拾取 ${itemObj.item.amount} 金币`, 'item');
      this.dungeon.removeItemAt(nx, ny);
    }

    // 进入宝箱格子
    const chestObj = this.dungeon.items.find(i => i.x === nx && i.y === ny && i.isChest && !i.opened);
    if (chestObj) this._openChest(chestObj);

    this._endPlayerTurn();
  }

  _endPlayerTurn() {
    this.player.turnCount++;

    // 状态效果（开始计时）
    const statusMsgs = this.player.tickStatuses();
    this.ui.addMessages(statusMsgs);
    if (this.renderer && statusMsgs.some(m => m.type === 'danger')) {
      this.renderer.hitFlash('rgba(60,255,60,0.2)');
    }

    if (!this.player.isAlive()) { this._gameOver(); return; }

    // 天赋：被动再生（每4回合）
    if (this.player.hasPerk('regen_perk') && this.player.turnCount % 4 === 0) {
      if (this.player.hp < this.player.maxHp) {
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
      }
    }

    // 视野 & 摄像机更新
    this.dungeon.computeVisibility(this.player.x, this.player.y, this.player.visionRadius);
    this.renderer.updateCamera(this.player, this.dungeon);

    // 敌人回合
    const enemyMsgs = enemyTurn(this.dungeon, this.player);
    this.ui.addMessages(enemyMsgs);

    if (this.renderer && enemyMsgs.some(m => m.type === 'danger')) {
      this.renderer.hitFlash();
      this.renderer.shake(2, 0.15);
    }

    if (!this.player.isAlive()) { this._gameOver(); return; }
  }

  _checkLevelUp() {
    if (this.player.pendingLevelUp > 0) {
      this.player.pendingLevelUp--;
      if (Audio) Audio.playLevelUp();
      if (Particles) Particles.emit('levelup', this.player.x, this.player.y);
      if (this.renderer) this.renderer.shake(3, 0.4);
      this._showPerkSelection();
    }
  }

  async _showPerkSelection() {
    this.state = 'perk_select';

    // 从天赋池随机选3个（不重复已有的）
    const owned = new Set(this.player.perks.map(p => p.id));
    const available = ALL_PERKS.filter(p => !owned.has(p.id));
    const choices = [];
    const pool = [...available];
    for (let i = 0; i < 3 && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      choices.push(pool.splice(idx, 1)[0]);
    }

    if (choices.length === 0) {
      this.ui.addMessage('没有更多天赋可以选择了！', 'info');
      this.state = 'playing';
      return;
    }

    const chosen = await this.ui.showPerkSelection(choices);
    if (chosen.apply) chosen.apply(this.player);
    this.player.perks.push(chosen);
    this.ui.addMessage(`天赋解锁：${chosen.icon} ${chosen.name} — ${chosen.desc}`, 'level');
    this.state = 'playing';
  }

  _openChest(chestObj) {
    const item = chestObj.item;
    chestObj.opened = true;
    this.dungeon.tiles[chestObj.y][chestObj.x] = TILE.FLOOR;

    if (Audio) Audio.playChestOpen();
    if (Particles) Particles.emit('gold', chestObj.x, chestObj.y);

    if (item.type === 'gold') {
      this.player.gold += item.amount;
      this.ui.addMessage(`💰 宝箱：获得 ${item.amount} 金币！`, 'item');
    } else if (this.player.canPickup()) {
      this.player.addItem(item);
      this.ui.addMessage(`📦 宝箱：获得 ${item.icon||''} ${item.name}！`, 'item');
    } else {
      this.ui.addMessage(`📦 宝箱里有 ${item.name}，但背包已满，留在地上。`, 'info');
      chestObj.isChest = false; // 变为地面物品
      return;
    }
    this.dungeon.removeItemAt(chestObj.x, chestObj.y);
  }

  _pickupItem() {
    const itemObj = this.dungeon.getItemAt(this.player.x, this.player.y);
    if (!itemObj) { this.ui.addMessage('这里没有物品。', 'info'); return; }

    const item = itemObj.item;

    // 商店购买
    if (itemObj.isShop) {
      if (this.player.gold < itemObj.price) {
        this.ui.addMessage(`💰 金币不足！需要 ${itemObj.price} 金币。(你有 ${this.player.gold})`, 'info');
        return;
      }
      if (!this.player.canPickup() && item.type !== 'gold') {
        this.ui.addMessage('背包已满！', 'info'); return;
      }
      this.player.gold -= itemObj.price;
      if (item.type === 'gold') {
        this.player.gold += item.amount;
        this.ui.addMessage(`🏪 购买了 ${item.amount} 金币（净赚 ${item.amount - itemObj.price}）`, 'item');
      } else {
        this.player.addItem(item);
        this.ui.addMessage(`🏪 购买了 ${item.icon||''} ${item.name}（花费 ${itemObj.price} 金币）`, 'item');
      }
      this.dungeon.removeItemAt(this.player.x, this.player.y);
      if (Audio) Audio.playPickup();
      this._endPlayerTurn();
      return;
    }

    if (item.type === 'gold') {
      this.player.gold += item.amount;
      if (Audio) Audio.playGold();
      if (Particles) Particles.emit('gold', this.player.x, this.player.y);
      this.ui.addMessage(`拾取 ${item.amount} 金币`, 'item');
      this.dungeon.removeItemAt(this.player.x, this.player.y);
      this._endPlayerTurn();
      return;
    }

    if (!this.player.canPickup()) { this.ui.addMessage('背包已满！(使用物品腾出空间)', 'info'); return; }

    this.player.addItem(item);
    if (Audio) Audio.playPickup();
    this.ui.addMessage(`拾取：${item.icon||''} ${item.name}`, 'item');
    this.dungeon.removeItemAt(this.player.x, this.player.y);
    this._endPlayerTurn();
  }

  _tryEquip() {
    for (let i = this.player.inventory.length - 1; i >= 0; i--) {
      const item = this.player.inventory[i];
      if (item.type === 'weapon' || item.type === 'armor') {
        const result = this.player.equipItem(i);
        if (result) { this.ui.addMessage(result.msg, 'item'); this._endPlayerTurn(); return; }
      }
    }
    this.ui.addMessage('背包中没有可装备的物品。', 'info');
  }

  _useItem(index) {
    const item = this.player.inventory[index];
    if (!item) { this.ui.addMessage(`格子 [${index+1}] 是空的。`, 'info'); return; }

    if (item.type === 'weapon' || item.type === 'armor') {
      const result = this.player.equipItem(index);
      if (result) this.ui.addMessage(result.msg, 'item');
      this._endPlayerTurn();
      return;
    }

    const result = applyItem(item, this.player);
    if (result) {
      this.ui.addMessage(result.msg, result.type || 'item');
      if (result.consumed) {
        // 消耗品特效
        if (result.healAmt && result.healAmt > 0) {
          if (Particles) Particles.emit('heal', this.player.x, this.player.y);
        }
        if (item.type === 'scroll') {
          if (Particles) Particles.emit('magic', this.player.x, this.player.y);
        }
        this._endPlayerTurn();
        this._checkLevelUp();
      }
    }
  }

  _useShrineIfOn() {
    const tile = this.dungeon.tiles[this.player.y][this.player.x];
    if (tile !== TILE.SHRINE) {
      this.ui.addMessage('这里没有神龛。', 'info');
      return;
    }
    if (this.player.hp <= 10) {
      this.ui.addMessage('HP 不足，无法祈祷！', 'info');
      return;
    }
    // 花费10HP，获得随机祝福
    this.player.hp -= 10;
    const blessings = ['bless', 'regen', 'shield', 'haste'];
    const chosen = randChoice(blessings);
    this.player.addStatus(chosen);
    const sd = STATUS_DATA[chosen];
    if (Particles) Particles.emit('magic', this.player.x, this.player.y);
    if (Audio) Audio.playLevelUp();
    this.ui.addMessage(`🌟 神龛祝福！花费 10 HP，获得${sd?.name||chosen}状态！`, 'level');
    this.dungeon.tiles[this.player.y][this.player.x] = TILE.FLOOR; // 神龛用完消失
    this._endPlayerTurn();
  }

  _toggleHelp() {
    const overlay = document.getElementById('ingame-help');
    if (overlay) overlay.classList.toggle('hidden');
  }

  _descend() {
    if (Audio) Audio.playStairs();
    if (Particles) Particles.emit('magic', this.player.x, this.player.y);

    if (this.player.floor >= MAX_FLOOR) {
      this._win();
      return;
    }
    this.player.floorsCleared++;
    const nextFloor = this.player.floor + 1;
    // 进入新层时轻微回血
    const healOnDescend = Math.floor(this.player.maxHp * 0.1);
    this.player.hp = Math.min(this.player.maxHp, this.player.hp + healOnDescend);
    this.ui.addMessage(`⬇ 下降至第 ${nextFloor} 层... (回复 ${healOnDescend} HP)`, 'info');
    this._enterFloor(nextFloor);
  }

  _gameOver() {
    this.state = 'gameover';
    if (Audio) Audio.playPlayerDeath();
    if (this.renderer) { this.renderer.shake(10, 0.8); this.renderer.hitFlash('rgba(255,0,0,0.5)'); }
    this.ui.addMessage('⚰ 你已陨落...', 'danger');
    setTimeout(() => {
      this.ui.showGameOver(this.player, false);
    }, 1200);
  }

  _win() {
    this.state = 'won';
    if (Audio) Audio.playLevelUp();
    if (Particles) Particles.emit('levelup', this.player.x, this.player.y);
    this.ui.addMessage('🏆 你征服了深渊最深处！深渊魔王已被击败！', 'level');
    setTimeout(() => {
      this.ui.showGameOver(this.player, true);
    }, 1500);
  }
}

// ── 启动 ──────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  window._game = new Game();
});
