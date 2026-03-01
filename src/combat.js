// ─── 战斗系统 ────────────────────────────────────────────

const CRIT_BASE = 0.1; // 基础暴击率

function playerAttack(player, enemy) {
  const msgs = [];

  // 暴击判定
  let critChance = CRIT_BASE;
  if (player.weapon?.crit) critChance += player.weapon.crit / 100;
  if (player.className === 'rogue' && enemy.sleeping) critChance = 1.0; // 必定暴击

  const isCrit = Math.random() < critChance;
  const critMult = isCrit ? (player.className === 'rogue' && enemy.sleeping ? 3.0 : 2.0) : 1.0;

  // 基础伤害
  let rawDmg = randInt(Math.floor(player.atk * 0.75), player.atk);

  // 处刑者天赋
  if (player.hasPerk('execute') && enemy.hp < enemy.maxHp * 0.25) rawDmg *= 2;

  // 暗杀者对非睡眠目标的额外伤害
  if (player.hasPerk('assassin_class') && !enemy.sleeping && Math.random() < 0.2) rawDmg = Math.floor(rawDmg * 1.5);

  const finalDmg = Math.floor(rawDmg * critMult);
  const defReduced = Math.max(1, finalDmg - enemy.def);
  enemy.hp -= defReduced;
  enemy.hitFlash = 0.3;

  // 声音
  if (Audio) { isCrit ? Audio.playCrit() : Audio.playHit(); }

  // 粒子
  if (Particles) {
    Particles.addDamage(enemy.x, enemy.y, defReduced, isCrit, 'phys');
    if (isCrit) Particles.emit('sparks', enemy.x, enemy.y);
    else Particles.emit('blood', enemy.x, enemy.y);
  }

  if (isCrit) {
    msgs.push({ text: `💥 暴击！你对 ${enemy.name} 造成 ${defReduced} 点伤害！`, type: 'combat' });
  } else {
    msgs.push({ text: `你攻击了 ${enemy.name}，造成 ${defReduced} 点伤害。(${Math.max(0, enemy.hp)}/${enemy.maxHp})`, type: 'combat' });
  }

  // 吸血天赋
  if (player.hasPerk('life_steal') && defReduced > 0) {
    const healAmt = 3;
    player.hp = Math.min(player.maxHp, player.hp + healAmt);
  }

  player.totalDamageDealt += defReduced;

  // 天赋：状态附着
  applyWeaponStatus(player, enemy, msgs);

  // 武器特殊效果
  if (player.weapon?.special) {
    applyWeaponSpecial(player.weapon.special, enemy, msgs);
  }

  // 敌人死亡
  if (enemy.hp <= 0) {
    return handleEnemyDeath(enemy, player, msgs);
  }

  // 敌人被唤醒
  if (enemy.sleeping) {
    enemy.sleeping = false;
    enemy.chasing = true;
  }

  // 敌人反击
  if (!enemy.hasStatus?.('freeze') && !enemy.hasStatus?.('stun')) {
    const counterMsgs = enemyAttack(enemy, player);
    msgs.push(...counterMsgs);
  }

  return msgs;
}

function applyWeaponStatus(player, enemy, msgs) {
  if (player.hasPerk('toxic_touch') && Math.random() < 0.30 && !enemy.poisonImmune && !enemy.undead) {
    applyEnemyStatus(enemy, 'poison', msgs);
  }
  if (player.hasPerk('fire_touch') && Math.random() < 0.25 && !enemy.fireImmune) {
    applyEnemyStatus(enemy, 'burn', msgs);
  }
  if (player.hasPerk('frost_touch') && Math.random() < 0.25) {
    applyEnemyStatus(enemy, 'freeze', msgs);
  }
  if (player.hasPerk('bleed_touch') && Math.random() < 0.30) {
    applyEnemyStatus(enemy, 'bleed', msgs);
  }
}

function applyWeaponSpecial(special, enemy, msgs) {
  if (special === 'stun' && Math.random() < 0.3) {
    applyEnemyStatus(enemy, 'stun', msgs);
  }
  if (special === 'toxic_weapon' && !enemy.undead) {
    applyEnemyStatus(enemy, 'poison', msgs);
  }
}

