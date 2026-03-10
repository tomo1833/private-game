"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

/* ================================================================
   聖剣伝説風 アクションRPG — "Blade of Mana"
   ================================================================ */

/* ─── 型定義 ─── */
type Dir = 0 | 1 | 2 | 3; // 0=down 1=up 2=left 3=right

type Player = {
  x: number; y: number; w: number; h: number;
  hp: number; maxHp: number; mp: number; maxMp: number;
  atk: number; def: number; level: number; exp: number; nextExp: number;
  dir: Dir; speed: number;
  attacking: boolean; attackTimer: number; attackCooldown: number;
  chargeTime: number; isCharging: boolean; chargeLevel: number;
  invincible: number; knockVx: number; knockVy: number;
  potions: number; mpPotions: number; selectedMagic: number;
  walkFrame: number; walkTimer: number;
};

type EnemyKind = "slime" | "goblin" | "bat" | "skeleton" | "darkKnight";
type Enemy = {
  x: number; y: number; w: number; h: number;
  hp: number; maxHp: number; atk: number; def: number; speed: number;
  kind: EnemyKind; dir: Dir;
  invincible: number; knockVx: number; knockVy: number;
  aiTimer: number; aiState: string;
  shootTimer: number; dead: boolean;
  animTimer: number;
};

type Projectile = {
  x: number; y: number; vx: number; vy: number;
  radius: number; damage: number; isEnemy: boolean;
  life: number; color: string; kind: string;
};

type ItemDrop = {
  x: number; y: number;
  kind: "hp" | "mp" | "exp";
  life: number;
};

type DmgNum = {
  x: number; y: number; text: string; color: string;
  life: number; vy: number;
};

type Particle = {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; color: string; size: number;
};

type NPC = {
  x: number; y: number;
  name: string; dialog: string[];
  kind: "elder" | "healer" | "girl";
};

type MapTransition = {
  x: number; y: number; w: number; h: number;
  target: string; tx: number; ty: number;
};

type GameMap = {
  name: string; cols: number; rows: number;
  tiles: number[][]; bgColor: string;
  enemyDefs: { kind: EnemyKind; x: number; y: number }[];
  npcs: NPC[];
  transitions: MapTransition[];
};

/* ─── 定数 ─── */
const W = 960, H = 540;
const T = 32; // tile size
const WALK_SPEED = 150;

// タイルID
const GRASS = 0, WALL = 1, WATER = 2, TREE = 3, PATH = 4, FLOOR = 5, BRIDGE = 6;
const WALKABLE = new Set([GRASS, PATH, FLOOR, BRIDGE]);

// 魔法
const MAGICS = [
  { name: "ファイア", cost: 5, color: "#ff6633", desc: "火球を放つ" },
  { name: "アイス", cost: 8, color: "#66ccff", desc: "周囲を凍てつかせる" },
  { name: "ヒール", cost: 10, color: "#66ff99", desc: "HPを回復する" },
] as const;

// 敵パラメータ
const ENEMY_DEFS: Record<EnemyKind, { hp: number; atk: number; def: number; speed: number; exp: number; w: number; h: number }> = {
  slime:      { hp: 25, atk: 6, def: 2, speed: 40, exp: 12, w: 24, h: 20 },
  goblin:     { hp: 45, atk: 12, def: 4, speed: 70, exp: 28, w: 24, h: 28 },
  bat:        { hp: 30, atk: 9, def: 2, speed: 100, exp: 18, w: 26, h: 20 },
  skeleton:   { hp: 60, atk: 15, def: 7, speed: 55, exp: 40, w: 26, h: 30 },
  darkKnight: { hp: 600, atk: 30, def: 12, speed: 65, exp: 500, w: 40, h: 44 },
};

/* ─── マップデータ生成 ─── */
function parseMap(rows: string[]): number[][] {
  const charMap: Record<string, number> = {
    ".": GRASS, "#": WALL, "~": WATER, "T": TREE, ",": PATH, "_": FLOOR, "=": BRIDGE,
  };
  return rows.map(r => [...r].map(c => charMap[c] ?? GRASS));
}

function buildMaps(): Record<string, GameMap> {
  /* ── 村 (25×18) ── */
  const villageTiles = parseMap([
    "TTTTTTTTTTTTTTTTTTTTTTTTT",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,##,,,,,,,,,,,,##,,,,T",
    "T,,,#_,,,,,,,,,,,,_#,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,~~~~~,,,,,,,,,T",
    "T,,,,,,,,,~~~~~,,,,,,,,,T",
    "T,,,,,,,,,~~~~~,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,##,,,,,,,,,,,,##,,,,T",
    "T,,,#_,,,,,,,,,,,,_#,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "T,,,,,,,,,,,,,,,,,,,,,,,T",
    "TTTTTTTTTTTTTTTTTTTTTTTTT",
  ]);

  /* ── 森 (35×25) ── */
  const forestTiles = parseMap([
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
    "T.....T..........T.....T.........T",
    "T..T.....T....T.....T.....T.....T",
    "T.....T......T...........T.......T",
    "T..T.....T........T.T...........TT",
    "T........T...T..........T........T",
    "T.T..........~~~~.....T..........T",
    "T.....T......~~~~T..........T....T",
    "T..T.........====...T............T",
    "T...........T~~~~..........T.....T",
    "T.T...T......~~~~.....T.........TT",
    "T..........T.............T.......T",
    "T....T.........T...T.............T",
    "T.........T.T..........T....T...TT",
    "T..T.T..........T...............TT",
    "T..........T..........T.T.......TT",
    "T.T....T.........T..............TT",
    "T...........T.T........T........TT",
    "T.....T.T..............T.........T",
    "T..T..........T....T.......T....TT",
    "T........T...........T..........TT",
    "T.T...T........T..........T.....TT",
    "T..........T.......T.............T",
    "T....T.........T.........T......TT",
    "TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT",
  ]);

  /* ── 洞窟 (30×22) ── */
  const caveTiles = parseMap([
    "##############################",
    "#____________________________#",
    "#__####__________####________#",
    "#__#__#__________#__#________#",
    "#_____#____~~____#___________#",
    "#__####____~~____####________#",
    "#__________~~________________#",
    "#__________==________________#",
    "#__________~~________####___##",
    "#__####____~~________#__#___##",
    "#__#__#______________#_______#",
    "#_____#______________####____#",
    "#__####______________________#",
    "#____________________________#",
    "#________####________####___##",
    "#________#__#________#__#___##",
    "#________#___________#_______#",
    "#________####________####____#",
    "#____________________________#",
    "#____________________________#",
    "#____________________________#",
    "##############################",
  ]);

  /* ── 魔王城 (28×22) ── */
  const castleTiles = parseMap([
    "############################",
    "#__________________________#",
    "#__######################__#",
    "#__#__________________#____#",
    "#__#__________________#____#",
    "#__#__________________#____#",
    "#__########____########____#",
    "#__________________________#",
    "#__________________________#",
    "#__########____########____#",
    "#__#__________________#____#",
    "#__#__________________#____#",
    "#__#______........____#____#",
    "#__#______........____#____#",
    "#__#______........____#____#",
    "#__#______........____#____#",
    "#__#__________________#____#",
    "#__########____########____#",
    "#__________________________#",
    "#__________________________#",
    "#__________________________#",
    "############################",
  ]);

  return {
    village: {
      name: "マナの村", cols: 25, rows: 18, tiles: villageTiles, bgColor: "#1a3a1a",
      enemyDefs: [],
      npcs: [
        { x: 5 * T, y: 3 * T, name: "長老", kind: "elder",
          dialog: ["東の森を越え、洞窟を抜けた先に", "闇の騎士が待ち構えておる。", "この地に平和を取り戻してくれ！"] },
        { x: 19 * T, y: 3 * T, name: "癒し手", kind: "healer",
          dialog: ["あなたの傷を癒しましょう…", "（HPとMPが全回復した！）"] },
        { x: 12 * T, y: 14 * T, name: "少女", kind: "girl",
          dialog: ["気をつけてね、勇者さん！", "森にはスライムやゴブリンがいるわ。"] },
      ],
      transitions: [
        { x: 24 * T, y: 5 * T, w: T, h: T * 3, target: "forest", tx: 2 * T, ty: 12 * T },
      ],
    },
    forest: {
      name: "精霊の森", cols: 35, rows: 25, tiles: forestTiles, bgColor: "#0d2b0d",
      enemyDefs: [
        { kind: "slime", x: 8 * T, y: 4 * T }, { kind: "slime", x: 15 * T, y: 6 * T },
        { kind: "slime", x: 22 * T, y: 3 * T }, { kind: "slime", x: 10 * T, y: 16 * T },
        { kind: "goblin", x: 25 * T, y: 8 * T }, { kind: "goblin", x: 18 * T, y: 14 * T },
        { kind: "goblin", x: 28 * T, y: 18 * T }, { kind: "slime", x: 6 * T, y: 20 * T },
        { kind: "goblin", x: 30 * T, y: 12 * T },
      ],
      npcs: [],
      transitions: [
        { x: 0, y: 11 * T, w: T, h: T * 3, target: "village", tx: 22 * T, ty: 5 * T },
        { x: 34 * T, y: 11 * T, w: T, h: T * 3, target: "cave", tx: 2 * T, ty: 10 * T },
      ],
    },
    cave: {
      name: "暗黒の洞窟", cols: 30, rows: 22, tiles: caveTiles, bgColor: "#111118",
      enemyDefs: [
        { kind: "bat", x: 8 * T, y: 4 * T }, { kind: "bat", x: 20 * T, y: 6 * T },
        { kind: "bat", x: 14 * T, y: 12 * T }, { kind: "skeleton", x: 22 * T, y: 4 * T },
        { kind: "skeleton", x: 10 * T, y: 16 * T }, { kind: "skeleton", x: 24 * T, y: 14 * T },
        { kind: "bat", x: 6 * T, y: 18 * T }, { kind: "skeleton", x: 18 * T, y: 18 * T },
      ],
      npcs: [],
      transitions: [
        { x: 0, y: 9 * T, w: T, h: T * 3, target: "forest", tx: 32 * T, ty: 12 * T },
        { x: 29 * T, y: 1 * T, w: T, h: T * 3, target: "castle", tx: 2 * T, ty: 18 * T },
      ],
    },
    castle: {
      name: "闇の城", cols: 28, rows: 22, tiles: castleTiles, bgColor: "#0a0a14",
      enemyDefs: [
        { kind: "skeleton", x: 6 * T, y: 8 * T }, { kind: "skeleton", x: 20 * T, y: 8 * T },
        { kind: "skeleton", x: 6 * T, y: 18 * T }, { kind: "skeleton", x: 20 * T, y: 18 * T },
        { kind: "darkKnight", x: 13 * T, y: 4 * T },
      ],
      npcs: [],
      transitions: [
        { x: 0, y: 17 * T, w: T, h: T * 3, target: "cave", tx: 27 * T, ty: 2 * T },
      ],
    },
  };
}

