// ─── 实体系统（玩家、敌人、状态效果、职业、天赋）────────

// ── 状态效果 ──────────────────────────────────────────────
const STATUS = {
  POISON:  'poison',
  BURN:    'burn',
  FREEZE:  'freeze',
  STUN:    'stun',
  BLEED:   'bleed',
  BLESS:   'bless',
  CURSE:   'curse',
  REGEN:   'regen',
  SHIELD:  'shield',
  HASTE:   'haste',
};

const STATUS_DATA = {
  poison: { name: '中毒', color: '#40c040', icon: '☠', dot: 2, turns: 5 },
  burn:   { name: '燃烧', color: '#ff8000', icon: '🔥', dot: 3, turns: 3, particle: 'fire' },
  freeze: { name: '冰冻', color: '#80d0ff', icon: '❄', skip: true, turns: 2, particle: 'ice' },
  stun:   { name: '眩晕', color: '#ffff40', icon: '💫', skip: true, turns: 1 },
  bleed:  { name: '流血', color: '#c00020', icon: '🩸', dot: 2, turns: 4, particle: 'blood' },
  bless:  { name: '祝福', color: '#f0c040', icon: '✨', atkMod: 1.3, defMod: 1.3, turns: 8 },
  curse:  { name: '诅咒', color: '#9020c0', icon: '💀', atkMod: 0.7, defMod: 0.7, turns: 6 },
  regen:  { name: '再生', color: '#40ff80', icon: '💚', heal: 3, turns: 5, particle: 'heal' },
  shield: { name: '护盾', color: '#c0c0ff', icon: '🛡', absorb: true, turns: 1 },
  haste:  { name: '急速', color: '#ffff80', icon: '⚡', extraTurn: true, turns: 3 },
};

// ── 职业定义 ──────────────────────────────────────────────
const CLASSES = {
  warrior: {
    name: '战士', icon: '⚔',
    color: '#e06040',
    desc: '钢铁意志的近战专家',
    bonusDesc: 'HP低于30%时攻击力+50%',
    startHp: 40, startAtk: 7, startDef: 4,
    startWeapon: { name: '短剑', type: 'weapon', bonus: 3, icon: '⚔', tier: 1 },
    startArmor:  { name: '皮甲', type: 'armor',  bonus: 2, icon: '🛡', tier: 1 },
    passive: 'berserker_class',
  },
  rogue: {
    name: '盗贼', icon: '🗡',
    color: '#6060c0',
    desc: '行于暗影的刺客',
    bonusDesc: '攻击沉睡敌人时暴击×3，30%闪避概率',
    startHp: 25, startAtk: 9, startDef: 1,
    startWeapon: { name: '匕首', type: 'weapon', bonus: 2, icon: '🗡', tier: 1, crit: 20 },
    startArmor:  null,
    passive: 'assassin_class',
  },
  mage: {
    name: '法师', icon: '🔮',
    color: '#a060e0',
    desc: '掌控元素之力的智者',
    bonusDesc: '受到伤害减少30%，法术效果加倍',
    startHp: 22, startAtk: 12, startDef: 1,
    startWeapon: { name: '魔法杖', type: 'weapon', bonus: 5, icon: '🪄', tier: 2, magic: true },
    startArmor:  null,
    passive: 'mage_class',
  },
};

// ── 天赋定义 ──────────────────────────────────────────────
const ALL_PERKS = [
  { id: 'power_strike', name: '猛击',    icon: '⚔', desc: '攻击力 +4',      apply: p => p.baseAtk += 4 },
  { id: 'iron_skin',    name: '铁皮',    icon: '🛡', desc: '防御力 +3',      apply: p => p.baseDef += 3 },
  { id: 'vitality',     name: '活力',    icon: '❤', desc: '最大HP +18，并立即恢复', apply: p => { p.maxHp += 18; p.hp = Math.min(p.hp + 18, p.maxHp); } },
  { id: 'life_steal',   name: '吸血',    icon: '🩸', desc: '击杀时恢复 3 HP', passive: 'life_steal' },
  { id: 'double_gold',  name: '掘金者',  icon: '💰', desc: '获得双倍金币',    passive: 'double_gold' },
  { id: 'sharp_eyes',   name: '锐利之眼', icon: '👁', desc: '视野范围 +2',    apply: p => p.visionRadius += 2 },
  { id: 'toxic_touch',  name: '毒掌',    icon: '☠', desc: '攻击30%概率中毒', passive: 'toxic_touch' },
  { id: 'fire_touch',   name: '火焰掌',  icon: '🔥', desc: '攻击25%概率燃烧', passive: 'fire_touch' },
  { id: 'frost_touch',  name: '冰霜掌',  icon: '❄', desc: '攻击25%概率冰冻', passive: 'frost_touch' },
  { id: 'quick_hands',  name: '快手',    icon: '👐', desc: '背包容量 +1',     apply: p => p.maxInvSize++ },
  { id: 'medic',        name: '医者',    icon: '💊', desc: '药水效果 +50%',  passive: 'potion_boost' },
  { id: 'berserker',    name: '狂战士',  icon: '💢', desc: 'HP<50%时攻击力 +5', passive: 'berserker' },
  { id: 'dodge',        name: '闪避',    icon: '💨', desc: '25%概率完全规避攻击', passive: 'dodge' },
  { id: 'execute',      name: '处刑者',  icon: '⚡', desc: '对HP<25%的敌人伤害×2', passive: 'execute' },
  { id: 'no_trap',      name: '轻盈步伐', icon: '🦶', desc: '不会触发陷阱',   passive: 'no_trap' },
  { id: 'regen_perk',   name: '再生',    icon: '💚', desc: '每 4 回合恢复 1 HP', passive: 'regen_perk' },
  { id: 'bleed_touch',  name: '裂伤',    icon: '🩸', desc: '攻击30%概率流血', passive: 'bleed_touch' },
  { id: 'arcane_boost', name: '秘法强化', icon: '🔮', desc: '卷轴伤害 +50%', passive: 'arcane_boost' },
];

