// ─── 物品系统 ────────────────────────────────────────────

const RARITY = {
  COMMON:    { name: '普通', color: '#c0c0c0', weight: 60 },
  UNCOMMON:  { name: '优良', color: '#40c060', weight: 25 },
  RARE:      { name: '稀有', color: '#4080f0', weight: 10 },
  EPIC:      { name: '史诗', color: '#c040f0', weight: 4 },
  LEGENDARY: { name: '传说', color: '#f0a020', weight: 1 },
};

const ITEM_COLORS = {
  potion: '#e04080',
  weapon: '#80c0ff',
  armor:  '#c0a060',
  scroll: '#d0a0ff',
  gold:   '#f0c040',
  ring:   '#ff8080',
};

// ── 武器库（按阶段分） ──────────────────────────────────
const WEAPONS = [
  // 阶段 1（floor 1-3）
  { name: '破木棒', bonus: 1, tier: 1, icon: '🪵', rarity: 'COMMON' },
  { name: '匕首',   bonus: 2, tier: 1, icon: '🗡', rarity: 'COMMON' },
  { name: '短剑',   bonus: 3, tier: 1, icon: '⚔', rarity: 'COMMON' },
  { name: '猎弓',   bonus: 3, tier: 1, icon: '🏹', rarity: 'UNCOMMON' },
  // 阶段 2（floor 2-5）
  { name: '长剑',   bonus: 5, tier: 2, icon: '⚔', rarity: 'UNCOMMON' },
  { name: '战斧',   bonus: 6, tier: 2, icon: '🪓', rarity: 'UNCOMMON' },
  { name: '铁锤',   bonus: 6, tier: 2, icon: '🔨', rarity: 'UNCOMMON', special: 'stun' },
  // 阶段 3（floor 4-7）
  { name: '精灵剑', bonus: 8,  tier: 3, icon: '⚔', rarity: 'RARE', magic: true },
  { name: '魔法杖', bonus: 7,  tier: 3, icon: '🪄', rarity: 'RARE', magic: true, special: 'magic_bonus' },
  { name: '阔剑',   bonus: 9,  tier: 3, icon: '⚔', rarity: 'RARE' },
  { name: '毒刃',   bonus: 7,  tier: 3, icon: '🗡', rarity: 'RARE', special: 'toxic_weapon' },
  // 阶段 4（floor 6-10）
  { name: '龙骨剑', bonus: 12, tier: 4, icon: '⚔', rarity: 'EPIC',      magic: true },
  { name: '混沌斧', bonus: 14, tier: 4, icon: '🪓', rarity: 'EPIC',      magic: true },
  { name: '深渊法杖', bonus: 11, tier: 4, icon: '🪄', rarity: 'EPIC',    magic: true, special: 'magic_bonus' },
  { name: '圣焰剑', bonus: 16, tier: 4, icon: '⚔', rarity: 'LEGENDARY', magic: true, special: 'holy' },
];

// ── 防具库 ──────────────────────────────────────────────
const ARMORS = [
  { name: '破布衣', bonus: 1, tier: 1, icon: '🧥', rarity: 'COMMON' },
  { name: '皮甲',   bonus: 2, tier: 1, icon: '🧥', rarity: 'COMMON' },
  { name: '锁甲',   bonus: 4, tier: 2, icon: '🛡', rarity: 'UNCOMMON' },
  { name: '圆盾',   bonus: 3, tier: 2, icon: '🛡', rarity: 'UNCOMMON' },
  { name: '板甲',   bonus: 6, tier: 3, icon: '🛡', rarity: 'RARE' },
  { name: '精灵皮甲', bonus: 5, tier: 3, icon: '🧝', rarity: 'RARE', magic: true },
  { name: '龙鳞盾', bonus: 7, tier: 3, icon: '🐉', rarity: 'RARE', magic: true },
  { name: '龙鳞甲', bonus: 9, tier: 4, icon: '🐉', rarity: 'EPIC', magic: true },
  { name: '虚空铠', bonus: 11, tier: 4, icon: '🛡', rarity: 'LEGENDARY', magic: true },
];

