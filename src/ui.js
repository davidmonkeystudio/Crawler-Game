// ─── UI 系统 ─────────────────────────────────────────────

const MAX_LOG = 50;

class UI {
  constructor() {
    this.logEl = document.getElementById('message-log');
    this.messages = [];
    this.perkResolver = null; // Promise resolve 函数，等待天赋选择
  }

  // ── 属性更新 ──────────────────────────────────────────
  updateStats(player) {
    const hpRatio = player.hp / player.maxHp;
    const hpBar = document.getElementById('hp-bar');
    hpBar.style.width = `${hpRatio * 100}%`;
    hpBar.style.background = hpRatio < 0.25
      ? 'linear-gradient(90deg, #900, #f00)'
      : hpRatio < 0.5
        ? 'linear-gradient(90deg, #c04020, #e06040)'
        : 'linear-gradient(90deg, #d04040, #f06060)';
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

    document.getElementById('equipped-weapon').textContent =
      player.weapon ? `${player.weapon.icon||'⚔'} ${player.weapon.name} +${player.weapon.bonus}` : '空手';
    document.getElementById('equipped-armor').textContent =
      player.armor  ? `${player.armor.icon||'🛡'} ${player.armor.name}  +${player.armor.bonus}` : '布衣';

    this._updateStatusEffects(player);
    this._updateInventory(player);
    this._updatePerks(player);
    // 职业图标 & 等级
    const cls = CLASSES[player.className];
    const clsIcon = document.getElementById('player-class-icon');
    if (clsIcon) clsIcon.textContent = cls?.icon || '⚔';
    const lvlBadge = document.getElementById('player-level-badge');
    if (lvlBadge) lvlBadge.textContent = `Lv ${player.level}`;
  }

  _updateStatusEffects(player) {
    const el = document.getElementById('status-effects');
    if (!el) return;
    el.innerHTML = '';
    for (const [id, state] of Object.entries(player.statuses)) {
      const data = STATUS_DATA[id];
      if (!data || !state.turns) continue;
      const span = document.createElement('span');
      span.className = 'status-badge';
      span.style.color = data.color;
      span.title = `${data.name} (${state.turns}回合)`;
      span.textContent = `${data.icon}${state.turns}`;
      el.appendChild(span);
    }
  }

  _updatePerks(player) {
    const el = document.getElementById('perk-list');
    if (!el) return;
    if (player.perks.length === 0) {
      el.textContent = '还没有天赋';
      return;
    }
    el.innerHTML = player.perks.map(p =>
      `<div title="${p.desc}">${p.icon} ${p.name}</div>`
    ).join('');
  }

  _updateInventory(player) {
    const el = document.getElementById('inventory-list');
    el.innerHTML = '';
    for (let i = 0; i < player.maxInvSize; i++) {
      const item = player.inventory[i];
      const div = document.createElement('div');
      if (!item) {
        div.className = 'empty-slot';
        div.innerHTML = `<span class="item-key">[${i+1}]</span> <span style="color:#333">—</span>`;
      } else {
        div.className = 'inv-item';
        div.style.borderLeftColor = itemDisplayColor(item);
        const rarityColor = RARITY[item.rarity || 'COMMON']?.color || '#ccc';
        div.innerHTML = `<span class="item-key" style="color:#aaa">[${i+1}]</span> `
          + `<span style="font-size:9px">${item.icon || '?'}</span> `
          + `<span style="color:${rarityColor}">${item.name}</span>`;
        div.title = `[${i+1}] ${item.name}\n${itemRarityLabel(item)}`
          + (item.bonus ? `\n+${item.bonus} ${item.type === 'weapon' ? 'ATK' : 'DEF'}` : '')
          + (item.value ? `\n效果: ${item.value}` : '')
          + '\n按数字键使用/装备';
      }
      el.appendChild(div);
    }
  }