/* ─── ヘルパー関数 ─── */
function dist2(ax: number, ay: number, bx: number, by: number) {
  const dx = ax - bx, dy = ay - by;
  return dx * dx + dy * dy;
}
function clamp(v: number, lo: number, hi: number) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function rng(min: number, max: number) { return min + Math.random() * (max - min); }

function isWalkable(map: GameMap, px: number, py: number, pw: number, ph: number): boolean {
  const margin = 4;
  const x1 = Math.floor((px + margin) / T);
  const y1 = Math.floor((py + margin) / T);
  const x2 = Math.floor((px + pw - margin - 1) / T);
  const y2 = Math.floor((py + ph - margin - 1) / T);
  for (let r = y1; r <= y2; r++) {
    for (let c = x1; c <= x2; c++) {
      if (r < 0 || r >= map.rows || c < 0 || c >= map.cols) return false;
      if (!WALKABLE.has(map.tiles[r][c])) return false;
    }
  }
  return true;
}

function makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
  const d = ENEMY_DEFS[kind];
  return {
    x, y, w: d.w, h: d.h, hp: d.hp, maxHp: d.hp,
    atk: d.atk, def: d.def, speed: d.speed, kind, dir: 0,
    invincible: 0, knockVx: 0, knockVy: 0,
    aiTimer: Math.random() * 2, aiState: "wander",
    shootTimer: 2 + Math.random() * 2, dead: false, animTimer: 0,
  };
}

/* ================================================================
   メインコンポーネント
   ================================================================ */
