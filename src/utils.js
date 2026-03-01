// ─── 工具函数 + A* 寻路 ──────────────────────────────────

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function dist(ax, ay, bx, by) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function distEucl(ax, ay, bx, by) {
  const dx = ax - bx, dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

function lerpColor(a, b, t) {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const rr = Math.round(ar + (br - ar) * t);
  const rg = Math.round(ag + (bg - ag) * t);
  const rb = Math.round(ab + (bb - ab) * t);
  return `#${rr.toString(16).padStart(2,'0')}${rg.toString(16).padStart(2,'0')}${rb.toString(16).padStart(2,'0')}`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

// ── A* 寻路 ──────────────────────────────────────────────

class MinHeap {
  constructor(compare) {
    this.data = [];
    this.compare = compare;
  }
  push(item) {
    this.data.push(item);
    this._bubbleUp(this.data.length - 1);
  }
  pop() {
    const top = this.data[0];
    const last = this.data.pop();
    if (this.data.length > 0) {
      this.data[0] = last;
      this._sinkDown(0);
    }
    return top;
  }
  get size() { return this.data.length; }
  _bubbleUp(i) {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.compare(this.data[i], this.data[parent]) < 0) {
        [this.data[i], this.data[parent]] = [this.data[parent], this.data[i]];
        i = parent;
      } else break;
    }
  }
  _sinkDown(i) {
    const n = this.data.length;
    while (true) {
      let min = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.compare(this.data[l], this.data[min]) < 0) min = l;
      if (r < n && this.compare(this.data[r], this.data[min]) < 0) min = r;
      if (min === i) break;
      [this.data[i], this.data[min]] = [this.data[min], this.data[i]];
      i = min;
    }
  }
}

// 返回路径数组 [{x,y}...]，不包含起点，包含终点
// maxSteps 限制搜索深度（防止开销过大）
function aStar(dungeon, sx, sy, tx, ty, ignoreEntities = false, maxSteps = 150) {
  if (sx === tx && sy === ty) return [];

  const key = (x, y) => y * dungeon.width + x;
  const h = (x, y) => dist(x, y, tx, ty);

  const open = new MinHeap((a, b) => a.f - b.f);
  const gScore = new Map();
  const cameFrom = new Map();

  const startKey = key(sx, sy);
  gScore.set(startKey, 0);
  open.push({ x: sx, y: sy, f: h(sx, sy) });

  let steps = 0;

  while (open.size > 0 && steps < maxSteps) {
    steps++;
    const curr = open.pop();
    if (curr.x === tx && curr.y === ty) {
      // 重建路径
      const path = [];
      let k = key(curr.x, curr.y);
      while (cameFrom.has(k)) {
        path.unshift({ x: curr.x, y: curr.y });
        k = cameFrom.get(k);
        // recalc curr position
        const cy = Math.floor(k / dungeon.width);
        const cx = k - cy * dungeon.width;
        path.unshift({ x: cx, y: cy });
        break;
      }
      // Rebuild properly
      const fullPath = [];
      let cur = key(tx, ty);
      while (cameFrom.has(cur)) {
        const prev = cameFrom.get(cur);
        const cy = Math.floor(cur / dungeon.width);
        const cx = cur - cy * dungeon.width;
        fullPath.unshift({ x: cx, y: cy });
        cur = prev;
      }
      return fullPath;
    }

    const dirs = [[0,-1],[0,1],[-1,0],[1,0]];
    for (const [dx, dy] of dirs) {
      const nx = curr.x + dx, ny = curr.y + dy;
      if (nx < 0 || ny < 0 || nx >= dungeon.width || ny >= dungeon.height) continue;
      if (!dungeon.isWalkable(nx, ny)) continue;
      if (!ignoreEntities && nx !== tx && ny !== ty) {
        if (dungeon.getEntityAt(nx, ny)) continue;
      }

      const nk = key(nx, ny);
      const tentativeG = (gScore.get(key(curr.x, curr.y)) || 0) + 1;
      if (!gScore.has(nk) || tentativeG < gScore.get(nk)) {
        gScore.set(nk, tentativeG);
        cameFrom.set(nk, key(curr.x, curr.y));
        open.push({ x: nx, y: ny, f: tentativeG + h(nx, ny) });
      }
    }
  }
  return []; // 找不到路径
}

// ── 事件总线 ─────────────────────────────────────────────
const EventBus = {
  listeners: {},
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  },
  emit(event, data) {
    (this.listeners[event] || []).forEach(cb => cb(data));
  },
  off(event, cb) {
    if (!this.listeners[event]) return;
    if (cb) this.listeners[event] = this.listeners[event].filter(f => f !== cb);
    else delete this.listeners[event];
  }
};
