// ─── 地牢生成 (BSP 分割法) ──────────────────────────────

const TILE = {
  WALL: 0,
  FLOOR: 1,
  DOOR: 2,
  STAIRS: 3,
  CHEST: 4,
  TRAP: 5,
};

const MAP_W = 40;
const MAP_H = 40;
const TILE_SIZE = 16; // canvas 像素

class Room {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
  get cx() { return Math.floor(this.x + this.w / 2); }
  get cy() { return Math.floor(this.y + this.h / 2); }
  intersects(other) {
    return !(
      this.x + this.w + 1 < other.x ||
      other.x + other.w + 1 < this.x ||
      this.y + this.h + 1 < other.y ||
      other.y + other.h + 1 < this.y
    );
  }
}

class Dungeon {
  constructor(floor) {
    this.floor = floor;
    this.width = MAP_W;
    this.height = MAP_H;
    this.tiles = [];
    this.rooms = [];
    this.entities = []; // 敌人
    this.items = [];    // 掉落物品
    this.stairsPos = null;
    this.playerStart = null;
    this.revealed = []; // 已探索格子
    this.visible = [];  // 当前可见格子

    this.generate();
  }

  generate() {
    // 初始化全墙
    for (let y = 0; y < this.height; y++) {
      this.tiles[y] = [];
      this.revealed[y] = [];
      this.visible[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.tiles[y][x] = TILE.WALL;
        this.revealed[y][x] = false;
        this.visible[y][x] = false;
      }
    }

    // 放置房间
    const maxRooms = 12 + Math.min(this.floor, 6);
    const minSize = 4;
    const maxSize = 9;

    for (let i = 0; i < 200; i++) {
      if (this.rooms.length >= maxRooms) break;
      const w = randInt(minSize, maxSize);
      const h = randInt(minSize, maxSize);
      const x = randInt(1, this.width - w - 1);
      const y = randInt(1, this.height - h - 1);
      const room = new Room(x, y, w, h);

      if (!this.rooms.some(r => r.intersects(room))) {
        this.carveRoom(room);
        if (this.rooms.length > 0) {
          this.connectToNearest(room);
        }
        this.rooms.push(room);
      }
    }

    // 玩家出生在第一个房间中心
    this.playerStart = { x: this.rooms[0].cx, y: this.rooms[0].cy };

    // 楼梯在最后一个房间
    const lastRoom = this.rooms[this.rooms.length - 1];
    this.stairsPos = { x: lastRoom.cx, y: lastRoom.cy };
    this.tiles[lastRoom.cy][lastRoom.cx] = TILE.STAIRS;

    // 生成内容
    this.spawnEntitiesAndItems();
  }

  carveRoom(room) {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        this.tiles[y][x] = TILE.FLOOR;
      }
    }
  }

  connectToNearest(room) {
    let nearest = null;
    let minDist = Infinity;
    for (const r of this.rooms) {
      const d = dist(room.cx, room.cy, r.cx, r.cy);
      if (d < minDist) { minDist = d; nearest = r; }
    }
    this.carveCorridor(room.cx, room.cy, nearest.cx, nearest.cy);
  }

  carveCorridor(x1, y1, x2, y2) {
    let cx = x1, cy = y1;
    // L形走廊（先横后竖）
    while (cx !== x2) {
      this.tiles[cy][cx] = TILE.FLOOR;
      cx += (x2 > cx) ? 1 : -1;
    }
    while (cy !== y2) {
      this.tiles[cy][cx] = TILE.FLOOR;
      cy += (y2 > cy) ? 1 : -1;
    }
    this.tiles[cy][cx] = TILE.FLOOR;
  }

  spawnEntitiesAndItems() {
    const floor = this.floor;
    // 跳过第一个房间（玩家出生点）
    for (let i = 1; i < this.rooms.length; i++) {
      const room = this.rooms[i];
      const isLast = (i === this.rooms.length - 1);

      // 敌人数量随楼层增加
      const enemyCount = randInt(1, 2 + Math.floor(floor / 2));
      for (let j = 0; j < enemyCount; j++) {
        const pos = this.randomPosInRoom(room);
        if (pos) {
          this.entities.push(spawnEnemy(pos.x, pos.y, floor));
        }
      }

      // 宝箱（最后房间必有，其他随机）
      if (isLast || Math.random() < 0.4) {
        const pos = this.randomPosInRoom(room, true);
        if (pos) {
          this.tiles[pos.y][pos.x] = TILE.CHEST;
          this.items.push({ x: pos.x, y: pos.y, item: generateLoot(floor), isChest: true });
        }
      }

      // 地面道具
      if (Math.random() < 0.35) {
        const pos = this.randomPosInRoom(room);
        if (pos) {
          this.items.push({ x: pos.x, y: pos.y, item: generateLoot(floor, true), isChest: false });
        }
      }

      // 陷阱（深层增加）
      if (floor > 2 && Math.random() < 0.2) {
        const pos = this.randomPosInRoom(room);
        if (pos) {
          this.tiles[pos.y][pos.x] = TILE.TRAP;
        }
      }
    }
  }

  randomPosInRoom(room, avoidCenter = false) {
    const maxTries = 20;
    for (let i = 0; i < maxTries; i++) {
      const x = randInt(room.x + 1, room.x + room.w - 2);
      const y = randInt(room.y + 1, room.y + room.h - 2);
      if (avoidCenter && x === room.cx && y === room.cy) continue;
      if (this.tiles[y][x] === TILE.FLOOR && !this.isOccupied(x, y)) {
        return { x, y };
      }
    }
    return null;
  }

  isOccupied(x, y) {
    if (this.stairsPos && this.stairsPos.x === x && this.stairsPos.y === y) return true;
    if (this.playerStart && this.playerStart.x === x && this.playerStart.y === y) return true;
    return this.entities.some(e => e.x === x && e.y === y) ||
           this.items.some(i => i.x === x && i.y === y);
  }

  isWalkable(x, y) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return this.tiles[y][x] !== TILE.WALL;
  }

  // 计算视野（简单矩形视野 + 遮挡）
  computeVisibility(px, py, radius) {
    // 清空上一帧可见
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++)
        this.visible[y][x] = false;

    // 投射光线（圆形范围内，用 Bresenham 检测遮挡）
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const tx = px + dx;
        const ty = py + dy;
        if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) continue;

        if (this.hasLineOfSight(px, py, tx, ty)) {
          this.visible[ty][tx] = true;
          this.revealed[ty][tx] = true;
        }
      }
    }
  }

  hasLineOfSight(x0, y0, x1, y1) {
    // Bresenham 直线算法
    let dx = Math.abs(x1 - x0);
    let dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1;
    let sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let cx = x0, cy = y0;

    while (true) {
      if (cx === x1 && cy === y1) return true;
      // 遇到墙壁则阻断（但墙壁本身可见）
      if (cx !== x0 || cy !== y0) {
        if (this.tiles[cy][cx] === TILE.WALL) {
          return (cx === x1 && cy === y1);
        }
      }
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; cx += sx; }
      if (e2 < dx) { err += dx; cy += sy; }
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
    if (idx !== -1) {
      this.items.splice(idx, 1);
    }
  }
}
