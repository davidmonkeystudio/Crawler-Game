// ─── 地牢生成系统 ────────────────────────────────────────

const TILE = {
  WALL: 0,
  FLOOR: 1,
  DOOR: 2,
  STAIRS: 3,
  CHEST: 4,
  TRAP: 5,
  TORCH: 6,     // 火把（装饰性，但影响视野）
  WATER: 7,     // 水坑（减速）
  SHRINE: 8,    // 神龛
  SHOP: 9,      // 商店格
  SECRET: 10,   // 隐藏门
};

const ROOM_TYPE = {
  NORMAL:   'normal',
  TREASURE: 'treasure',
  SHOP:     'shop',
  SHRINE:   'shrine',
  BOSS:     'boss',
  START:    'start',
};

const MAP_W = 50;
const MAP_H = 50;
const TILE_SIZE = 16;

class Room {
  constructor(x, y, w, h, type = ROOM_TYPE.NORMAL) {
    this.x = x; this.y = y; this.w = w; this.h = h;
    this.type = type;
    this.connected = [];
  }
  get cx() { return Math.floor(this.x + this.w / 2); }
  get cy() { return Math.floor(this.y + this.h / 2); }
  get area() { return this.w * this.h; }
  intersects(other, pad = 2) {
    return !(
      this.x + this.w + pad < other.x ||
      other.x + other.w + pad < this.x ||
      this.y + this.h + pad < other.y ||
      other.y + other.h + pad < this.y
    );
  }
  contains(x, y) {
    return x >= this.x && x < this.x + this.w &&
           y >= this.y && y < this.y + this.h;
  }
  randomFloor(margin = 1) {
    return {
      x: randInt(this.x + margin, this.x + this.w - 1 - margin),
      y: randInt(this.y + margin, this.y + this.h - 1 - margin),
    };
  }
}

class Dungeon {
  constructor(floor) {
    this.floor = floor;
    this.width  = MAP_W;
    this.height = MAP_H;
    this.tiles = [];
    this.tileVariant = []; // 瓦片变体索引（视觉多样性）
    this.rooms = [];
    this.entities = [];
    this.items = [];
    this.stairsPos = null;
    this.playerStart = null;
    this.revealed = [];
    this.visible = [];
    this.lightMap = []; // 0-1 的光照强度

    this._init();
    this.generate();
  }

  _init() {
    for (let y = 0; y < this.height; y++) {
      this.tiles[y] = [];
      this.tileVariant[y] = [];
      this.revealed[y] = [];
      this.visible[y] = [];
      this.lightMap[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.tiles[y][x] = TILE.WALL;
        this.tileVariant[y][x] = Math.floor(Math.random() * 4);
        this.revealed[y][x] = false;
        this.visible[y][x] = false;
        this.lightMap[y][x] = 0;
      }
    }
  }

  generate() {
    const floor = this.floor;
    const isBossFloor = (floor % 5 === 0);

    const maxRooms = isBossFloor ? 8 : Math.min(14 + floor, 20);
    const minRoomW = 4, maxRoomW = isBossFloor ? 10 : 9;
    const minRoomH = 4, maxRoomH = isBossFloor ? 10 : 9;

    // ── 生成房间 ──
    for (let attempt = 0; attempt < 300 && this.rooms.length < maxRooms; attempt++) {
      const w = randInt(minRoomW, maxRoomW);
      const h = randInt(minRoomH, maxRoomH);
      const x = randInt(1, this.width - w - 2);
      const y = randInt(1, this.height - h - 2);
      const room = new Room(x, y, w, h);

      if (!this.rooms.some(r => r.intersects(room))) {
        this.carveRoom(room);
        if (this.rooms.length > 0) {
          this.connectToNearest(room);
        }
        this.rooms.push(room);
      }
    }

    // ── 分配房间类型 ──
    this.rooms[0].type = ROOM_TYPE.START;

    const lastIdx = this.rooms.length - 1;
    if (isBossFloor) {
      this.rooms[lastIdx].type = ROOM_TYPE.BOSS;
    }

    // 随机特殊房间（跳过起点和最后房间）
    for (let i = 1; i < this.rooms.length - 1; i++) {
      const r = Math.random();
      if (r < 0.08 && !this.rooms.some(rm => rm.type === ROOM_TYPE.SHOP)) {
        this.rooms[i].type = ROOM_TYPE.SHOP;
      } else if (r < 0.14 && !this.rooms.some(rm => rm.type === ROOM_TYPE.SHRINE)) {
        this.rooms[i].type = ROOM_TYPE.SHRINE;
      } else if (r < 0.24) {
        this.rooms[i].type = ROOM_TYPE.TREASURE;
      }
    }

    // ── 玩家起点 ──
    this.playerStart = { x: this.rooms[0].cx, y: this.rooms[0].cy };

    // ── 楼梯 ──
    const lastRoom = this.rooms[lastIdx];
    this.stairsPos = { x: lastRoom.cx, y: lastRoom.cy };
    this.tiles[lastRoom.cy][lastRoom.cx] = TILE.STAIRS;

    // ── 装饰：火把 ──
    this.placeTorches();

    // ── 秘密通道 ──
    if (floor > 2 && Math.random() < 0.5) {
      this.placeSecretPassage();
    }

    // ── 放置内容 ──
    this.spawnContent();
  }

