// ─── UI 更新器 ──────────────────────────────────────────

const MAX_LOG_MESSAGES = 40;

class UI {
  constructor() {
    this.logEl = document.getElementById('message-log');
    this.messages = [];
  }

  updateStats(player) {
    const hpRatio = player.hp / player.maxHp;
    document.getElementById('hp-bar').style.width = `${hpRatio * 100}%`;
    document.getElementById('hp-bar').style.background =
      hpRatio < 0.25 ? 'linear-gradient(90deg, #a00, #f00)' :
      hpRatio < 0.5  ? 'linear-gradient(90deg, #c04020, #e06040)' :
                       'linear-gradient(90deg, #d04040, #f06060)';
    document.getElementById('hp-text').textContent = `${player.hp}/${player.maxHp}`;

    const xpRatio = player.xp / player.xpNext;
    document.getElementById('xp-bar').style.width = `${xpRatio * 100}%`;
    document.getElementById('xp-text').textContent = `${player.xp}/${player.xpNext}`;

    document.getElementById('player-level').textContent = player.level;
    document.getElementById('player-atk').textContent = player.atk;
    document.getElementById('player-def').textContent = player.def;
    document.getElementById('player-gold').textContent = player.gold;

    document.getElementById('floor-text').textContent = `第 ${player.floor} 层`;
    document.getElementById('turn-text').textContent = `回合 ${player.turnCount}`;

    // 装备
    document.getElementById('equipped-weapon').textContent =
      player.weapon ? `⚔ ${player.weapon.name} +${player.weapon.bonus}` : '拳头';
    document.getElementById('equipped-armor').textContent =
      player.armor ? `🛡 ${player.armor.name} +${player.armor.bonus}` : '布衣';

    this.updateInventory(player);
  }

  updateInventory(player) {
    const el = document.getElementById('inventory-list');
    el.innerHTML = '';

    for (let i = 0; i < player.maxInvSize; i++) {
      const item = player.inventory[i];
      const div = document.createElement('div');

      if (!item) {
        div.className = 'empty-slot';
        div.textContent = '—';
      } else {
        div.className = 'inv-item';
        div.style.color = itemDisplayColor(item);

        const key = document.createElement('span');
        key.className = 'item-key';
        key.textContent = `[${i + 1}]`;
        div.appendChild(key);

        const icon = document.createElement('span');
        icon.textContent = item.icon || '?';
        div.appendChild(icon);

        const name = document.createElement('span');
        name.textContent = item.name;
        div.appendChild(name);

        div.title = `按 ${i + 1} 使用/装备`;
      }

      el.appendChild(div);
    }
  }

  addMessage(text, type = 'info') {
    this.messages.push({ text, type });
    if (this.messages.length > MAX_LOG_MESSAGES) {
      this.messages.shift();
    }

    const p = document.createElement('p');
    p.className = `msg-${type}`;
    p.textContent = text;
    this.logEl.appendChild(p);

    // 超出限制删除旧消息
    while (this.logEl.children.length > MAX_LOG_MESSAGES) {
      this.logEl.removeChild(this.logEl.firstChild);
    }

    // 自动滚动到底
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  addMessages(msgArray) {
    for (const m of msgArray) {
      if (m && m.text) this.addMessage(m.text, m.type || 'info');
    }
  }

  showGameOver(player, won = false) {
    document.getElementById('game-screen').classList.add('hidden');
    const screen = document.getElementById('gameover-screen');
    screen.classList.remove('hidden');

    document.getElementById('gameover-title').textContent =
      won ? '你征服了深渊！' : '你已陨落';
    document.getElementById('gameover-title').style.color =
      won ? '#f0c040' : '#e05050';

    document.getElementById('gameover-stats').innerHTML = `
      <p>最终等级：<span>Lv ${player.level}</span></p>
      <p>到达楼层：<span>第 ${player.floor} 层</span></p>
      <p>击杀数量：<span>${player.killCount} 只怪物</span></p>
      <p>收集金币：<span>${player.gold} 金币</span></p>
      <p>存活回合：<span>${player.turnCount} 回合</span></p>
    `;
  }
}
