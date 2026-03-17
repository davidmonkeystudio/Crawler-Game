// ==========================================
//  深渊地牢 - Roguelike 地牢爬行者 v2.0
//  大型升级版：陷阱、宝箱、状态效果、稀有度、
//  Boss战、商店、暴击闪避、存档系统
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
        TRAP_HIDDEN: '.',  // 隐藏陷阱看起来像地板
        TRAP_VISIBLE: '^',
        CHEST: '=',
        SHOP: '$',
    };

    // ---- 稀有度系统 ----
    const RARITY = {
        COMMON: { name: '普通', color: '#aaaaaa', mult: 1.0 },
        UNCOMMON: { name: '优良', color: '#44ff44', mult: 1.3 },
        RARE: { name: '稀有', color: '#4488ff', mult: 1.6 },
        EPIC: { name: '史诗', color: '#cc44ff', mult: 2.0 },
        LEGENDARY: { name: '传说', color: '#ffaa00', mult: 2.5 },
    };

    function rollRarity(floor) {
        const r = Math.random() * 100;
        const bonus = floor * 2; // 高层更容易出好东西
        if (r < 2 + bonus * 0.3) return RARITY.LEGENDARY;
        if (r < 8 + bonus * 0.5) return RARITY.EPIC;
        if (r < 20 + bonus) return RARITY.RARE;
        if (r < 45 + bonus) return RARITY.UNCOMMON;
        return RARITY.COMMON;
    }

    // ---- 状态效果 ----
    const STATUS_EFFECTS = {
        POISON: { name: '中毒', ch: '☠', color: '#44ff44', duration: 5, dmgPerTurn: 3 },
        BURN: { name: '灼烧', ch: '🔥', color: '#ff6600', duration: 3, dmgPerTurn: 5 },
        STUN: { name: '眩晕', ch: '💫', color: '#ffff00', duration: 2 },
        BLEED: { name: '流血', ch: '🩸', color: '#ff0000', duration: 4, dmgPerTurn: 2 },
        REGEN: { name: '再生', ch: '💚', color: '#00ff00', duration: 5, healPerTurn: 4 },
        SHIELD: { name: '护盾', ch: '🛡', color: '#4488ff', duration: 8, defBonus: 5 },
    };

    // 怪物定义
    const MONSTER_DEFS = [
        { ch: 'r', name: '巨鼠', hp: 8, atk: 2, def: 0, xp: 5, minFloor: 1, gold: 3 },
        { ch: 'g', name: '哥布林', hp: 15, atk: 4, def: 1, xp: 10, minFloor: 1, gold: 8 },
        { ch: 'b', name: '蝙蝠', hp: 10, atk: 3, def: 0, xp: 7, minFloor: 1, gold: 5 },
        { ch: 's', name: '骷髅', hp: 25, atk: 6, def: 3, xp: 20, minFloor: 3, gold: 15 },
        { ch: 'S', name: '蛇女', hp: 30, atk: 8, def: 2, xp: 25, minFloor: 4, gold: 20, onHit: 'POISON' },
        { ch: 'o', name: '兽人', hp: 40, atk: 10, def: 5, xp: 35, minFloor: 5, gold: 25 },
        { ch: 'w', name: '幽灵', hp: 20, atk: 12, def: 1, xp: 30, minFloor: 5, gold: 22 },
        { ch: 'T', name: '巨魔', hp: 60, atk: 14, def: 8, xp: 50, minFloor: 7, gold: 40, regen: true },
        { ch: 'V', name: '吸血鬼', hp: 50, atk: 16, def: 6, xp: 55, minFloor: 8, gold: 45, lifesteal: true },
        { ch: 'D', name: '恶龙', hp: 100, atk: 22, def: 12, xp: 100, minFloor: 9, gold: 80, onHit: 'BURN' },
    ];

    // Boss定义
    const BOSS_DEFS = {
        5: { ch: 'B', name: '地牢守卫·暗影骑士', hp: 200, atk: 18, def: 10, xp: 200, gold: 150,
             onHit: 'BLEED', abilities: ['charge', 'shield'], isBoss: true },
        10: { ch: 'W', name: '深渊领主·虚无之王', hp: 500, atk: 30, def: 15, xp: 500, gold: 500,
              onHit: 'BURN', abilities: ['summon', 'nova', 'heal'], isBoss: true },
    };

    // 武器
    const WEAPONS = [
        { name: '短剑', atk: 2, minFloor: 1 },
        { name: '长剑', atk: 4, minFloor: 2 },
        { name: '毒刃', atk: 3, minFloor: 3, onHit: 'POISON' },
        { name: '战斧', atk: 6, minFloor: 4 },
        { name: '烈焰刀', atk: 5, minFloor: 5, onHit: 'BURN' },
        { name: '魔杖', atk: 8, minFloor: 6 },
        { name: '嗜血剑', atk: 7, minFloor: 7, lifesteal: true },
        { name: '圣剑', atk: 12, minFloor: 8 },
    ];

    // 护甲
    const ARMORS = [
        { name: '皮甲', def: 2, minFloor: 1 },
        { name: '锁甲', def: 4, minFloor: 3 },
        { name: '荆棘甲', def: 3, minFloor: 4, thorns: 3 },
        { name: '板甲', def: 7, minFloor: 5 },
        { name: '龙鳞甲', def: 10, minFloor: 7 },
    ];

    // 陷阱类型
    const TRAP_TYPES = [
        { name: '尖刺陷阱', dmg: 10, effect: null, msg: '你踩到了尖刺陷阱！' },
        { name: '毒气陷阱', dmg: 5, effect: 'POISON', msg: '毒气从地面涌出！' },
        { name: '火焰陷阱', dmg: 15, effect: 'BURN', msg: '烈焰从地板喷出！' },
        { name: '传送陷阱', dmg: 0, effect: null, teleport: true, msg: '你被传送到了别处！' },
        { name: '减速陷阱', dmg: 5, effect: 'STUN', msg: '黏液缠住了你的腿！' },
    ];

    // 商店物品
    const SHOP_ITEMS = [
        { name: '治疗药水', type: 'potion', cost: 20, desc: '恢复生命值' },
        { name: '再生卷轴', type: 'scroll_regen', cost: 40, desc: '获得再生效果' },
        { name: '护盾卷轴', type: 'scroll_shield', cost: 50, desc: '获得护盾效果' },
        { name: '钥匙', type: 'key', cost: 30, desc: '打开宝箱' },
        { name: '解毒剂', type: 'antidote', cost: 15, desc: '清除负面效果' },
    ];

    // ---- 游戏状态 ----
    let state = {};
    let shopOpen = false;
    let shopItems = [];

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
                potions: 2,
                keys: 0,
                weapon: null,
                armor: null,
                kills: 0,
                critChance: 5,   // 暴击率 %
                dodgeChance: 3,  // 闪避率 %
                statusEffects: [],
                turnCount: 0,
                totalDmgDealt: 0,
                totalDmgTaken: 0,
                bossesKilled: 0,
                chestsOpened: 0,
                trapsTriggered: 0,
            },
            enemies: [],
            items: [],
            traps: [],
            chests: [],
            shops: [],
            messages: [],
            gameOver: false,
            bossFloor: false,
        };
    }

    // ---- 存档系统 ----
    function saveGame() {
        try {
            const saveData = JSON.parse(JSON.stringify(state));
            localStorage.setItem('abyssDungeon_save', JSON.stringify(saveData));
            addMessage('游戏已保存！', 'msg-info');
        } catch (e) {
            addMessage('保存失败！', 'msg-danger');
        }
    }

    function loadGame() {
        try {
            const data = localStorage.getItem('abyssDungeon_save');
            if (!data) return false;
            state = JSON.parse(data);
            return true;
        } catch (e) {
            return false;
        }
    }

    function deleteSave() {
        localStorage.removeItem('abyssDungeon_save');
    }

    function hasSave() {
        return !!localStorage.getItem('abyssDungeon_save');
    }

    // ---- 排行榜 ----
    function getHighScores() {
        try {
            return JSON.parse(localStorage.getItem('abyssDungeon_scores') || '[]');
        } catch (e) {
            return [];
        }
    }

    function addHighScore(score) {
        const scores = getHighScores();
        scores.push(score);
        scores.sort((a, b) => b.score - a.score);
        localStorage.setItem('abyssDungeon_scores', JSON.stringify(scores.slice(0, 10)));
    }

    function calculateScore() {
        const p = state.player;
        return p.kills * 10 + p.gold + p.level * 50 + state.floor * 100 +
               p.bossesKilled * 200 + p.chestsOpened * 30;
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

    // ---- 随机空地板位置 ----
    function randomFloorInRoom(room) {
        const x = room.x1 + Math.floor(Math.random() * (room.x2 - room.x1 + 1));
        const y = room.y1 + Math.floor(Math.random() * (room.y2 - room.y1 + 1));
        return { x, y };
    }

    // ---- 物品放置 ----
    function placeItems(rooms) {
        state.items = [];
        const floor = state.floor;

        for (let i = 1; i < rooms.length; i++) {
            const room = rooms[i];

            // 药水
            if (Math.random() < 0.4) {
                const pos = randomFloorInRoom(room);
                state.items.push({ x: pos.x, y: pos.y, type: 'potion', ch: '!', name: '治疗药水', heal: 25 + floor * 5 });
            }

            // 金币
            if (Math.random() < 0.5) {
                const pos = randomFloorInRoom(room);
                state.items.push({ x: pos.x, y: pos.y, type: 'gold', ch: '$', name: '金币', amount: 5 + Math.floor(Math.random() * 10 * floor) });
            }

            // 钥匙
            if (Math.random() < 0.2) {
                const pos = randomFloorInRoom(room);
                state.items.push({ x: pos.x, y: pos.y, type: 'key', ch: 'k', name: '钥匙' });
            }

            // 武器（带稀有度）
            if (Math.random() < 0.15) {
                const avail = WEAPONS.filter(w => w.minFloor <= floor);
                if (avail.length > 0) {
                    const w = avail[Math.floor(Math.random() * avail.length)];
                    const rarity = rollRarity(floor);
                    const pos = randomFloorInRoom(room);
                    const bonusAtk = Math.floor(w.atk * rarity.mult);
                    state.items.push({
                        x: pos.x, y: pos.y, type: 'weapon', ch: ')',
                        name: `${rarity.name}${w.name}`, atk: bonusAtk,
                        rarity, onHit: w.onHit || null, lifesteal: w.lifesteal || false,
                    });
                }
            }

            // 护甲（带稀有度）
            if (Math.random() < 0.12) {
                const avail = ARMORS.filter(a => a.minFloor <= floor);
                if (avail.length > 0) {
                    const a = avail[Math.floor(Math.random() * avail.length)];
                    const rarity = rollRarity(floor);
                    const pos = randomFloorInRoom(room);
                    const bonusDef = Math.floor(a.def * rarity.mult);
                    state.items.push({
                        x: pos.x, y: pos.y, type: 'armor', ch: ']',
                        name: `${rarity.name}${a.name}`, def: bonusDef,
                        rarity, thorns: a.thorns ? Math.floor(a.thorns * rarity.mult) : 0,
                    });
                }
            }
        }
    }

    // ---- 陷阱放置 ----
    function placeTraps(rooms) {
        state.traps = [];
        const floor = state.floor;
        const trapCount = Math.floor(floor * 1.5) + 2;

        for (let i = 0; i < trapCount; i++) {
            const roomIdx = 1 + Math.floor(Math.random() * (rooms.length - 1));
            const room = rooms[roomIdx];
            const pos = randomFloorInRoom(room);
            const trapDef = TRAP_TYPES[Math.floor(Math.random() * TRAP_TYPES.length)];

            // 随层数增加陷阱伤害
            const scale = 1 + (floor - 1) * 0.2;
            state.traps.push({
                x: pos.x, y: pos.y,
                name: trapDef.name,
                dmg: Math.floor(trapDef.dmg * scale),
                effect: trapDef.effect,
                teleport: trapDef.teleport || false,
                msg: trapDef.msg,
                revealed: false,
            });
        }
    }

    // ---- 宝箱放置 ----
    function placeChests(rooms) {
        state.chests = [];
        const floor = state.floor;

        for (let i = 2; i < rooms.length; i++) {
            if (Math.random() < 0.3) {
                const room = rooms[i];
                const pos = randomFloorInRoom(room);
                const rarity = rollRarity(floor + 2); // 宝箱奖励偏好

                let reward;
                const roll = Math.random();
                if (roll < 0.3) {
                    // 武器
                    const avail = WEAPONS.filter(w => w.minFloor <= floor + 2);
                    const w = avail[Math.floor(Math.random() * avail.length)];
                    reward = {
                        type: 'weapon', ch: ')',
                        name: `${rarity.name}${w.name}`,
                        atk: Math.floor(w.atk * rarity.mult),
                        rarity, onHit: w.onHit || null, lifesteal: w.lifesteal || false,
                    };
                } else if (roll < 0.5) {
                    // 护甲
                    const avail = ARMORS.filter(a => a.minFloor <= floor + 2);
                    const a = avail[Math.floor(Math.random() * avail.length)];
                    reward = {
                        type: 'armor', ch: ']',
                        name: `${rarity.name}${a.name}`,
                        def: Math.floor(a.def * rarity.mult),
                        rarity, thorns: a.thorns ? Math.floor(a.thorns * rarity.mult) : 0,
                    };
                } else {
                    // 大量金币和药水
                    reward = {
                        type: 'treasure',
                        gold: 20 + floor * 15 + Math.floor(Math.random() * 50),
                        potions: 1 + Math.floor(Math.random() * 2),
                    };
                }

                state.chests.push({
                    x: pos.x, y: pos.y,
                    locked: Math.random() < 0.5,
                    reward,
                    rarity,
                });
            }
        }
    }

    // ---- 商店放置 ----
    function placeShops(rooms) {
        state.shops = [];
        // 每2层放一个商店
        if (state.floor % 2 === 0 && rooms.length > 3) {
            const roomIdx = 2 + Math.floor(Math.random() * (rooms.length - 3));
            const room = rooms[roomIdx];
            const cx = Math.floor((room.x1 + room.x2) / 2);
            const cy = Math.floor((room.y1 + room.y2) / 2);

            // 根据层数调整商店物品
            const items = SHOP_ITEMS.map(item => ({
                ...item,
                cost: Math.floor(item.cost * (1 + (state.floor - 1) * 0.1)),
            }));

            state.shops.push({ x: cx, y: cy, items });
        }
    }

    // ---- 怪物放置 ----
    function placeEnemies(rooms) {
        state.enemies = [];
        const floor = state.floor;
        const available = MONSTER_DEFS.filter(m => m.minFloor <= floor);

        // Boss层
        if (BOSS_DEFS[floor]) {
            state.bossFloor = true;
            const bossDef = BOSS_DEFS[floor];
            const bossRoom = rooms[rooms.length - 1];
            const cx = Math.floor((bossRoom.x1 + bossRoom.x2) / 2);
            const cy = Math.floor((bossRoom.y1 + bossRoom.y2) / 2);

            state.enemies.push({
                x: cx, y: cy,
                ch: bossDef.ch,
                name: bossDef.name,
                hp: bossDef.hp,
                maxHp: bossDef.hp,
                atk: bossDef.atk,
                def: bossDef.def,
                xp: bossDef.xp,
                gold: bossDef.gold,
                onHit: bossDef.onHit || null,
                abilities: bossDef.abilities || [],
                isBoss: true,
                statusEffects: [],
                abilityCooldown: 0,
            });
        } else {
            state.bossFloor = false;
        }

        for (let i = 1; i < rooms.length; i++) {
            // Boss房间只放Boss
            if (BOSS_DEFS[floor] && i === rooms.length - 1) continue;

            const room = rooms[i];
            const count = 1 + Math.floor(Math.random() * Math.min(3, Math.ceil(floor / 2)));

            for (let j = 0; j < count; j++) {
                const def = available[Math.floor(Math.random() * available.length)];
                const pos = randomFloorInRoom(room);

                const scale = 1 + (floor - 1) * 0.15;
                state.enemies.push({
                    x: pos.x, y: pos.y,
                    ch: def.ch,
                    name: def.name,
                    hp: Math.floor(def.hp * scale),
                    maxHp: Math.floor(def.hp * scale),
                    atk: Math.floor(def.atk * scale),
                    def: Math.floor(def.def * scale),
                    xp: Math.floor(def.xp * scale),
                    gold: Math.floor((def.gold || 0) * scale),
                    onHit: def.onHit || null,
                    regen: def.regen || false,
                    lifesteal: def.lifesteal || false,
                    statusEffects: [],
                    isBoss: false,
                });
            }
        }
    }

    // ---- 生成新楼层 ----
    function generateFloor() {
        const { map, rooms } = generateDungeon();
        state.map = map;

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
            // Boss层楼梯在Boss旁边
            if (BOSS_DEFS[state.floor]) {
                state.map[sy + 1] && (state.map[Math.min(sy + 1, MAP_H - 1)][sx] = TILE.STAIRS);
            } else {
                state.map[sy][sx] = TILE.STAIRS;
            }
        }

        placeItems(rooms);
        placeEnemies(rooms);
        placeTraps(rooms);
        placeChests(rooms);
        placeShops(rooms);
        computeFOV(state.player.x, state.player.y);
    }

    // ---- 消息系统 ----
    function addMessage(text, cls) {
        state.messages.push({ text, cls: cls || 'msg-info' });
        if (state.messages.length > 50) state.messages.shift();
    }

    // ---- 状态效果处理 ----
    function applyStatusEffect(target, effectName, targetName) {
        const effectDef = STATUS_EFFECTS[effectName];
        if (!effectDef) return;

        // 检查是否已有该效果
        const existing = target.statusEffects.find(e => e.name === effectDef.name);
        if (existing) {
            existing.duration = effectDef.duration; // 刷新持续时间
            return;
        }

        target.statusEffects.push({
            ...effectDef,
            remaining: effectDef.duration,
        });
        addMessage(`${targetName} 被施加了 ${effectDef.name} 效果！`, 'msg-danger');
    }

    function processStatusEffects(target, targetName) {
        if (!target.statusEffects) return;

        const toRemove = [];
        for (const effect of target.statusEffects) {
            if (effect.dmgPerTurn) {
                target.hp -= effect.dmgPerTurn;
                addMessage(`${targetName} 受到 ${effect.name} 造成的 ${effect.dmgPerTurn} 点伤害`, 'msg-danger');
            }
            if (effect.healPerTurn && target.hp < target.maxHp) {
                const heal = Math.min(effect.healPerTurn, target.maxHp - target.hp);
                target.hp += heal;
                addMessage(`${targetName} 恢复了 ${heal} 点生命`, 'msg-heal');
            }

            effect.remaining--;
            if (effect.remaining <= 0) {
                toRemove.push(effect);
            }
        }

        for (const effect of toRemove) {
            target.statusEffects = target.statusEffects.filter(e => e !== effect);
            addMessage(`${targetName} 的 ${effect.name} 效果消失了`, 'msg-info');
        }
    }

    function isStunned(target) {
        return target.statusEffects && target.statusEffects.some(e => e.name === '眩晕');
    }

    function getShieldBonus(target) {
        if (!target.statusEffects) return 0;
        const shield = target.statusEffects.find(e => e.defBonus);
        return shield ? shield.defBonus : 0;
    }

    // ---- 战斗系统 ----
    function attack(attacker, defender, attackerName, defenderName, isPlayer) {
        const p = state.player;

        // 闪避判定
        if (isPlayer === false) {
            // 玩家闪避
            if (Math.random() * 100 < p.dodgeChance) {
                addMessage(`你闪避了 ${attackerName} 的攻击！`, 'msg-combat');
                return 0;
            }
        }

        // 暴击判定
        let critMult = 1;
        let isCrit = false;
        if (isPlayer) {
            if (Math.random() * 100 < p.critChance) {
                critMult = 2;
                isCrit = true;
            }
        }

        const defBonus = getShieldBonus(defender);
        const baseDmg = attacker.atk - (defender.def + defBonus);
        const dmg = Math.max(1, Math.floor((baseDmg + Math.floor(Math.random() * 3) - 1) * critMult));
        defender.hp -= dmg;

        const critText = isCrit ? ' 【暴击！】' : '';
        addMessage(`${attackerName} 对 ${defenderName} 造成了 ${dmg} 点伤害！${critText}`, 'msg-combat');

        return dmg;
    }

    function playerAttack(enemy) {
        const p = state.player;
        const totalAtk = p.atk + (p.weapon ? p.weapon.atk : 0);
        const attacker = { atk: totalAtk };
        const dmg = attack(attacker, enemy, '你', enemy.name, true);
        p.totalDmgDealt += dmg;

        // 武器特效：命中附加状态
        if (p.weapon && p.weapon.onHit && Math.random() < 0.3) {
            applyStatusEffect(enemy, p.weapon.onHit, enemy.name);
        }

        // 武器特效：吸血
        if (p.weapon && p.weapon.lifesteal && dmg > 0) {
            const steal = Math.floor(dmg * 0.25);
            if (steal > 0) {
                p.hp = Math.min(p.hp + steal, p.maxHp);
                addMessage(`吸取了 ${steal} 点生命！`, 'msg-heal');
            }
        }

        // 护甲特效：荆棘反伤
        if (p.armor && p.armor.thorns) {
            // 对敌人没作用，只有被打时触发
        }

        if (enemy.hp <= 0) {
            addMessage(`你击杀了 ${enemy.name}！`, 'msg-combat');
            if (enemy.isBoss) {
                addMessage(`★ BOSS已被击败！伟大的胜利！★`, 'msg-level');
                p.bossesKilled++;
            }
            p.xp += enemy.xp;
            p.gold += enemy.gold || 0;
            p.kills++;

            // 掉落物品
            if (Math.random() < 0.2) {
                state.items.push({
                    x: enemy.x, y: enemy.y, type: 'potion', ch: '!',
                    name: '治疗药水', heal: 25 + state.floor * 5,
                });
            }

            // 升级检查
            while (p.xp >= p.xpNext) {
                p.xp -= p.xpNext;
                p.level++;
                p.maxHp += 12;
                p.hp = Math.min(p.hp + 20, p.maxHp);
                p.atk += 2;
                p.def += 1;
                p.critChance = Math.min(p.critChance + 1, 30);
                p.dodgeChance = Math.min(p.dodgeChance + 0.5, 20);
                p.xpNext = Math.floor(p.xpNext * 1.5);
                addMessage(`★ 升级！你现在是 ${p.level} 级了！暴击${p.critChance}% 闪避${p.dodgeChance.toFixed(1)}%`, 'msg-level');
            }

            state.enemies = state.enemies.filter(e => e !== enemy);
        }
    }

    function enemyAttack(enemy) {
        const p = state.player;
        const totalDef = p.def + (p.armor ? p.armor.def : 0);
        const defender = { hp: p.hp, def: totalDef, statusEffects: p.statusEffects };
        const dmg = attack(enemy, defender, enemy.name, '你', false);
        p.hp = defender.hp;
        p.totalDmgTaken += dmg;

        // 怪物命中附加状态
        if (enemy.onHit && dmg > 0 && Math.random() < 0.3) {
            applyStatusEffect(p, enemy.onHit, '你');
        }

        // 吸血怪回血
        if (enemy.lifesteal && dmg > 0) {
            const steal = Math.floor(dmg * 0.3);
            enemy.hp = Math.min(enemy.hp + steal, enemy.maxHp);
            addMessage(`${enemy.name} 吸取了 ${steal} 点生命！`, 'msg-danger');
        }

        // 荆棘甲反伤
        if (p.armor && p.armor.thorns && dmg > 0) {
            enemy.hp -= p.armor.thorns;
            addMessage(`荆棘甲反弹了 ${p.armor.thorns} 点伤害！`, 'msg-combat');
            if (enemy.hp <= 0) {
                addMessage(`${enemy.name} 被荆棘甲杀死了！`, 'msg-combat');
                p.xp += enemy.xp;
                p.gold += enemy.gold || 0;
                p.kills++;
                state.enemies = state.enemies.filter(e => e !== enemy);
            }
        }

        if (p.hp <= 0) {
            p.hp = 0;
            state.gameOver = true;
            addMessage('你被击败了...', 'msg-danger');
        }
    }

    // ---- Boss能力 ----
    function bossAbility(boss) {
        if (!boss.abilities || boss.abilities.length === 0) return;
        if (boss.abilityCooldown > 0) {
            boss.abilityCooldown--;
            return;
        }

        // Boss血量低于50%时更频繁使用技能
        const hpRatio = boss.hp / boss.maxHp;
        if (Math.random() > (hpRatio < 0.5 ? 0.4 : 0.25)) return;

        const ability = boss.abilities[Math.floor(Math.random() * boss.abilities.length)];

        switch (ability) {
            case 'charge': {
                // 冲锋：对玩家造成大量伤害
                const p = state.player;
                const dist = Math.abs(boss.x - p.x) + Math.abs(boss.y - p.y);
                if (dist <= 4) {
                    const dmg = Math.floor(boss.atk * 1.5);
                    p.hp -= dmg;
                    p.totalDmgTaken += dmg;
                    addMessage(`${boss.name} 发动了冲锋！造成 ${dmg} 点伤害！`, 'msg-danger');
                    if (p.hp <= 0) {
                        p.hp = 0;
                        state.gameOver = true;
                    }
                    boss.abilityCooldown = 3;
                }
                break;
            }
            case 'shield': {
                applyStatusEffect(boss, 'SHIELD', boss.name);
                addMessage(`${boss.name} 举起了护盾！`, 'msg-danger');
                boss.abilityCooldown = 4;
                break;
            }
            case 'summon': {
                // 召唤小兵
                const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                let summoned = 0;
                for (const [dx, dy] of dirs) {
                    const nx = boss.x + dx;
                    const ny = boss.y + dy;
                    if (nx >= 0 && nx < MAP_W && ny >= 0 && ny < MAP_H &&
                        state.map[ny][nx] !== TILE.WALL &&
                        !state.enemies.some(e => e.x === nx && e.y === ny) &&
                        !(state.player.x === nx && state.player.y === ny) &&
                        summoned < 2) {
                        state.enemies.push({
                            x: nx, y: ny, ch: 'w', name: '虚空仆从',
                            hp: 20, maxHp: 20, atk: 10, def: 3, xp: 15, gold: 10,
                            statusEffects: [], isBoss: false,
                        });
                        summoned++;
                    }
                }
                if (summoned > 0) {
                    addMessage(`${boss.name} 召唤了 ${summoned} 个虚空仆从！`, 'msg-danger');
                    boss.abilityCooldown = 5;
                }
                break;
            }
            case 'nova': {
                // 范围攻击
                const p = state.player;
                const dist = Math.abs(boss.x - p.x) + Math.abs(boss.y - p.y);
                if (dist <= 3) {
                    const dmg = Math.floor(boss.atk * 0.8);
                    p.hp -= dmg;
                    p.totalDmgTaken += dmg;
                    applyStatusEffect(p, 'BURN', '你');
                    addMessage(`${boss.name} 释放了虚空新星！造成 ${dmg} 点伤害！`, 'msg-danger');
                    if (p.hp <= 0) {
                        p.hp = 0;
                        state.gameOver = true;
                    }
                    boss.abilityCooldown = 3;
                }
                break;
            }
            case 'heal': {
                if (hpRatio < 0.5) {
                    const heal = Math.floor(boss.maxHp * 0.1);
                    boss.hp = Math.min(boss.hp + heal, boss.maxHp);
                    addMessage(`${boss.name} 恢复了 ${heal} 点生命！`, 'msg-danger');
                    boss.abilityCooldown = 4;
                }
                break;
            }
        }
    }

    // ---- 怪物AI ----
    function moveEnemies() {
        const p = state.player;

        for (const e of state.enemies) {
            // 处理怪物状态效果
            processStatusEffects(e, e.name);
            if (e.hp <= 0) {
                state.enemies = state.enemies.filter(en => en !== e);
                addMessage(`${e.name} 被状态效果击杀！`, 'msg-combat');
                p.xp += e.xp;
                p.kills++;
                continue;
            }

            // 眩晕跳过回合
            if (isStunned(e)) {
                addMessage(`${e.name} 处于眩晕状态，无法行动`, 'msg-info');
                continue;
            }

            // 巨魔回血
            if (e.regen && e.hp < e.maxHp) {
                const regen = Math.floor(e.maxHp * 0.05);
                e.hp = Math.min(e.hp + regen, e.maxHp);
            }

            // Boss使用技能
            if (e.isBoss) {
                bossAbility(e);
                if (state.gameOver) return;
            }

            const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);

            if (dist > FOV_RADIUS + 2) continue;

            if (dist === 1) {
                enemyAttack(e);
                if (state.gameOver) return;
                continue;
            }

            if (dist <= FOV_RADIUS + 1) {
                let bestDx = 0, bestDy = 0;
                let bestDist = dist;

                const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
                for (let i = dirs.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
                }

                for (const [dx, dy] of dirs) {
                    const nx = e.x + dx;
                    const ny = e.y + dy;
                    if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) continue;
                    if (state.map[ny][nx] === TILE.WALL) continue;
                    if (state.enemies.some(oe => oe !== e && oe.x === nx && oe.y === ny)) continue;
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

    // ---- 陷阱触发 ----
    function checkTraps() {
        const p = state.player;
        const trap = state.traps.find(t => t.x === p.x && t.y === p.y);
        if (!trap) return;

        trap.revealed = true;
        p.trapsTriggered++;
        addMessage(trap.msg, 'msg-danger');

        if (trap.dmg > 0) {
            p.hp -= trap.dmg;
            addMessage(`受到 ${trap.dmg} 点陷阱伤害！`, 'msg-danger');
        }

        if (trap.effect) {
            applyStatusEffect(p, trap.effect, '你');
        }

        if (trap.teleport) {
            // 传送到随机地板位置
            let tries = 0;
            while (tries < 100) {
                const rx = Math.floor(Math.random() * MAP_W);
                const ry = Math.floor(Math.random() * MAP_H);
                if (state.map[ry][rx] === TILE.FLOOR &&
                    !state.enemies.some(e => e.x === rx && e.y === ry)) {
                    p.x = rx;
                    p.y = ry;
                    addMessage('你被传送到了一个陌生的地方...', 'msg-info');
                    break;
                }
                tries++;
            }
        }

        // 移除已触发的陷阱
        state.traps = state.traps.filter(t => t !== trap);

        if (p.hp <= 0) {
            p.hp = 0;
            state.gameOver = true;
            addMessage('你被陷阱杀死了...', 'msg-danger');
        }
    }

    // ---- 宝箱交互 ----
    function tryOpenChest() {
        const p = state.player;
        const chest = state.chests.find(c => c.x === p.x && c.y === p.y);
        if (!chest) return false;

        if (chest.locked) {
            if (p.keys <= 0) {
                addMessage('这个宝箱上了锁！需要钥匙才能打开。', 'msg-info');
                return true;
            }
            p.keys--;
            addMessage('你用钥匙打开了宝箱！', 'msg-item');
        } else {
            addMessage('你打开了宝箱！', 'msg-item');
        }

        p.chestsOpened++;
        const reward = chest.reward;

        if (reward.type === 'weapon') {
            if (!p.weapon || reward.atk > p.weapon.atk) {
                const old = p.weapon;
                p.weapon = { name: reward.name, atk: reward.atk, rarity: reward.rarity, onHit: reward.onHit, lifesteal: reward.lifesteal };
                addMessage(`获得了 ${reward.name}（ATK +${reward.atk}）！`, 'msg-item');
                if (old) addMessage(`丢弃了 ${old.name}。`, 'msg-info');
            } else {
                addMessage(`${reward.name} 不如当前武器，转化为 ${reward.atk * 5} 金币。`, 'msg-info');
                p.gold += reward.atk * 5;
            }
        } else if (reward.type === 'armor') {
            if (!p.armor || reward.def > p.armor.def) {
                const old = p.armor;
                p.armor = { name: reward.name, def: reward.def, rarity: reward.rarity, thorns: reward.thorns };
                addMessage(`获得了 ${reward.name}（DEF +${reward.def}）！`, 'msg-item');
                if (old) addMessage(`丢弃了 ${old.name}。`, 'msg-info');
            } else {
                addMessage(`${reward.name} 不如当前护甲，转化为 ${reward.def * 5} 金币。`, 'msg-info');
                p.gold += reward.def * 5;
            }
        } else if (reward.type === 'treasure') {
            p.gold += reward.gold;
            p.potions += reward.potions;
            addMessage(`获得了 ${reward.gold} 金币和 ${reward.potions} 瓶药水！`, 'msg-item');
        }

        state.chests = state.chests.filter(c => c !== chest);
        return true;
    }

    // ---- 商店交互 ----
    function tryShop() {
        const p = state.player;
        const shop = state.shops.find(s => s.x === p.x && s.y === p.y);
        if (!shop) return false;

        shopOpen = true;
        shopItems = shop.items;
        renderShop();
        return true;
    }

    function buyItem(index) {
        const p = state.player;
        const item = shopItems[index];
        if (!item) return;

        if (p.gold < item.cost) {
            addMessage('金币不足！', 'msg-danger');
            renderShop();
            return;
        }

        p.gold -= item.cost;

        switch (item.type) {
            case 'potion':
                p.potions++;
                addMessage(`购买了 ${item.name}！`, 'msg-item');
                break;
            case 'scroll_regen':
                applyStatusEffect(p, 'REGEN', '你');
                addMessage(`使用了 ${item.name}！`, 'msg-heal');
                break;
            case 'scroll_shield':
                applyStatusEffect(p, 'SHIELD', '你');
                addMessage(`使用了 ${item.name}！`, 'msg-item');
                break;
            case 'key':
                p.keys++;
                addMessage(`购买了 ${item.name}！`, 'msg-item');
                break;
            case 'antidote':
                p.statusEffects = p.statusEffects.filter(e =>
                    e.name === '再生' || e.name === '护盾');
                addMessage(`清除了所有负面效果！`, 'msg-heal');
                break;
        }

        renderShop();
        render();
    }

    function closeShop() {
        shopOpen = false;
        document.getElementById('shop-overlay').classList.add('hidden');
        render();
    }

    // ---- 玩家操作 ----
    function tryMove(dx, dy) {
        if (state.gameOver || shopOpen) return;

        const p = state.player;

        // 眩晕无法行动
        if (isStunned(p)) {
            addMessage('你处于眩晕状态，无法行动！', 'msg-danger');
            processStatusEffects(p, '你');
            moveEnemies();
            computeFOV(p.x, p.y);
            p.turnCount++;
            render();
            return;
        }

        const nx = p.x + dx;
        const ny = p.y + dy;

        if (nx < 0 || nx >= MAP_W || ny < 0 || ny >= MAP_H) return;
        if (state.map[ny][nx] === TILE.WALL) return;

        const enemy = state.enemies.find(e => e.x === nx && e.y === ny);
        if (enemy) {
            playerAttack(enemy);
        } else {
            p.x = nx;
            p.y = ny;

            // 检查陷阱
            checkTraps();
        }

        // 处理玩家状态效果
        processStatusEffects(p, '你');

        if (!state.gameOver) {
            moveEnemies();
            computeFOV(p.x, p.y);
            p.turnCount++;
        }

        // 自动保存
        if (p.turnCount % 20 === 0) {
            saveGame();
        }

        render();
    }

    function tryPickup() {
        if (shopOpen) return;
        const p = state.player;

        // 先检查宝箱
        if (tryOpenChest()) {
            moveEnemies();
            computeFOV(p.x, p.y);
            p.turnCount++;
            render();
            return;
        }

        // 检查商店
        if (tryShop()) {
            return;
        }

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
            case 'key':
                p.keys++;
                addMessage(`拾取了 ${item.name}！（钥匙 +1）`, 'msg-item');
                break;
            case 'weapon': {
                const weaponValue = item.atk;
                const currentValue = p.weapon ? p.weapon.atk : 0;
                if (weaponValue > currentValue) {
                    const old = p.weapon;
                    p.weapon = { name: item.name, atk: item.atk, rarity: item.rarity, onHit: item.onHit, lifesteal: item.lifesteal };
                    const rarityColor = item.rarity ? item.rarity.color : '#aaa';
                    addMessage(`装备了 ${item.name}（ATK +${item.atk}）！`, 'msg-item');
                    if (old) addMessage(`丢弃了 ${old.name}。`, 'msg-info');
                } else {
                    addMessage(`${item.name} 不如当前武器，已忽略。`, 'msg-info');
                }
                break;
            }
            case 'armor': {
                const armorValue = item.def;
                const currentDefValue = p.armor ? p.armor.def : 0;
                if (armorValue > currentDefValue) {
                    const old = p.armor;
                    p.armor = { name: item.name, def: item.def, rarity: item.rarity, thorns: item.thorns };
                    addMessage(`装备了 ${item.name}（DEF +${item.def}）！`, 'msg-item');
                    if (old) addMessage(`丢弃了 ${old.name}。`, 'msg-info');
                } else {
                    addMessage(`${item.name} 不如当前护甲，已忽略。`, 'msg-info');
                }
                break;
            }
        }

        state.items.splice(itemIdx, 1);
        moveEnemies();
        computeFOV(p.x, p.y);
        p.turnCount++;
        render();
    }

    function usePotion() {
        if (shopOpen) return;
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

        processStatusEffects(p, '你');
        moveEnemies();
        computeFOV(p.x, p.y);
        p.turnCount++;
        render();
    }

    function tryDescend() {
        if (shopOpen) return;
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
        if (BOSS_DEFS[state.floor]) {
            addMessage(`⚠ 你感到一股强大的气息...这层有BOSS！`, 'msg-danger');
        }
        generateFloor();
        render();
    }

    function waitTurn() {
        if (state.gameOver || shopOpen) return;
        addMessage('你等待了一回合。', 'msg-info');
        if (state.player.hp < state.player.maxHp) {
            state.player.hp = Math.min(state.player.hp + 1, state.player.maxHp);
        }
        processStatusEffects(state.player, '你');
        moveEnemies();
        computeFOV(state.player.x, state.player.y);
        state.player.turnCount++;
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
            case 'k': return 'color:#ffaa00';
            case '^': return 'color:#ff4444';
            case '=': return 'color:#ffcc00;font-weight:bold';
            default: return 'color:#ff4444';
        }
    }

    function render() {
        const p = state.player;
        const mapEl = document.getElementById('map-display');

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

                if (isVisible) {
                    // Boss用特殊颜色
                    const enemy = state.enemies.find(e => e.x === x && e.y === y);
                    if (enemy) {
                        const color = enemy.isBoss ? '#ff00ff' : '#ff4444';
                        const weight = enemy.isBoss ? 'bold' : 'bold';
                        html += `<span style="color:${color};font-weight:${weight}">${enemy.ch}</span>`;
                        continue;
                    }

                    const item = state.items.find(i => i.x === x && i.y === y);
                    if (item) {
                        const color = item.rarity ? item.rarity.color : getColorForTile(item.ch, true).replace('color:', '');
                        html += `<span style="color:${color}">${item.ch}</span>`;
                        continue;
                    }

                    // 宝箱
                    const chest = state.chests.find(c => c.x === x && c.y === y);
                    if (chest) {
                        const color = chest.locked ? '#ff8800' : '#ffcc00';
                        html += `<span style="color:${color};font-weight:bold">=</span>`;
                        continue;
                    }

                    // 商店
                    const shop = state.shops.find(s => s.x === x && s.y === y);
                    if (shop) {
                        html += '<span style="color:#00ffff;font-weight:bold">S</span>';
                        continue;
                    }

                    // 可见的陷阱
                    const trap = state.traps.find(t => t.x === x && t.y === y && t.revealed);
                    if (trap) {
                        html += '<span style="color:#ff4444">^</span>';
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
        document.getElementById('floor-display').textContent =
            state.bossFloor ? `地牢 第${state.floor}层 ★BOSS★` : `地牢 第${state.floor}层`;
        document.getElementById('hp-text').textContent = `${p.hp}/${p.maxHp}`;
        document.getElementById('hp-bar').style.width = (p.hp / p.maxHp * 100) + '%';
        document.getElementById('xp-text').textContent = `${p.xp}/${p.xpNext}`;
        document.getElementById('xp-bar').style.width = (p.xp / p.xpNext * 100) + '%';
        document.getElementById('level-text').textContent = p.level;
        document.getElementById('atk-text').textContent = p.atk + (p.weapon ? '+' + p.weapon.atk : '');
        document.getElementById('def-text').textContent = p.def + (p.armor ? '+' + p.armor.def : '');
        document.getElementById('gold-text').textContent = p.gold;
        document.getElementById('potion-text').textContent = p.potions;
        document.getElementById('key-text').textContent = p.keys;

        // 状态效果显示
        const statusEl = document.getElementById('status-effects');
        if (statusEl) {
            if (p.statusEffects.length > 0) {
                statusEl.innerHTML = p.statusEffects.map(e =>
                    `<span class="status-badge" style="color:${e.color}" title="${e.name} (${e.remaining}回合)">${e.ch}${e.remaining}</span>`
                ).join(' ');
            } else {
                statusEl.innerHTML = '';
            }
        }

        // 武器/护甲名称颜色
        const weaponEl = document.getElementById('weapon-text');
        if (weaponEl) {
            if (p.weapon) {
                const color = p.weapon.rarity ? p.weapon.rarity.color : '#aaa';
                weaponEl.innerHTML = `<span style="color:${color}">${p.weapon.name}</span>`;
            } else {
                weaponEl.textContent = '无';
            }
        }
        const armorEl = document.getElementById('armor-text');
        if (armorEl) {
            if (p.armor) {
                const color = p.armor.rarity ? p.armor.rarity.color : '#aaa';
                armorEl.innerHTML = `<span style="color:${color}">${p.armor.name}</span>`;
            } else {
                armorEl.textContent = '无';
            }
        }

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

        // 如果死了，显示死亡画面
        if (state.gameOver) {
            setTimeout(() => showDeath(), 500);
        }
    }

    function renderShop() {
        const overlay = document.getElementById('shop-overlay');
        const content = document.getElementById('shop-content');
        const p = state.player;

        let html = '<h2 style="color:#00ffff;margin-bottom:0.5em">商店</h2>';
        html += `<p style="color:#ffdd00;margin-bottom:1em">金币: ${p.gold}</p>`;

        shopItems.forEach((item, i) => {
            const canBuy = p.gold >= item.cost;
            html += `<div class="shop-item ${canBuy ? '' : 'shop-disabled'}">
                <button class="shop-buy-btn" data-index="${i}" ${canBuy ? '' : 'disabled'}>
                    ${item.name} - ${item.cost}G
                </button>
                <span style="color:#888;font-size:0.8em">${item.desc}</span>
            </div>`;
        });

        html += '<button id="shop-close-btn" class="menu-btn" style="margin-top:1em;padding:0.5em 2em">离开商店</button>';
        content.innerHTML = html;
        overlay.classList.remove('hidden');

        // 绑定购买按钮
        content.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => buyItem(parseInt(btn.dataset.index)));
        });
        document.getElementById('shop-close-btn').addEventListener('click', closeShop);
    }

    // ---- 画面切换 ----
    function hideAll() {
        document.getElementById('title-screen').classList.add('hidden');
        document.getElementById('help-screen').classList.add('hidden');
        document.getElementById('game-screen').classList.add('hidden');
        document.getElementById('death-screen').classList.add('hidden');
        document.getElementById('win-screen').classList.add('hidden');
        document.getElementById('scores-screen').classList.add('hidden');
    }

    function showTitle() {
        hideAll();
        document.getElementById('title-screen').classList.remove('hidden');
        // 检查是否有存档
        const continueBtn = document.getElementById('btn-continue');
        if (continueBtn) {
            continueBtn.style.display = hasSave() ? 'block' : 'none';
        }
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
        deleteSave();
        const score = calculateScore();
        addHighScore({
            score,
            floor: state.floor,
            level: state.player.level,
            kills: state.player.kills,
            gold: state.player.gold,
            bossesKilled: state.player.bossesKilled,
            date: new Date().toLocaleDateString(),
        });

        document.getElementById('death-screen').classList.remove('hidden');
        document.getElementById('death-floor').textContent = state.floor;
        document.getElementById('death-level').textContent = state.player.level;
        document.getElementById('death-kills').textContent = state.player.kills;
        document.getElementById('death-gold').textContent = state.player.gold;
        document.getElementById('death-score').textContent = score;
        document.getElementById('death-bosses').textContent = state.player.bossesKilled;
    }

    function showWin() {
        hideAll();
        deleteSave();
        const score = calculateScore() + 1000; // 通关奖励
        addHighScore({
            score,
            floor: MAX_FLOOR,
            level: state.player.level,
            kills: state.player.kills,
            gold: state.player.gold,
            bossesKilled: state.player.bossesKilled,
            cleared: true,
            date: new Date().toLocaleDateString(),
        });

        document.getElementById('win-screen').classList.remove('hidden');
        document.getElementById('win-level').textContent = state.player.level;
        document.getElementById('win-kills').textContent = state.player.kills;
        document.getElementById('win-gold').textContent = state.player.gold;
        document.getElementById('win-score').textContent = score;
        document.getElementById('win-bosses').textContent = state.player.bossesKilled;
    }

    function showScores() {
        hideAll();
        document.getElementById('scores-screen').classList.remove('hidden');
        const scores = getHighScores();
        const listEl = document.getElementById('scores-list');

        if (scores.length === 0) {
            listEl.innerHTML = '<p style="color:#888;text-align:center">暂无记录</p>';
        } else {
            listEl.innerHTML = scores.map((s, i) => `
                <div class="score-entry">
                    <span class="score-rank">#${i + 1}</span>
                    <span class="score-value">${s.score}分</span>
                    <span class="score-detail">
                        ${s.cleared ? '★通关★' : `第${s.floor}层`}
                        Lv.${s.level} | ${s.kills}杀 | Boss×${s.bossesKilled || 0}
                    </span>
                    <span class="score-date">${s.date}</span>
                </div>
            `).join('');
        }
    }

    function startGame() {
        initState();
        generateFloor();
        addMessage('你进入了深渊地牢的第 1 层...', 'msg-info');
        addMessage('WASD移动 | E拾取/开箱/商店 | Q药水 | >下楼', 'msg-info');
        addMessage('小心陷阱！探索宝箱获取强力装备！', 'msg-info');
        showGame();
        render();
    }

    function continueGame() {
        if (loadGame()) {
            addMessage('读取存档成功！继续冒险...', 'msg-info');
            showGame();
            computeFOV(state.player.x, state.player.y);
            render();
        } else {
            addMessage('存档读取失败！', 'msg-danger');
            startGame();
        }
    }

    // ---- 输入处理 ----
    function handleKeyDown(e) {
        // 商店中的按键
        if (shopOpen) {
            if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                closeShop();
            }
            if (e.key >= '1' && e.key <= '5') {
                e.preventDefault();
                buyItem(parseInt(e.key) - 1);
            }
            return;
        }

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
                case 'S':
                    e.preventDefault(); saveGame(); render(); break;
            }
        }
    }

    // ---- 触控处理 ----
    function handleTouchAction(action) {
        if (document.getElementById('game-screen').classList.contains('hidden')) return;
        if (shopOpen && action !== 'pickup') return;
        if (state.gameOver) {
            showDeath();
            return;
        }

        switch (action) {
            case 'up': tryMove(0, -1); break;
            case 'down': tryMove(0, 1); break;
            case 'left': tryMove(-1, 0); break;
            case 'right': tryMove(1, 0); break;
            case 'pickup': shopOpen ? closeShop() : tryPickup(); break;
            case 'potion': usePotion(); break;
            case 'descend': tryDescend(); break;
            case 'wait': waitTurn(); break;
        }
    }

    function initTouchControls() {
        const buttons = document.querySelectorAll('#touch-controls .touch-btn');
        buttons.forEach(btn => {
            const action = btn.dataset.action;
            if (!action) return;

            btn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                handleTouchAction(action);
            });
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                handleTouchAction(action);
            });
        });
    }

    // ---- 滑动手势 ----
    function initSwipeGesture() {
        let startX = 0, startY = 0;
        const mapContainer = document.getElementById('map-container');
        const SWIPE_THRESHOLD = 30;

        mapContainer.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        mapContainer.addEventListener('touchend', (e) => {
            if (document.getElementById('game-screen').classList.contains('hidden')) return;
            if (shopOpen) return;
            if (state.gameOver) { showDeath(); return; }

            const dx = e.changedTouches[0].clientX - startX;
            const dy = e.changedTouches[0].clientY - startY;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);

            if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;

            if (absDx > absDy) {
                tryMove(dx > 0 ? 1 : -1, 0);
            } else {
                tryMove(0, dy > 0 ? 1 : -1);
            }
        }, { passive: true });
    }

    // ---- 初始化 ----
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('btn-start').addEventListener('click', startGame);
        document.getElementById('btn-continue').addEventListener('click', continueGame);
        document.getElementById('btn-help').addEventListener('click', showHelp);
        document.getElementById('btn-scores').addEventListener('click', showScores);
        document.getElementById('btn-back').addEventListener('click', showTitle);
        document.getElementById('btn-retry').addEventListener('click', startGame);
        document.getElementById('btn-win-retry').addEventListener('click', startGame);
        document.getElementById('btn-scores-back').addEventListener('click', showTitle);
        document.addEventListener('keydown', handleKeyDown);
        initTouchControls();
        initSwipeGesture();

        // 显示/隐藏继续按钮
        const continueBtn = document.getElementById('btn-continue');
        continueBtn.style.display = hasSave() ? 'block' : 'none';
    });

})();
