// ─── 主游戏逻辑 ─────────────────────────────────────────

const VISION_RADIUS = 8;
const MAX_FLOOR = 10;

class Game {
  constructor() {
    this.state = 'title'; // title | playing | gameover | won
    this.player = null;
    this.dungeon = null;
    this.renderer = null;
    this.ui = null;

    this.lastTime = 0;
    this.animFrame = null;

    this.setupUI();
    this.setupEvents();
    this.loop = this.loop.bind(this);
  }

  setupUI() {
    // 标题屏幕按钮
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('help-btn').addEventListener('click', () => {
      document.getElementById('title-screen').classList.add('hidden');
      document.getElementById('help-screen').classList.remove('hidden');
    });
    document.getElementById('help-back-btn').addEventListener('click', () => {
      document.getElementById('help-screen').classList.add('hidden');
      document.getElementById('title-screen').classList.remove('hidden');
    });
    document.getElementById('restart-btn').addEventListener('click', () => this.startGame());
    document.getElementById('menu-btn').addEventListener('click', () => this.returnToMenu());
  }

  setupEvents() {
    document.addEventListener('keydown', e => this.handleKey(e));

    // 全局事件
    EventBus.on('reveal_map', () => {
      if (!this.dungeon) return;
      for (let y = 0; y < this.dungeon.height; y++)
        for (let x = 0; x < this.dungeon.width; x++)
          this.dungeon.revealed[y][x] = true;
      this.ui.addMessage('地图已全部揭示！', 'item');
    });

    EventBus.on('teleport_player', () => {
      if (!this.dungeon || !this.player) return;
      const rooms = this.dungeon.rooms.filter(r =>
        !(r.cx === this.player.x && r.cy === this.player.y)
      );
      if (rooms.length > 0) {
        const room = randChoice(rooms);
        this.player.x = room.cx;
        this.player.y = room.cy;
        this.dungeon.computeVisibility(this.player.x, this.player.y, VISION_RADIUS);
        this.renderer.updateCamera(this.player, this.dungeon);
        this.ui.addMessage('你瞬间移动了！', 'item');
      }
    });

    EventBus.on('fireball', ({ damage }) => {
      if (!this.dungeon || !this.player) return;
      let killed = 0;
      for (const enemy of this.dungeon.entities) {
        if (!enemy.alive) continue;
        if (dist(enemy.x, enemy.y, this.player.x, this.player.y) <= 4) {
          enemy.hp -= damage;
          if (enemy.hp <= 0) {
            enemy.alive = false;
            this.player.gold += enemy.gold;
            this.player.killCount++;
            const xpMsgs = this.player.addXP(enemy.xp);
            this.ui.addMessages(xpMsgs);
            killed++;
          }
        }
      }
      this.ui.addMessage(`火球爆炸！对周围敌人造成 ${damage} 点伤害，击杀 ${killed} 只。`, 'combat');
    });
  }

  startGame() {
    // 隐藏所有屏幕
    document.getElementById('title-screen').classList.add('hidden');
    document.getElementById('help-screen').classList.add('hidden');
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    this.player = new Player();
    this.ui = new UI();

    const canvas = document.getElementById('game-canvas');
    const minimap = document.getElementById('minimap-canvas');
    this.renderer = new Renderer(canvas, minimap);

    this.enterFloor(1);
    this.state = 'playing';

    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this.lastTime = performance.now();
    this.animFrame = requestAnimationFrame(this.loop);
  }

  enterFloor(floorNum) {
    this.dungeon = new Dungeon(floorNum);
    this.player.floor = floorNum;
    this.player.x = this.dungeon.playerStart.x;
    this.player.y = this.dungeon.playerStart.y;

    // 初始视野
    this.dungeon.computeVisibility(this.player.x, this.player.y, VISION_RADIUS);
    this.renderer.updateCamera(this.player, this.dungeon);

    if (floorNum === 1) {
      this.ui.addMessage('你踏入了深渊...', 'info');
      this.ui.addMessage('用方向键或WASD移动，撞击敌人攻击。', 'info');
      this.ui.addMessage('G拾取物品，1-5使用背包，E装备武器/防具。', 'info');
    } else {
      this.ui.addMessage(`进入第 ${floorNum} 层...`, 'info');
    }
  }