// ── 敌人模板 ──────────────────────────────────────────────
const ENEMY_TEMPLATES = [
  {
    id: 'bat',       name: '幽蝠',     symbol: 'b', color: '#604090',
    hp: 6,  atk: 3,  def: 0, xp: 4,  gold: [0,2],
    floor: [1, 3], alertRadius: 8, canFly: true,
    desc: '快速但脆弱，可越过陷阱',
  },
  {
    id: 'rat',       name: '巨鼠',     symbol: 'r', color: '#a06030',
    hp: 8,  atk: 3,  def: 0, xp: 4,  gold: [0,2],
    floor: [1, 4], packHunter: true,
    desc: '成群结队更危险',
  },
  {
    id: 'skeleton',  name: '骷髅',     symbol: 'S', color: '#c0c0b0',
    hp: 14, atk: 5,  def: 1, xp: 7,  gold: [1,5],
    floor: [1, 6], undead: true,
    desc: '不死之身，对毒素免疫',
  },
  {
    id: 'goblin',    name: '哥布林',   symbol: 'G', color: '#40a040',
    hp: 18, atk: 6,  def: 2, xp: 10, gold: [2,8],
    floor: [2, 7], callReinforcements: true,
    desc: '会呼叫同伴支援',
  },
  {
    id: 'slime',     name: '史莱姆',   symbol: 's', color: '#40c080',
    hp: 12, atk: 4,  def: 3, xp: 8,  gold: [0,4],
    floor: [2, 5], splitOnDeath: false,
    statusOnHit: 'poison', statusChance: 0.3,
    desc: '攻击有概率中毒',
  },
  {
    id: 'orc',       name: '兽人',     symbol: 'O', color: '#508050',
    hp: 30, atk: 9,  def: 4, xp: 18, gold: [3,12],
    floor: [3, 99],
    desc: '血厚防高，正面硬敌',
  },
  {
    id: 'spider',    name: '蜘蛛女王', symbol: 'W', color: '#805020',
    hp: 22, atk: 8,  def: 2, xp: 16, gold: [2,8],
    floor: [3, 8], statusOnHit: 'poison', statusChance: 0.4,
    desc: '注毒攻击，躲开！',
  },
  {
    id: 'troll',     name: '食人妖',   symbol: 'T', color: '#306850',
    hp: 50, atk: 13, def: 6, xp: 30, gold: [5,20],
    floor: [4, 99], regen: 3,
    desc: '每回合回血，尽快击杀',
  },
  {
    id: 'ghost',     name: '幽灵',     symbol: '?', color: '#c0c0ff',
    hp: 20, atk: 10, def: 0, xp: 22, gold: [2,8],
    floor: [4, 9], phaseThrough: true, canFly: true,
    statusOnHit: 'curse', statusChance: 0.25,
    desc: '可穿墙，攻击致诅咒',
  },
  {
    id: 'demon',     name: '地狱恶魔', symbol: 'D', color: '#c04020',
    hp: 35, atk: 14, def: 5, xp: 35, gold: [6,18],
    floor: [5, 99], fireImmune: true,
    statusOnHit: 'burn', statusChance: 0.35,
    desc: '免疫火焰，攻击点燃',
  },
  {
    id: 'vampire',   name: '吸血鬼',   symbol: 'V', color: '#800040',
    hp: 40, atk: 15, def: 5, xp: 40, gold: [10,30],
    floor: [5, 99], lifesteal: 4, undead: true,
    desc: '攻击吸血，夜之掠食者',
  },
  {
    id: 'lich',      name: '巫妖',     symbol: 'L', color: '#8040c0',
    hp: 45, atk: 18, def: 6, xp: 55, gold: [15,40],
    floor: [7, 99], undead: true, spellcaster: true,
    statusOnHit: 'curse', statusChance: 0.4,
    desc: '远程法术攻击，可致诅咒',
  },
  {
    id: 'dragon',    name: '深渊火龙', symbol: 'X', color: '#e04020',
    hp: 90, atk: 22, def: 10, xp: 100, gold: [30,60],
    floor: [8, 99], fireBreath: true, fireImmune: true,
    desc: '喷火攻击！小心防御',
  },
];