export default function SeikenPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [gameState, setGameState] = useState<"title" | "playing" | "gameover" | "victory">("title");
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);
  const gameStateRef = useRef<"title" | "playing" | "gameover" | "victory">("title");
  const restartRef = useRef(0);

  const startGame = useCallback(() => {
    gameStateRef.current = "playing";
    setGameState("playing");
    restartRef.current++;
  }, []);

  const togglePause = useCallback(() => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(p => !p);
  }, []);

  /* ─── ゲームループ ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const maps = buildMaps();
    const keys = new Set<string>();

    /* ── ゲーム状態 ── */
    let currentMapId = "village";
    let currentMap = maps[currentMapId];
    const enemies: Enemy[] = [];
    const projectiles: Projectile[] = [];
    const items: ItemDrop[] = [];
    const particles: Particle[] = [];
    const dmgNums: DmgNum[] = [];

    let camX = 0, camY = 0;
    let screenShake = 0;
    let fadeAlpha = 1; // フェードイン開始
    let fadeDir = -1;  // -1=フェードイン, 1=フェードアウト, 0=なし
    let pendingTransition: MapTransition | null = null;
    let dialogActive = false;
    let dialogLines: string[] = [];
    let dialogName = "";
    let dialogLineIdx = 0;
    let dialogCooldown = 0;
    let ringMenuOpen = false;
    let ringMenuIdx = 0;
    let bossDead = false;
    let prev = performance.now();
    let raf = 0;
    let levelUpTimer = 0;
    let waterAnimTimer = 0;

    const player: Player = {
      x: 12 * T, y: 9 * T, w: 22, h: 28,
      hp: 100, maxHp: 100, mp: 30, maxMp: 30,
      atk: 10, def: 5, level: 1, exp: 0, nextExp: 50,
      dir: 0, speed: WALK_SPEED,
      attacking: false, attackTimer: 0, attackCooldown: 0,
      chargeTime: 0, isCharging: false, chargeLevel: 0,
      invincible: 1.5, knockVx: 0, knockVy: 0,
      potions: 3, mpPotions: 2, selectedMagic: 0,
      walkFrame: 0, walkTimer: 0,
    };

    function spawnMapEnemies() {
      enemies.length = 0;
      for (const ed of currentMap.enemyDefs) {
        if (ed.kind === "darkKnight" && bossDead) continue;
        enemies.push(makeEnemy(ed.kind, ed.x, ed.y));
      }
    }
    spawnMapEnemies();

    function spawnParticles(x: number, y: number, count: number, color: string, spd = 120) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 20 + Math.random() * spd;
        particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
          life: 0.3 + Math.random() * 0.4, maxLife: 0.6, color,
          size: 2 + Math.random() * 3,
        });
      }
    }

    function addDmgNum(x: number, y: number, text: string, color: string) {
      dmgNums.push({ x, y, text, color, life: 1.0, vy: -60 });
    }

    function rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
      return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    }

    function dirVec(d: Dir): [number, number] {
      return d === 0 ? [0, 1] : d === 1 ? [0, -1] : d === 2 ? [-1, 0] : [1, 0];
    }

    /* ── チャージレベル計算 ── */
    function calcChargeLevel(t: number): number {
      if (t < 0.8) return 0;
      if (t < 1.8) return 1;
      return 2;
    }

    /* ── ダメージ計算 ── */
    function calcDmg(atk: number, def: number): number {
      return Math.max(1, atk - def + Math.floor(rng(-2, 3)));
    }

    /* ── 攻撃ヒットボックス取得 ── */
    function getAttackBox(p: Player): { x: number; y: number; w: number; h: number; isSpin: boolean } {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      const isSpin = p.chargeLevel >= 2;
      if (isSpin) {
        const r = 44;
        return { x: cx - r, y: cy - r, w: r * 2, h: r * 2, isSpin: true };
      }
      const reach = p.chargeLevel >= 1 ? 34 : 26;
      const thick = p.chargeLevel >= 1 ? 28 : 20;
      const [dx, dy] = dirVec(p.dir);
      if (dx !== 0) {
        return { x: cx + dx * 10 - (dx < 0 ? reach : 0), y: cy - thick / 2, w: reach, h: thick, isSpin: false };
      }
      return { x: cx - thick / 2, y: cy + dy * 10 - (dy < 0 ? reach : 0), w: thick, h: reach, isSpin: false };
    }

    /* ── レベルアップ ── */
    function checkLevelUp() {
      while (player.exp >= player.nextExp) {
        player.exp -= player.nextExp;
        player.level++;
        player.maxHp += 15;
        player.maxMp += 5;
        player.hp = player.maxHp;
        player.mp = player.maxMp;
        player.atk += 3;
        player.def += 2;
        player.speed += 3;
        player.nextExp = player.level * 50;
        levelUpTimer = 2.0;
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 30, "#ffe066", 180);
        addDmgNum(player.x + player.w / 2, player.y - 20, `Level ${player.level}!`, "#ffe066");
      }
    }

    /* ── アイテムドロップ ── */
    function dropItems(x: number, y: number) {
      const r = Math.random();
      if (r < 0.25) items.push({ x, y, kind: "hp", life: 10 });
      else if (r < 0.40) items.push({ x, y, kind: "mp", life: 10 });
      else if (r < 0.70) items.push({ x, y, kind: "exp", life: 10 });
    }

    /* ── 魔法発動 ── */
    function castMagic() {
      const m = MAGICS[player.selectedMagic];
      if (player.mp < m.cost) { addDmgNum(player.x, player.y - 10, "MP不足", "#ff6666"); return; }
      player.mp -= m.cost;
      const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
      const [dx, dy] = dirVec(player.dir);

      if (player.selectedMagic === 0) { // ファイア
        projectiles.push({
          x: cx, y: cy, vx: dx * 350 + (dx === 0 ? 0 : 0), vy: dy * 350 + (dy === 0 ? 0 : 0),
          radius: 8, damage: Math.floor(player.atk * 1.5), isEnemy: false,
          life: 1.2, color: "#ff6633", kind: "fire",
        });
        // 方向がゼロの場合デフォルト
        if (dx === 0 && dy === 0) {
          projectiles[projectiles.length - 1].vy = 350;
        }
        spawnParticles(cx, cy, 8, "#ff9944");
      } else if (player.selectedMagic === 1) { // アイス
        const dmg = Math.floor(player.atk * 1.3);
        for (const e of enemies) {
          if (e.dead) continue;
          const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
          if (dist2(cx, cy, ex, ey) < 120 * 120) {
            const d = calcDmg(dmg, e.def);
            e.hp -= d;
            e.invincible = 0.5;
            addDmgNum(ex, ey - 10, String(d), "#66ccff");
            spawnParticles(ex, ey, 6, "#aaeeff");
            const ang = Math.atan2(ey - cy, ex - cx);
            e.knockVx = Math.cos(ang) * 200;
            e.knockVy = Math.sin(ang) * 200;
          }
        }
        spawnParticles(cx, cy, 20, "#66ccff", 150);
      } else { // ヒール
        const heal = Math.floor(player.maxHp * 0.35);
        player.hp = Math.min(player.maxHp, player.hp + heal);
        addDmgNum(cx, cy - 20, `+${heal}`, "#66ff99");
        spawnParticles(cx, cy, 15, "#66ff99", 80);
      }
    }

    /* ── NPC判定 ── */
    function checkNPC(): NPC | null {
      const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
      for (const npc of currentMap.npcs) {
        if (dist2(cx, cy, npc.x + 16, npc.y + 16) < 50 * 50) return npc;
      }
      return null;
    }

    /* ── マップ遷移 ── */
    function checkTransition() {
      for (const tr of currentMap.transitions) {
        if (rectsOverlap(player.x, player.y, player.w, player.h, tr.x, tr.y, tr.w, tr.h)) {
          pendingTransition = tr;
          fadeDir = 1;
          fadeAlpha = 0;
          return;
        }
      }
    }

    function doTransition(tr: MapTransition) {
      currentMapId = tr.target;
      currentMap = maps[currentMapId];
      player.x = tr.tx;
      player.y = tr.ty;
      projectiles.length = 0;
      items.length = 0;
      particles.length = 0;
      dmgNums.length = 0;
      spawnMapEnemies();
      fadeDir = -1;
    }

    /* ─── 入力 ─── */
    const onKeyDown = (e: KeyboardEvent) => {
      keys.add(e.key.toLowerCase());
      if (gameStateRef.current !== "playing") return;

      if (e.key.toLowerCase() === "p" || e.key === "Escape") {
        if (!dialogActive && !ringMenuOpen) {
          pauseRef.current = !pauseRef.current;
          setIsPaused(pauseRef.current);
        }
      }

      // ダイアログ送り
      if (dialogActive && (e.key === "Enter" || e.key === " " || e.key.toLowerCase() === "z")) {
        if (dialogCooldown <= 0) {
          dialogLineIdx++;
          if (dialogLineIdx >= dialogLines.length) {
            dialogActive = false;
          }
          dialogCooldown = 0.2;
        }
        return;
      }

      // リングメニュー
      if (e.key === "Tab") {
        e.preventDefault();
        ringMenuOpen = !ringMenuOpen;
        return;
      }
      if (ringMenuOpen) {
        if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a") ringMenuIdx = (ringMenuIdx + 4) % 5;
        if (e.key === "ArrowRight" || e.key.toLowerCase() === "d") ringMenuIdx = (ringMenuIdx + 1) % 5;
        if (e.key === "Enter" || e.key.toLowerCase() === "z") {
          if (ringMenuIdx < 3) {
            player.selectedMagic = ringMenuIdx;
          } else if (ringMenuIdx === 3 && player.potions > 0) {
            player.potions--;
            const heal = 50;
            player.hp = Math.min(player.maxHp, player.hp + heal);
            addDmgNum(player.x + player.w / 2, player.y - 15, `+${heal}`, "#ff6699");
          } else if (ringMenuIdx === 4 && player.mpPotions > 0) {
            player.mpPotions--;
            const heal = 30;
            player.mp = Math.min(player.maxMp, player.mp + heal);
            addDmgNum(player.x + player.w / 2, player.y - 15, `+${heal}MP`, "#6699ff");
          }
          ringMenuOpen = false;
        }
        return;
      }

      // 魔法発動
      if (e.key.toLowerCase() === "x" && !player.attacking) {
        castMagic();
      }
      // ポーション
      if (e.key.toLowerCase() === "c" && player.potions > 0) {
        player.potions--;
        const heal = 50;
        player.hp = Math.min(player.maxHp, player.hp + heal);
        addDmgNum(player.x + player.w / 2, player.y - 15, `+${heal}`, "#ff6699");
        spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 8, "#ff6699");
      }
      // MPポーション
      if (e.key.toLowerCase() === "v" && player.mpPotions > 0) {
        player.mpPotions--;
        const heal = 30;
        player.mp = Math.min(player.maxMp, player.mp + heal);
        addDmgNum(player.x + player.w / 2, player.y - 15, `+${heal}MP`, "#6699ff");
      }
      // NPC会話
      if ((e.key === "Enter" || e.key.toLowerCase() === "e") && !dialogActive) {
        const npc = checkNPC();
        if (npc) {
          dialogActive = true;
          dialogLines = npc.dialog;
          dialogName = npc.name;
          dialogLineIdx = 0;
          dialogCooldown = 0.3;
          if (npc.kind === "healer") {
            player.hp = player.maxHp;
            player.mp = player.maxMp;
          }
        }
      }
      // 魔法切り替え (数字キー)
      if (e.key === "1") player.selectedMagic = 0;
      if (e.key === "2") player.selectedMagic = 1;
      if (e.key === "3") player.selectedMagic = 2;
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
      // チャージ攻撃のリリース
      if ((e.key.toLowerCase() === "z" || e.key === " ") && player.isCharging && !player.attacking) {
        player.isCharging = false;
        player.chargeLevel = calcChargeLevel(player.chargeTime);
        player.attacking = true;
        player.attackTimer = player.chargeLevel >= 2 ? 0.35 : 0.25;
        player.attackCooldown = 0.15;
        player.chargeTime = 0;
        // 攻撃パーティクル
        const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
        const col = player.chargeLevel >= 2 ? "#ffe066" : player.chargeLevel >= 1 ? "#88ccff" : "#ffffff";
        spawnParticles(cx, cy, player.chargeLevel >= 2 ? 12 : 4, col, 100);
        if (player.chargeLevel >= 2) screenShake = 0.2;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    /* ═══════════════════════════════════════
       メインループ
       ═══════════════════════════════════════ */
    function loop(now: number) {
      const rawDt = (now - prev) / 1000;
      prev = now;
      const dt = Math.min(rawDt, 0.05);

      if (gameStateRef.current === "title") {
        drawTitle(ctx, now);
        raf = requestAnimationFrame(loop);
        return;
      }
      if (gameStateRef.current === "gameover" || gameStateRef.current === "victory") {
        drawEndScreen(ctx, gameStateRef.current === "victory");
        raf = requestAnimationFrame(loop);
        return;
      }

      /* フェード処理 */
      if (fadeDir !== 0) {
        fadeAlpha = clamp(fadeAlpha + fadeDir * dt * 3, 0, 1);
        if (fadeDir === 1 && fadeAlpha >= 1 && pendingTransition) {
          doTransition(pendingTransition);
          pendingTransition = null;
        }
        if (fadeDir === -1 && fadeAlpha <= 0) {
          fadeAlpha = 0;
          fadeDir = 0;
        }
      }

      const paused = pauseRef.current || dialogActive || ringMenuOpen || fadeDir !== 0;

      if (!paused) {
        waterAnimTimer += dt;
        if (levelUpTimer > 0) levelUpTimer -= dt;
        if (dialogCooldown > 0) dialogCooldown -= dt;
        if (screenShake > 0) screenShake -= dt;

        /* ── プレイヤー移動 ── */
        let mx = 0, my = 0;
        if (keys.has("arrowleft") || keys.has("a")) mx -= 1;
        if (keys.has("arrowright") || keys.has("d")) mx += 1;
        if (keys.has("arrowup") || keys.has("w")) my -= 1;
        if (keys.has("arrowdown") || keys.has("s")) my += 1;

        // 方向更新
        if (mx !== 0 || my !== 0) {
          if (Math.abs(mx) >= Math.abs(my)) player.dir = mx < 0 ? 2 : 3;
          else player.dir = my < 0 ? 1 : 0;
          player.walkTimer += dt;
          if (player.walkTimer > 0.15) { player.walkFrame = (player.walkFrame + 1) % 4; player.walkTimer = 0; }
        }

        if (!player.attacking) {
          const spd = player.speed * dt;
          const len = Math.sqrt(mx * mx + my * my) || 1;
          const nx = player.x + (mx / len) * spd;
          const ny = player.y + (my / len) * spd;
          if (isWalkable(currentMap, nx, player.y, player.w, player.h)) player.x = nx;
          if (isWalkable(currentMap, player.x, ny, player.w, player.h)) player.y = ny;
        }

        // ノックバック
        if (player.knockVx !== 0 || player.knockVy !== 0) {
          const nx = player.x + player.knockVx * dt;
          const ny = player.y + player.knockVy * dt;
          if (isWalkable(currentMap, nx, player.y, player.w, player.h)) player.x = nx;
          if (isWalkable(currentMap, player.x, ny, player.w, player.h)) player.y = ny;
          player.knockVx *= 0.85;
          player.knockVy *= 0.85;
          if (Math.abs(player.knockVx) < 5) player.knockVx = 0;
          if (Math.abs(player.knockVy) < 5) player.knockVy = 0;
        }

        // マップ範囲内に制限
        player.x = clamp(player.x, 0, currentMap.cols * T - player.w);
        player.y = clamp(player.y, 0, currentMap.rows * T - player.h);

        // チャージ
        if ((keys.has("z") || keys.has(" ")) && !player.attacking && player.attackCooldown <= 0) {
          if (!player.isCharging) player.isCharging = true;
          player.chargeTime += dt;
        }

        // 攻撃タイマー
        if (player.attacking) {
          player.attackTimer -= dt;
          if (player.attackTimer <= 0) {
            player.attacking = false;
            player.chargeLevel = 0;
          }
        }
        if (player.attackCooldown > 0) player.attackCooldown -= dt;
        if (player.invincible > 0) player.invincible -= dt;

        /* ── プレイヤー攻撃ヒット判定 ── */
        if (player.attacking && player.attackTimer > 0.1) {
          const atkBox = getAttackBox(player);
          const mult = player.chargeLevel >= 2 ? 3.0 : player.chargeLevel >= 1 ? 1.8 : 1.0;
          for (const e of enemies) {
            if (e.dead || e.invincible > 0) continue;
            if (rectsOverlap(atkBox.x, atkBox.y, atkBox.w, atkBox.h, e.x, e.y, e.w, e.h)) {
              const dmg = calcDmg(Math.floor(player.atk * mult), e.def);
              e.hp -= dmg;
              e.invincible = 0.3;
              const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
              const px = player.x + player.w / 2, py = player.y + player.h / 2;
              const ang = Math.atan2(ey - py, ex - px);
              e.knockVx = Math.cos(ang) * (player.chargeLevel >= 2 ? 350 : 180);
              e.knockVy = Math.sin(ang) * (player.chargeLevel >= 2 ? 350 : 180);
              addDmgNum(ex, ey - 10, String(dmg), player.chargeLevel >= 1 ? "#ffee44" : "#ffffff");
              spawnParticles(ex, ey, 5, "#ffffff");
              if (player.chargeLevel >= 2) screenShake = 0.15;
            }
          }
        }

        /* ── 敵AI & 更新 ── */
        for (const e of enemies) {
          if (e.dead) continue;
          e.animTimer += dt;
          if (e.invincible > 0) e.invincible -= dt;

          // 死亡チェック
          if (e.hp <= 0) {
            e.dead = true;
            const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
            spawnParticles(ex, ey, 15, e.kind === "darkKnight" ? "#aa44ff" : "#ffaa33", 160);
            player.exp += ENEMY_DEFS[e.kind].exp;
            checkLevelUp();
            dropItems(e.x, e.y);
            if (e.kind === "darkKnight") {
              bossDead = true;
              screenShake = 0.5;
              spawnParticles(ex, ey, 40, "#ff44ff", 250);
              spawnParticles(ex, ey, 40, "#ffee66", 250);
              // 勝利
              setTimeout(() => {
                gameStateRef.current = "victory";
                setGameState("victory");
              }, 2000);
            }
            continue;
          }

          // ノックバック
          if (e.knockVx !== 0 || e.knockVy !== 0) {
            const nx = e.x + e.knockVx * dt;
            const ny = e.y + e.knockVy * dt;
            if (isWalkable(currentMap, nx, e.y, e.w, e.h)) e.x = nx;
            if (isWalkable(currentMap, e.x, ny, e.w, e.h)) e.y = ny;
            e.knockVx *= 0.82;
            e.knockVy *= 0.82;
            if (Math.abs(e.knockVx) < 5) e.knockVx = 0;
            if (Math.abs(e.knockVy) < 5) e.knockVy = 0;
          }

          const px = player.x + player.w / 2, py = player.y + player.h / 2;
          const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
          const d = Math.sqrt(dist2(px, py, ex, ey));

          e.aiTimer -= dt;
          if (e.aiTimer <= 0) {
            e.aiTimer = 1.0 + Math.random() * 1.5;
            if (d < 250) e.aiState = "chase";
            else e.aiState = "wander";
          }

          // 移動
          let evx = 0, evy = 0;
          if (e.aiState === "chase") {
            const ang = Math.atan2(py - ey, px - ex);
            evx = Math.cos(ang) * e.speed;
            evy = Math.sin(ang) * e.speed;
          } else {
            evx = (Math.random() - 0.5) * e.speed * 0.5;
            evy = (Math.random() - 0.5) * e.speed * 0.5;
          }

          // バットは蛇行
          if (e.kind === "bat") {
            evx += Math.sin(e.animTimer * 5) * 60;
            evy += Math.cos(e.animTimer * 4) * 40;
          }

          // ボス特殊AI
          if (e.kind === "darkKnight") {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
              e.shootTimer = 1.5 + Math.random();
              // 4方向弾
              for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 / 8) * i + e.animTimer;
                projectiles.push({
                  x: ex, y: ey, vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
                  radius: 5, damage: e.atk, isEnemy: true, life: 3, color: "#cc44ff", kind: "dark",
                });
              }
            }
            if (d < 80) { evx *= 0.3; evy *= 0.3; }
          }

          // スケルトンは弾を撃つ
          if (e.kind === "skeleton") {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0 && d < 220) {
              e.shootTimer = 2.0 + Math.random();
              const ang = Math.atan2(py - ey, px - ex);
              projectiles.push({
                x: ex, y: ey, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200,
                radius: 4, damage: e.atk, isEnemy: true, life: 2, color: "#ccccaa", kind: "bone",
              });
            }
            // 距離を保つ
            if (d < 100) {
              const ang = Math.atan2(ey - py, ex - px);
              evx = Math.cos(ang) * e.speed;
              evy = Math.sin(ang) * e.speed;
            }
          }

          if (e.knockVx === 0 && e.knockVy === 0) {
            const nx = e.x + evx * dt;
            const ny = e.y + evy * dt;
            if (isWalkable(currentMap, nx, e.y, e.w, e.h)) e.x = nx;
            if (isWalkable(currentMap, e.x, ny, e.w, e.h)) e.y = ny;
          }

          // 向き
          if (Math.abs(evx) > Math.abs(evy)) e.dir = evx < 0 ? 2 : 3;
          else e.dir = evy < 0 ? 1 : 0;

          // プレイヤーとの接触ダメージ
          if (player.invincible <= 0 && rectsOverlap(player.x, player.y, player.w, player.h, e.x, e.y, e.w, e.h)) {
            const dmg = calcDmg(e.atk, player.def);
            player.hp -= dmg;
            player.invincible = 1.0;
            const ang = Math.atan2(py - ey, px - ex);
            player.knockVx = Math.cos(ang) * 250;
            player.knockVy = Math.sin(ang) * 250;
            addDmgNum(px, py - 15, String(dmg), "#ff4444");
            spawnParticles(px, py, 6, "#ff4444");
            screenShake = 0.15;
          }
        }

        /* ── 弾の更新 ── */
        for (let i = projectiles.length - 1; i >= 0; i--) {
          const p = projectiles[i];
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt;
          if (p.life <= 0) { projectiles.splice(i, 1); continue; }

          if (p.isEnemy) {
            // プレイヤーに当たる
            if (player.invincible <= 0 && dist2(p.x, p.y, player.x + player.w / 2, player.y + player.h / 2) < (p.radius + 14) ** 2) {
              const dmg = calcDmg(p.damage, player.def);
              player.hp -= dmg;
              player.invincible = 1.0;
              const ang = Math.atan2(player.y + player.h / 2 - p.y, player.x + player.w / 2 - p.x);
              player.knockVx = Math.cos(ang) * 200;
              player.knockVy = Math.sin(ang) * 200;
              addDmgNum(player.x + player.w / 2, player.y - 10, String(dmg), "#ff4444");
              spawnParticles(p.x, p.y, 4, "#ff4444");
              screenShake = 0.1;
              projectiles.splice(i, 1);
            }
          } else {
            // 敵に当たる
            for (const e of enemies) {
              if (e.dead || e.invincible > 0) continue;
              if (dist2(p.x, p.y, e.x + e.w / 2, e.y + e.h / 2) < (p.radius + Math.max(e.w, e.h) / 2) ** 2) {
                const dmg = calcDmg(p.damage, e.def);
                e.hp -= dmg;
                e.invincible = 0.3;
                const ang = Math.atan2(e.y + e.h / 2 - p.y, e.x + e.w / 2 - p.x);
                e.knockVx = Math.cos(ang) * 150;
                e.knockVy = Math.sin(ang) * 150;
                addDmgNum(e.x + e.w / 2, e.y - 10, String(dmg), p.color);
                spawnParticles(e.x + e.w / 2, e.y + e.h / 2, 6, p.color);
                projectiles.splice(i, 1);
                break;
              }
            }
          }
        }

        /* ── アイテム回収 ── */
        for (let i = items.length - 1; i >= 0; i--) {
          const it = items[i];
          it.life -= dt;
          if (it.life <= 0) { items.splice(i, 1); continue; }
          const px = player.x + player.w / 2, py = player.y + player.h / 2;
          if (dist2(px, py, it.x + 8, it.y + 8) < 30 * 30) {
            if (it.kind === "hp") {
              const h = 30;
              player.hp = Math.min(player.maxHp, player.hp + h);
              addDmgNum(it.x, it.y - 5, `+${h}`, "#ff6699");
            } else if (it.kind === "mp") {
              const h = 15;
              player.mp = Math.min(player.maxMp, player.mp + h);
              addDmgNum(it.x, it.y - 5, `+${h}MP`, "#6699ff");
            } else {
              const xp = 10 + player.level * 3;
              player.exp += xp;
              addDmgNum(it.x, it.y - 5, `+${xp}EXP`, "#eedd44");
              checkLevelUp();
            }
            items.splice(i, 1);
          }
        }

        /* ── パーティクル ── */
        for (let i = particles.length - 1; i >= 0; i--) {
          const p = particles[i];
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.life -= dt;
          p.vx *= 0.95; p.vy *= 0.95;
          if (p.life <= 0) particles.splice(i, 1);
        }

        /* ── ダメージ数字 ── */
        for (let i = dmgNums.length - 1; i >= 0; i--) {
          const d = dmgNums[i];
          d.y += d.vy * dt;
          d.life -= dt;
          if (d.life <= 0) dmgNums.splice(i, 1);
        }

        /* ── マップ遷移チェック ── */
        checkTransition();

        /* ── ゲームオーバーチェック ── */
        if (player.hp <= 0) {
          player.hp = 0;
          gameStateRef.current = "gameover";
          setGameState("gameover");
        }
      } else {
        if (dialogCooldown > 0) dialogCooldown -= dt;
      }

      /* ═══ カメラ ═══ */
      const targetCamX = player.x + player.w / 2 - W / 2;
      const targetCamY = player.y + player.h / 2 - H / 2;
      camX = lerp(camX, targetCamX, 0.1);
      camY = lerp(camY, targetCamY, 0.1);
      camX = clamp(camX, 0, currentMap.cols * T - W);
      camY = clamp(camY, 0, currentMap.rows * T - H);

      /* ═══ 描画 ═══ */
      const shakeX = screenShake > 0 ? rng(-4, 4) : 0;
      const shakeY = screenShake > 0 ? rng(-4, 4) : 0;

      ctx.save();
      ctx.fillStyle = currentMap.bgColor;
      ctx.fillRect(0, 0, W, H);
      ctx.translate(-Math.floor(camX) + shakeX, -Math.floor(camY) + shakeY);

      /* タイル描画 */
      const startCol = Math.max(0, Math.floor(camX / T));
      const endCol = Math.min(currentMap.cols, Math.ceil((camX + W) / T) + 1);
      const startRow = Math.max(0, Math.floor(camY / T));
      const endRow = Math.min(currentMap.rows, Math.ceil((camY + H) / T) + 1);

      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const tile = currentMap.tiles[r]?.[c] ?? WALL;
          const tx = c * T, ty = r * T;
          drawTile(ctx, tile, tx, ty);
        }
      }

      /* トランジションゾーン描画 */
      for (const tr of currentMap.transitions) {
        ctx.fillStyle = `rgba(255, 255, 100, ${0.15 + Math.sin(waterAnimTimer * 3) * 0.1})`;
        ctx.fillRect(tr.x, tr.y, tr.w, tr.h);
      }

      /* NPC描画 */
      for (const npc of currentMap.npcs) {
        drawNPC(ctx, npc);
      }

      /* アイテム描画 */
      for (const it of items) {
        const alpha = it.life < 3 ? 0.5 + Math.sin(it.life * 10) * 0.5 : 1;
        ctx.globalAlpha = alpha;
        if (it.kind === "hp") { ctx.fillStyle = "#ff4466"; drawDiamond(ctx, it.x + 8, it.y + 8, 7); }
        else if (it.kind === "mp") { ctx.fillStyle = "#4466ff"; drawDiamond(ctx, it.x + 8, it.y + 8, 7); }
        else { ctx.fillStyle = "#ffdd44"; drawStar5(ctx, it.x + 8, it.y + 8, 6); }
        ctx.globalAlpha = 1;
      }

      /* 敵描画 */
      for (const e of enemies) {
        if (e.dead) continue;
        drawEnemy(ctx, e);
      }

      /* プレイヤー描画 */
      drawPlayer(ctx, player);

      /* 弾描画 */
      for (const p of projectiles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        // グロー
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color.replace(")", ",0.3)").replace("rgb", "rgba");
        ctx.globalAlpha = 0.4;
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      /* パーティクル */
      for (const p of particles) {
        const a = p.life / p.maxLife;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      /* ダメージ数字 */
      for (const d of dmgNums) {
        const a = Math.min(1, d.life * 2);
        ctx.globalAlpha = a;
        ctx.font = "bold 16px monospace";
        ctx.fillStyle = d.color;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.strokeText(d.text, d.x - ctx.measureText(d.text).width / 2, d.y);
        ctx.fillText(d.text, d.x - ctx.measureText(d.text).width / 2, d.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      /* ═══ HUD ═══ */
      drawHUD(ctx, player, currentMap.name);

      /* ボスHPバー */
      const boss = enemies.find(e => e.kind === "darkKnight" && !e.dead);
      if (boss) {
        drawBossHP(ctx, boss);
      }

      /* レベルアップ表示 */
      if (levelUpTimer > 0) {
        const a = Math.min(1, levelUpTimer);
        ctx.globalAlpha = a;
        ctx.font = "bold 28px sans-serif";
        ctx.fillStyle = "#ffe066";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 4;
        const txt = `⚔ LEVEL UP! Lv.${player.level} ⚔`;
        const tw = ctx.measureText(txt).width;
        ctx.strokeText(txt, W / 2 - tw / 2, H / 2 - 50);
        ctx.fillText(txt, W / 2 - tw / 2, H / 2 - 50);
        ctx.globalAlpha = 1;
      }

      /* ダイアログ */
      if (dialogActive) {
        drawDialog(ctx, dialogName, dialogLines[Math.min(dialogLineIdx, dialogLines.length - 1)]);
      }

      /* リングメニュー */
      if (ringMenuOpen) {
        drawRingMenu(ctx, player, ringMenuIdx);
      }

      /* ポーズ */
      if (pauseRef.current && !dialogActive && !ringMenuOpen) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, W, H);
        ctx.font = "bold 36px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText("PAUSE", W / 2, H / 2);
        ctx.textAlign = "start";
      }

      /* フェード */
      if (fadeAlpha > 0) {
        ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
        ctx.fillRect(0, 0, W, H);
      }

      raf = requestAnimationFrame(loop);
    }

    /* ─── タイル描画 ─── */
    function drawTile(ctx: CanvasRenderingContext2D, tile: number, tx: number, ty: number) {
      switch (tile) {
        case GRASS:
          ctx.fillStyle = "#2d5a1e";
          ctx.fillRect(tx, ty, T, T);
          // 草の模様
          ctx.fillStyle = "#3a6b28";
          ctx.fillRect(tx + 4, ty + 6, 3, 3);
          ctx.fillRect(tx + 18, ty + 20, 3, 3);
          ctx.fillRect(tx + 24, ty + 8, 2, 2);
          break;
        case WALL:
          ctx.fillStyle = "#555566";
          ctx.fillRect(tx, ty, T, T);
          ctx.fillStyle = "#666677";
          ctx.fillRect(tx + 1, ty + 1, T - 2, T - 2);
          ctx.fillStyle = "#555566";
          ctx.fillRect(tx + T / 2, ty, 1, T);
          ctx.fillRect(tx, ty + T / 2, T, 1);
          break;
        case WATER: {
          ctx.fillStyle = "#1a4488";
          ctx.fillRect(tx, ty, T, T);
          const wo = Math.sin(waterAnimTimer * 2 + tx * 0.1) * 0.15;
          ctx.fillStyle = `rgba(100, 180, 255, ${0.3 + wo})`;
          ctx.fillRect(tx + 2, ty + 8 + Math.sin(waterAnimTimer * 3 + tx * 0.2) * 3, T - 4, 4);
          ctx.fillRect(tx + 6, ty + 20 + Math.sin(waterAnimTimer * 2.5 + tx * 0.3) * 3, T - 8, 3);
          break;
        }
        case TREE:
          ctx.fillStyle = "#2d5a1e";
          ctx.fillRect(tx, ty, T, T);
          ctx.fillStyle = "#5a3a1e";
          ctx.fillRect(tx + 12, ty + 18, 8, 14);
          ctx.fillStyle = "#1e7a1e";
          ctx.beginPath();
          ctx.arc(tx + 16, ty + 14, 12, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#2a8a2a";
          ctx.beginPath();
          ctx.arc(tx + 14, ty + 12, 8, 0, Math.PI * 2);
          ctx.fill();
          break;
        case PATH:
          ctx.fillStyle = "#8a7a55";
          ctx.fillRect(tx, ty, T, T);
          ctx.fillStyle = "#9a8a65";
          ctx.fillRect(tx + 3, ty + 3, 4, 4);
          ctx.fillRect(tx + 20, ty + 15, 5, 5);
          break;
        case FLOOR:
          ctx.fillStyle = "#3a3a44";
          ctx.fillRect(tx, ty, T, T);
          ctx.fillStyle = "#444450";
          ctx.fillRect(tx + 1, ty + 1, T - 2, T - 2);
          break;
        case BRIDGE:
          ctx.fillStyle = "#1a4488";
          ctx.fillRect(tx, ty, T, T);
          ctx.fillStyle = "#8a6a3a";
          ctx.fillRect(tx + 2, ty, T - 4, T);
          ctx.fillStyle = "#7a5a2a";
          ctx.fillRect(tx + 2, ty + T / 2 - 1, T - 4, 2);
          break;
      }
    }

    /* ─── プレイヤー描画 ─── */
    function drawPlayer(ctx: CanvasRenderingContext2D, p: Player) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      // 無敵点滅
      if (p.invincible > 0 && Math.floor(p.invincible * 10) % 2 === 0) {
        ctx.globalAlpha = 0.4;
      }

      // チャージエフェクト
      if (p.isCharging) {
        const cl = calcChargeLevel(p.chargeTime);
        const r = 18 + cl * 10 + Math.sin(p.chargeTime * 8) * 3;
        const colors = ["rgba(255,255,255,0.15)", "rgba(100,180,255,0.25)", "rgba(255,230,80,0.35)"];
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = colors[cl];
        ctx.fill();
      }

      // 体
      const bob = Math.sin(p.walkTimer * 20) * 1.5;
      ctx.fillStyle = "#2277aa"; // 青い服
      ctx.fillRect(p.x + 3, p.y + 10 + bob, p.w - 6, p.h - 12);

      // 頭
      ctx.fillStyle = "#ffcc88";
      ctx.beginPath();
      ctx.arc(cx, p.y + 8 + bob, 9, 0, Math.PI * 2);
      ctx.fill();

      // 髪
      ctx.fillStyle = "#885533";
      ctx.beginPath();
      ctx.arc(cx, p.y + 5 + bob, 9, Math.PI, Math.PI * 2);
      ctx.fill();

      // 目（方向に応じて）
      ctx.fillStyle = "#222";
      if (p.dir === 0) { // 下向き
        ctx.fillRect(cx - 4, p.y + 7 + bob, 2, 2);
        ctx.fillRect(cx + 2, p.y + 7 + bob, 2, 2);
      } else if (p.dir === 1) { // 上向き
        // 後ろ姿なので目は見えない
      } else if (p.dir === 2) { // 左
        ctx.fillRect(cx - 5, p.y + 7 + bob, 2, 2);
      } else { // 右
        ctx.fillRect(cx + 3, p.y + 7 + bob, 2, 2);
      }

      // 足
      ctx.fillStyle = "#664422";
      const legOff = Math.sin(p.walkFrame * Math.PI / 2) * 3;
      ctx.fillRect(p.x + 5, p.y + p.h - 4 + bob, 5, 4);
      ctx.fillRect(p.x + p.w - 10, p.y + p.h - 4 + bob + legOff, 5, 4);

      // 攻撃中の剣エフェクト
      if (p.attacking) {
        drawSwordSwing(ctx, p);
      }

      ctx.globalAlpha = 1;
    }

    /* ─── 剣スイングエフェクト ─── */
    function drawSwordSwing(ctx: CanvasRenderingContext2D, p: Player) {
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      const progress = 1 - p.attackTimer / (p.chargeLevel >= 2 ? 0.35 : 0.25);

      if (p.chargeLevel >= 2) {
        // 回転斬り
        const angle = progress * Math.PI * 2;
        const r = 40;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillStyle = "#eeddaa";
        ctx.fillRect(0, -3, r, 6);
        ctx.fillStyle = "#ffee88";
        ctx.fillRect(r - 6, -5, 8, 10);
        // 軌跡
        ctx.strokeStyle = "rgba(255, 230, 100, 0.5)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r, angle - 1.5, angle);
        ctx.stroke();
        ctx.restore();
      } else {
        // 通常斬り
        const swingAngle = (progress - 0.5) * Math.PI * 0.8;
        const swordLen = p.chargeLevel >= 1 ? 30 : 24;
        const baseAngle = p.dir === 0 ? Math.PI / 2 : p.dir === 1 ? -Math.PI / 2 : p.dir === 2 ? Math.PI : 0;
        const angle = baseAngle + swingAngle;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(angle);
        ctx.fillStyle = "#ccbbaa";
        ctx.fillRect(4, -2, swordLen, 4);
        ctx.fillStyle = p.chargeLevel >= 1 ? "#aaddff" : "#eeddaa";
        ctx.fillRect(swordLen - 2, -3, 6, 6);
        ctx.restore();

        // 斬撃エフェクト
        if (progress > 0.2 && progress < 0.8) {
          ctx.strokeStyle = p.chargeLevel >= 1 ? "rgba(130,200,255,0.6)" : "rgba(255,255,255,0.4)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, swordLen + 4, baseAngle - 0.6, baseAngle + 0.6);
          ctx.stroke();
        }
      }
    }

    /* ─── 敵描画 ─── */
    function drawEnemy(ctx: CanvasRenderingContext2D, e: Enemy) {
      const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
      if (e.invincible > 0 && Math.floor(e.invincible * 15) % 2 === 0) {
        ctx.globalAlpha = 0.5;
      }

      switch (e.kind) {
        case "slime": {
          const squish = 1 + Math.sin(e.animTimer * 4) * 0.1;
          ctx.fillStyle = "#44cc44";
          ctx.beginPath();
          ctx.ellipse(cx, cy + 2, e.w / 2 * squish, e.h / 2 / squish, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#66ee66";
          ctx.beginPath();
          ctx.ellipse(cx - 3, cy - 3, 4, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          // 目
          ctx.fillStyle = "#222";
          ctx.fillRect(cx - 5, cy - 3, 3, 3);
          ctx.fillRect(cx + 2, cy - 3, 3, 3);
          break;
        }
        case "goblin": {
          // 体
          ctx.fillStyle = "#884422";
          ctx.fillRect(e.x + 4, e.y + 10, e.w - 8, e.h - 12);
          // 頭
          ctx.fillStyle = "#559933";
          ctx.beginPath();
          ctx.arc(cx, e.y + 8, 10, 0, Math.PI * 2);
          ctx.fill();
          // 目
          ctx.fillStyle = "#ff3333";
          ctx.fillRect(cx - 5, e.y + 6, 3, 3);
          ctx.fillRect(cx + 2, e.y + 6, 3, 3);
          // 耳
          ctx.fillStyle = "#559933";
          ctx.beginPath();
          ctx.moveTo(cx - 10, e.y + 4);
          ctx.lineTo(cx - 14, e.y - 4);
          ctx.lineTo(cx - 6, e.y + 4);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(cx + 10, e.y + 4);
          ctx.lineTo(cx + 14, e.y - 4);
          ctx.lineTo(cx + 6, e.y + 4);
          ctx.fill();
          break;
        }
        case "bat": {
          const wingAngle = Math.sin(e.animTimer * 10) * 0.5;
          ctx.fillStyle = "#6633aa";
          // 体
          ctx.beginPath();
          ctx.ellipse(cx, cy, 6, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          // 翼
          ctx.save();
          ctx.translate(cx, cy);
          // 左翼
          ctx.save();
          ctx.rotate(-0.3 + wingAngle);
          ctx.fillStyle = "#7744bb";
          ctx.beginPath();
          ctx.moveTo(-4, 0);
          ctx.lineTo(-16, -8);
          ctx.lineTo(-14, 4);
          ctx.fill();
          ctx.restore();
          // 右翼
          ctx.save();
          ctx.rotate(0.3 - wingAngle);
          ctx.fillStyle = "#7744bb";
          ctx.beginPath();
          ctx.moveTo(4, 0);
          ctx.lineTo(16, -8);
          ctx.lineTo(14, 4);
          ctx.fill();
          ctx.restore();
          ctx.restore();
          // 目
          ctx.fillStyle = "#ff4444";
          ctx.fillRect(cx - 4, cy - 3, 2, 2);
          ctx.fillRect(cx + 2, cy - 3, 2, 2);
          break;
        }
        case "skeleton": {
          // 体（白い骨）
          ctx.fillStyle = "#ddd8cc";
          ctx.fillRect(cx - 4, e.y + 8, 8, 18);
          // 頭
          ctx.fillStyle = "#eeeadd";
          ctx.beginPath();
          ctx.arc(cx, e.y + 7, 9, 0, Math.PI * 2);
          ctx.fill();
          // 目
          ctx.fillStyle = "#111";
          ctx.fillRect(cx - 5, e.y + 5, 3, 4);
          ctx.fillRect(cx + 2, e.y + 5, 3, 4);
          // 腕
          ctx.fillStyle = "#ddd8cc";
          ctx.fillRect(e.x + 1, e.y + 12, 4, 2);
          ctx.fillRect(e.x + e.w - 5, e.y + 12, 4, 2);
          ctx.fillRect(e.x + 1, e.y + 12, 2, 10);
          ctx.fillRect(e.x + e.w - 3, e.y + 12, 2, 10);
          break;
        }
        case "darkKnight": {
          // 影
          ctx.fillStyle = "rgba(0,0,0,0.3)";
          ctx.beginPath();
          ctx.ellipse(cx, e.y + e.h - 4, 22, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          // 体（黒い鎧）
          ctx.fillStyle = "#222233";
          ctx.fillRect(e.x + 4, e.y + 16, e.w - 8, e.h - 20);
          // 肩パッド
          ctx.fillStyle = "#3a2255";
          ctx.fillRect(e.x - 2, e.y + 16, 12, 8);
          ctx.fillRect(e.x + e.w - 10, e.y + 16, 12, 8);
          // 頭（兜）
          ctx.fillStyle = "#333344";
          ctx.beginPath();
          ctx.arc(cx, e.y + 12, 14, 0, Math.PI * 2);
          ctx.fill();
          // 角
          ctx.fillStyle = "#5a3a7a";
          ctx.beginPath();
          ctx.moveTo(cx - 10, e.y + 4);
          ctx.lineTo(cx - 14, e.y - 10);
          ctx.lineTo(cx - 6, e.y + 4);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(cx + 10, e.y + 4);
          ctx.lineTo(cx + 14, e.y - 10);
          ctx.lineTo(cx + 6, e.y + 4);
          ctx.fill();
          // 目（赤い光）
          ctx.fillStyle = "#ff2244";
          ctx.shadowColor = "#ff2244";
          ctx.shadowBlur = 8;
          ctx.fillRect(cx - 6, e.y + 10, 4, 3);
          ctx.fillRect(cx + 2, e.y + 10, 4, 3);
          ctx.shadowBlur = 0;
          // マント
          ctx.fillStyle = "#2a1644";
          const capeWave = Math.sin(e.animTimer * 3) * 3;
          ctx.beginPath();
          ctx.moveTo(e.x + 6, e.y + 20);
          ctx.lineTo(e.x + 2 + capeWave, e.y + e.h + 4);
          ctx.lineTo(e.x + e.w - 2 - capeWave, e.y + e.h + 4);
          ctx.lineTo(e.x + e.w - 6, e.y + 20);
          ctx.fill();
          // 大剣
          const swordBob = Math.sin(e.animTimer * 2) * 2;
          ctx.fillStyle = "#667788";
          ctx.fillRect(e.x + e.w + 2, e.y + 8 + swordBob, 5, 30);
          ctx.fillStyle = "#8899aa";
          ctx.fillRect(e.x + e.w, e.y + 6 + swordBob, 9, 5);
          break;
        }
      }

      // HPバー（ボス以外）
      if (e.kind !== "darkKnight" && e.hp < e.maxHp) {
        const bw = e.w + 4;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(e.x - 2, e.y - 8, bw, 4);
        ctx.fillStyle = "#44cc44";
        ctx.fillRect(e.x - 2, e.y - 8, bw * (e.hp / e.maxHp), 4);
      }

      ctx.globalAlpha = 1;
    }

    /* ─── NPC描画 ─── */
    function drawNPC(ctx: CanvasRenderingContext2D, npc: NPC) {
      const cx = npc.x + 16, cy = npc.y + 16;
      const bob = Math.sin(waterAnimTimer * 2 + npc.x) * 1;

      if (npc.kind === "elder") {
        ctx.fillStyle = "#774433";
        ctx.fillRect(npc.x + 4, npc.y + 12 + bob, 24, 16);
        ctx.fillStyle = "#ffcc88";
        ctx.beginPath();
        ctx.arc(cx, npc.y + 8 + bob, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#cccccc";
        ctx.beginPath();
        ctx.arc(cx, npc.y + 4 + bob, 10, Math.PI, Math.PI * 2);
        ctx.fill();
        // ひげ
        ctx.fillStyle = "#cccccc";
        ctx.fillRect(cx - 4, npc.y + 14 + bob, 8, 6);
      } else if (npc.kind === "healer") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(npc.x + 4, npc.y + 12 + bob, 24, 16);
        ctx.fillStyle = "#ffcc88";
        ctx.beginPath();
        ctx.arc(cx, npc.y + 8 + bob, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffdd44";
        ctx.beginPath();
        ctx.arc(cx, npc.y + 4 + bob, 10, Math.PI, Math.PI * 2);
        ctx.fill();
        // 十字
        ctx.fillStyle = "#44cc44";
        ctx.fillRect(cx - 2, npc.y + 16 + bob, 4, 8);
        ctx.fillRect(cx - 4, npc.y + 18 + bob, 8, 4);
      } else {
        ctx.fillStyle = "#cc6699";
        ctx.fillRect(npc.x + 4, npc.y + 12 + bob, 24, 16);
        ctx.fillStyle = "#ffcc88";
        ctx.beginPath();
        ctx.arc(cx, npc.y + 8 + bob, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#774422";
        ctx.beginPath();
        ctx.arc(cx, npc.y + 4 + bob, 10, Math.PI * 0.8, Math.PI * 2.2);
        ctx.fill();
      }

      // 「!」マーク（近くにいる時）
      const px = player.x + player.w / 2, py = player.y + player.h / 2;
      if (dist2(px, py, cx, cy) < 60 * 60) {
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "#ffee44";
        ctx.fillText("!", cx - 3, npc.y - 6 + Math.sin(waterAnimTimer * 4) * 2);
      }
    }

    /* ─── ダイヤモンド形 ─── */
    function drawDiamond(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
    }

    /* ─── 星形 ─── */
    function drawStar5(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        const method = i === 0 ? "moveTo" : "lineTo";
        ctx[method](x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }

    /* ─── HUD ─── */
    function drawHUD(ctx: CanvasRenderingContext2D, p: Player, areaName: string) {
      // 背景パネル
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(8, 8, 220, 80);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(8, 8, 220, 80);

      // HP
      ctx.font = "bold 12px monospace";
      ctx.fillStyle = "#ff6666";
      ctx.fillText("HP", 16, 28);
      ctx.fillStyle = "#333";
      ctx.fillRect(40, 18, 140, 12);
      ctx.fillStyle = p.hp / p.maxHp > 0.3 ? "#44cc44" : "#cc4444";
      ctx.fillRect(40, 18, 140 * (p.hp / p.maxHp), 12);
      ctx.fillStyle = "#fff";
      ctx.fillText(`${p.hp}/${p.maxHp}`, 185, 28);

      // MP
      ctx.fillStyle = "#6688ff";
      ctx.fillText("MP", 16, 46);
      ctx.fillStyle = "#333";
      ctx.fillRect(40, 36, 140, 12);
      ctx.fillStyle = "#4488ff";
      ctx.fillRect(40, 36, 140 * (p.mp / p.maxMp), 12);
      ctx.fillStyle = "#fff";
      ctx.fillText(`${p.mp}/${p.maxMp}`, 185, 46);

      // EXP
      ctx.fillStyle = "#eedd44";
      ctx.fillText("EXP", 16, 62);
      ctx.fillStyle = "#333";
      ctx.fillRect(44, 52, 136, 8);
      ctx.fillStyle = "#eedd44";
      ctx.fillRect(44, 52, 136 * (p.exp / p.nextExp), 8);

      // レベル
      ctx.fillStyle = "#fff";
      ctx.fillText(`Lv.${p.level}`, 16, 80);

      // ATK/DEF
      ctx.fillStyle = "#ffaa44";
      ctx.fillText(`ATK:${p.atk}`, 70, 80);
      ctx.fillStyle = "#44aaff";
      ctx.fillText(`DEF:${p.def}`, 140, 80);

      // エリア名
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      const nameW = ctx.measureText(areaName).width + 20;
      ctx.fillRect(W - nameW - 8, 8, nameW, 24);
      ctx.fillStyle = "#ddeeff";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText(areaName, W - nameW + 2, 25);

      // アイテム・魔法ショートカット
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(8, H - 48, 320, 40);
      ctx.strokeStyle = "rgba(255,255,255,0.2)";
      ctx.strokeRect(8, H - 48, 320, 40);

      ctx.font = "11px monospace";
      // 魔法
      for (let i = 0; i < 3; i++) {
        const mx = 16 + i * 80;
        const selected = i === p.selectedMagic;
        ctx.fillStyle = selected ? "rgba(255,255,255,0.2)" : "transparent";
        ctx.fillRect(mx - 4, H - 44, 72, 32);
        if (selected) {
          ctx.strokeStyle = MAGICS[i].color;
          ctx.strokeRect(mx - 4, H - 44, 72, 32);
        }
        ctx.fillStyle = MAGICS[i].color;
        ctx.fillText(`[${i + 1}]${MAGICS[i].name}`, mx, H - 28);
        ctx.fillStyle = "#aaa";
        ctx.fillText(`MP:${MAGICS[i].cost}`, mx, H - 16);
      }

      // ポーション数
      ctx.fillStyle = "#ff6699";
      ctx.fillText(`[C]薬:${p.potions}`, 256, H - 28);
      ctx.fillStyle = "#6699ff";
      ctx.fillText(`[V]魔薬:${p.mpPotions}`, 256, H - 16);
    }

    /* ─── ボスHPバー ─── */
    function drawBossHP(ctx: CanvasRenderingContext2D, boss: Enemy) {
      const bw = 400, bh = 16;
      const bx = W / 2 - bw / 2, by = H - 100;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(bx - 4, by - 20, bw + 8, bh + 28);
      ctx.font = "bold 12px sans-serif";
      ctx.fillStyle = "#ff4466";
      ctx.fillText("闇の騎士", bx, by - 6);
      ctx.fillStyle = "#333";
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle = "#cc2244";
      ctx.fillRect(bx, by, bw * (boss.hp / boss.maxHp), bh);
      ctx.strokeStyle = "#888";
      ctx.strokeRect(bx, by, bw, bh);
    }

    /* ─── ダイアログ ─── */
    function drawDialog(ctx: CanvasRenderingContext2D, name: string, text: string) {
      const dh = 80, dy = H - dh - 60;
      ctx.fillStyle = "rgba(0,0,20,0.85)";
      ctx.fillRect(40, dy, W - 80, dh);
      ctx.strokeStyle = "#aabbcc";
      ctx.lineWidth = 2;
      ctx.strokeRect(40, dy, W - 80, dh);
      ctx.lineWidth = 1;
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = "#ffdd88";
      ctx.fillText(name, 60, dy + 22);
      ctx.font = "14px sans-serif";
      ctx.fillStyle = "#ddeeff";
      ctx.fillText(text, 60, dy + 48);
      ctx.fillStyle = "#88aacc";
      ctx.font = "11px sans-serif";
      ctx.fillText("▼ Z/Enter で次へ", W - 200, dy + dh - 10);
    }

    /* ─── リングメニュー ─── */
    function drawRingMenu(ctx: CanvasRenderingContext2D, p: Player, idx: number) {
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(0, 0, W, H);

      const cx = W / 2, cy = H / 2;
      const r = 100;
      const labels = ["🔥 ファイア", "❄️ アイス", "💚 ヒール", `❤️ 薬×${p.potions}`, `💙 魔薬×${p.mpPotions}`];
      const colors = ["#ff6633", "#66ccff", "#66ff99", "#ff6699", "#6699ff"];

      // 外枠
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r + 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;

      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        const ix = cx + Math.cos(a) * r;
        const iy = cy + Math.sin(a) * r;
        const selected = i === idx;

        ctx.beginPath();
        ctx.arc(ix, iy, selected ? 32 : 26, 0, Math.PI * 2);
        ctx.fillStyle = selected ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.5)";
        ctx.fill();
        ctx.strokeStyle = selected ? colors[i] : "rgba(255,255,255,0.3)";
        ctx.lineWidth = selected ? 3 : 1;
        ctx.stroke();
        ctx.lineWidth = 1;

        ctx.font = selected ? "bold 13px sans-serif" : "12px sans-serif";
        ctx.fillStyle = selected ? "#fff" : "#aaa";
        const tw = ctx.measureText(labels[i]).width;
        ctx.fillText(labels[i], ix - tw / 2, iy + 4);
      }

      // 中央テキスト
      ctx.font = "bold 14px sans-serif";
      ctx.fillStyle = colors[idx];
      const selText = labels[idx];
      const stw = ctx.measureText(selText).width;
      ctx.fillText(selText, cx - stw / 2, cy + 4);

      ctx.fillStyle = "#aabbcc";
      ctx.font = "11px sans-serif";
      ctx.fillText("← → で選択 / Z で決定 / Tab で閉じる", cx - 140, cy + r + 50);
    }

    /* ─── タイトル画面 ─── */
    function drawTitle(ctx: CanvasRenderingContext2D, now: number) {
      ctx.fillStyle = "#0a0a18";
      ctx.fillRect(0, 0, W, H);

      // 背景パーティクル
      for (let i = 0; i < 60; i++) {
        const t = now / 1000 + i * 1.7;
        const x = (Math.sin(t * 0.3 + i) * 0.5 + 0.5) * W;
        const y = (Math.cos(t * 0.2 + i * 0.7) * 0.5 + 0.5) * H;
        ctx.fillStyle = `rgba(100, 150, 255, ${0.1 + Math.sin(t) * 0.05})`;
        ctx.beginPath();
        ctx.arc(x, y, 2 + Math.sin(t * 2) * 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // タイトル
      ctx.font = "bold 52px serif";
      ctx.fillStyle = "#eeddcc";
      ctx.shadowColor = "#6644aa";
      ctx.shadowBlur = 20;
      const title = "Blade of Mana";
      const tw = ctx.measureText(title).width;
      ctx.fillText(title, W / 2 - tw / 2, H / 2 - 40);
      ctx.shadowBlur = 0;

      ctx.font = "18px sans-serif";
      ctx.fillStyle = "#8899bb";
      const sub = "〜 聖剣の伝説 〜";
      const sw = ctx.measureText(sub).width;
      ctx.fillText(sub, W / 2 - sw / 2, H / 2);

      // 点滅テキスト
      const blink = Math.sin(now / 400) > 0;
      if (blink) {
        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#aabbdd";
        const prompt = "何かキーを押してスタート";
        const pw = ctx.measureText(prompt).width;
        ctx.fillText(prompt, W / 2 - pw / 2, H / 2 + 80);
      }

      // 操作説明
      ctx.font = "12px monospace";
      ctx.fillStyle = "#556677";
      const controls = [
        "矢印キー/WASD: 移動  |  Z/Space: 攻撃 (長押しでチャージ)  |  X: 魔法",
        "C: HP回復  |  V: MP回復  |  Tab: リングメニュー  |  E/Enter: 会話",
      ];
      controls.forEach((c, i) => {
        const cw = ctx.measureText(c).width;
        ctx.fillText(c, W / 2 - cw / 2, H - 60 + i * 18);
      });
    }

    /* ─── エンド画面 ─── */
    function drawEndScreen(ctx: CanvasRenderingContext2D, victory: boolean) {
      ctx.fillStyle = victory ? "#0a1a0a" : "#1a0a0a";
      ctx.fillRect(0, 0, W, H);

      ctx.font = "bold 44px serif";
      ctx.fillStyle = victory ? "#66ff88" : "#ff4444";
      ctx.shadowColor = victory ? "#44cc66" : "#cc0000";
      ctx.shadowBlur = 15;
      const text = victory ? "VICTORY!" : "GAME OVER";
      const tw = ctx.measureText(text).width;
      ctx.fillText(text, W / 2 - tw / 2, H / 2 - 30);
      ctx.shadowBlur = 0;

      if (victory) {
        ctx.font = "18px sans-serif";
        ctx.fillStyle = "#aaddbb";
        const msg = "闇の騎士を倒し、世界に平和が戻った！";
        const mw = ctx.measureText(msg).width;
        ctx.fillText(msg, W / 2 - mw / 2, H / 2 + 10);
      }

      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#aabbcc";
      const prompt = "R キーでリトライ";
      const pw = ctx.measureText(prompt).width;
      ctx.fillText(prompt, W / 2 - pw / 2, H / 2 + 60);
    }

    /* タイトル画面キー検知 */
    const onTitleKey = (e: KeyboardEvent) => {
      if (gameStateRef.current === "title") {
        gameStateRef.current = "playing";
        setGameState("playing");
      }
      if ((gameStateRef.current === "gameover" || gameStateRef.current === "victory") && e.key.toLowerCase() === "r") {
        // リスタート
        gameStateRef.current = "title";
        setGameState("title");
        // 状態リセット
        currentMapId = "village";
        currentMap = maps[currentMapId];
        Object.assign(player, {
          x: 12 * T, y: 9 * T, hp: 100, maxHp: 100, mp: 30, maxMp: 30,
          atk: 10, def: 5, level: 1, exp: 0, nextExp: 50,
          dir: 0, speed: WALK_SPEED,
          attacking: false, attackTimer: 0, attackCooldown: 0,
          chargeTime: 0, isCharging: false, chargeLevel: 0,
          invincible: 1.5, knockVx: 0, knockVy: 0,
          potions: 3, mpPotions: 2, selectedMagic: 0,
        });
        projectiles.length = 0;
        items.length = 0;
        particles.length = 0;
        dmgNums.length = 0;
        enemies.length = 0;
        bossDead = false;
        fadeAlpha = 1;
        fadeDir = -1;
        spawnMapEnemies();
      }
    };
    window.addEventListener("keydown", onTitleKey);

    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("keydown", onTitleKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartRef.current]);

  return (
    <main className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 p-4">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-slate-400 hover:text-white text-sm px-3 py-1 border border-slate-700 rounded hover:border-cyan-400 transition"
        >
          ← 戻る
        </Link>
        <h1 className="text-xl font-bold text-slate-100 tracking-wide">
          ⚔️ Blade of Mana 〜聖剣の伝説〜
        </h1>
        <button
          onClick={togglePause}
          className="text-xs px-3 py-1 border border-slate-700 rounded text-slate-400 hover:text-white hover:border-cyan-400 transition"
        >
          {isPaused ? "▶ 再開" : "⏸ 一時停止"}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="border border-slate-700 rounded-lg shadow-2xl bg-black"
        tabIndex={0}
        onFocus={(e) => e.target.style.outline = "none"}
      />

      <div className="flex gap-6 text-xs text-slate-500">
        <span>矢印/WASD: 移動</span>
        <span>Z/Space: 攻撃 (長押しチャージ)</span>
        <span>X: 魔法</span>
        <span>C/V: 回復</span>
        <span>Tab: リングメニュー</span>
        <span>E/Enter: 会話</span>
        <span>P/Esc: ポーズ</span>
      </div>
    </main>
  );
}