  returnToMenu() {
    document.getElementById('gameover-screen').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    this.state = 'title';
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
  }

  loop(timestamp) {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
    this.lastTime = timestamp;

    if (this.state === 'playing' && this.renderer) {
      this.renderer.update(dt);
      this.renderer.render(this.dungeon, this.player);
      this.ui.updateStats(this.player);
    }

    this.animFrame = requestAnimationFrame(this.loop);
  }

  handleKey(e) {
    if (this.state !== 'playing') return;

    // 防止方向键滚动页面
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) {
      e.preventDefault();
    }

    const key = e.key;

    // 移动
    const dirs = {
      'ArrowUp': [0, -1], 'w': [0, -1], 'W': [0, -1],
      'ArrowDown': [0, 1], 's': [0, 1], 'S': [0, 1],
      'ArrowLeft': [-1, 0], 'a': [-1, 0], 'A': [-1, 0],
      'ArrowRight': [1, 0], 'd': [1, 0], 'D': [1, 0],
    };

    if (dirs[key]) {
      const [dx, dy] = dirs[key];
      this.tryMove(dx, dy);
      return;
    }

    // 拾取
    if (key === 'g' || key === 'G') {
      this.pickupItem();
      return;
    }

    // 装备（E键）
    if (key === 'e' || key === 'E') {
      this.tryEquip();
      return;
    }

    // 使用背包物品 1-5
    if (key >= '1' && key <= '5') {
      const idx = parseInt(key) - 1;
      this.useInventoryItem(idx);
      return;
    }

