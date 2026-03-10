"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

/* ================================================================
   定数
   ================================================================ */
const TILE = 40;
const COLS = 20;
const ROWS = 14;
const W = COLS * TILE;
const H = ROWS * TILE;

/* DQ 配色 */
const DQ_BG    = "#0a0a1a";
const DQ_WIN   = "#100820";
const DQ_BRD   = "#c8c8ff";
const DQ_BRD2  = "#6060b0";
const DQ_TXT   = "#ffffff";
const DQ_GOLD  = "#f8d830";

/* タイル種別 */
const T = { GRASS: 0, WALL: 1, WATER: 2, TOWN: 3, DUNGEON: 4, CASTLE: 5, FOREST: 6, SAND: 7, BRIDGE: 8 } as const;
type TileType = (typeof T)[keyof typeof T];

// prettier-ignore
// 0=草原  1=山/壁  2=海/水  3=町  4=洞窟  5=城  6=森  7=砂地  8=橋
const MAP: TileType[][] = [
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
  [2,2,2,6,6,0,0,0,0,7,7,7,2,2,2,2,2,2,2,2],
  [2,2,6,6,0,0,5,0,0,0,7,7,7,2,2,0,0,6,2,2],
  [2,6,6,0,0,0,0,0,6,0,0,7,7,2,0,0,0,6,6,2],
  [2,6,0,0,1,1,0,6,6,6,0,0,2,2,0,0,0,0,6,2],
  [2,0,0,3,0,1,0,0,6,0,0,0,2,0,0,1,1,0,0,2],
  [2,0,0,0,0,0,0,0,0,0,0,8,2,0,0,1,4,0,0,2],
  [2,0,0,0,0,6,0,0,4,0,0,8,0,0,0,0,0,0,0,2],
  [2,0,6,6,0,6,6,0,0,0,0,8,0,0,6,6,0,3,0,2],
  [2,0,0,6,0,0,0,0,0,0,2,2,0,0,6,0,0,0,0,2],
  [2,0,0,0,0,0,0,3,0,2,2,2,2,0,0,0,0,0,0,2],
  [2,7,7,0,0,0,0,0,2,2,2,2,2,2,0,0,0,6,0,2],
  [2,7,7,7,0,4,0,2,2,2,2,2,2,2,2,0,6,6,0,2],
  [2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2],
];

/* ================================================================
   モンスター
   ================================================================ */
interface MonsterDef {
  name: string; emoji: string; hp: number; atk: number;
  def: number; exp: number; gold: number; spells?: string[];
}
const MONSTERS: MonsterDef[] = [
  { name: "スライム",       emoji: "🟦", hp: 12,  atk: 5,  def: 1,  exp: 5,   gold: 4  },
  { name: "ドラキー",       emoji: "🦇", hp: 16,  atk: 8,  def: 2,  exp: 8,   gold: 6  },
  { name: "おおさそり",     emoji: "🦂", hp: 24,  atk: 14, def: 4,  exp: 14,  gold: 10 },
  { name: "メタルスライム", emoji: "⚪", hp: 4,   atk: 10, def: 16, exp: 80,  gold: 30 },
  { name: "キメラ",         emoji: "🦅", hp: 36,  atk: 18, def: 6,  exp: 25,  gold: 20, spells: ["ベギラマ"] },
  { name: "ゾンビ",         emoji: "🧟", hp: 50,  atk: 22, def: 8,  exp: 35,  gold: 25 },
  { name: "ドラゴン",       emoji: "🐉", hp: 80,  atk: 30, def: 12, exp: 60,  gold: 50, spells: ["かえんのいき"] },
  { name: "魔王バラモス",   emoji: "👿", hp: 200, atk: 45, def: 20, exp: 500, gold: 200, spells: ["ベギラゴン","マヒャド"] },
];

/* ================================================================
   レベルアップ
   ================================================================ */
const LV_TABLE = [0, 10, 30, 60, 110, 180, 280, 420, 600, 830, 1100];
function expForNext(lv: number) { return LV_TABLE[Math.min(lv, LV_TABLE.length - 1)] ?? Infinity; }

/* ================================================================
   プレイヤー
   ================================================================ */
interface Player {
  x: number; y: number;
  hp: number; maxHp: number; mp: number; maxMp: number;
  atk: number; def: number; lv: number; exp: number; gold: number; name: string;
}
function initPlayer(): Player {
  return { x:5, y:2, hp:30, maxHp:30, mp:10, maxMp:10, atk:12, def:5, lv:1, exp:0, gold:10, name:"ゆうしゃ" };
}
function lvUp(p: Player): Player {
  const hp  = p.maxHp + 10 + Math.floor(Math.random() * 5);
  const mp  = p.maxMp + 3  + Math.floor(Math.random() * 3);
  const atk = p.atk   + 3  + Math.floor(Math.random() * 3);
  const def = p.def   + 2  + Math.floor(Math.random() * 2);
  return { ...p, lv: p.lv + 1, maxHp: hp, hp, maxMp: mp, mp, atk, def };
}

/* ================================================================
   バトル
   ================================================================ */
