// ─── 战斗系统 ───────────────────────────────────────────

function playerAttack(player, enemy) {
  const msgs = [];

  // 玩家攻击敌人
  const atkRoll = randInt(Math.floor(player.atk * 0.7), player.atk);
  const dmg = Math.max(1, atkRoll - enemy.def);
  enemy.hp -= dmg;

  msgs.push({
    text: `你攻击了${enemy.name}，造成 ${dmg} 点伤害。(${Math.max(0, enemy.hp)}/${enemy.maxHp}HP)`,
    type: 'combat'
  });

  if (enemy.hp <= 0) {
    enemy.alive = false;
    enemy.hp = 0;
    player.gold += enemy.gold;
    player.killCount++;

    const xpMsgs = player.addXP(enemy.xp);
    msgs.push({
      text: `${enemy.name} 被击败！获得 ${enemy.xp} XP，${enemy.gold} 金币。`,
      type: 'combat'
    });
    msgs.push(...xpMsgs);
  } else {
    // 敌人反击
    const counterMsgs = enemyAttack(enemy, player);
    msgs.push(...counterMsgs);
  }

  return msgs;
}

function enemyAttack(enemy, player) {
  const msgs = [];

  // 特殊技能
  if (enemy.fireBreath && Math.random() < 0.25) {
    const dmg = Math.floor(enemy.atk * 0.8);
    const actual = Math.max(1, dmg - Math.floor(player.def / 2));
    player.hp = Math.max(0, player.hp - actual);
    msgs.push({
      text: `${enemy.name} 喷吐烈焰！你受到 ${actual} 点火焰伤害！`,
      type: 'danger'
    });
    return msgs;
  }

  const atkRoll = randInt(Math.floor(enemy.atk * 0.7), enemy.atk);
  const dmg = Math.max(1, atkRoll - player.def);
  player.hp = Math.max(0, player.hp - dmg);

  const suffix = player.hp <= 0 ? '你已陨落...' :
                 player.hp < player.maxHp * 0.25 ? '你岌岌可危！' : '';

  msgs.push({
    text: `${enemy.name} 攻击你，造成 ${dmg} 点伤害。${suffix}`,
    type: player.hp < player.maxHp * 0.25 ? 'danger' : 'combat'
  });

  // 吸血
  if (enemy.lifesteal) {
    enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.lifesteal);
  }

  return msgs;
}

// 所有活着的敌人行动（玩家移动后）
function enemyTurn(dungeon, player) {
  const msgs = [];

  for (const enemy of dungeon.entities) {
    if (!enemy.alive) continue;

    // 睡眠检测：玩家靠近才唤醒
    if (enemy.sleeping) {
      if (dist(enemy.x, enemy.y, player.x, player.y) <= 3) {
        enemy.sleeping = false;
        enemy.chasing = true;
        msgs.push({ text: `${enemy.name} 被惊醒了！`, type: 'info' });
      }
      continue;
    }

    // 视野范围内追击
    if (!enemy.chasing) {
      if (dist(enemy.x, enemy.y, player.x, player.y) <= enemy.alertRadius &&
          dungeon.visible[enemy.y] && dungeon.visible[enemy.y][enemy.x]) {
        enemy.chasing = true;
      }
    }

    if (!enemy.chasing) continue;

    // 回血（食人妖）
    if (enemy.regen) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen);
    }

    // 邻近玩家则攻击
    if (dist(enemy.x, enemy.y, player.x, player.y) === 1) {
      const attackMsgs = enemyAttack(enemy, player);
      msgs.push(...attackMsgs);
    } else {
      // 向玩家移动（简单贪婪寻路）
      moveEnemyToward(enemy, player.x, player.y, dungeon);
    }
  }

  return msgs;
}

function moveEnemyToward(enemy, tx, ty, dungeon) {
  const dx = tx - enemy.x;
  const dy = ty - enemy.y;

  // 优先选大方向
  const moves = [];
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (dx !== 0) moves.push([Math.sign(dx), 0]);
    if (dy !== 0) moves.push([0, Math.sign(dy)]);
  } else {
    if (dy !== 0) moves.push([0, Math.sign(dy)]);
    if (dx !== 0) moves.push([Math.sign(dx), 0]);
  }

  for (const [mx, my] of moves) {
    const nx = enemy.x + mx;
    const ny = enemy.y + my;
    if (dungeon.isWalkable(nx, ny) && !dungeon.getEntityAt(nx, ny)) {
      enemy.x = nx;
      enemy.y = ny;
      return;
    }
  }
}

function stepOnTrap(player) {
  const dmg = randInt(3, 8 + player.floor * 2);
  const actual = Math.max(1, dmg - player.def);
  player.hp = Math.max(0, player.hp - actual);
  return [{
    text: `你踩到了陷阱！受到 ${actual} 点伤害！`,
    type: 'danger'
  }];
}