// Boss 定义
const BOSS_TEMPLATES = [
  {
    id: 'stone_guardian', name: '石像守卫', symbol: 'B', color: '#808090',
    floor: 5,
    hp: 120, atk: 18, def: 12, xp: 150, gold: [50, 80],
    isBoss: true, poisonImmune: true,
    stunAttack: 0.3, // 30%概率震击
    desc: '坚不可摧的守卫，免疫毒素',
  },
  {
    id: 'abyss_lord', name: '深渊魔王', symbol: 'A', color: '#9020d0',
    floor: 10,
    hp: 250, atk: 28, def: 16, xp: 500, gold: [100, 200],
    isBoss: true, fireImmune: true, poisonImmune: true,
    fireBreath: true, summonMinions: true, lifesteal: 6,
    desc: '深渊的主宰！终极挑战！',
  },
];

function spawnEnemy(x, y, floor) {
  const available = ENEMY_TEMPLATES.filter(t =>
    floor >= t.floor[0] && floor <= t.floor[1]
  );
  // 权重：越接近楼层范围中间的敌人越常见
  const tpl = randChoice(available);
  const hpBonus = Math.floor(floor * 0.6);
  const maxHp = tpl.hp + hpBonus + randInt(-2, 2);
  return {
    ...tpl,
    x, y,
    maxHp,
    hp: maxHp,
    atk: tpl.atk + Math.floor(floor * 0.35),
    def: Math.floor(tpl.def + floor * 0.12),
    alive: true,
    gold: randInt(tpl.gold[0], tpl.gold[1]),
    sleeping: Math.random() < 0.35,
    alertRadius: tpl.alertRadius || 6,
    chasing: false,
    statuses: {},
    hitFlash: 0, // 受击闪烁计时
  };
}

function spawnBoss(x, y, floor) {
  const tpl = BOSS_TEMPLATES.find(b => b.floor === floor) || BOSS_TEMPLATES[0];
  return {
    ...tpl,
    x, y,
    maxHp: tpl.hp,
    hp: tpl.hp,
    alive: true,
    gold: randInt(tpl.gold[0], tpl.gold[1]),
    sleeping: false,
    alertRadius: 20,
    chasing: true,
    statuses: {},
    hitFlash: 0,
    phase: 1,
  };
}

// ── 玩家类 ────────────────────────────────────────────────
class Player {
  constructor(className = 'warrior') {
    const cls = CLASSES[className];
    this.className = className;
    this.classData = cls;

    this.x = 0; this.y = 0;
    this.level = 1;
    this.xp = 0;
    this.xpNext = 12;

    this.maxHp = cls.startHp;
    this.hp = cls.startHp;
    this.baseAtk = cls.startAtk;
    this.baseDef = cls.startDef;
    this.visionRadius = 8;

    this.gold = 0;
    this.floor = 1;
    this.turnCount = 0;
    this.killCount = 0;
    this.floorsCleared = 0;
    this.totalDamageDealt = 0;
    this.totalDamageReceived = 0;

    this.weapon = cls.startWeapon ? { ...cls.startWeapon } : null;
    this.armor  = cls.startArmor  ? { ...cls.startArmor  } : null;

    this.inventory = [];
    this.maxInvSize = 5;
    this.perks = [];
    this.statuses = {};

    this.pendingLevelUp = 0;
    this.extraTurn = false;

    // 职业特定加成
    if (className === 'mage') {
      // 法师起始2张火球卷轴
      this.inventory.push({ type: 'scroll', name: '火球卷轴', effect: 'fireball', value: 25, icon: '📜' });
      this.inventory.push({ type: 'scroll', name: '火球卷轴', effect: 'fireball', value: 25, icon: '📜' });
    } else if (className === 'rogue') {
      // 盗贼起始1张传送卷轴
      this.inventory.push({ type: 'scroll', name: '传送卷轴', effect: 'teleport', icon: '📜' });
    }
  }

