// ─── 实体定义（玩家 & 敌人）────────────────────────────

// ── 敌人模板 ──
const ENEMY_TEMPLATES = [
  // floor: 出现楼层范围
  {
    id: 'rat',       name: '地鼠',    symbol: 'r', color: '#a06030',
    hp: 5,  atk: 2,  def: 0, xp: 3,  gold: [0,2],
    floor: [1, 3], speed: 1
  },
  {
    id: 'skeleton',  name: '骷髅',    symbol: 'S', color: '#c0c0b0',
    hp: 10, atk: 4,  def: 1, xp: 6,  gold: [1,5],
    floor: [1, 5], speed: 1
  },
  {
    id: 'goblin',    name: '哥布林',  symbol: 'G', color: '#40a040',
    hp: 14, atk: 5,  def: 2, xp: 10, gold: [2,8],
    floor: [2, 7], speed: 1
  },
  {
    id: 'orc',       name: '兽人',    symbol: 'O', color: '#508050',
    hp: 25, atk: 8,  def: 4, xp: 18, gold: [3,12],
    floor: [3, 99], speed: 1
  },
  {
    id: 'troll',     name: '食人妖', symbol: 'T', color: '#306850',
    hp: 40, atk: 12, def: 6, xp: 30, gold: [5,20],
    floor: [5, 99], speed: 1,
    regen: 2  // 每回合回血
  },
  {
    id: 'vampire',   name: '吸血鬼', symbol: 'V', color: '#800040',
    hp: 35, atk: 14, def: 5, xp: 40, gold: [10,30],
    floor: [6, 99], speed: 1,
    lifesteal: 3
  },
  {
    id: 'dragon',    name: '深渊龙', symbol: 'D', color: '#e04020',
    hp: 80, atk: 20, def: 10, xp: 100, gold: [30,60],
    floor: [8, 99], speed: 1,
    fireBreath: true
  },
];

// 根据楼层生成敌人
function spawnEnemy(x, y, floor) {
  const available = ENEMY_TEMPLATES.filter(t =>
    floor >= t.floor[0] && floor <= t.floor[1]
  );
  const tpl = randChoice(available);
  const hpVar = Math.floor(tpl.hp * 0.2);
  const maxHp = tpl.hp + randInt(-hpVar, hpVar) + Math.floor(floor * 0.5);
  return {
    ...tpl,
    x, y,
    maxHp,
    hp: maxHp,
    atk: tpl.atk + Math.floor(floor * 0.3),
    def: tpl.def + Math.floor(floor * 0.1),
    alive: true,
    gold: randInt(tpl.gold[0], tpl.gold[1]),
    sleeping: Math.random() < 0.3, // 部分敌人初始睡着
    alertRadius: 6,
    chasing: false,
  };
}

// ── 玩家 ──
class Player {
  constructor() {
    this.x = 0;
    this.y = 0;

    this.level = 1;
    this.xp = 0;
    this.xpNext = 10;

    this.maxHp = 30;
    this.hp = 30;

    this.baseAtk = 5;
    this.baseDef = 2;

    this.gold = 0;
    this.floor = 1;
    this.turnCount = 0;
    this.killCount = 0;
    this.floorsCleared = 0;

    // 装备
    this.weapon = null;  // { name, bonus }
    this.armor = null;   // { name, bonus }

    // 背包（最多5格）
    this.inventory = [];
    this.maxInvSize = 5;
  }

  get atk() {
    return this.baseAtk + (this.weapon ? this.weapon.bonus : 0);
  }

  get def() {
    return this.baseDef + (this.armor ? this.armor.bonus : 0);
  }

  isAlive() { return this.hp > 0; }

  addXP(amount) {
    this.xp += amount;
    const msgs = [];
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.levelUp(msgs);
    }
    return msgs;
  }

  levelUp(msgs) {
    this.level++;
    this.xpNext = Math.floor(this.xpNext * 1.5);

    const hpGain = randInt(4, 8);
    const atkGain = randInt(1, 2);
    const defGain = randInt(0, 1);

    this.maxHp += hpGain;
    this.hp = Math.min(this.hp + hpGain, this.maxHp);
    this.baseAtk += atkGain;
    this.baseDef += defGain;

    msgs.push({
      text: `⬆ 升级！Lv ${this.level}  HP+${hpGain}  ATK+${atkGain}  DEF+${defGain}`,
      type: 'level'
    });
  }

  canPickup() {
    return this.inventory.length < this.maxInvSize;
  }

  addItem(item) {
    if (!this.canPickup()) return false;
    this.inventory.push(item);
    return true;
  }

  useItem(index) {
    const item = this.inventory[index];
    if (!item) return null;
    const result = applyItem(item, this);
    if (result.consumed) {
      this.inventory.splice(index, 1);
    }
    return result;
  }

  equipItem(index) {
    const item = this.inventory[index];
    if (!item) return null;
    if (item.type === 'weapon') {
      const old = this.weapon;
      this.weapon = item;
      this.inventory.splice(index, 1);
      if (old) this.inventory.push(old);
      return { msg: `装备了 ${item.name}` };
    }
    if (item.type === 'armor') {
      const old = this.armor;
      this.armor = item;
      this.inventory.splice(index, 1);
      if (old) this.inventory.push(old);
      return { msg: `穿上了 ${item.name}` };
    }
    return null;
  }

  takeDamage(dmg) {
    const actual = Math.max(1, dmg - this.def);
    this.hp = Math.max(0, this.hp - actual);
    return actual;
  }
}