function applyEnemyStatus(enemy, statusId, msgs) {
  const data = STATUS_DATA[statusId];
  if (!data) return;
  if (!enemy.statuses) enemy.statuses = {};
  if (enemy.statuses[statusId]) {
    enemy.statuses[statusId].turns = Math.max(enemy.statuses[statusId].turns, data.turns);
  } else {
    enemy.statuses[statusId] = { turns: data.turns };
  }
  msgs.push({ text: `${data.icon} ${enemy.name} 陷入${data.name}！`, type: 'info' });
  if (Particles && data.particle) Particles.emit(data.particle, enemy.x, enemy.y);
  if (Audio) {
    if (statusId === 'poison') Audio.playPoison();
    else if (statusId === 'freeze') Audio.playFreeze();
    else if (statusId === 'burn') Audio.playBurn();
  }
}

function handleEnemyDeath(enemy, player, msgs) {
  enemy.alive = false;
  enemy.hp = 0;

  let gold = enemy.gold;
  if (player.hasPerk('double_gold')) gold *= 2;
  player.gold += gold;
  player.killCount++;

  const xpMsgs = player.addXP(enemy.xp);

  if (Particles) {
    Particles.emit('death', enemy.x, enemy.y, { color: enemy.color });
    if (enemy.isBoss) Particles.emit('boss', enemy.x, enemy.y, { color: enemy.color });
  }
  if (Audio) Audio.playEnemyDeath();

  msgs.push({ text: `✓ ${enemy.name} 被击败！+${enemy.xp} XP，+${gold} 金币`, type: 'combat' });
  msgs.push(...xpMsgs);

  // 生命吸取后击杀
  if (player.hasPerk('life_steal')) {
    player.hp = Math.min(player.maxHp, player.hp + 3);
  }

  return msgs;
}

// ── 敌人攻击玩家 ──────────────────────────────────────────
function enemyAttack(enemy, player) {
  const msgs = [];

  // 特殊：震击攻击（Boss）
  if (enemy.stunAttack && Math.random() < enemy.stunAttack) {
    const dmg = Math.floor(enemy.atk * 1.2);
    const actual = player.takeDamage(dmg);
    if (actual === -1) {
      msgs.push({ text: `${enemy.name} 发动震击！但你闪开了！`, type: 'info' });
    } else if (actual === 0) {
      msgs.push({ text: `${enemy.name} 发动震击！护盾吸收了攻击！`, type: 'item' });
    } else {
      player.addStatus('stun');
      if (Audio) Audio.playPlayerHurt();
      msgs.push({ text: `💥 ${enemy.name} 发动震击！你受到 ${actual} 点伤害并被眩晕！`, type: 'danger' });
    }
    return msgs;
  }

  // 特殊：喷火（龙、恶魔）
  if (enemy.fireBreath && Math.random() < 0.25) {
    const dmg = Math.floor(enemy.atk * 0.9);
    const actual = Math.max(1, dmg - Math.floor(player.def * 0.5));
    player.hp = Math.max(0, player.hp - actual);
    player.totalDamageReceived += actual;
    if (Particles) Particles.emit('fire', player.x, player.y);
    if (Audio) Audio.playBurn();
    msgs.push({ text: `🔥 ${enemy.name} 喷吐烈焰！你受到 ${actual} 点火焰伤害！`, type: 'danger' });
    return msgs;
  }

  // 普通攻击
  const rawDmg = randInt(Math.floor(enemy.atk * 0.75), enemy.atk);
  const actual = player.takeDamage(rawDmg);

  if (actual === -1) {
    msgs.push({ text: `${enemy.name} 发动攻击，但你灵巧地闪开了！`, type: 'info' });
    return msgs;
  }

  if (actual === 0) {
    msgs.push({ text: `${enemy.name} 攻击，但护盾吸收了伤害！`, type: 'item' });
    return msgs;
  }

  if (Audio) Audio.playPlayerHurt();

  const hpRatio = player.hp / player.maxHp;
  const suffix = player.hp <= 0 ? '' : hpRatio < 0.2 ? ' 你危在旦夕！' : hpRatio < 0.4 ? ' 小心！' : '';
  const msgType = hpRatio < 0.3 ? 'danger' : 'combat';

  msgs.push({ text: `${enemy.name} 攻击你，造成 ${actual} 点伤害。${suffix}`, type: msgType });

  // 敌人的状态附着
  if (enemy.statusOnHit && Math.random() < (enemy.statusChance || 0.3)) {
    const sd = STATUS_DATA[enemy.statusOnHit];
    if (sd) {
      player.addStatus(enemy.statusOnHit);
      msgs.push({ text: `${sd.icon} 你被 ${enemy.name} 的攻击${sd.name}了！`, type: 'danger' });
    }
  }

  // 吸血
  if (enemy.lifesteal) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.lifesteal);
  }

  return msgs;
}

