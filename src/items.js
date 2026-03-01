// ─── 物品系统 ───────────────────────────────────────────

const ITEM_COLORS = {
  potion: '#e04080',
  weapon: '#80c0ff',
  armor: '#c0a060',
  scroll: '#d0a0ff',
  gold: '#f0c040',
};

// 武器列表
const WEAPONS = [
  { name: '短剑',   bonus: 2,  rare: false, icon: '🗡' },
  { name: '长剑',   bonus: 4,  rare: false, icon: '⚔' },
  { name: '战斧',   bonus: 6,  rare: false, icon: '🪓' },
  { name: '魔法杖', bonus: 5,  rare: true,  icon: '🪄', magic: true },
  { name: '精灵弓', bonus: 7,  rare: true,  icon: '🏹' },
  { name: '龙骨剑', bonus: 10, rare: true,  icon: '⚔', magic: true },
];

// 防具列表
const ARMORS = [
  { name: '皮甲',   bonus: 2,  rare: false, icon: '🧥' },
  { name: '锁甲',   bonus: 4,  rare: false, icon: '🛡' },
  { name: '板甲',   bonus: 6,  rare: false, icon: '🛡' },
  { name: '精灵皮甲', bonus: 5, rare: true, icon: '🧝', magic: true },
  { name: '龙鳞甲', bonus: 8,  rare: true,  icon: '🐉', magic: true },
];

// 药水
const POTIONS = [
  { name: '小回血药', effect: 'heal', value: 15, icon: '🧪' },
  { name: '中回血药', effect: 'heal', value: 30, icon: '🧪' },
  { name: '大回血药', effect: 'heal', value: 60, icon: '🧪' },
  { name: '力量药水', effect: 'buff_atk', value: 3, icon: '💪', turns: 10 },
  { name: '防御药水', effect: 'buff_def', value: 3, icon: '🛡', turns: 10 },
];

// 卷轴
const SCROLLS = [
  { name: '辨识卷轴', effect: 'identify',  icon: '📜' },
  { name: '传送卷轴', effect: 'teleport',  icon: '📜' },
  { name: '地图卷轴', effect: 'reveal_map', icon: '📜' },
  { name: '火球卷轴', effect: 'fireball',  value: 20, icon: '📜' },
];

function generateLoot(floor, isFloorDrop = false) {
  const roll = Math.random();
  const floorMod = Math.min(floor - 1, 5); // 深层更好的物品

  if (roll < 0.35) {
    // 药水
    const idx = Math.min(Math.floor(Math.random() * (2 + Math.floor(floorMod / 2))), POTIONS.length - 1);
    return { type: 'potion', ...POTIONS[Math.max(0, idx)] };
  } else if (roll < 0.55) {
    // 武器
    const maxIdx = Math.min(2 + Math.floor(floorMod / 2), WEAPONS.length - 1);
    const idx = randInt(0, maxIdx);
    return { type: 'weapon', ...WEAPONS[idx] };
  } else if (roll < 0.72) {
    // 防具
    const maxIdx = Math.min(2 + Math.floor(floorMod / 2), ARMORS.length - 1);
    const idx = randInt(0, maxIdx);
    return { type: 'armor', ...ARMORS[idx] };
  } else if (roll < 0.88) {
    // 金币
    const amount = randInt(5 + floor * 2, 15 + floor * 5);
    return { type: 'gold', name: `${amount} 金币`, amount, icon: '💰' };
  } else {
    // 卷轴
    return { type: 'scroll', ...randChoice(SCROLLS) };
  }
}

// 应用物品效果
function applyItem(item, player) {
  switch (item.type) {
    case 'potion':
      return applyPotion(item, player);
    case 'scroll':
      return applyScroll(item, player);
    case 'gold':
      player.gold += item.amount;
      return { consumed: true, msg: `获得 ${item.amount} 金币`, type: 'item' };
    case 'weapon':
    case 'armor':
      return player.equipItem(player.inventory.indexOf(item)) ||
             { consumed: false, msg: '请使用装备键(E)', type: 'info' };
    default:
      return { consumed: false, msg: '?', type: 'info' };
  }
}

function applyPotion(item, player) {
  switch (item.effect) {
    case 'heal': {
      const healed = Math.min(item.value, player.maxHp - player.hp);
      player.hp = Math.min(player.maxHp, player.hp + item.value);
      return { consumed: true, msg: `使用 ${item.name}，恢复 ${healed} HP`, type: 'item' };
    }
    case 'buff_atk':
      player.baseAtk += item.value;
      return { consumed: true, msg: `使用 ${item.name}，攻击 +${item.value}`, type: 'item' };
    case 'buff_def':
      player.baseDef += item.value;
      return { consumed: true, msg: `使用 ${item.name}，防御 +${item.value}`, type: 'item' };
    default:
      return { consumed: false, msg: '效果未知', type: 'info' };
  }
}

function applyScroll(item, player) {
  switch (item.effect) {
    case 'reveal_map':
      EventBus.emit('reveal_map', null);
      return { consumed: true, msg: '地图已全部显示！', type: 'item' };
    case 'teleport':
      EventBus.emit('teleport_player', null);
      return { consumed: true, msg: '瞬间移动！', type: 'item' };
    case 'fireball':
      EventBus.emit('fireball', { damage: item.value || 20 });
      return { consumed: true, msg: '火球爆炸！', type: 'item' };
    case 'identify':
      return { consumed: true, msg: '(辨识功能施工中)', type: 'info' };
    default:
      return { consumed: false, msg: '...什么也没发生', type: 'info' };
  }
}

function itemDisplayColor(item) {
  if (!item) return '#fff';
  if (item.magic) return '#d0a0ff';
  if (item.rare) return '#f0c040';
  return ITEM_COLORS[item.type] || '#ccc';
}