// ── 药水库 ──────────────────────────────────────────────
const POTIONS = [
  { name: '小回血药', effect: 'heal',     value: 15, icon: '🧪', rarity: 'COMMON' },
  { name: '中回血药', effect: 'heal',     value: 30, icon: '🧪', rarity: 'UNCOMMON' },
  { name: '大回血药', effect: 'heal',     value: 60, icon: '🧪', rarity: 'RARE' },
  { name: '满血药水', effect: 'heal_full',           icon: '🧪', rarity: 'EPIC' },
  { name: '力量药水', effect: 'buff_atk', value: 4,  icon: '💪', rarity: 'UNCOMMON' },
  { name: '防御药水', effect: 'buff_def', value: 3,  icon: '🛡', rarity: 'UNCOMMON' },
  { name: '成长药水', effect: 'buff_maxhp', value: 10, icon: '❤', rarity: 'RARE' },
  { name: '祝福药水', effect: 'status',   status: 'bless',  icon: '✨', rarity: 'RARE' },
  { name: '急速药水', effect: 'status',   status: 'haste',  icon: '⚡', rarity: 'UNCOMMON' },
  { name: '再生药水', effect: 'status',   status: 'regen',  icon: '💚', rarity: 'UNCOMMON' },
];

// ── 卷轴库 ──────────────────────────────────────────────
const SCROLLS = [
  { name: '火球卷轴', effect: 'fireball',   value: 20, icon: '📜', rarity: 'UNCOMMON' },
  { name: '冰霜卷轴', effect: 'blizzard',   value: 15, icon: '📜', rarity: 'UNCOMMON' },
  { name: '传送卷轴', effect: 'teleport',              icon: '📜', rarity: 'COMMON' },
  { name: '地图卷轴', effect: 'reveal_map',             icon: '📜', rarity: 'UNCOMMON' },
  { name: '护盾卷轴', effect: 'scroll_shield',          icon: '📜', rarity: 'COMMON' },
  { name: '噤声卷轴', effect: 'sleep_all',              icon: '📜', rarity: 'RARE' },
  { name: '天火卷轴', effect: 'meteor',     value: 50, icon: '📜', rarity: 'EPIC' },
  { name: '诅咒卷轴', effect: 'curse_room',             icon: '📜', rarity: 'RARE' },
  { name: '混沌卷轴', effect: 'chaos',                  icon: '📜', rarity: 'LEGENDARY' },
];