interface BattleState {
  monster: MonsterDef & { curHp: number };
  log: string[];
  phase: "select" | "player_attack" | "monster_attack" | "result";
  result?: "win" | "lose" | "escape";
  cursor: number;
}
function createBattle(monDef: MonsterDef): BattleState {
  return {
    monster: { ...monDef, curHp: monDef.hp },
    log: [`${monDef.name}が あらわれた！`],
    phase: "select", cursor: 0,
  };
}

type Scene = "field" | "battle" | "gameover" | "ending";

/* ================================================================
   タイル — ピクセルアート風描画
   ================================================================ */

/** 疑似乱数（座標ベース、描画ごとに同じ結果） */
function hash(x: number, y: number, seed = 0) {
  let h = seed + x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177; h = h ^ (h >> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

/** 各タイルのカスタム描画 */
function drawTile(ctx: CanvasRenderingContext2D, col: number, row: number, t: TileType) {
  const bx = col * TILE, by = row * TILE;
  const S = TILE;
  const p4 = S / 4;  // 10px unit

  switch (t) {
    /* ── 草原 ─────────────────────────── */
    case T.GRASS: {
      ctx.fillStyle = "#38a830"; ctx.fillRect(bx, by, S, S);
      // ランダムな濃淡 & 草タフト
      for (let i = 0; i < 6; i++) {
        const gx = Math.floor(hash(col, row, i * 3) * (S - 6));
        const gy = Math.floor(hash(col, row, i * 3 + 1) * (S - 6));
        ctx.fillStyle = hash(col, row, i * 7) > 0.5 ? "#48b840" : "#2d9020";
        ctx.fillRect(bx + gx, by + gy, 4, 4);
      }
      // 小さな草の模様
      if (hash(col, row, 99) > 0.6) {
        ctx.fillStyle = "#50d048";
        ctx.fillRect(bx + p4, by + p4 * 2, 2, 6);
        ctx.fillRect(bx + p4 - 2, by + p4 * 2, 2, 2);
        ctx.fillRect(bx + p4 + 2, by + p4 * 2, 2, 2);
      }
      break;
    }
    /* ── 海 ───────────────────────────── */
    case T.WATER: {
      ctx.fillStyle = "#1050b0"; ctx.fillRect(bx, by, S, S);
      // 波の帯
      const waveY1 = Math.floor(hash(col, row, 0) * 8) + 8;
      const waveY2 = Math.floor(hash(col, row, 1) * 8) + 24;
      ctx.fillStyle = "#2068c8";
      ctx.fillRect(bx, by + waveY1, S, 4);
      ctx.fillStyle = "#1860c0";
      ctx.fillRect(bx, by + waveY2, S, 3);
      // ハイライト
      ctx.fillStyle = "#3888e8";
      ctx.fillRect(bx + 4 + Math.floor(hash(col, row, 5) * 10), by + waveY1, 8, 2);
      ctx.fillRect(bx + 16 + Math.floor(hash(col, row, 6) * 8), by + waveY2, 6, 2);
      break;
    }
    /* ── 山/壁 ────────────────────────── */
    case T.WALL: {
      ctx.fillStyle = "#7a6a4e"; ctx.fillRect(bx, by, S, S);
      // 三角の山
      ctx.fillStyle = "#9a8a68";
      ctx.beginPath();
      ctx.moveTo(bx + S / 2, by + 4);
      ctx.lineTo(bx + S - 4, by + S - 4);
      ctx.lineTo(bx + 4, by + S - 4);
      ctx.closePath(); ctx.fill();
      // 雪冠
      ctx.fillStyle = "#e8e0d0";
      ctx.beginPath();
      ctx.moveTo(bx + S / 2, by + 4);
      ctx.lineTo(bx + S / 2 + 7, by + 14);
      ctx.lineTo(bx + S / 2 - 7, by + 14);
      ctx.closePath(); ctx.fill();
      // 影
      ctx.fillStyle = "#685838";
      ctx.beginPath();
      ctx.moveTo(bx + S / 2, by + 4);
      ctx.lineTo(bx + 4, by + S - 4);
      ctx.lineTo(bx + S / 2, by + S - 4);
      ctx.closePath(); ctx.fill();
      break;
    }
    /* ── 森 ───────────────────────────── */
    case T.FOREST: {
      ctx.fillStyle = "#1a4c18"; ctx.fillRect(bx, by, S, S);
      // 木の幹
      ctx.fillStyle = "#6a4a20";
      ctx.fillRect(bx + S / 2 - 2, by + S / 2 + 2, 5, S / 2 - 4);
      // 木の葉（3 段）
      const leafColors = ["#207018", "#28882a", "#1c6016"];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = leafColors[i];
        const w = 20 - i * 5, h2 = 8;
        const lx = bx + S / 2 - w / 2, ly = by + 4 + i * 7;
        ctx.beginPath();
        ctx.ellipse(lx + w / 2, ly + h2 / 2, w / 2, h2 / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // ドット飾り
      if (hash(col, row, 20) > 0.5) {
        ctx.fillStyle = "#40b038";
        ctx.fillRect(bx + 6, by + 10, 3, 3);
        ctx.fillRect(bx + S - 10, by + 14, 3, 3);
      }
      break;
    }
    /* ── 砂地 ─────────────────────────── */
    case T.SAND: {
      ctx.fillStyle = "#d8b860"; ctx.fillRect(bx, by, S, S);
      // 砂つぶ
      for (let i = 0; i < 8; i++) {
        const sx = Math.floor(hash(col, row, i * 2) * (S - 2));
        const sy = Math.floor(hash(col, row, i * 2 + 1) * (S - 2));
        ctx.fillStyle = hash(col, row, i + 30) > 0.5 ? "#e8cc78" : "#c0a048";
        ctx.fillRect(bx + sx, by + sy, 3, 3);
      }
      // 風紋
      if (hash(col, row, 50) > 0.4) {
        ctx.fillStyle = "#c8a840";
        ctx.fillRect(bx + 4, by + S / 2, S - 8, 2);
      }
      break;
    }
    /* ── 橋 ───────────────────────────── */
    case T.BRIDGE: {
      // 水の下地
      ctx.fillStyle = "#1050b0"; ctx.fillRect(bx, by, S, S);
      // 板
      ctx.fillStyle = "#8a6030";
      ctx.fillRect(bx + 2, by + 6, S - 4, S - 12);
      // 板の隙間
      ctx.fillStyle = "#6a4820";
      for (let i = 0; i < 3; i++) {
        ctx.fillRect(bx + 4 + i * 12, by + 6, 2, S - 12);
      }
      // 手すり
      ctx.fillStyle = "#a07040";
      ctx.fillRect(bx, by + 4, S, 3);
      ctx.fillRect(bx, by + S - 7, S, 3);
      break;
    }
    /* ── 町 ───────────────────────────── */
    case T.TOWN: {
      ctx.fillStyle = "#38a830"; ctx.fillRect(bx, by, S, S); // 草ベース
      // 家の壁
      ctx.fillStyle = "#e8d0a0";
      ctx.fillRect(bx + 8, by + 14, 24, 18);
      // 屋根
      ctx.fillStyle = "#c04020";
      ctx.beginPath();
      ctx.moveTo(bx + 4, by + 14);
      ctx.lineTo(bx + 20, by + 4);
      ctx.lineTo(bx + 36, by + 14);
      ctx.closePath(); ctx.fill();
      // ドア
      ctx.fillStyle = "#6a4020";
      ctx.fillRect(bx + 17, by + 22, 7, 10);
      // 窓
      ctx.fillStyle = "#88c8f8";
      ctx.fillRect(bx + 10, by + 17, 5, 5);
      ctx.fillRect(bx + 26, by + 17, 5, 5);
      break;
    }
    /* ── 洞窟 ─────────────────────────── */
    case T.DUNGEON: {
      ctx.fillStyle = "#38a830"; ctx.fillRect(bx, by, S, S); // 草ベース
      // 岩
      ctx.fillStyle = "#606060";
      ctx.beginPath();
      ctx.arc(bx + S / 2, by + S / 2 + 2, 16, Math.PI, 0);
      ctx.lineTo(bx + S / 2 + 16, by + S - 4);
      ctx.lineTo(bx + S / 2 - 16, by + S - 4);
      ctx.closePath(); ctx.fill();
      // 入口（黒い穴）
      ctx.fillStyle = "#181018";
      ctx.beginPath();
      ctx.arc(bx + S / 2, by + S / 2 + 6, 8, Math.PI, 0);
      ctx.lineTo(bx + S / 2 + 8, by + S - 4);
      ctx.lineTo(bx + S / 2 - 8, by + S - 4);
      ctx.closePath(); ctx.fill();
      // ハイライト
      ctx.fillStyle = "#808080";
      ctx.fillRect(bx + 10, by + 12, 4, 3);
      break;
    }
    /* ── 城 ───────────────────────────── */
    case T.CASTLE: {
      ctx.fillStyle = "#38a830"; ctx.fillRect(bx, by, S, S); // 草ベース
      // 城壁
      ctx.fillStyle = "#d0c8b8";
      ctx.fillRect(bx + 6, by + 12, 28, 22);
      // 塔 (左)
      ctx.fillRect(bx + 4, by + 6, 8, 28);
      // 塔 (右)
      ctx.fillRect(bx + 28, by + 6, 8, 28);
      // 塔のとんがり屋根
      ctx.fillStyle = "#2060c0";
      ctx.beginPath(); ctx.moveTo(bx + 8, by + 2); ctx.lineTo(bx + 13, by + 6); ctx.lineTo(bx + 3, by + 6); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(bx + 32, by + 2); ctx.lineTo(bx + 37, by + 6); ctx.lineTo(bx + 27, by + 6); ctx.closePath(); ctx.fill();
      // 中央の旗
      ctx.fillStyle = "#e03030";
      ctx.fillRect(bx + 18, by + 2, 6, 4);
      ctx.fillStyle = "#a07040";
      ctx.fillRect(bx + 19, by + 2, 1, 10);
      // 門
      ctx.fillStyle = "#4a3020";
      ctx.fillRect(bx + 15, by + 24, 10, 10);
      ctx.fillStyle = "#302010";
      ctx.beginPath(); ctx.arc(bx + 20, by + 24, 5, Math.PI, 0); ctx.fill();
      // 窓
      ctx.fillStyle = "#f8e850";
      ctx.fillRect(bx + 8, by + 14, 3, 4);
      ctx.fillRect(bx + 30, by + 14, 3, 4);
      break;
    }
  }
}

/** プレイヤーをピクセルアート風に描く */
function drawPlayer(ctx: CanvasRenderingContext2D, col: number, row: number) {
  const bx = col * TILE, by = row * TILE;
  const S = TILE;
  // 体
  ctx.fillStyle = "#2060e0"; // 青い服
  ctx.fillRect(bx + 13, by + 18, 14, 12);
  // 頭
  ctx.fillStyle = "#f8d0a0";
  ctx.fillRect(bx + 14, by + 8, 12, 10);
  // 髪
  ctx.fillStyle = "#c07020";
  ctx.fillRect(bx + 13, by + 6, 14, 5);
  ctx.fillRect(bx + 12, by + 8, 2, 6);
  // 目
  ctx.fillStyle = "#202020";
  ctx.fillRect(bx + 16, by + 13, 2, 2);
  ctx.fillRect(bx + 22, by + 13, 2, 2);
  // 足
  ctx.fillStyle = "#c06020";
  ctx.fillRect(bx + 14, by + 30, 5, 4);
  ctx.fillRect(bx + 21, by + 30, 5, 4);
  // 剣（右側）
  ctx.fillStyle = "#c0c0c0";
  ctx.fillRect(bx + S - 8, by + 10, 3, 16);
  ctx.fillStyle = "#f8d830";
  ctx.fillRect(bx + S - 10, by + 24, 7, 3);
  // 盾（左側）
  ctx.fillStyle = "#2040a0";
  ctx.fillRect(bx + 4, by + 16, 8, 10);
  ctx.fillStyle = "#f8d830";
  ctx.fillRect(bx + 6, by + 19, 4, 4);
}

/* ================================================================
   DQ風ウィンドウ共通スタイル
   ================================================================ */
const dqWin: React.CSSProperties = {
  background: DQ_WIN,
  border: `3px solid ${DQ_BRD}`,
  boxShadow: `inset 0 0 0 2px ${DQ_BRD2}, 0 0 20px rgba(80,80,200,0.25)`,
  borderRadius: 10,
  color: DQ_TXT,
  fontFamily: "'DotGothic16', 'MS Gothic', monospace",
};

/* ================================================================
   メインコンポーネント
   ================================================================ */
export default function DragonQuestPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scene, setScene]     = useState<Scene>("field");
  const [player, setPlayer]   = useState<Player>(initPlayer);
  const [battle, setBattle]   = useState<BattleState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const stateRef = useRef({ player: initPlayer(), scene: "field" as Scene, battle: null as BattleState | null });

  /* ── フィールド描画 ─────────────────────────────────── */
  const drawField = useCallback((p: Player) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    // タイル描画
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        drawTile(ctx, c, r, MAP[r][c] as TileType);
      }
    }

    // プレイヤー
    drawPlayer(ctx, p.x, p.y);
  }, []);

  useEffect(() => { if (scene === "field") drawField(player); }, [scene, player, drawField]);

  /* ── キー入力 ───────────────────────────────────────── */
  const doBattleActionRef = useRef<((a: "attack"|"magic"|"heal"|"escape") => void) | null>(null);

  const handleKey = useCallback((e: KeyboardEvent) => {
    const { player: pl, scene: sc, battle: bt } = stateRef.current;

    /* バトル中キー */
    if (sc === "battle" && bt && bt.phase === "select") {
      const cmds: ("attack"|"magic"|"heal"|"escape")[] = ["attack","magic","heal","escape"];
      if (e.key === "ArrowUp" || e.key === "w")    { e.preventDefault(); setBattle(b => b ? { ...b, cursor: (b.cursor + 2) % 4 } : b); return; }
      if (e.key === "ArrowDown" || e.key === "s")  { e.preventDefault(); setBattle(b => b ? { ...b, cursor: (b.cursor + 2) % 4 } : b); return; }
      if (e.key === "ArrowLeft" || e.key === "a")  { e.preventDefault(); setBattle(b => b ? { ...b, cursor: b.cursor % 2 === 0 ? b.cursor + 1 : b.cursor - 1 } : b); return; }
      if (e.key === "ArrowRight" || e.key === "d") { e.preventDefault(); setBattle(b => b ? { ...b, cursor: b.cursor % 2 === 0 ? b.cursor + 1 : b.cursor - 1 } : b); return; }
      if (e.key === "Enter" || e.key === " ")      { e.preventDefault(); doBattleActionRef.current?.(cmds[bt.cursor]); return; }
      return;
    }

    /* フィールド移動 */
    if (sc !== "field") return;
    const dirs: Record<string,[number,number]> = {
      ArrowUp:[0,-1],w:[0,-1], ArrowDown:[0,1],s:[0,1],
      ArrowLeft:[-1,0],a:[-1,0], ArrowRight:[1,0],d:[1,0],
    };
    const dir = dirs[e.key]; if (!dir) return;
    e.preventDefault();
    const nx = pl.x + dir[0], ny = pl.y + dir[1];
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return;
    const tile = MAP[ny][nx] as TileType;
    if (tile === T.WALL || tile === T.WATER) return;

    if (tile === T.BRIDGE) {
      // 橋は通行のみ
    }

    if (tile === T.TOWN) {
      const p2 = { ...pl, hp: pl.maxHp, mp: pl.maxMp };
      stateRef.current.player = p2; setPlayer(p2);
      setMessage("やどやに とまった。\nHP と MP が かいふくした！");
      setTimeout(() => setMessage(null), 2500); return;
    }
    if (tile === T.CASTLE) {
      setMessage("おうさま「まおうを たおして\nへいわを とりもどしてくれ！」");
      setTimeout(() => setMessage(null), 3000); return;
    }
    if (tile === T.DUNGEON) {
      setMessage("どうくつに はいった！\nきょうてきが まちかまえている…");
      setTimeout(() => setMessage(null), 2500);
    }

    const moved = { ...pl, x: nx, y: ny };
    stateRef.current.player = moved; setPlayer(moved); drawField(moved);

    const encRate = tile === T.DUNGEON ? 0.22 : tile === T.FOREST ? 0.25 : (tile === T.GRASS || tile === T.SAND) ? 0.15 : 0;
    if (encRate > 0 && Math.random() < encRate) {
      const pool = tile === T.DUNGEON ? MONSTERS.slice(4) : tile === T.FOREST ? MONSTERS.slice(2, 7) : MONSTERS.slice(0, 6);
      const monDef = pool[Math.floor(Math.random() * pool.length)];
      const newBt = createBattle(monDef);
      stateRef.current.scene = "battle"; stateRef.current.battle = newBt;
      setScene("battle"); setBattle(newBt);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawField]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  useEffect(() => { stateRef.current.player = player; }, [player]);
  useEffect(() => { stateRef.current.scene = scene; }, [scene]);
  useEffect(() => { stateRef.current.battle = battle; }, [battle]);

  /* ── バトルアクション ───────────────────────────────── */
  const doBattleAction = useCallback((action: "attack"|"magic"|"heal"|"escape") => {
    if (!battle || battle.phase !== "select") return;
    const p = stateRef.current.player;
    const nb: BattleState = { ...battle, monster: { ...battle.monster }, log: [], cursor: battle.cursor };

    if (action === "escape") {
      if (Math.random() < 0.5) {
        nb.log = ["ゆうしゃは にげだした！"]; nb.phase = "result"; nb.result = "escape";
        setBattle(nb);
        setTimeout(() => { stateRef.current.scene = "field"; stateRef.current.battle = null; setScene("field"); setBattle(null); }, 1500);
      } else {
        nb.log = ["しかし まわりこまれてしまった！"]; nb.phase = "monster_attack";
        setBattle(nb); setTimeout(() => monsterTurn(nb), 800);
      }
      return;
    }

    let plog = ""; let newP = { ...p };
    if (action === "attack") {
      const dmg = Math.max(1, p.atk - nb.monster.def + Math.floor(Math.random()*5) - 2);
      nb.monster.curHp = Math.max(0, nb.monster.curHp - dmg);
      plog = `ゆうしゃの こうげき！\n${nb.monster.name}に ${dmg}の ダメージ！`;
    } else if (action === "magic") {
      if (newP.mp < 4) { nb.log = ["MP が たりない！"]; setBattle({ ...nb, phase: "select" }); return; }
      const dmg = Math.max(5, Math.floor(p.atk * 1.8) + Math.floor(Math.random()*8));
      nb.monster.curHp = Math.max(0, nb.monster.curHp - dmg);
      newP.mp -= 4;
      plog = `ゆうしゃは メラゾーマを となえた！\n${nb.monster.name}に ${dmg}の ダメージ！`;
    } else if (action === "heal") {
      if (newP.mp < 3) { nb.log = ["MP が たりない！"]; setBattle({ ...nb, phase: "select" }); return; }
      const heal = 15 + Math.floor(Math.random()*10);
      newP.hp = Math.min(newP.maxHp, newP.hp + heal); newP.mp -= 3;
      plog = `ゆうしゃは ホイミを となえた！\nHP が ${heal} かいふくした！`;
    }
    nb.log = [plog];

    if (nb.monster.curHp <= 0) {
      const expVal = nb.monster.exp, goldVal = nb.monster.gold;
      let lvMsg = "";
      let uP = { ...newP, exp: newP.exp + expVal, gold: newP.gold + goldVal };
      while (uP.exp >= expForNext(uP.lv) && uP.lv < LV_TABLE.length) {
        uP = lvUp(uP);
        lvMsg += `\nレベルが あがった！ Lv.${uP.lv} になった！`;
      }
      nb.log = [...nb.log, `${nb.monster.name}を たおした！`, `${expVal}の けいけんち と ${goldVal}ゴールド を かくとく！${lvMsg}`];
      nb.phase = "result"; nb.result = "win";
      stateRef.current.player = uP; setPlayer(uP); setBattle(nb);
      setTimeout(() => { stateRef.current.scene = "field"; stateRef.current.battle = null; setScene("field"); setBattle(null); }, 2800);
      return;
    }
    stateRef.current.player = newP; setPlayer(newP);
    nb.phase = "monster_attack"; setBattle(nb);
    setTimeout(() => monsterTurn(nb, newP), 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [battle]);

  useEffect(() => { doBattleActionRef.current = doBattleAction; }, [doBattleAction]);

  function monsterTurn(b: BattleState, overP?: Player) {
    const p = overP ?? stateRef.current.player;
    const spells = b.monster.spells ?? [];
    let log = ""; let newHp = p.hp;
    if (spells.length > 0 && Math.random() < 0.35) {
      const sp = spells[Math.floor(Math.random()*spells.length)];
      const dmg = Math.max(3, Math.floor(b.monster.atk*1.5) + Math.floor(Math.random()*8));
      newHp = Math.max(0, p.hp - dmg);
      log = `${b.monster.name}は ${sp}を はなった！\nゆうしゃに ${dmg}の ダメージ！`;
    } else {
      const dmg = Math.max(1, b.monster.atk - p.def + Math.floor(Math.random()*4) - 2);
      newHp = Math.max(0, p.hp - dmg);
      log = `${b.monster.name}の こうげき！\nゆうしゃに ${dmg}の ダメージ！`;
    }
    const np = { ...p, hp: newHp }; stateRef.current.player = np; setPlayer(np);
    const nb2: BattleState = { ...b, monster: { ...b.monster }, log: [log], phase: "select" };
    if (newHp <= 0) {
      nb2.log = [log, "ゆうしゃは ちからつきた…"];
      nb2.phase = "result"; nb2.result = "lose"; setBattle(nb2);
      stateRef.current.scene = "gameover"; stateRef.current.battle = null;
      setTimeout(() => setScene("gameover"), 1800); return;
    }
    setBattle(nb2);
  }

  const resetGame = () => {
    const p = initPlayer();
    stateRef.current.player = p; stateRef.current.scene = "field"; stateRef.current.battle = null;
    setPlayer(p); setBattle(null); setScene("field");
  };

  const startBoss = () => {
    const boss = MONSTERS[MONSTERS.length - 1];
    const newBt = createBattle(boss);
    stateRef.current.scene = "battle"; stateRef.current.battle = newBt;
    setScene("battle"); setBattle(newBt);
  };

  useEffect(() => {
    if (battle?.result === "win" && battle.monster.name === "魔王バラモス") {
      stateRef.current.scene = "ending"; stateRef.current.battle = null;
      setTimeout(() => setScene("ending"), 2800);
    }
  }, [battle]);

  /* ── レンダリング ───────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col items-center py-4 px-2"
         style={{ background: DQ_BG, fontFamily: "'DotGothic16','MS Gothic',monospace" }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" />

      {/* ヘッダー */}
      <div className="w-full flex items-center justify-between mb-2" style={{ maxWidth: W + 220 }}>
        <Link href="/" className="text-sm hover:opacity-70 transition" style={{ color: DQ_BRD }}>◀ もどる</Link>
        <h1 className="text-xl tracking-widest" style={{ color: DQ_GOLD, textShadow: "0 0 8px rgba(248,216,48,0.5)" }}>
          ＊ ドラゴンクエスト ＊
        </h1>
        <span className="text-xs" style={{ color: DQ_BRD2 }}>矢印/WASD で いどう</span>
      </div>

      <div className="flex gap-3" style={{ maxWidth: W + 220 }}>
        {/* ゲーム画面 */}
        <div className="relative" style={{ width: W, minHeight: H }}>
          <canvas ref={canvasRef} width={W} height={H}
            style={{ ...dqWin, imageRendering: "pixelated", display: scene === "field" ? "block" : "none" }} />

          {scene === "battle" && battle && (
            <BattleScreen battle={battle} player={player} onAction={doBattleAction} />
          )}
          {scene === "gameover" && <GameOverScreen onRetry={resetGame} />}
          {scene === "ending" && <EndingScreen player={player} onRetry={resetGame} />}

          {message && scene === "field" && (
            <div className="absolute bottom-3 left-3 right-3 p-4 text-sm leading-relaxed whitespace-pre-wrap" style={dqWin}>
              {message}
            </div>
          )}
        </div>

        {/* 右パネル */}
        <DqStatusPanel player={player} onBoss={startBoss} />
      </div>

      <DqLegend />
    </div>
  );
}

/* ================================================================
   バトル画面
   ================================================================ */
function BattleScreen({
  battle, player, onAction,
}: {
  battle: BattleState; player: Player;
  onAction: (a: "attack"|"magic"|"heal"|"escape") => void;
}) {
  const cmds: { id: "attack"|"magic"|"heal"|"escape"; label: string }[] = [
    { id: "attack", label: "たたかう" },
    { id: "magic",  label: "じゅもん" },
    { id: "heal",   label: "ホイミ" },
    { id: "escape", label: "にげる" },
  ];

  return (
    <div className="flex flex-col" style={{ ...dqWin, width: W, height: H, padding: 0, overflow: "hidden" }}>
      {/* 上: モンスター */}
      <div className="flex-1 flex flex-col items-center justify-center relative"
           style={{ background: "linear-gradient(180deg, #000010 0%, #080828 60%, #101840 100%)" }}>
        <div className="absolute bottom-0 left-0 right-0 h-16"
             style={{ background: "linear-gradient(0deg, #182040 0%, transparent 100%)" }} />
        <div className="text-center z-10 mb-4">
          <div className="text-8xl mb-3" style={{ filter: "drop-shadow(0 0 12px rgba(100,100,255,0.3))" }}>
            {battle.monster.emoji}
          </div>
          <p className="text-lg tracking-widest" style={{ color: DQ_TXT }}>{battle.monster.name}</p>
          <div className="mt-2 flex items-center gap-2 justify-center text-xs" style={{ color: DQ_BRD }}>
            <span>HP</span>
            <div className="w-36 h-2 rounded-full overflow-hidden" style={{ background: "#202050" }}>
              <div className="h-full rounded-full transition-all duration-300"
                   style={{ width: `${Math.max(0,(battle.monster.curHp/battle.monster.hp)*100)}%`, background: "#e04040" }} />
            </div>
            <span>{battle.monster.curHp}/{battle.monster.hp}</span>
          </div>
        </div>
      </div>

      {/* 下: コマンド + メッセージ + ステータス */}
      <div className="flex" style={{ height: 180 }}>
        {battle.phase === "select" ? (
          <div className="p-3 shrink-0" style={{ ...dqWin, width: 200, borderRadius: 8, margin: 4, fontSize: 15 }}>
            <div className="grid grid-cols-1 gap-1">
              {cmds.map((c, i) => (
                <button key={c.id}
                  onClick={() => onAction(c.id)}
                  className="text-left px-3 py-1.5 rounded transition-all flex items-center gap-2"
                  style={{
                    color: DQ_TXT,
                    background: i === battle.cursor ? "rgba(200,200,255,0.12)" : "transparent",
                    fontFamily: "inherit",
                  }}>
                  <span style={{ color: DQ_GOLD, visibility: i === battle.cursor ? "visible" : "hidden" }}>▶</span>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="shrink-0" style={{ width: 200, margin: 4 }} />
        )}

        <div className="flex-1 p-3 text-sm leading-relaxed whitespace-pre-wrap"
             style={{ ...dqWin, borderRadius: 8, margin: 4, overflowY: "auto" }}>
          {battle.log.map((l, i) => <p key={i}>{l}</p>)}
        </div>

        <div className="shrink-0 p-3 text-sm" style={{ ...dqWin, width: 180, borderRadius: 8, margin: 4 }}>
          <p className="mb-1" style={{ color: DQ_GOLD }}>ゆうしゃ  Lv.{player.lv}</p>
          <DqBar label="HP" value={player.hp} max={player.maxHp} barColor="#30b048" />
          <DqBar label="MP" value={player.mp} max={player.maxMp} barColor="#3080d0" />
        </div>
      </div>
    </div>
  );
}

function DqBar({ label, value, max, barColor }: { label: string; value: number; max: number; barColor: string }) {
  return (
    <div className="mb-1.5">
      <div className="flex justify-between text-xs" style={{ color: DQ_BRD }}>
        <span>{label}</span><span>{value}/{max}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden mt-0.5" style={{ background: "#202050" }}>
        <div className="h-full rounded-full transition-all duration-300"
             style={{ width: `${Math.max(0,(value/max)*100)}%`, background: barColor }} />
      </div>
    </div>
  );
}

/* ================================================================
   ステータスパネル
   ================================================================ */
function DqStatusPanel({ player, onBoss }: { player: Player; onBoss: () => void }) {
  const next = expForNext(player.lv);
  return (
    <aside className="flex flex-col gap-2" style={{ width: 200, fontFamily: "'DotGothic16','MS Gothic',monospace" }}>
      <div className="p-4 text-sm" style={dqWin}>
        <p className="text-center mb-3 tracking-widest text-base" style={{ color: DQ_GOLD }}>ステータス</p>
        <DqRow label="なまえ" val={player.name} />
        <DqRow label="Lv" val={String(player.lv)} />
        <DqRow label="H P" val={`${player.hp}/${player.maxHp}`} />
        <DqRow label="M P" val={`${player.mp}/${player.maxMp}`} />
        <DqRow label="こうげき" val={String(player.atk)} />
        <DqRow label="しゅび" val={String(player.def)} />
        <DqRow label="E X P" val={`${player.exp}`} />
        <DqRow label="G" val={`${player.gold}`} />
        {next !== Infinity && (
          <div className="mt-2">
            <div className="text-xs mb-1" style={{ color: DQ_BRD2 }}>つぎのLvまで {next - player.exp}</div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "#202050" }}>
              <div className="h-full rounded-full transition-all"
                   style={{ width: `${Math.min(100,(player.exp/next)*100)}%`, background: DQ_GOLD }} />
            </div>
          </div>
        )}
      </div>

      <button onClick={onBoss}
        className="py-3 text-sm tracking-wider transition-all hover:brightness-125"
        style={{ ...dqWin, cursor: "pointer", textAlign: "center", color: "#ff6060", fontFamily: "inherit" }}>
        ▶ まおうに いどむ
      </button>

      <div className="p-3 text-xs leading-relaxed" style={{ ...dqWin, color: DQ_BRD }}>
        <p style={{ color: DQ_GOLD }} className="mb-1">さくせん</p>
        <p>🏘 やどやで かいふく</p>
        <p>⛩ どうくつは きょうてき</p>
        <p>👿 じゅんびしたら ボスへ</p>
        <p className="mt-1" style={{ color: DQ_BRD2 }}>Enter/Space で けってい</p>
      </div>
    </aside>
  );
}

function DqRow({ label, val }: { label: string; val: string }) {
  return (
    <div className="flex justify-between py-0.5" style={{ borderBottom: `1px solid ${DQ_BRD2}30` }}>
      <span style={{ color: DQ_BRD }}>{label}</span>
      <span style={{ color: DQ_TXT }}>{val}</span>
    </div>
  );
}

/* ================================================================
   ゲームオーバー
   ================================================================ */
function GameOverScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center"
         style={{ ...dqWin, width: W, height: H, background: "#0a0008" }}>
      <p className="text-6xl mb-6">✝</p>
      <p className="text-lg tracking-widest mb-4" style={{ color: "#ff4040" }}>
        ゆうしゃは しんでしまった！
      </p>
      <div className="p-4 mb-6 text-center text-sm leading-relaxed" style={{ ...dqWin, maxWidth: 400 }}>
        <p>おうさま「しんでしまうとは なにごとだ！</p>
        <p className="mt-1">　もういちど がんばってくるのじゃ。」</p>
      </div>
      <button onClick={onRetry}
        className="py-3 px-10 text-sm tracking-wider transition-all hover:brightness-125"
        style={{ ...dqWin, cursor: "pointer", color: DQ_GOLD, fontFamily: "inherit" }}>
        ▶ さいしょから
      </button>
    </div>
  );
}