  get atk() {
    let a = this.baseAtk + (this.weapon ? this.weapon.bonus : 0);
    // 状态修正
    if (this.statuses.bless) a = Math.floor(a * STATUS_DATA.bless.atkMod);
    if (this.statuses.curse) a = Math.floor(a * STATUS_DATA.curse.atkMod);
    // 战士狂暴
    if (this.hasPerk('berserker_class') && this.hp < this.maxHp * 0.3) a = Math.floor(a * 1.5);
    if (this.hasPerk('berserker') && this.hp < this.maxHp * 0.5) a += 5;
    return a;
  }

  get def() {
    let d = this.baseDef + (this.armor ? this.armor.bonus : 0);
    if (this.statuses.bless) d = Math.floor(d * STATUS_DATA.bless.defMod);
    if (this.statuses.curse) d = Math.floor(d * STATUS_DATA.curse.defMod);
    return d;
  }

  isAlive() { return this.hp > 0; }

  hasPerk(id) {
    return this.perks.some(p => p.id === id || p.passive === id);
  }

  hasStatus(id) {
    return !!this.statuses[id] && this.statuses[id].turns > 0;
  }

  addStatus(id, turnsOverride) {
    const data = STATUS_DATA[id];
    if (!data) return;
    const turns = turnsOverride || data.turns;
    if (this.statuses[id]) {
      this.statuses[id].turns = Math.max(this.statuses[id].turns, turns);
    } else {
      this.statuses[id] = { turns };
    }
  }

  removeStatus(id) { delete this.statuses[id]; }

  // 回合开始时处理状态效果，返回消息数组
  tickStatuses() {
    const msgs = [];
    const toRemove = [];

    for (const [id, state] of Object.entries(this.statuses)) {
      const data = STATUS_DATA[id];
      if (!data) { toRemove.push(id); continue; }

      // 持续伤害
      if (data.dot) {
        const dmg = Math.max(1, data.dot - Math.floor(this.def * 0.3));
        this.hp = Math.max(0, this.hp - dmg);
        msgs.push({ text: `${data.icon} ${data.name}！你受到 ${dmg} 点伤害。`, type: 'danger' });
      }

      // 持续治疗
      if (data.heal) {
        const h = Math.min(data.heal, this.maxHp - this.hp);
        this.hp += h;
        if (h > 0) msgs.push({ text: `${data.icon} ${data.name}：恢复 ${h} HP`, type: 'item' });
      }

      state.turns--;
      if (state.turns <= 0) toRemove.push(id);
    }

    for (const id of toRemove) delete this.statuses[id];
    return msgs;
  }

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
    this.xpNext = Math.floor(this.xpNext * 1.6);
    const hpGain = randInt(5, 9);
    const atkGain = randInt(1, 3);
    const defGain = randInt(0, 1);
    this.maxHp += hpGain;
    this.hp = Math.min(this.hp + hpGain, this.maxHp);
    this.baseAtk += atkGain;
    this.baseDef += defGain;
    this.pendingLevelUp++;
    msgs.push({ text: `⬆ 升级！Lv ${this.level}  HP+${hpGain}  ATK+${atkGain}  DEF+${defGain}`, type: 'level' });
  }

  // 背包
  canPickup() { return this.inventory.length < this.maxInvSize; }

  addItem(item) {
    if (!this.canPickup()) return false;
    this.inventory.push(item);
    return true;
  }

  removeItem(index) {
    return this.inventory.splice(index, 1)[0];
  }

  equipItem(index) {
    const item = this.inventory[index];
    if (!item) return null;
    if (item.type === 'weapon') {
      const old = this.weapon;
      this.weapon = item;
      this.inventory.splice(index, 1);
      if (old) this.inventory.push(old);
      return { msg: `装备了 ${item.icon || ''} ${item.name}  (ATK +${item.bonus})` };
    }
    if (item.type === 'armor') {
      const old = this.armor;
      this.armor = item;
      this.inventory.splice(index, 1);
      if (old) this.inventory.push(old);
      return { msg: `穿上了 ${item.icon || ''} ${item.name}  (DEF +${item.bonus})` };
    }
    return null;
  }

  takeDamage(rawDmg) {
    // 法师减伤30%
    if (this.hasPerk('mage_class')) rawDmg = Math.floor(rawDmg * 0.7);

    // 护盾吸收
    if (this.hasStatus('shield')) {
      this.removeStatus('shield');
      return 0;
    }

    // 闪避（盗贼职业 + 闪避天赋）
    if (this.hasPerk('assassin_class') || this.hasPerk('dodge')) {
      const dodgeChance = this.hasPerk('assassin_class') ? 0.30 : 0.25;
      if (Math.random() < dodgeChance) return -1; // -1 表示闪避
    }

    const actual = Math.max(1, rawDmg - this.def);
    this.hp = Math.max(0, this.hp - actual);
    this.totalDamageReceived += actual;
    return actual;
  }
}