// ── 所有敌人行动（玩家回合结束后） ───────────────────────
function enemyTurn(dungeon, player) {
  const msgs = [];

  for (const enemy of dungeon.entities) {
    if (!enemy.alive) continue;

    // 处理敌人状态效果
    const statusMsgs = tickEnemyStatuses(enemy, dungeon);
    msgs.push(...statusMsgs);
    if (!enemy.alive) continue;

    // 眩晕/冰冻：跳过行动
    if (enemy.statuses?.freeze?.turns > 0 || enemy.statuses?.stun?.turns > 0) continue;

    // 唤醒判定
    if (enemy.sleeping) {
      if (dist(enemy.x, enemy.y, player.x, player.y) <= 3) {
        enemy.sleeping = false;
        enemy.chasing = true;
        msgs.push({ text: `${enemy.name} 被惊醒了！`, type: 'info' });
      }
      continue;
    }

    // 视野内追击
    if (!enemy.chasing) {
      const inView = dungeon.visible[enemy.y]?.[enemy.x];
      if (inView && dist(enemy.x, enemy.y, player.x, player.y) <= enemy.alertRadius) {
        enemy.chasing = true;
      }
    }
    if (!enemy.chasing) continue;

    // 回血（食人妖）
    if (enemy.regen) enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen);

    const d = dist(enemy.x, enemy.y, player.x, player.y);

    if (d === 1) {
      // 攻击玩家
      const attackMsgs = enemyAttack(enemy, player);
      msgs.push(...attackMsgs);
    } else if (enemy.chasing) {
      // 移动
      moveEnemyToward(enemy, player.x, player.y, dungeon);
    }
  }

  return msgs;
}

function tickEnemyStatuses(enemy, dungeon) {
  const msgs = [];
  if (!enemy.statuses) return msgs;

  const toRemove = [];
  for (const [id, state] of Object.entries(enemy.statuses)) {
    const data = STATUS_DATA[id];
    if (!data) { toRemove.push(id); continue; }

    if (data.dot) {
      // 骷髅/不死：免疫毒素
      if (id === 'poison' && enemy.undead) { toRemove.push(id); continue; }
      if (id === 'burn'   && enemy.fireImmune) { toRemove.push(id); continue; }

      enemy.hp -= data.dot;
      if (Particles && data.particle) Particles.emit(data.particle, enemy.x, enemy.y);
      if (enemy.hp <= 0) {
        enemy.alive = false;
        msgs.push({ text: `☠ ${enemy.name} 死于${data.name}！`, type: 'combat' });
        toRemove.push(id);
        continue;
      }
    }

    state.turns--;
    if (state.turns <= 0) toRemove.push(id);
  }

  for (const id of toRemove) delete enemy.statuses[id];
  return msgs;
}

function moveEnemyToward(enemy, tx, ty, dungeon) {
  // 先尝试A*，如果A*太远降级到贪心
  if (dist(enemy.x, enemy.y, tx, ty) <= 12) {
    const path = aStar(dungeon, enemy.x, enemy.y, tx, ty, false, 80);
    if (path.length > 0) {
      const next = path[0];
      if (!dungeon.getEntityAt(next.x, next.y)) {
        enemy.x = next.x;
        enemy.y = next.y;
        return;
      }
    }
  }
  // 降级到贪心移动
  greedyMove(enemy, tx, ty, dungeon);
}

function greedyMove(enemy, tx, ty, dungeon) {
  const dx = tx - enemy.x, dy = ty - enemy.y;
  const moves = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) moves.push([Math.sign(dx), 0]);
    if (dy !== 0) moves.push([0, Math.sign(dy)]);
  } else {
    if (dy !== 0) moves.push([0, Math.sign(dy)]);
    if (dx !== 0) moves.push([Math.sign(dx), 0]);
  }
  for (const [mx, my] of moves) {
    const nx = enemy.x + mx, ny = enemy.y + my;
    if (dungeon.isWalkable(nx, ny) && !dungeon.getEntityAt(nx, ny)) {
      enemy.x = nx; enemy.y = ny;
      return;
    }
  }
}

function stepOnTrap(player) {
  if (player.hasPerk('no_trap')) {
    return [{ text: '你轻盈地越过了陷阱！', type: 'info' }];
  }
  const dmg = randInt(4 + player.floor * 2, 10 + player.floor * 3);
  const actual = Math.max(1, dmg - player.def);
  player.hp = Math.max(0, player.hp - actual);
  player.totalDamageReceived += actual;
  if (Audio) Audio.playTrap();
  if (Particles) Particles.emit('sparks', player.x, player.y);
  return [{ text: `⚠ 你踩中了陷阱！受到 ${actual} 点伤害！`, type: 'danger' }];
}