  carveRoom(room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        this.tiles[y][x] = TILE.FLOOR;
      }
    }
  }

  connectToNearest(room) {
    // 找最近的已有房间
    let nearest = null, minD = Infinity;
    for (const r of this.rooms) {
      const d = distEucl(room.cx, room.cy, r.cx, r.cy);
      if (d < minD) { minD = d; nearest = r; }
    }
    this.carveCorridor(room.cx, room.cy, nearest.cx, nearest.cy);
  }

  carveCorridor(x1, y1, x2, y2) {
    let cx = x1, cy = y1;
    if (Math.random() < 0.5) {
      // 先横后竖
      while (cx !== x2) { this.tiles[cy][cx] = TILE.FLOOR; cx += Math.sign(x2 - cx); }
      while (cy !== y2) { this.tiles[cy][cx] = TILE.FLOOR; cy += Math.sign(y2 - cy); }
    } else {
      // 先竖后横
      while (cy !== y2) { this.tiles[cy][cx] = TILE.FLOOR; cy += Math.sign(y2 - cy); }
      while (cx !== x2) { this.tiles[cy][cx] = TILE.FLOOR; cx += Math.sign(x2 - cx); }
    }
    this.tiles[cy][cx] = TILE.FLOOR;
  }

  placeTorches() {
    for (const room of this.rooms) {
      if (room.type === ROOM_TYPE.START) continue;
      // 沿墙壁放置火把
      const torchChance = 0.4;
      if (Math.random() < torchChance) {
        // 放在房间角落附近的墙壁
        const corners = [
          [room.x - 1, room.y + 1],
          [room.x + room.w, room.y + 1],
          [room.x - 1, room.y + room.h - 2],
          [room.x + room.w, room.y + room.h - 2],
        ];
        for (const [tx, ty] of corners) {
          if (ty > 0 && ty < this.height - 1 && tx > 0 && tx < this.width - 1) {
            if (this.tiles[ty][tx] === TILE.WALL) {
              if (Math.random() < 0.5) {
                this.tiles[ty][tx] = TILE.TORCH;
              }
            }
          }
        }
      }
    }
  }

  placeSecretPassage() {
    // 在两个不相连的房间之间挖掘一条隐藏走廊
    if (this.rooms.length < 3) return;
    const r1 = randChoice(this.rooms.slice(1, -1));
    const r2 = randChoice(this.rooms.slice(1, -1));
    if (r1 === r2) return;

    const px = randInt(r1.x, r1.x + r1.w - 1);
    const py = randInt(r1.y, r1.y + r1.h - 1);
    const ex = randInt(r2.x, r2.x + r2.w - 1);
    const ey = randInt(r2.y, r2.y + r2.h - 1);

    // 暗色走廊
    let cx = px, cy = py;
    while (cx !== ex) { this.tiles[cy][cx] = TILE.FLOOR; cx += Math.sign(ex - cx); }
    while (cy !== ey) { this.tiles[cy][cx] = TILE.FLOOR; cy += Math.sign(ey - cy); }
    this.tiles[cy][cx] = TILE.FLOOR;
  }

  spawnContent() {
    const floor = this.floor;

    for (let i = 0; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      if (room.type === ROOM_TYPE.START) continue;

      switch (room.type) {
        case ROOM_TYPE.BOSS:
          this.spawnBossRoom(room);
          break;
        case ROOM_TYPE.SHOP:
          this.spawnShopRoom(room);
          break;
        case ROOM_TYPE.SHRINE:
          this.tiles[room.cy][room.cx] = TILE.SHRINE;
          break;
        case ROOM_TYPE.TREASURE:
          this.spawnTreasureRoom(room);
          break;
        default:
          this.spawnNormalRoom(room, floor);
          break;
      }
    }
  }

  spawnNormalRoom(room, floor) {
    const enemyCount = randInt(1, 2 + Math.floor(floor / 2));
    for (let j = 0; j < enemyCount; j++) {
      const pos = this.randomFloorPos(room);
      if (pos) this.entities.push(spawnEnemy(pos.x, pos.y, floor));
    }

    // 随机宝箱
    if (Math.random() < 0.3) {
      const pos = this.randomFloorPos(room);
      if (pos) {
        this.tiles[pos.y][pos.x] = TILE.CHEST;
        this.items.push({ x: pos.x, y: pos.y, item: generateLoot(floor), isChest: true, opened: false });
      }
    }

    // 地面道具
    if (Math.random() < 0.25) {
      const pos = this.randomFloorPos(room);
      if (pos) {
        this.items.push({ x: pos.x, y: pos.y, item: generateLoot(floor, true), isChest: false });
      }
    }

    // 陷阱（深层增加）
    const trapChance = Math.min(0.05 + floor * 0.02, 0.3);
    if (Math.random() < trapChance) {
      const pos = this.randomFloorPos(room);
      if (pos) this.tiles[pos.y][pos.x] = TILE.TRAP;
    }
  }

  spawnTreasureRoom(room) {
    const floor = this.floor;
    // 2-3个宝箱，有守卫
    const chestCount = randInt(2, 3);
    for (let i = 0; i < chestCount; i++) {
      const pos = this.randomFloorPos(room);
      if (pos) {
        this.tiles[pos.y][pos.x] = TILE.CHEST;
        this.items.push({ x: pos.x, y: pos.y, item: generateLoot(floor + 2), isChest: true, opened: false });
      }
    }
    // 守卫
    const guardCount = randInt(1, 3);
    for (let i = 0; i < guardCount; i++) {
      const pos = this.randomFloorPos(room);
      if (pos) this.entities.push(spawnEnemy(pos.x, pos.y, floor + 1));
    }
  }

  spawnShopRoom(room) {
    const floor = this.floor;
    // 商店放3-4件物品
    const shopItems = [generateShopItem(floor), generateShopItem(floor), generateShopItem(floor)];
    const positions = [];
    for (let i = 0; i < shopItems.length; i++) {
      const pos = this.randomFloorPos(room);
      if (pos && !positions.some(p => p.x === pos.x && p.y === pos.y)) {
        positions.push(pos);
        this.items.push({
          x: pos.x, y: pos.y,
          item: shopItems[i].item,
          isShop: true,
          price: shopItems[i].price
        });
      }
    }
    this.tiles[room.cy][room.cx] = TILE.SHOP;
  }

  spawnBossRoom(room) {
    const floor = this.floor;
    const boss = spawnBoss(room.cx, room.cy - 1, floor);
    this.entities.push(boss);
    // Boss房有丰厚战利品
    for (let i = 0; i < 2; i++) {
      const pos = this.randomFloorPos(room, 2);
      if (pos) {
        this.tiles[pos.y][pos.x] = TILE.CHEST;
        this.items.push({ x: pos.x, y: pos.y, item: generateLoot(floor + 3), isChest: true, opened: false });
      }
    }
  }

  randomFloorPos(room, margin = 1) {
    for (let i = 0; i < 30; i++) {
      const x = randInt(room.x + margin, room.x + room.w - 1 - margin);
      const y = randInt(room.y + margin, room.y + room.h - 1 - margin);
      if (this.tiles[y][x] === TILE.FLOOR && !this.isOccupied(x, y)) {
        return { x, y };
      }
    }
    return null;
  }

  isOccupied(x, y) {
    if (this.stairsPos?.x === x && this.stairsPos?.y === y) return true;
    if (this.playerStart?.x === x && this.playerStart?.y === y) return true;
    return this.entities.some(e => e.x === x && e.y === y) ||
           this.items.some(i => i.x === x && i.y === y);
  }

  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const t = this.tiles[y][x];
    return t !== TILE.WALL && t !== TILE.SECRET;
  }

  // ── 视野 & 光照 ──────────────────────────────────────
  computeVisibility(px, py, radius) {
    // 清空
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        this.visible[y][x] = false;
        this.lightMap[y][x] = 0;
      }

    // 基础视野（FOV 投射）
    const r2 = radius * radius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const tx = px + dx, ty = py + dy;
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
        if (this.hasLineOfSight(px, py, tx, ty)) {
          this.visible[ty][tx] = true;
          this.revealed[ty][tx] = true;
          // 光照强度：近处亮，远处暗
          const d2 = dx * dx + dy * dy;
          this.lightMap[ty][tx] = Math.max(0, 1 - d2 / r2);
        }
      }
    }

    // 火把额外照亮附近
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (this.tiles[y][x] === TILE.TORCH && this.revealed[y][x]) {
          const tr = 3;
          for (let dy = -tr; dy <= tr; dy++) {
            for (let dx = -tr; dx <= tr; dx++) {
              const tx = x + dx, ty = y + dy;
              if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;
              if (!this.revealed[ty][tx]) continue;
              const boost = Math.max(0, 0.5 - (dx * dx + dy * dy) / (tr * tr));
              this.lightMap[ty][tx] = Math.min(1, this.lightMap[ty][tx] + boost);
            }
          }
        }
      }
    }
  }

  hasLineOfSight(x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;
    while (true) {
      if (cx === x1 && cy === y1) return true;
      if (cx !== x0 || cy !== y0) {
        const t = this.tiles[cy][cx];
        if (t === TILE.WALL || t === TILE.SECRET) return false;
      }
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 <  dx) { err += dx; cy += sy; }
    }
  }

  getEntityAt(x, y) {
    return this.entities.find(e => e.x === x && e.y === y && e.alive);
  }

  getItemAt(x, y) {
    return this.items.find(i => i.x === x && i.y === y);
  }

  removeItemAt(x, y) {
    const idx = this.items.findIndex(i => i.x === x && i.y === y);
    if (idx !== -1) this.items.splice(idx, 1);
  }

  getRoomAt(x, y) {
    return this.rooms.find(r => r.contains(x, y));
  }
}