    // 等待（回合推进）
    if (key === '.' || key === ' ') {
      this.endPlayerTurn();
      return;
    }
  }

  tryMove(dx, dy) {
    const nx = this.player.x + dx;
    const ny = this.player.y + dy;

    if (!this.dungeon.isWalkable(nx, ny)) return;

    // 有敌人则攻击
    const enemy = this.dungeon.getEntityAt(nx, ny);
    if (enemy) {
      const msgs = playerAttack(this.player, enemy);
      this.ui.addMessages(msgs);

      // 显示伤害浮字
      const dmgMsg = msgs.find(m => m.type === 'combat');
      if (dmgMsg) {
        const dmgNum = dmgMsg.text.match(/造成 (\d+) 点/);
        if (dmgNum) {
          this.renderer.addDamageEffect(nx, ny, `-${dmgNum[1]}`, '#ff4040');
        }
      }

      if (!this.player.isAlive()) {
        this.gameOver();
        return;
      }

      this.endPlayerTurn();
      return;
    }

    // 移动
    this.player.x = nx;
    this.player.y = ny;

    // 踩楼梯
    const tile = this.dungeon.tiles[ny][nx];
    if (tile === TILE.STAIRS) {
      this.descend();
      return;
    }

    // 踩陷阱
    if (tile === TILE.TRAP) {
      const msgs = stepOnTrap(this.player);
      this.ui.addMessages(msgs);
      this.dungeon.tiles[ny][nx] = TILE.FLOOR; // 陷阱触发后消失
      if (!this.player.isAlive()) {
        this.gameOver();
        return;
      }
    }

    // 自动拾取金币
    const itemObj = this.dungeon.getItemAt(nx, ny);
    if (itemObj && itemObj.item.type === 'gold') {
      this.player.gold += itemObj.item.amount;
      this.ui.addMessage(`拾取 ${itemObj.item.amount} 金币`, 'item');
      this.dungeon.removeItemAt(nx, ny);
    }

    this.endPlayerTurn();
  }

  endPlayerTurn() {
    this.player.turnCount++;

    // 更新视野
    this.dungeon.computeVisibility(this.player.x, this.player.y, VISION_RADIUS);
    this.renderer.updateCamera(this.player, this.dungeon);

    // 检查宝箱
    const chestObj = this.dungeon.items.find(
      i => i.x === this.player.x && i.y === this.player.y && i.isChest
    );
    if (chestObj) {
      this.openChest(chestObj);
    }

    // 敌人回合
    if (this.state === 'playing') {
      const msgs = enemyTurn(this.dungeon, this.player);
      this.ui.addMessages(msgs);

      if (!this.player.isAlive()) {
        this.gameOver();
      }
    }
  }

  openChest(chestObj) {
    const item = chestObj.item;
    this.dungeon.tiles[chestObj.y][chestObj.x] = TILE.FLOOR;

    if (item.type === 'gold') {
      this.player.gold += item.amount;
      this.ui.addMessage(`宝箱：获得 ${item.amount} 金币！`, 'item');
    } else if (this.player.canPickup()) {
      this.player.addItem(item);
      this.ui.addMessage(`宝箱：获得 ${item.icon || ''} ${item.name}！`, 'item');
    } else {
      this.ui.addMessage(`宝箱：背包已满，${item.name} 掉落地面！`, 'info');
      // 变为普通地面道具
      chestObj.isChest = false;
      return; // 不删除 item
    }

    this.dungeon.removeItemAt(chestObj.x, chestObj.y);
  }

  pickupItem() {
    const itemObj = this.dungeon.getItemAt(this.player.x, this.player.y);
    if (!itemObj) {
      this.ui.addMessage('这里没有物品。', 'info');
      return;
    }

    const item = itemObj.item;
    if (item.type === 'gold') {
      this.player.gold += item.amount;
      this.ui.addMessage(`拾取 ${item.amount} 金币`, 'item');
      this.dungeon.removeItemAt(this.player.x, this.player.y);
      this.endPlayerTurn();
      return;
    }

    if (!this.player.canPickup()) {
      this.ui.addMessage('背包已满！(使用物品腾出空间)', 'info');
      return;
    }

    this.player.addItem(item);
    this.ui.addMessage(`拾取：${item.icon || ''} ${item.name}`, 'item');
    this.dungeon.removeItemAt(this.player.x, this.player.y);
    this.endPlayerTurn();
  }

  tryEquip() {
    // 自动装备背包中最后一件武器/防具
    for (let i = this.player.inventory.length - 1; i >= 0; i--) {
      const item = this.player.inventory[i];
      if (item.type === 'weapon' || item.type === 'armor') {
        const result = this.player.equipItem(i);
        if (result) {
          this.ui.addMessage(result.msg, 'item');
          this.endPlayerTurn();
          return;
        }
      }
    }
    this.ui.addMessage('背包中没有可装备的物品。', 'info');
  }

  useInventoryItem(index) {
    const item = this.player.inventory[index];
    if (!item) {
      this.ui.addMessage(`背包格 ${index + 1} 是空的。`, 'info');
      return;
    }

    // 武器/防具自动装备
    if (item.type === 'weapon' || item.type === 'armor') {
      const result = this.player.equipItem(index);
      if (result) this.ui.addMessage(result.msg, 'item');
      this.endPlayerTurn();
      return;
    }

    const result = this.player.useItem(index);
    if (result) {
      this.ui.addMessage(result.msg, result.type || 'item');
      if (result.consumed) this.endPlayerTurn();
    }
  }

  descend() {
    if (this.player.floor >= MAX_FLOOR) {
      this.win();
      return;
    }

    this.player.floorsCleared++;
    const nextFloor = this.player.floor + 1;
    this.enterFloor(nextFloor);
  }

  gameOver() {
    this.state = 'gameover';
    this.ui.addMessage('你已陨落...', 'danger');
    setTimeout(() => {
      this.ui.showGameOver(this.player, false);
    }, 800);
  }

  win() {
    this.state = 'won';
    this.ui.addMessage('你征服了深渊最深处！', 'level');
    setTimeout(() => {
      this.ui.showGameOver(this.player, true);
    }, 800);
  }
}

// ── 启动 ──
window.addEventListener('DOMContentLoaded', () => {
  window._game = new Game();
});