// 选择物品时使用权重
function weightedRarityChoice(items, floorBoost = 0) {
  const available = items;
  const weights = available.map(it => {
    const r = RARITY[it.rarity || 'COMMON'];
    let w = r.weight;
    // 高楼层稀有物品权重提升
    if (it.tier && it.tier <= 2) w = Math.max(1, w - floorBoost * 5);
    if (it.tier && it.tier >= 3) w += floorBoost * 3;
    return Math.max(1, w);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let rng = Math.random() * total;
  for (let i = 0; i < available.length; i++) {
    rng -= weights[i];
    if (rng <= 0) return available[i];
  }
  return available[available.length - 1];
}

function generateLoot(floor, isGroundDrop = false) {
  const floorBoost = Math.floor(floor / 2);

  const roll = Math.random();
  if (roll < 0.30) {
    return { type: 'weapon', ...weightedRarityChoice(
      WEAPONS.filter(w => w.tier <= 1 + floorBoost), floorBoost
    )};
  } else if (roll < 0.50) {
    return { type: 'armor', ...weightedRarityChoice(
      ARMORS.filter(a => a.tier <= 1 + floorBoost), floorBoost
    )};
  } else if (roll < 0.70) {
    return { type: 'potion', ...weightedRarityChoice(POTIONS, floorBoost) };
  } else if (roll < 0.82) {
    return { type: 'scroll', ...weightedRarityChoice(SCROLLS, floorBoost) };
  } else {
    const amount = randInt(8 + floor * 3, 20 + floor * 8);
    return { type: 'gold', name: `${amount} 金币`, amount, icon: '💰', rarity: 'COMMON' };
  }
}

// 商店物品（有价格）
function generateShopItem(floor) {
  const item = generateLoot(floor + 1);
  const r = RARITY[item.rarity || 'COMMON'];
  const basePrice = { COMMON: 20, UNCOMMON: 50, RARE: 100, EPIC: 200, LEGENDARY: 400 };
  const price = Math.floor((basePrice[item.rarity || 'COMMON'] + floor * 10) * (0.8 + Math.random() * 0.4));
  return { item, price };
}

// 应用物品效果
function applyItem(item, player) {
  if (item.type === 'weapon' || item.type === 'armor') {
    const result = player.equipItem(player.inventory.indexOf(item));
    return result || { consumed: false, msg: '?', type: 'info' };
  }
  switch (item.type) {
    case 'potion': return applyPotion(item, player);
    case 'scroll': return applyScroll(item, player);
    case 'gold':
      player.gold += item.amount;
      return { consumed: true, msg: `获得 ${item.amount} 金币`, type: 'item' };
    default:
      return { consumed: false, msg: '无效物品', type: 'info' };
  }
}

function applyPotion(item, player) {
  const boost = player.hasPerk('potion_boost') ? 1.5 : 1.0;

  switch (item.effect) {
    case 'heal': {
      const val = Math.floor(item.value * boost);
      const healed = Math.min(val, player.maxHp - player.hp);
      player.hp += healed;
      if (Audio) Audio.playPotion();
      return { consumed: true, msg: `使用 ${item.name}，恢复 ${healed} HP`, type: 'item', healAmt: healed };
    }
    case 'heal_full': {
      const healed = player.maxHp - player.hp;
      player.hp = player.maxHp;
      if (Audio) Audio.playPotion();
      return { consumed: true, msg: `使用 ${item.name}，完全恢复！(+${healed} HP)`, type: 'item', healAmt: healed };
    }
    case 'buff_atk': {
      const val = Math.floor(item.value * boost);
      player.baseAtk += val;
      return { consumed: true, msg: `使用 ${item.name}，攻击力永久 +${val}`, type: 'item' };
    }
    case 'buff_def': {
      const val = Math.floor(item.value * boost);
      player.baseDef += val;
      return { consumed: true, msg: `使用 ${item.name}，防御力永久 +${val}`, type: 'item' };
    }
    case 'buff_maxhp': {
      const val = Math.floor(item.value * boost);
      player.maxHp += val;
      player.hp += val;
      return { consumed: true, msg: `使用 ${item.name}，最大HP永久 +${val}`, type: 'item' };
    }
    case 'status': {
      player.addStatus(item.status);
      const sd = STATUS_DATA[item.status];
      return { consumed: true, msg: `使用 ${item.name}，获得 ${sd?.name || item.status} 状态`, type: 'item' };
    }
    default:
      return { consumed: false, msg: '?', type: 'info' };
  }
}

function applyScroll(item, player) {
  if (Audio) Audio.playScroll();
  switch (item.effect) {
    case 'fireball':
    case 'meteor': {
      const dmgBoost = player.hasPerk('arcane_boost') ? 1.5 : 1.0;
      const dmg = Math.floor((item.value || 20) * dmgBoost);
      const radius = item.effect === 'meteor' ? 6 : 4;
      EventBus.emit('scroll_aoe', { damage: dmg, radius, type: 'fire', name: item.name });
      return { consumed: true, msg: `${item.name}！对周围 ${radius} 格内敌人造成 ${dmg} 点火焰伤害！`, type: 'combat' };
    }
    case 'blizzard': {
      const dmg = Math.floor((item.value || 15) * (player.hasPerk('arcane_boost') ? 1.5 : 1.0));
      EventBus.emit('scroll_aoe', { damage: dmg, radius: 4, type: 'ice', name: item.name });
      return { consumed: true, msg: `${item.name}！寒冰风暴席卷！`, type: 'combat' };
    }
    case 'reveal_map':
      EventBus.emit('reveal_map', null);
      return { consumed: true, msg: '地图完全揭示！', type: 'item' };
    case 'teleport':
      EventBus.emit('teleport_player', null);
      return { consumed: true, msg: '瞬间传送！', type: 'item' };
    case 'scroll_shield':
      player.addStatus('shield');
      return { consumed: true, msg: '护盾激活！下一次攻击将被吸收！', type: 'item' };
    case 'sleep_all':
      EventBus.emit('sleep_all_enemies', null);
      return { consumed: true, msg: '宁静之符！所有可见敌人陷入沉睡！', type: 'item' };
    case 'curse_room':
      EventBus.emit('curse_enemies', null);
      return { consumed: true, msg: '诅咒缠绕！房间内所有敌人受到诅咒！', type: 'combat' };
    case 'chaos': {
      const effects = ['fireball', 'blizzard', 'reveal_map', 'teleport', 'scroll_shield', 'sleep_all'];
      const chosen = randChoice(effects);
      return applyScroll({ ...item, effect: chosen }, player);
    }
    default:
      return { consumed: false, msg: '...什么也没发生', type: 'info' };
  }
}

function itemDisplayColor(item) {
  if (!item) return '#fff';
  if (item.rarity === 'LEGENDARY') return RARITY.LEGENDARY.color;
  if (item.rarity === 'EPIC')      return RARITY.EPIC.color;
  if (item.rarity === 'RARE')      return RARITY.RARE.color;
  if (item.rarity === 'UNCOMMON')  return RARITY.UNCOMMON.color;
  if (item.magic) return '#d0a0ff';
  return ITEM_COLORS[item.type] || '#ccc';
}

function itemRarityLabel(item) {
  if (!item || !item.rarity) return '';
  return RARITY[item.rarity]?.name || '';
}