  addMessage(text, type = 'info') {
    const p = document.createElement('p');
    p.className = `msg-${type}`;
    p.textContent = text;
    this.logEl.appendChild(p);
    while (this.logEl.children.length > MAX_LOG) {
      this.logEl.removeChild(this.logEl.firstChild);
    }
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  addMessages(msgs) {
    if (!msgs) return;
    for (const m of msgs) {
      if (m?.text) this.addMessage(m.text, m.type || 'info');
    }
  }

  // ── 职业选择界面 ──────────────────────────────────────
  showClassSelect() {
    return new Promise(resolve => {
      document.getElementById('title-screen').classList.add('hidden');
      const screen = document.getElementById('class-screen');
      screen.classList.remove('hidden');

      const cards = screen.querySelectorAll('.class-card');
      cards.forEach(card => {
        card.onclick = () => {
          screen.classList.add('hidden');
          resolve(card.dataset.class);
        };
      });
    });
  }

  // ── 天赋选择模态框 ──────────────────────────────────
  showPerkSelection(availablePerks) {
    return new Promise(resolve => {
      const modal = document.getElementById('perk-modal');
      const container = document.getElementById('perk-options');
      container.innerHTML = '';

      availablePerks.forEach(perk => {
        const div = document.createElement('div');
        div.className = 'perk-card';
        div.innerHTML = `
          <div class="perk-icon">${perk.icon}</div>
          <div class="perk-info">
            <div class="perk-name">${perk.name}</div>
            <div class="perk-desc">${perk.desc}</div>
          </div>
        `;
        div.onclick = () => {
          modal.classList.add('hidden');
          resolve(perk);
        };
        container.appendChild(div);
      });

      modal.classList.remove('hidden');
    });
  }

  // ── 商店界面 ──────────────────────────────────────────
  showShopNotice() {
    this.addMessage('🏪 你进入了商店！地面上的物品标有价格，踩上去可以购买（G键）', 'item');
  }

  showShrineNotice() {
    this.addMessage('🌟 你发现了神龛！站在上面按 P 接受祝福（花费 10 HP）', 'item');
  }

  // ── 游戏结束界面 ──────────────────────────────────────
  showGameOver(player, won = false) {
    document.getElementById('game-screen').classList.add('hidden');
    const screen = document.getElementById('gameover-screen');
    screen.classList.remove('hidden');

    const title = document.getElementById('gameover-title');
    title.textContent = won ? '你征服了深渊！' : '你已陨落';
    title.style.color   = won ? '#f0c040' : '#e05050';
    title.style.textShadow = won
      ? '0 0 20px #f0c04080, 0 0 40px #f0c04040'
      : '0 0 20px #e0505080';

    const cls = CLASSES[player.className] || {};
    document.getElementById('gameover-stats').innerHTML = `
      <p>职业：<span>${cls.icon || ''} ${cls.name || '?'}</span></p>
      <p>最终等级：<span>Lv ${player.level}</span></p>
      <p>到达楼层：<span>第 ${player.floor} 层</span></p>
      <p>击杀数量：<span>${player.killCount} 只</span></p>
      <p>收集金币：<span>${player.gold} 金币</span></p>
      <p>存活回合：<span>${player.turnCount} 回合</span></p>
      <p>造成伤害：<span>${player.totalDamageDealt}</span></p>
    `;

    // 更新最高分
    this._updateHighScore(player);
    this._renderHighScores();
  }

  _updateHighScore(player) {
    const scores = JSON.parse(localStorage.getItem('crawlerScores') || '[]');
    scores.push({
      floor: player.floor, level: player.level,
      kills: player.killCount, gold: player.gold,
      className: player.className, date: new Date().toLocaleDateString(),
    });
    scores.sort((a, b) => b.floor - a.floor || b.level - a.level);
    localStorage.setItem('crawlerScores', JSON.stringify(scores.slice(0, 10)));
  }

  _renderHighScores() {
    const el = document.getElementById('high-scores');
    if (!el) return;
    const scores = JSON.parse(localStorage.getItem('crawlerScores') || '[]');
    if (scores.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = '<h3>最高记录</h3>'
      + scores.slice(0, 5).map((s, i) =>
          `<div class="score-entry">
            <span class="score-rank">#${i+1}</span>
            <span class="score-class">${CLASSES[s.className]?.icon||'?'}</span>
            <span>第${s.floor}层 Lv${s.level}</span>
            <span class="score-detail">${s.kills}杀 ${s.gold}金</span>
          </div>`
        ).join('');
  }
}
