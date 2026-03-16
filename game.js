// ==========================================
//  深渊地牢 - Roguelike 地牢爬行者
// ==========================================

(function () {
    'use strict';

    // ---- 常量 ----
    const MAP_W = 60;
    const MAP_H = 30;
    const MAX_FLOOR = 10;
    const FOV_RADIUS = 6;

    const TILE = {
        WALL: '#',
        FLOOR: '.',
        STAIRS: '>',
        DOOR: '+',
    };

    // 怪物定义: [符号, 名称, hp, atk, def, xp, 出现最早层]
    const MONSTER_DEFS = [
        { ch: 'r', name: '巨鼠', hp: 8, atk: 2, def: 0, xp: 5, minFloor: 1 },
        { ch: 'g', name: '哥布林', hp: 15, atk: 4, def: 1, xp: 10, minFloor: 1 },
        { ch: 'b', name: '蝙蝠', hp: 10, atk: 3, def: 0, xp: 7, minFloor: 1 },
        { ch: 's', name: '骷髅', hp: 25, atk: 6, def: 3, xp: 20, minFloor: 3 },
        { ch: 'S', name: '蛇女', hp: 30, atk: 8, def: 2, xp: 25, minFloor: 4 },
        { ch: 'o', name: '兽人', hp: 40, atk: 10, def: 5, xp: 35, minFloor: 5 },
        { ch: 'w', name: '幽灵', hp: 20, atk: 12, def: 1, xp: 30, minFloor: 5 },
        { ch: 'T', name: '巨魔', hp: 60, atk: 14, def: 8, xp: 50, minFloor: 7 },
        { ch: 'V', name: '吸血鬼', hp: 50, atk: 16, def: 6, xp: 55, minFloor: 8 },
        { ch: 'D', name: '恶龙', hp: 100, atk: 22, def: 12, xp: 100, minFloor: 9 },
    ];

    // 武器: [名称, 攻击力加成, 出现最早层]
    const WEAPONS = [
        { name: '短剑', atk: 2, minFloor: 1 },
        { name: '长剑', atk: 4, minFloor: 2 },
        { name: '战斧', atk: 6, minFloor: 4 },
        { name: '魔杖', atk: 8, minFloor: 6 },
        { name: '圣剑', atk: 12, minFloor: 8 },
    ];

    // 护甲: [名称, 防御力加成, 出现最早层]
    const ARMORS = [
        { name: '皮甲', def: 2, minFloor: 1 },
        { name: '锁甲', def: 4, minFloor: 3 },
        { name: '板甲', def: 7, minFloor: 5 },
        { name: '龙鳞甲', def: 10, minFloor: 7 },
    ];

    // ---- 游戏状态 ----
    let state = {};

    function initState() {
        state = {
            floor: 1,
            map: [],
            revealed: [],
            visible: [],
            player: {
                x: 0, y: 0,
                hp: 100, maxHp: 100,
                atk: 5, def: 2,
                level: 1, xp: 0, xpNext: 20,
                gold: 0,
                potions: 1,
                weapon: null,
                armor: null,
                kills: 0,
            },
            enemies: [],
            items: [],
            messages: [],
            gameOver: false,
        };
    }

    // ---- 地图生成 ----
    function createMap() {
        const map = [];
        for (let y = 0; y < MAP_H; y++) {
            map[y] = [];
            for (let x = 0; x < MAP_W; x++) {
                map[y][x] = TILE.WALL;
            }
        }
        return map;
    }

    function carveRoom(map, x1, y1, x2, y2) {
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                map[y][x] = TILE.FLOOR;
            }
        }
    }

    function carveCorridor(map, x1, y1, x2, y2) {
        let x = x1, y = y1;
        while (x !== x2) {
            if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) map[y][x] = TILE.FLOOR;
            x += x < x2 ? 1 : -1;
        }
        while (y !== y2) {
            if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) map[y][x] = TILE.FLOOR;
            y += y < y2 ? 1 : -1;
        }
    }

    function generateDungeon() {
        const map = createMap();
        const rooms = [];
        const numRooms = 8 + Math.floor(Math.random() * 5);

        for (let i = 0; i < 200 && rooms.length < numRooms; i++) {
            const w = 4 + Math.floor(Math.random() * 6);
            const h = 3 + Math.floor(Math.random() * 4);
            const x = 1 + Math.floor(Math.random() * (MAP_W - w - 2));
            const y = 1 + Math.floor(Math.random() * (MAP_H - h - 2));

            let overlap = false;
            for (const r of rooms) {
                if (x <= r.x2 + 1 && x + w - 1 >= r.x1 - 1 &&
                    y <= r.y2 + 1 && y + h - 1 >= r.y1 - 1) {
                    overlap = true;
                    break;
                }
            }
            if (overlap) continue;

            const room = { x1: x, y1: y, x2: x + w - 1, y2: y + h - 1 };
            carveRoom(map, room.x1, room.y1, room.x2, room.y2);
            rooms.push(room);

            if (rooms.length > 1) {
                const prev = rooms[rooms.length - 2];
                const cx1 = Math.floor((prev.x1 + prev.x2) / 2);
                const cy1 = Math.floor((prev.y1 + prev.y2) / 2);
                const cx2 = Math.floor((room.x1 + room.x2) / 2);
                const cy2 = Math.floor((room.y1 + room.y2) / 2);
                if (Math.random() < 0.5) {
                    carveCorridor(map, cx1, cy1, cx2, cy1);
                    carveCorridor(map, cx2, cy1, cx2, cy2);
                } else {
                    carveCorridor(map, cx1, cy1, cx1, cy2);
                    carveCorridor(map, cx1, cy2, cx2, cy2);
                }
            }
        }

        return { map, rooms };
    }

    // ---- 视野 (FOV) ----
    function computeFOV(px, py) {
        const visible = [];
        for (let y = 0; y < MAP_H; y++) {
            visible[y] = [];
            for (let x = 0; x < MAP_W; x++) {
                visible[y][x] = false;
            }
        }

        for (let angle = 0; angle < 360; angle += 0.5) {
            const rad = angle * Math.PI / 180;
            const dx = Math.cos(rad);
            const dy = Math.sin(rad);
            let cx = px + 0.5;
            let cy = py + 0.5;

            for (let step = 0; step < FOV_RADIUS; step++) {
                const ix = Math.floor(cx);
                const iy = Math.floor(cy);
                if (ix < 0 || ix >= MAP_W || iy < 0 || iy >= MAP_H) break;

                visible[iy][ix] = true;
                state.revealed[iy][ix] = true;

                if (state.map[iy][ix] === TILE.WALL) break;

                cx += dx;
                cy += dy;
            }
        }

        state.visible = visible;
    }

    // ---- 物品放置 ----
    function placeItems(rooms) {
        state.items = [];
        const floor = state.floor;

        for (let i = 1; i < rooms.length; i++) {
            const room = rooms[i];
            const cx = Math.floor((room.x1 + room.x2) / 2);
            const cy = Math.floor((room.y1 + room.y2) / 2);

            // 药水
            if (Math.random() < 0.4) {
                const px = room.x1 + Math.floor(Math.random() * (room.x2 - room.x1 + 1));
                const py = room.y1 + Math.floor(Math.random() * (room.y2 - room.y1 + 1));
                state.items.push({ x: px, y: py, type: 'potion', ch: '!', name: '治疗药水', heal: 25 + floor * 5 });
            }

            // 金币
            if (Math.random() < 0.5) {
                const gx = room.x1 + Math.floor(Math.random() * (room.x2 - room.x1 + 1));
                const gy = room.y1 + Math.floor(Math.random() * (room.y2 - room.y1 + 1));
                state.items.push({ x: gx, y: gy, type: 'gold', ch: '$', name: '金币', amount: 5 + Math.floor(Math.random() * 10 * floor) });
            }

            // 武器
            if (Math.random() < 0.15) {
                const avail = WEAPONS.filter(w => w.minFloor <= floor);
                if (avail.length > 0) {
                    const w = avail[Math.floor(Math.random() * avail.length)];
                    const wx = room.x1 + Math.floor(Math.random() * (room.x2 - room.x1 + 1));
                    const wy = room.y1 + Math.floor(Math.random() * (room.y2 - room.y1 + 1));
                    state.items.push({ x: wx, y: wy, type: 'weapon', ch: ')', name: w.name, atk: w.atk });
                }
            }

            // 护甲
            if (Math.random() < 0.12) {
                const avail = ARMORS.filter(a => a.minFloor <= floor);
                if (avail.length > 0) {
                    const a = avail[Math.floor(Math.random() * avail.length)];
                    const ax = room.x1 + Math.floor(Math.random() * (room.x2 - room.x1 + 1));
                    const ay = room.y1 + Math.floor(Math.random() * (room.y2 - room.y1 + 1));
                    state.items.push({ x: ax, y: ay, type: 'armor', ch: ']', name: a.name, def: a.def });
                }
            }
        }
    }

    // ---- 怪物放置 ----
    function placeEnemies(rooms) {
        state.enemies = [];
        const floor = state.floor;
        const available = MONSTER_DEFS.filter(m => m.minFloor <= floor);

        for (let i = 1; i < rooms.length; i++) {
            const room = rooms[i];
            const count = 1 + Math.floor(Math.random() * Math.min(3, Math.ceil(floor / 2)));

            for (let j = 0; j < count; j++) {
                const def = available[Math.floor(Math.random() * available.length)];
                const ex = room.x1 + Math.floor(Math.random() * (room.x2 - room.x1 + 1));
                const ey = room.y1 + Math.floor(Math.random() * (room.y2 - room.y1 + 1));

                // 随层数增强
                const scale = 1 + (floor - 1) * 0.15;
                state.enemies.push({
                    x: ex, y: ey,
                    ch: def.ch,
                    name: def.name,
                    hp: Math.floor(def.hp * scale),
                    maxHp: Math.floor(def.hp * scale),
                    atk: Math.floor(def.atk * scale),
                    def: Math.floor(def.def * scale),
                    xp: Math.floor(def.xp * scale),
                });
            }
        }
    }

    // ---- 生成新楼层 ----
    function generateFloor() {
        const { map, rooms } = generateDungeon();
        state.map = map;

        // 初始化可见性
        state.revealed = [];
        state.visible = [];
        for (let y = 0; y < MAP_H; y++) {
            state.revealed[y] = [];
            state.visible[y] = [];
            for (let x = 0; x < MAP_W; x++) {
                state.revealed[y][x] = false;
                state.visible[y][x] = false;
            }
        }

        // 放置玩家到第一个房间
        const startRoom = rooms[0];
        state.player.x = Math.floor((startRoom.x1 + startRoom.x2) / 2);
        state.player.y = Math.floor((startRoom.y1 + startRoom.y2) / 2);

        // 放置楼梯到最后一个房间
        if (state.floor < MAX_FLOOR) {
            const endRoom = rooms[rooms.length - 1];
            const sx = Math.floor((endRoom.x1 + endRoom.x2) / 2);
            const sy = Math.floor((endRoom.y1 + endRoom.y2) / 2);
            state.map[sy][sx] = TILE.STAIRS;
        }

        placeItems(rooms);
        placeEnemies(rooms);
        computeFOV(state.player.x, state.player.y);
    }

    // ---- 消息系统 ----
    function addMessage(text, cls) {
        state.messages.push({ text, cls: cls || 'msg-info' });
        if (state.messages.length > 50) state.messages.shift();
    }

    // ---- 战斗 ----
    function attack(attacker, defender, attackerName, defenderName) {
        const baseDmg = attacker.atk - defender.def;
        const dmg = Math.max(1, baseDmg + Math.floor(Math.random() * 3) - 1);
        defender.hp -= dmg;
        addMessage(`${attackerName} 对 ${defenderName} 造成了 ${dmg} 点伤害！`, 'msg-combat');
        return dmg;
    }

    function playerAttack(enemy) {
        const p = state.player;
        const totalAtk = p.atk + (p.weapon ? p.weapon.atk : 0);
        const attacker = { atk: totalAtk };
        attack(attacker, enemy, '你', enemy.name);

        if (enemy.hp <= 0) {
            addMessage(`你击杀了 ${enemy.name}！`, 'msg-combat');
            p.xp += enemy.xp;
            p.kills++;

            // 升级检查
            while (p.xp >= p.xpNext) {
                p.xp -= p.xpNext;
                p.level++;
                p.maxHp += 10;
                p.hp = Math.min(p.hp + 15, p.maxHp);
                p.atk += 2;
                p.def += 1;
                p.xpNext = Math.floor(p.xpNext * 1.5);
                addMessage(`升级！你现在是 ${p.level} 级了！`, 'msg-level');
            }

            state.enemies = state.enemies.filter(e => e !== enemy);
        }
    }

    function enemyAttack(enemy) {
        const p = state.player;
        const totalDef = p.def + (p.armor ? p.armor.def : 0);
        const defender = { hp: p.hp, def: totalDef };
        const dmg = attack(enemy, defender, enemy.name, '你');
        p.hp = defender.hp;

        if (p.hp <= 0) {
            p.hp = 0;
            state.gameOver = true;
            addMessage('你被击败了...', 'msg-danger');
        }
    }

    // ---- 怪物AI ----
    function moveEnemies() {
        const p = state.player;

        for (const e of state.enemies) {
            const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);

            // 只在玩家视野范围+2内活动
            if (dist > FOV_RADIUS + 2) continue;

            // 如果相邻则攻击
            if (dist === 1) {
                enemyAttack(e);
                if (state.gameOver) return;
                continue;
            }

            // 简单追踪AI
            if (dist <= FOV_RADIUS + 1) {
                let bestDx = 0, bestDy = 0;
                let bestDist = dist;

                const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
                // 打乱方向顺序避免一致性
                for (let i = dirs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
                }

                for (const [dx, dy] of dirs) {
                    const nx = e.x + dx;
                    const ny = e.y + dy;
                    if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
                    if (state.map[ny][nx] === TILE.WALL) continue;

                    // 不走到其他怪物上
                    if (state.enemies.some(oe => oe !== e && oe.x === nx && oe.y === ny)) continue;
                    // 不走到玩家上
                    if (nx === p.x && ny === p.y) continue;

                    const nd = Math.abs(nx - p.x) + Math.abs(ny - p.y);
                    if (nd < bestDist) {
                        bestDist = nd;
                        bestDx = dx;
                        bestDy = dy;
                    }
                }

                if (bestDx !== 0 || bestDy !== 0) {
                    e.x += bestDx;
                    e.y += bestDy;
                }
            }
        }
    }

    // ---- 玩家操作 ----
    function tryMove(dx, dy) {
        if (state.gameOver) return;

        const p = state.player;
        const nx = p.x + dx;
        const ny = p.y + dy;

        if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) return;
        if (state.map[ny][nx] === TILE.WALL) return;

        // 检查敌人
        const enemy = state.enemies.find(e => e.x === nx && e.y === ny);
        if (enemy) {
            playerAttack(enemy);
        } else {
            p.x = nx;
            p.y = ny;
        }

        // 怪物回合
        moveEnemies();
        computeFOV(p.x, p.y);
        render();
    }

    function tryPickup() {
        const p = state.player;
        const itemIdx = state.items.findIndex(i => i.x === p.x && i.y === p.y);
        if (itemIdx === -1) {
            addMessage('这里没有可拾取的物品。', 'msg-info');
            render();
            return;
        }

        const item = state.items[itemIdx];

        switch (item.type) {
            case 'potion':
                p.potions++;
                addMessage(`拾取了 ${item.name}！（药水 +1）`, 'msg-item');
                break;
            case 'gold':
                p.gold += item.amount;
                addMessage(`拾取了 ${item.amount} 金币！`, 'msg-item');
                break;
            case 'weapon':
                if (!p.weapon || item.atk > p.weapon.atk) {
                    const old = p.weapon;
                    p.weapon = { name: item.name, atk: item.atk };
                    addMessage(`装备了 ${item.name}（ATK +${item.atk}）！`, 'msg-item');
                    if (old) addMessage(`丢弃了 ${old.name}。`, 'msg-info');
                } else {
                    addMessage(`${item.name} 不如当前武器，已忽略。`, 'msg-info');
                }
                break;
            case 'armor':
                if (!p.armor || item.def > p.armor.def) {
                    const old = p.armor;
                    p.armor = { name: item.name, def: item.def };
                    addMessage(`装备了 ${item.name}（DEF +${item.def}）！`, 'msg-item');
                    if (old) addMessage(`丢弃了 ${old.name}。`, 'msg-info');
                } else {
                    addMessage(`${item.name} 不如当前护甲，已忽略。`, 'msg-info');
                }
                break;
        }

        state.items.splice(itemIdx, 1);

        moveEnemies();
        computeFOV(p.x, p.y);
        render();
    }

    function usePotion() {
        const p = state.player;
        if (p.potions <= 0) {
            addMessage('你没有药水了！', 'msg-danger');
            render();
            return;
        }

        const heal = 25 + state.floor * 5;
        const actual = Math.min(heal, p.maxHp - p.hp);
        p.hp += actual;
        p.potions--;
        addMessage(`使用药水恢复了 ${actual} 点生命值！`, 'msg-heal');

        moveEnemies();
        computeFOV(p.x, p.y);
        render();
    }

    function tryDescend() {
        const p = state.player;
        if (state.map[p.y][p.x] !== TILE.STAIRS) {
            addMessage('你需要站在楼梯（>）上才能下楼。', 'msg-info');
            render();
            return;
        }

        state.floor++;
        if (state.floor > MAX_FLOOR) {
            showWin();
            return;
        }

        addMessage(`你进入了地牢第 ${state.floor} 层...`, 'msg-info');
        generateFloor();
        render();
    }

    function waitTurn() {
        if (state.gameOver) return;
        addMessage('你等待了一回合。', 'msg-info');
        // 等待时小幅回血
        if (state.player.hp < state.player.maxHp) {
            state.player.hp = Math.min(state.player.hp + 1, state.player.maxHp);
        }
        moveEnemies();
        computeFOV(state.player.x, state.player.y);
        render();
    }

    // ---- 渲染 ----
    function getColorForTile(ch, isVisible) {
        if (!isVisible) return 'color:#333';
        switch (ch) {
            case TILE.WALL: return 'color:#555';
            case TILE.FLOOR: return 'color:#2a2a2a';
            case TILE.STAIRS: return 'color:#ffff00;font-weight:bold';
            case '@': return 'color:#00ff88;font-weight:bold';
            case '!': return 'color:#ff66cc';
            case '$': return 'color:#ffdd00';
            case ')': return 'color:#66aaff';
            case ']': return 'color:#88ff88';
            default: return 'color:#ff4444';
        }
    }

    function render() {
        const p = state.player;
        const mapEl = document.getElementById('map-display');

        // 构建地图显示
        let html = '';
        for (let y = 0; y < MAP_H; y++) {
            for (let x = 0; x < MAP_W; x++) {
                const isVisible = state.visible[y][x];
                const isRevealed = state.revealed[y][x];

                if (x === p.x && y === p.y) {
                    html += '<span style="color:#00ff88;font-weight:bold">@</span>';
                    continue;
                }

                if (!isRevealed) {
                    html += '<span style="color:#111"> </span>';
                    continue;
                }

                // 在可见范围内显示怪物和物品
                if (isVisible) {
                    const enemy = state.enemies.find(e => e.x === x && e.y === y);
                    if (enemy) {
                        html += `<span style="color:#ff4444;font-weight:bold">${enemy.ch}</span>`;
                        continue;
                    }

                    const item = state.items.find(i => i.x === x && i.y === y);
                    if (item) {
                        const color = getColorForTile(item.ch, true);
                        html += `<span style="${color}">${item.ch}</span>`;
                        continue;
                    }
                }

                const tile = state.map[y][x];
                const color = getColorForTile(tile, isVisible);
                html += `<span style="${color}">${tile}</span>`;
            }
            html += '\n';
        }

        mapEl.innerHTML = html;

        // 更新UI
        document.getElementById('floor-display').textContent = `地牢 第${state.floor}层`;
        document.getElementById('hp-text').textContent = `${p.hp}/${p.maxHp}`;
        document.getElementById('hp-bar').style.width = (p.hp / p.maxHp * 100) + '%';
        document.getElementById('xp-text').textContent = `${p.xp}/${p.xpNext}`;
        document.getElementById('xp-bar').style.width = (p.xp / p.xpNext * 100) + '%';
        document.getElementById('level-text').textContent = p.level;
        document.getElementById('atk-text').textContent = p.atk + (p.weapon ? '+' + p.weapon.atk : '');
        document.getElementById('def-text').textContent = p.def + (p.armor ? '+' + p.armor.def : '');
        document.getElementById('gold-text').textContent = p.gold;
        document.getElementById('potion-text').textContent = p.potions;

        // HP条变色
        const hpPct = p.hp / p.maxHp;
        const hpBar = document.getElementById('hp-bar');
        if (hpPct < 0.25) {
            hpBar.style.background = 'linear-gradient(90deg, #880000, #cc0000)';
        } else if (hpPct < 0.5) {
            hpBar.style.background = 'linear-gradient(90deg, #cc6600, #ff8800)';
        } else {
            hpBar.style.background = 'linear-gradient(90deg, #cc0000, #ff3333)';
        }

        // 更新消息日志
        const msgsEl = document.getElementById('messages');
        msgsEl.innerHTML = state.messages.slice(-10).map(m =>
            `<div class="msg ${m.cls}">${m.text}</div>`
        ).join('');
        msgsEl.scrollTop = msgsEl.scrollHeight;
    }

    // ---- 画面切换 ----
    function hideAll() {
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('help-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('win-screen').classList.add('hidden');
    }

    function showTitle() {
        hideAll();
        document.getElementById('title-screen').classList.remove('hidden');
    }

    function showHelp() {
        hideAll();
        document.getElementById('help-screen').classList.remove('hidden');
    }

    function showGame() {
        hideAll();
        document.getElementById('game-screen').classList.remove('hidden');
    }

    function showDeath() {
        hideAll();
        document.getElementById('death-screen').classList.remove('hidden');
        document.getElementById('death-floor').textContent = state.floor;
        document.getElementById('death-level').textContent = state.player.level;
        document.getElementById('death-kills').textContent = state.player.kills;
        document.getElementById('death-gold').textContent = state.player.gold;
    }

    function showWin() {
        hideAll();
        document.getElementById('win-screen').classList.remove('hidden');
        document.getElementById('win-level').textContent = state.player.level;
        document.getElementById('win-kills').textContent = state.player.kills;
        document.getElementById('win-gold').textContent = state.player.gold;
    }

    function startGame() {
        initState();
        generateFloor();
        addMessage('你进入了深渊地牢的第 1 层...', 'msg-info');
        addMessage('用 WASD/方向键移动，E 拾取物品，Q 使用药水。', 'msg-info');
        showGame();
        render();
    }

    // ---- 输入处理 ----
    function handleKeyDown(e) {
        // 游戏画面的输入
        if (!document.getElementById('game-screen').classList.contains('hidden')) {
            if (state.gameOver) {
                showDeath();
                return;
            }

            switch (e.key) {
                case 'w': case 'W': case 'ArrowUp':
                    e.preventDefault(); tryMove(0, -1); break;
                case 's': case 'ArrowDown':
                    e.preventDefault(); tryMove(0, 1); break;
                case 'a': case 'A': case 'ArrowLeft':
                    e.preventDefault(); tryMove(-1, 0); break;
                case 'd': case 'D': case 'ArrowRight':
                    e.preventDefault(); tryMove(1, 0); break;
                case 'e': case 'E':
                    e.preventDefault(); tryPickup(); break;
                case 'q': case 'Q':
                    e.preventDefault(); usePotion(); break;
                case '>': case '.':
                    e.preventDefault(); tryDescend(); break;
                case ' ':
                    e.preventDefault(); waitTurn(); break;
            }
        }
    }

    // ---- 初始化 ----
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btn-start').addEventListener('click', startGame);
        document.getElementById('btn-help').addEventListener('click', showHelp);
        document.getElementById('btn-back').addEventListener('click', showTitle);
        document.getElementById('btn-retry').addEventListener('click', startGame);
        document.getElementById('btn-win-retry').addEventListener('click', startGame);
        document.addEventListener('keydown', handleKeyDown);
    });

})();