/* ================================================================
   エンディング
   ================================================================ */
function EndingScreen({ player, onRetry }: { player: Player; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center"
         style={{ ...dqWin, width: W, height: H, background: "linear-gradient(180deg, #080818 0%, #181040 100%)" }}>
      <p className="text-6xl mb-4">👑</p>
      <p className="text-xl tracking-widest mb-1"
         style={{ color: DQ_GOLD, textShadow: "0 0 12px rgba(248,216,48,0.5)" }}>
        へいわが おとずれた！
      </p>
      <p className="text-sm mb-6" style={{ color: DQ_BRD }}>
        ゆうしゃは まおうバラモスを たおした！
      </p>
      <div className="p-4 mb-6 text-sm leading-loose text-center" style={dqWin}>
        <p>さいしゅう レベル: <span style={{ color: DQ_GOLD }}>{player.lv}</span></p>
        <p>かくとく けいけんち: <span style={{ color: DQ_GOLD }}>{player.exp}</span></p>
        <p>しょじ ゴールド: <span style={{ color: DQ_GOLD }}>{player.gold} G</span></p>
      </div>
      <p className="text-sm mb-6" style={{ color: DQ_BRD }}>
        「そして でんせつは はじまった…」
      </p>
      <button onClick={onRetry}
        className="py-3 px-10 text-sm tracking-wider transition-all hover:brightness-125"
        style={{ ...dqWin, cursor: "pointer", color: DQ_GOLD, fontFamily: "inherit" }}>
        ▶ もういちど ぼうけんする
      </button>
    </div>
  );
}

/* ================================================================
   凡例
   ================================================================ */
function DqLegend() {
  const items = [
    { color: "#38a830", label: "そうげん" },
    { color: "#1a4c18", em: "🌲", label: "もり" },
    { color: "#d8b860", label: "さばく" },
    { color: "#7a6a4e", em: "⛰", label: "やま" },
    { color: "#1050b0", label: "うみ" },
    { color: "#8a6030", em: "🌉", label: "はし" },
    { color: "#c04020", em: "🏘", label: "やどや" },
    { color: "#606060", em: "⛩", label: "どうくつ" },
    { color: "#d0c8b8", em: "🏰", label: "おしろ" },
  ];
  return (
    <div className="mt-3 flex flex-wrap gap-3 justify-center text-xs" style={{ color: DQ_BRD2 }}>
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-4 rounded"
                style={{ background: it.color, fontSize: 8, lineHeight: "16px", textAlign: "center" }}>
            {it.em ?? ""}
          </span>
          {it.label}
        </div>
      ))}
    </div>
  );
}
