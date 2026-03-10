"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";

/* ═══════════════════════════════════════
   Constants
   ═══════════════════════════════════════ */
const TILE = 36;
const COLS = 20;
const ROWS = 14;
const W = TILE * COLS;
const H = TILE * ROWS;

const VC = {
  BG: "#1a1408",
  WIN: "#2a1c10",
  BRD: "#c8a860",
  TXT: "#f8f0d0",
  GOLD: "#f8d830",
};

/* ═══════════════════════════════════════
   Terrain & Building enums
   ═══════════════════════════════════════ */
const TR = { GRASS: 0, WATER: 1, FOREST: 2, MOUNTAIN: 3 } as const;
type Terrain = (typeof TR)[keyof typeof TR];

const BD = {
  NONE: 0, HOUSE: 1, FARM: 2, LUMBER: 3, QUARRY: 4,
  MARKET: 5, BARRACKS: 6, CHURCH: 7, WELL: 8,
  WALL: 9, SMITHY: 10, CASTLE: 11, INN: 12,
} as const;
type Building = (typeof BD)[keyof typeof BD];

/* ═══════════════════════════════════════
   Types
   ═══════════════════════════════════════ */
type Res = { gold: number; wood: number; stone: number; food: number };
type Village = {
  pop: number; popCap: number; happiness: number;
  defense: number; attack: number;
};
type BldgInfo = {
  name: string; icon: string; cost: Res; desc: string;
  req?: string;
  effect: (v: Village, prod: Res) => void;
  canPlace?: (t: Terrain[][], b: Building[][], r: number, c: number, v: Village) => boolean;
};

/* ═══════════════════════════════════════
   Helpers
   ═══════════════════════════════════════ */
function adjHas(grid: number[][], r: number, c: number, val: number): boolean {
  return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => {
    const nr = r + dr, nc = c + dc;
    return nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && grid[nr][nc] === val;
  });
}
function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263 + 1013904223) | 0;
  h = ((h >> 13) ^ h) * 1274126177;
  return ((h >> 16) ^ h) & 0x7fffffff;
}

/* ═══════════════════════════════════════
   Building Data
   ═══════════════════════════════════════ */
const BLDG: Record<number, BldgInfo> = {
  [BD.HOUSE]: {
    name: "民家", icon: "🏠",
    cost: { gold: 5, wood: 20, stone: 10, food: 0 },
    desc: "人口上限 +2",
    effect: (v) => { v.popCap += 2; },
  },
  [BD.FARM]: {
    name: "農場", icon: "🌾",
    cost: { gold: 0, wood: 15, stone: 5, food: 0 },
    desc: "食料 +4/ターン",
    effect: (_, p) => { p.food += 4; },
  },
  [BD.LUMBER]: {
    name: "製材所", icon: "🪓",
    cost: { gold: 5, wood: 5, stone: 15, food: 0 },
    desc: "木材 +3/ターン",
    req: "森に隣接",
    effect: (_, p) => { p.wood += 3; },
    canPlace: (t, _b, r, c) => adjHas(t, r, c, TR.FOREST),
  },
  [BD.QUARRY]: {
    name: "採石場", icon: "⛏️",
    cost: { gold: 5, wood: 10, stone: 0, food: 0 },
    desc: "石材 +3/ターン",
    req: "山に隣接",
    effect: (_, p) => { p.stone += 3; },
    canPlace: (t, _b, r, c) => adjHas(t, r, c, TR.MOUNTAIN),
  },
  [BD.MARKET]: {
    name: "市場", icon: "🏪",
    cost: { gold: 10, wood: 30, stone: 20, food: 0 },
    desc: "金貨 +6/ターン",
    req: "人口6以上",
    effect: (_, p) => { p.gold += 6; },
    canPlace: (_t, _b, _r, _c, v) => v.pop >= 6,
  },
  [BD.BARRACKS]: {
    name: "兵舎", icon: "🗡️",
    cost: { gold: 15, wood: 25, stone: 25, food: 0 },
    desc: "防衛力 +3",
    effect: (v) => { v.defense += 3; },
  },
  [BD.CHURCH]: {
    name: "教会", icon: "⛪",
    cost: { gold: 20, wood: 30, stone: 30, food: 0 },
    desc: "幸福度 +5",
    effect: (v) => { v.happiness += 5; },
  },
  [BD.WELL]: {
    name: "井戸", icon: "🪣",
    cost: { gold: 5, wood: 10, stone: 10, food: 0 },
    desc: "食料+1 幸福度+2",
    effect: (v, p) => { p.food += 1; v.happiness += 2; },
  },
  [BD.WALL]: {
    name: "城壁", icon: "🧱",
    cost: { gold: 0, wood: 5, stone: 15, food: 0 },
    desc: "防衛力 +1",
    effect: (v) => { v.defense += 1; },
  },
  [BD.SMITHY]: {
    name: "鍛冶屋", icon: "🔨",
    cost: { gold: 15, wood: 20, stone: 30, food: 0 },
    desc: "攻撃力 +2",
    effect: (v) => { v.attack += 2; },
  },
  [BD.INN]: {
    name: "宿屋", icon: "🍺",
    cost: { gold: 10, wood: 25, stone: 15, food: 0 },
    desc: "金貨+2 幸福度+3",
    effect: (v, p) => { p.gold += 2; v.happiness += 3; },
  },
  [BD.CASTLE]: {
    name: "城", icon: "🏰",
    cost: { gold: 200, wood: 150, stone: 150, food: 0 },
    desc: "🎉 勝利条件！",
    req: "人口20以上 幸福度50以上",
    effect: () => {},
    canPlace: (_t, _b, _r, _c, v) => v.pop >= 20 && v.happiness >= 50,
  },
};

/* ═══════════════════════════════════════
   Map (20x14)
   ═══════════════════════════════════════ */
const TERRAIN_MAP: Terrain[][] = [
  [3, 3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3, 3],
  [3, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3],
  [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2],
  [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2],
  [3, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 3],
  [3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3],
];

/* ═══════════════════════════════════════
   Seasons
   ═══════════════════════════════════════ */
const SEASONS = [
  { name: "🌸 春", farmMult: 1.5, woodExtra: 0 },
  { name: "☀️ 夏", farmMult: 1.0, woodExtra: 0 },
  { name: "🍂 秋", farmMult: 1.25, woodExtra: 0 },
  { name: "❄️ 冬", farmMult: 0.5, woodExtra: -1 },
];

/* ═══════════════════════════════════════
   Events
   ═══════════════════════════════════════ */
type GameEvent = {
  name: string; prob: number;
  apply: (r: Res, v: Village) => string;
};
const EVENTS: GameEvent[] = [
  { name: "豊作", prob: 0.10, apply: (r) => { r.food += 10; return "豊作！食料 +10"; } },
  { name: "商人来訪", prob: 0.09, apply: (r) => { r.gold += 15; return "旅商人が来た！金貨 +15"; } },
  {
    name: "山賊襲来", prob: 0.09,
    apply: (r, v) => {
      const dmg = Math.max(0, 8 - v.defense);
      if (dmg <= 0) return "山賊が来たが守備が堅く撃退！";
      const stolen = Math.min(r.gold, dmg * 2);
      r.gold -= stolen;
      return `山賊に金貨 ${stolen} 奪われた！`;
    },
  },
  { name: "祭り", prob: 0.08, apply: (_, v) => { v.happiness += 4; return "村祭りだ！幸福度 +4"; } },
  {
    name: "嵐", prob: 0.06,
    apply: (r) => { const l = Math.min(r.wood, 8); r.wood -= l; return `嵐で木材 ${l} 失った…`; },
  },
  {
    name: "開拓者", prob: 0.08,
    apply: (_, v) => {
      if (v.pop < v.popCap) { v.pop += 2; return "入植者が来た！人口 +2"; }
      return "入植者が来たが空きがない…";
    },
  },
  {
    name: "疫病", prob: 0.05,
    apply: (_, v) => {
      const l = Math.max(1, Math.floor(v.pop * 0.15));
      v.pop = Math.max(1, v.pop - l);
      v.happiness = Math.max(0, v.happiness - 5);
      return `疫病が…人口 -${l} 幸福度 -5`;
    },
  },
  { name: "鉱脈発見", prob: 0.07, apply: (r) => { r.stone += 12; return "鉱脈発見！石材 +12"; } },
  {
    name: "モンスター", prob: 0.08,
    apply: (r, v) => {
      const def = v.defense + v.attack;
      if (def >= 10) return "モンスターを撃退！被害なし";
      const l = Math.max(1, 5 - Math.floor(def / 2));
      r.food -= Math.min(r.food, l * 2);
      v.pop = Math.max(1, v.pop - 1);
      return `モンスター襲来！食料 -${l * 2} 人口 -1`;
    },
  },
  {
    name: "大豊作", prob: 0.04,
    apply: (r) => { r.food += 20; r.gold += 10; return "大豊作！食料+20 金貨+10"; },
  },
  {
    name: "放浪の鍛冶師", prob: 0.05,
    apply: (r) => { r.stone += 8; r.wood += 5; return "鍛冶師が資材を残した！石+8 木+5"; },
  },
];

/* ═══════════════════════════════════════
   Pixel Art: Terrain
   ═══════════════════════════════════════ */
function seasonGrass(s: number): string { return ["#70b850", "#50a838", "#a89848", "#c8d8c8"][s]; }
function seasonGrass2(s: number): string { return ["#60a840", "#409028", "#907830", "#b0c0b0"][s]; }
function seasonTree(s: number): string { return ["#38a038", "#288828", "#c87020", "#708070"][s]; }
function seasonTreeDk(s: number): string { return ["#288828", "#187018", "#a05818", "#506050"][s]; }

function drawTerrain(ctx: CanvasRenderingContext2D, c: number, r: number, t: number, season: number) {
  const x = c * TILE, y = r * TILE;
  const h = hash(c, r);
  switch (t) {
    case TR.GRASS: {
      ctx.fillStyle = seasonGrass(season);
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = seasonGrass2(season);
      for (let i = 0; i < 3; i++) {
        const gx = x + ((h >> (i * 4)) & 0x1f) % 30 + 2;
        const gy = y + ((h >> (i * 4 + 2)) & 0x1f) % 28 + 4;
        ctx.fillRect(gx, gy, 2, 4);
        ctx.fillRect(gx - 1, gy + 1, 1, 2);
        ctx.fillRect(gx + 2, gy + 1, 1, 2);
      }
      if (season === 0 && h % 7 === 0) {
        const fx = x + (h % 24) + 6, fy = y + ((h >> 3) % 24) + 6;
        ctx.fillStyle = h % 3 === 0 ? "#f08080" : h % 3 === 1 ? "#f0e068" : "#e0a0e0";
        ctx.fillRect(fx, fy, 3, 3);
        ctx.fillStyle = "#f8f888";
        ctx.fillRect(fx + 1, fy + 1, 1, 1);
      }
      break;
    }
    case TR.WATER: {
      ctx.fillStyle = "#2868b8";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#3878c8";
      for (let i = 0; i < 3; i++) {
        const wx = x + ((h >> (i * 3)) % 26) + 2, wy = y + i * 11 + 4;
        ctx.fillRect(wx, wy, 8, 2);
        ctx.fillRect(wx + 2, wy - 1, 4, 1);
      }
      ctx.fillStyle = "#88c8f8";
      ctx.fillRect(x + (h % 28) + 4, y + ((h >> 4) % 28) + 4, 2, 2);
      break;
    }
    case TR.FOREST: {
      ctx.fillStyle = seasonGrass(season);
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#684820";
      ctx.fillRect(x + 14, y + 20, 8, 12);
      ctx.fillStyle = seasonTree(season);
      ctx.fillRect(x + 8, y + 12, 20, 12);
      ctx.fillRect(x + 10, y + 6, 16, 8);
      ctx.fillRect(x + 12, y + 2, 12, 6);
      ctx.fillStyle = seasonTreeDk(season);
      ctx.fillRect(x + 8, y + 18, 8, 6);
      ctx.fillRect(x + 10, y + 10, 6, 8);
      if (h % 3 === 0) {
        ctx.fillStyle = "#604018";
        ctx.fillRect(x + 3, y + 24, 5, 8);
        ctx.fillStyle = seasonTree(season);
        ctx.fillRect(x + 0, y + 16, 11, 10);
        ctx.fillRect(x + 2, y + 12, 7, 5);
      }
      break;
    }
    case TR.MOUNTAIN: {
      ctx.fillStyle = "#706858";
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = "#908070";
      for (let my = 0; my < 28; my++) {
        const half = Math.floor((28 - my) * 0.6);
        ctx.fillRect(x + 18 - half, y + 4 + my, half * 2, 1);
      }
      ctx.fillStyle = season === 3 ? "#f8f8f8" : "#e8e0d8";
      for (let my = 0; my < 8; my++) {
        const half = Math.floor((8 - my) * 0.6);
        ctx.fillRect(x + 18 - half, y + 4 + my, half * 2, 1);
      }
      ctx.fillStyle = "#585048";
      ctx.fillRect(x + 8, y + 24, 6, 4);
      ctx.fillRect(x + 22, y + 20, 5, 5);
      break;
    }
  }
}

/* ═══════════════════════════════════════
   Pixel Art: Buildings
   ═══════════════════════════════════════ */
function drawBldg(ctx: CanvasRenderingContext2D, c: number, r: number, b: number) {
  const x = c * TILE, y = r * TILE;
  // Shadow base
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(x + 3, y + TILE - 5, TILE - 6, 5);

  switch (b) {
    case BD.HOUSE: {
      ctx.fillStyle = "#a07848";
      ctx.fillRect(x + 6, y + 16, 24, 16);
      ctx.fillStyle = "#c03020";
      for (let ry = 0; ry < 10; ry++) {
        const half = 14 - ry;
        ctx.fillRect(x + 18 - half, y + 6 + ry, half * 2, 1);
      }
      ctx.fillStyle = "#604020";
      ctx.fillRect(x + 15, y + 22, 6, 10);
      ctx.fillStyle = "#88c8f0";
      ctx.fillRect(x + 9, y + 20, 4, 4);
      ctx.fillRect(x + 23, y + 20, 4, 4);
      ctx.fillStyle = "#806050";
      ctx.fillRect(x + 24, y + 4, 4, 8);
      break;
    }
    case BD.FARM: {
      ctx.fillStyle = "#c8a840";
      ctx.fillRect(x + 2, y + 14, 32, 18);
      for (let i = 0; i < 6; i++) {
        const sx = x + 4 + i * 5;
        ctx.fillStyle = "#a08830";
        ctx.fillRect(sx, y + 8, 2, 12);
        ctx.fillStyle = "#d8c050";
        ctx.fillRect(sx - 1, y + 5, 4, 5);
      }
      ctx.fillStyle = "#906030";
      ctx.fillRect(x + 1, y + 30, 34, 2);
      ctx.fillRect(x + 2, y + 24, 2, 8);
      ctx.fillRect(x + 16, y + 24, 2, 8);
      ctx.fillRect(x + 32, y + 24, 2, 8);
      break;
    }
    case BD.LUMBER: {
      ctx.fillStyle = "#805828";
      ctx.fillRect(x + 8, y + 12, 20, 18);
      ctx.fillStyle = "#604018";
      ctx.fillRect(x + 5, y + 8, 26, 5);
      ctx.fillStyle = "#a07838";
      ctx.fillRect(x + 2, y + 26, 10, 4);
      ctx.fillRect(x + 2, y + 22, 10, 4);
      ctx.fillRect(x + 24, y + 26, 10, 4);
      ctx.fillStyle = "#888888";
      ctx.fillRect(x + 14, y + 2, 2, 8);
      ctx.fillStyle = "#b0b0b0";
      ctx.fillRect(x + 12, y + 1, 6, 3);
      break;
    }
    case BD.QUARRY: {
      ctx.fillStyle = "#808080";
      ctx.fillRect(x + 4, y + 18, 28, 14);
      ctx.fillStyle = "#989898";
      ctx.fillRect(x + 8, y + 12, 20, 8);
      ctx.fillStyle = "#b0b0b0";
      ctx.fillRect(x + 12, y + 8, 12, 6);
      ctx.fillStyle = "#705028";
      ctx.fillRect(x + 2, y + 4, 2, 12);
      ctx.fillStyle = "#a0a0a0";
      ctx.fillRect(x, y + 3, 6, 3);
      ctx.fillStyle = "#686868";
      ctx.fillRect(x + 4, y + 24, 28, 1);
      ctx.fillRect(x + 16, y + 18, 1, 14);
      break;
    }
    case BD.MARKET: {
      ctx.fillStyle = "#d03030";
      ctx.fillRect(x + 2, y + 6, 16, 4);
      ctx.fillStyle = "#e8e8e8";
      ctx.fillRect(x + 18, y + 6, 16, 4);
      ctx.fillStyle = "#d03030";
      ctx.fillRect(x + 4, y + 3, 28, 4);
      ctx.fillStyle = "#806030";
      ctx.fillRect(x + 4, y + 10, 3, 20);
      ctx.fillRect(x + 29, y + 10, 3, 20);
      ctx.fillStyle = "#a08040";
      ctx.fillRect(x + 4, y + 20, 28, 4);
      ctx.fillStyle = "#f0c040";
      ctx.fillRect(x + 8, y + 16, 4, 4);
      ctx.fillStyle = "#e06040";
      ctx.fillRect(x + 14, y + 16, 4, 4);
      ctx.fillStyle = "#60c060";
      ctx.fillRect(x + 20, y + 16, 4, 4);
      break;
    }
    case BD.BARRACKS: {
      ctx.fillStyle = "#606870";
      ctx.fillRect(x + 4, y + 12, 28, 20);
      ctx.fillStyle = "#707880";
      ctx.fillRect(x + 4, y + 8, 6, 6);
      ctx.fillRect(x + 14, y + 8, 8, 6);
      ctx.fillRect(x + 26, y + 8, 6, 6);
      ctx.fillStyle = "#484848";
      ctx.fillRect(x + 14, y + 22, 8, 10);
      ctx.fillStyle = "#d03030";
      ctx.fillRect(x + 18, y + 2, 8, 5);
      ctx.fillStyle = "#a06040";
      ctx.fillRect(x + 17, y + 1, 2, 10);
      break;
    }
    case BD.CHURCH: {
      ctx.fillStyle = "#e0d8c8";
      ctx.fillRect(x + 8, y + 14, 20, 18);
      ctx.fillStyle = "#d0c8b8";
      ctx.fillRect(x + 13, y + 4, 10, 12);
      ctx.fillStyle = "#f8d830";
      ctx.fillRect(x + 17, y + 0, 2, 6);
      ctx.fillRect(x + 15, y + 2, 6, 2);
      ctx.fillStyle = "#604828";
      ctx.fillRect(x + 15, y + 24, 6, 8);
      ctx.fillStyle = "#6080c0";
      ctx.fillRect(x + 16, y + 7, 4, 5);
      ctx.fillStyle = "#c06060";
      ctx.fillRect(x + 11, y + 18, 4, 4);
      ctx.fillStyle = "#60a060";
      ctx.fillRect(x + 21, y + 18, 4, 4);
      break;
    }
    case BD.WELL: {
      ctx.fillStyle = "#888888";
      ctx.fillRect(x + 10, y + 16, 16, 14);
      ctx.fillStyle = "#303040";
      ctx.fillRect(x + 12, y + 18, 12, 10);
      ctx.fillStyle = "#806030";
      ctx.fillRect(x + 8, y + 8, 20, 3);
      ctx.fillStyle = "#705028";
      ctx.fillRect(x + 10, y + 10, 3, 8);
      ctx.fillRect(x + 23, y + 10, 3, 8);
      ctx.fillStyle = "#a08860";
      ctx.fillRect(x + 17, y + 10, 2, 10);
      ctx.fillStyle = "#4888d0";
      ctx.fillRect(x + 14, y + 22, 8, 4);
      break;
    }
    case BD.WALL: {
      ctx.fillStyle = "#808888";
      ctx.fillRect(x + 2, y + 8, 32, 24);
      ctx.fillStyle = "#687070";
      ctx.fillRect(x + 2, y + 18, 32, 1);
      ctx.fillRect(x + 18, y + 8, 1, 24);
      ctx.fillRect(x + 10, y + 18, 1, 14);
      ctx.fillRect(x + 26, y + 18, 1, 14);
      ctx.fillStyle = "#909898";
      ctx.fillRect(x + 2, y + 4, 8, 6);
      ctx.fillRect(x + 14, y + 4, 8, 6);
      ctx.fillRect(x + 26, y + 4, 8, 6);
      break;
    }
    case BD.SMITHY: {
      ctx.fillStyle = "#484040";
      ctx.fillRect(x + 6, y + 12, 24, 20);
      ctx.fillStyle = "#383030";
      ctx.fillRect(x + 4, y + 8, 28, 5);
      ctx.fillStyle = "#504840";
      ctx.fillRect(x + 24, y + 2, 5, 8);
      ctx.fillStyle = "#a0a0a0";
      ctx.fillRect(x + 25, y + 0, 3, 3);
      ctx.fillStyle = "#707070";
      ctx.fillRect(x + 2, y + 24, 8, 4);
      ctx.fillRect(x + 4, y + 22, 4, 3);
      ctx.fillStyle = "#f08030";
      ctx.fillRect(x + 10, y + 20, 6, 6);
      ctx.fillStyle = "#f0c040";
      ctx.fillRect(x + 12, y + 18, 2, 4);
      ctx.fillStyle = "#383028";
      ctx.fillRect(x + 20, y + 22, 6, 10);
      break;
    }
    case BD.INN: {
      ctx.fillStyle = "#906838";
      ctx.fillRect(x + 4, y + 14, 28, 18);
      ctx.fillStyle = "#a87840";
      for (let ry = 0; ry < 8; ry++) {
        ctx.fillRect(x + 3, y + 6 + ry, 30, 1);
      }
      ctx.fillStyle = "#604020";
      ctx.fillRect(x + 13, y + 22, 6, 10);
      ctx.fillStyle = "#f8d830";
      ctx.fillRect(x + 8, y + 18, 4, 4);
      ctx.fillRect(x + 24, y + 18, 4, 4);
      ctx.fillStyle = "#e08030";
      ctx.fillRect(x + 9, y + 19, 2, 2);
      ctx.fillRect(x + 25, y + 19, 2, 2);
      ctx.fillStyle = "#c8a060";
      ctx.fillRect(x + 10, y + 2, 12, 5);
      ctx.fillStyle = "#806030";
      ctx.fillRect(x + 12, y + 3, 8, 3);
      break;
    }
    case BD.CASTLE: {
      ctx.fillStyle = "#a0a0a8";
      ctx.fillRect(x + 4, y + 12, 28, 20);
      ctx.fillStyle = "#909098";
      ctx.fillRect(x + 2, y + 4, 10, 28);
      ctx.fillRect(x + 24, y + 4, 10, 28);
      ctx.fillStyle = "#b0b0b8";
      ctx.fillRect(x + 2, y + 2, 3, 4);
      ctx.fillRect(x + 9, y + 2, 3, 4);
      ctx.fillRect(x + 24, y + 2, 3, 4);
      ctx.fillRect(x + 31, y + 2, 3, 4);
      ctx.fillStyle = "#888890";
      ctx.fillRect(x + 12, y + 6, 12, 10);
      ctx.fillStyle = "#989898";
      ctx.fillRect(x + 14, y + 2, 3, 6);
      ctx.fillRect(x + 19, y + 2, 3, 6);
      ctx.fillStyle = "#d03030";
      ctx.fillRect(x + 16, y + 0, 5, 3);
      ctx.fillStyle = "#a06040";
      ctx.fillRect(x + 15, y + -1, 2, 6);
      ctx.fillStyle = "#484040";
      ctx.fillRect(x + 13, y + 22, 10, 10);
      ctx.fillStyle = "#383030";
      ctx.fillRect(x + 14, y + 24, 8, 8);
      ctx.fillStyle = "#f8d830";
      ctx.fillRect(x + 6, y + 10, 3, 4);
      ctx.fillRect(x + 27, y + 10, 3, 4);
      ctx.fillRect(x + 15, y + 10, 3, 3);
      ctx.fillRect(x + 18, y + 10, 3, 3);
      break;
    }
  }
}

/* ═══════════════════════════════════════
   Canvas Render
   ═══════════════════════════════════════ */
function renderMap(
  ctx: CanvasRenderingContext2D,
  terrain: Terrain[][],
  buildings: Building[][],
  season: number,
  selected: [number, number] | null,
  hovered: [number, number] | null,
) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawTerrain(ctx, c, r, terrain[r][c], season);

  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (buildings[r][c] !== BD.NONE) drawBldg(ctx, c, r, buildings[r][c]);

  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 0.5;
  for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(0, r * TILE); ctx.lineTo(W, r * TILE); ctx.stroke(); }
  for (let c = 0; c <= COLS; c++) { ctx.beginPath(); ctx.moveTo(c * TILE, 0); ctx.lineTo(c * TILE, H); ctx.stroke(); }

  if (hovered) {
    const [hr, hc] = hovered;
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(hc * TILE, hr * TILE, TILE, TILE);
  }
  if (selected) {
    const [sr, sc] = selected;
    ctx.strokeStyle = "#f8d830";
    ctx.lineWidth = 2;
    ctx.strokeRect(sc * TILE + 1, sr * TILE + 1, TILE - 2, TILE - 2);
  }
}

/* ═══════════════════════════════════════
   Game Logic Helpers
   ═══════════════════════════════════════ */
function calcVillageStats(bldgs: Building[][], currentPop: number): Village {
  const v: Village = { pop: currentPop, popCap: 8, happiness: 50, defense: 1, attack: 0 };
  const dp: Res = { gold: 0, wood: 0, stone: 0, food: 0 };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const b = bldgs[r][c];
      if (b !== BD.NONE && BLDG[b]) BLDG[b].effect(v, dp);
    }
  v.pop = Math.min(v.pop, v.popCap);
  return v;
}

function calcProduction(bldgs: Building[][]): Res {
  const v: Village = { pop: 0, popCap: 0, happiness: 0, defense: 0, attack: 0 };
  const prod: Res = { gold: 0, wood: 0, stone: 0, food: 0 };
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const b = bldgs[r][c];
      if (b !== BD.NONE && BLDG[b]) BLDG[b].effect(v, prod);
    }
  return prod;
}

/* ═══════════════════════════════════════
   Main Component
   ═══════════════════════════════════════ */
export default function VillageSimPage() {
  const [terrain] = useState<Terrain[][]>(() => TERRAIN_MAP.map(row => [...row]));
  const [buildings, setBuildings] = useState<Building[][]>(() =>
    Array.from({ length: ROWS }, () => Array(COLS).fill(BD.NONE))
  );
  const [res, setRes] = useState<Res>({ gold: 50, wood: 50, stone: 30, food: 30 });
  const [village, setVillage] = useState<Village>({
    pop: 5, popCap: 8, happiness: 50, defense: 1, attack: 0,
  });
  const [turn, setTurn] = useState(1);
  const [season, setSeason] = useState(0);
  const [year, setYear] = useState(1);
  const [selectedBldg, setSelectedBldg] = useState<number>(BD.HOUSE);
  const [selectedTile, setSelectedTile] = useState<[number, number] | null>(null);
  const [hoveredTile, setHoveredTile] = useState<[number, number] | null>(null);
  const [log, setLog] = useState<string[]>(["春が来た。新しい村の始まりだ！"]);
  const [phase, setPhase] = useState<"title" | "play" | "victory" | "gameover">("title");
  const [demolishMode, setDemolishMode] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ── Canvas draw ── */
  const draw = useCallback(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    renderMap(ctx, terrain, buildings, season, selectedTile, hoveredTile);
  }, [terrain, buildings, season, selectedTile, hoveredTile]);

  useEffect(() => { draw(); }, [draw]);

  /* ── Canvas click ── */
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current;
    if (!cvs || phase !== "play") return;
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top) * (H / rect.height);
    const cc = Math.floor(mx / TILE), rr = Math.floor(my / TILE);
    if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) setSelectedTile([rr, cc]);
  }, [phase]);

  /* ── Canvas hover ── */
  const handleMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const cvs = canvasRef.current;
    if (!cvs || phase !== "play") return;
    const rect = cvs.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (W / rect.width);
    const my = (e.clientY - rect.top) * (H / rect.height);
    const cc = Math.floor(mx / TILE), rr = Math.floor(my / TILE);
    if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS) setHoveredTile([rr, cc]);
    else setHoveredTile(null);
  }, [phase]);

  /* ── Place / Demolish ── */
  const placeBuilding = useCallback(() => {
    if (!selectedTile || phase !== "play") return;
    const [r, c] = selectedTile;

    if (demolishMode) {
      if (buildings[r][c] === BD.NONE) {
        setLog(prev => ["建物がありません。", ...prev].slice(0, 40));
        return;
      }
      const info = BLDG[buildings[r][c]];
      const nb = buildings.map(row => [...row]);
      nb[r][c] = BD.NONE;
      setBuildings(nb);
      setRes(prev => ({
        gold: prev.gold + Math.floor(info.cost.gold * 0.5),
        wood: prev.wood + Math.floor(info.cost.wood * 0.5),
        stone: prev.stone + Math.floor(info.cost.stone * 0.5),
        food: prev.food,
      }));
      setVillage(calcVillageStats(nb, village.pop));
      setLog(prev => [`${info.name}を解体。資材の半分を回収した。`, ...prev].slice(0, 40));
      return;
    }

    if (terrain[r][c] !== TR.GRASS) {
      setLog(prev => ["草地にのみ建設できます。", ...prev].slice(0, 40));
      return;
    }
    if (buildings[r][c] !== BD.NONE) {
      setLog(prev => ["すでに建物があります。", ...prev].slice(0, 40));
      return;
    }
    const info = BLDG[selectedBldg];
    if (!info) return;
    if (res.gold < info.cost.gold || res.wood < info.cost.wood ||
      res.stone < info.cost.stone || res.food < info.cost.food) {
      setLog(prev => ["資材が足りません！", ...prev].slice(0, 40));
      return;
    }
    if (info.canPlace && !info.canPlace(terrain, buildings, r, c, village)) {
      setLog(prev => [`条件未達: ${info.req || ""}`, ...prev].slice(0, 40));
      return;
    }

    const nb = buildings.map(row => [...row]);
    nb[r][c] = selectedBldg as Building;
    setBuildings(nb);
    setRes(prev => ({
      gold: prev.gold - info.cost.gold,
      wood: prev.wood - info.cost.wood,
      stone: prev.stone - info.cost.stone,
      food: prev.food - info.cost.food,
    }));
    setVillage(calcVillageStats(nb, village.pop));
    setLog(prev => [`${info.name}を建設した！`, ...prev].slice(0, 40));

    if (selectedBldg === BD.CASTLE) {
      setPhase("victory");
      setLog(prev => ["🎉 城が完成！村は立派な王国になった！", ...prev]);
    }
  }, [selectedTile, selectedBldg, buildings, terrain, res, village, phase, demolishMode]);

  /* ── End Turn ── */
  const endTurn = useCallback(() => {
    if (phase !== "play") return;
    const msgs: string[] = [];
    const s = SEASONS[season];

    const prod = calcProduction(buildings);
    prod.food = Math.floor(prod.food * s.farmMult);
    prod.wood += s.woodExtra * village.pop;

    const foodEat = village.pop;
    const nr: Res = {
      gold: Math.max(0, res.gold + prod.gold),
      wood: Math.max(0, res.wood + prod.wood),
      stone: Math.max(0, res.stone + prod.stone),
      food: Math.max(0, res.food + prod.food - foodEat),
    };

    msgs.push(`生産: 💰+${prod.gold} 🪵+${prod.wood} 🪨+${prod.stone} 🌾+${prod.food}  消費: 🌾-${foodEat}`);

    const vCalc = calcVillageStats(buildings, village.pop);
    let newPop = vCalc.pop;

    if (nr.food > newPop && newPop < vCalc.popCap && vCalc.happiness >= 30) {
      const g = Math.min(2, vCalc.popCap - newPop);
      newPop += g;
      msgs.push(`人口 +${g}（${newPop}人に）`);
    } else if (nr.food === 0 && vCalc.pop > 1) {
      const loss = Math.max(1, Math.floor(vCalc.pop * 0.2));
      newPop = Math.max(1, vCalc.pop - loss);
      vCalc.happiness = Math.max(0, vCalc.happiness - 10);
      msgs.push(`⚠ 食料不足！人口 -${loss}`);
    }

    const roll = Math.random();
    let cum = 0;
    for (const evt of EVENTS) {
      cum += evt.prob;
      if (roll < cum) {
        const vRef = { ...vCalc, pop: newPop };
        const result = evt.apply(nr, vRef);
        newPop = vRef.pop;
        vCalc.happiness = vRef.happiness;
        msgs.push(`【${evt.name}】${result}`);
        break;
      }
    }

    if (vCalc.happiness > 55) vCalc.happiness -= 1;
    if (vCalc.happiness < 45) vCalc.happiness += 1;

    const ns = (season + 1) % 4;
    const ny = ns === 0 ? year + 1 : year;
    msgs.push(`― ${SEASONS[ns].name}（${ny}年目）―`);

    newPop = Math.min(newPop, vCalc.popCap);
    setRes(nr);
    setVillage({ ...vCalc, pop: newPop });
    setTurn(t => t + 1);
    setSeason(ns);
    setYear(ny);
    setLog(prev => [...msgs.reverse(), ...prev].slice(0, 50));

    if (newPop <= 0) {
      setPhase("gameover");
      setLog(prev => ["💀 村の人口がゼロに…ゲームオーバー", ...prev]);
    }
  }, [phase, season, year, res, village, buildings]);

  /* ── Affordability check ── */
  const canAfford = (id: number) => {
    const b = BLDG[id];
    return b && res.gold >= b.cost.gold && res.wood >= b.cost.wood &&
      res.stone >= b.cost.stone && res.food >= b.cost.food;
  };

  /* ── Production preview ── */
  const preview = calcProduction(buildings);
  const previewFood = Math.floor(preview.food * SEASONS[season].farmMult);

  /* ── Styles ── */
  const vWin: React.CSSProperties = {
    background: "linear-gradient(135deg, #2a1c10 0%, #1a1408 100%)",
    border: "2px solid #c8a860",
    borderRadius: 8,
    boxShadow: "inset 0 0 20px rgba(200,168,96,0.12), 0 4px 12px rgba(0,0,0,0.5)",
  };
  const btn = (active?: boolean): React.CSSProperties => ({
    background: active
      ? "linear-gradient(180deg, #c8a860 0%, #a08040 100%)"
      : "linear-gradient(180deg, #483820 0%, #302010 100%)",
    color: active ? "#1a1408" : "#c8a860",
    border: `1px solid ${active ? "#f0d888" : "#8a6830"}`,
    borderRadius: 4,
    padding: "5px 12px",
    cursor: "pointer",
    fontFamily: "'DotGothic16', monospace",
    fontSize: 13,
    fontWeight: active ? "bold" : "normal",
  });

  const terrainLabel: Record<number, string> = {
    [TR.GRASS]: "🌿 草地", [TR.WATER]: "💧 水辺", [TR.FOREST]: "🌲 森", [TR.MOUNTAIN]: "⛰️ 山",
  };

  /* ═══════════════════════════════════════
     Title Screen
     ═══════════════════════════════════════ */
  if (phase === "title") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(180deg, #1a1408 0%, #0a0800 100%)" }}>
        <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" />
        <div className="text-center" style={{ fontFamily: "'DotGothic16', monospace" }}>
          <div style={{ fontSize: 72, marginBottom: 8 }}>🏘️</div>
          <h1 style={{ fontSize: 38, color: VC.GOLD, textShadow: "0 0 24px rgba(248,216,48,0.5)", marginBottom: 8 }}>
            村づくり物語
          </h1>
          <p style={{ color: VC.BRD, fontSize: 16, marginBottom: 32 }}>
            ～ 小さな村を王国へ ～
          </p>
          <div style={{ ...vWin, padding: "20px 32px", maxWidth: 500, margin: "0 auto 28px", textAlign: "left" }}>
            <p style={{ color: VC.TXT, fontSize: 14, lineHeight: 2 }}>
              🌾 建物を建てて村を発展させよう<br />
              👥 人口を増やし、資源を集めよう<br />
              ⚔️ 山賊やモンスターから村を守ろう<br />
              🏰 <span style={{ color: VC.GOLD }}>最終目標：城を建設して王国を築け！</span><br />
              <br />
              <span style={{ color: VC.BRD, fontSize: 13 }}>操作：マップクリック → 建物選択 → 建設ボタン</span>
            </p>
          </div>
          <button onClick={() => setPhase("play")} style={{
            background: "linear-gradient(180deg, #f8d830 0%, #c8a020 100%)",
            color: "#1a1408", border: "2px solid #f0d888", borderRadius: 8,
            padding: "14px 56px", fontSize: 22, fontFamily: "'DotGothic16', monospace",
            fontWeight: "bold", cursor: "pointer",
            boxShadow: "0 0 24px rgba(248,216,48,0.3)",
          }}>
            始める
          </button>
          <div style={{ marginTop: 28 }}>
            <Link href="/" style={{ color: "#8a6830", fontSize: 14, textDecoration: "none" }}>← ゲーム一覧に戻る</Link>
          </div>
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════
     Victory Screen
     ═══════════════════════════════════════ */
  if (phase === "victory") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(180deg, #1a1408 0%, #0a0800 100%)" }}>
        <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" />
        <div className="text-center" style={{ fontFamily: "'DotGothic16', monospace" }}>
          <div style={{ fontSize: 80, marginBottom: 16 }}>🏰</div>
          <h1 style={{ fontSize: 36, color: VC.GOLD, textShadow: "0 0 20px rgba(248,216,48,0.5)", marginBottom: 8 }}>
            おめでとう！
          </h1>
          <p style={{ color: VC.TXT, fontSize: 18, marginBottom: 8 }}>
            城が完成し、村は立派な王国となった！
          </p>
          <div style={{ ...vWin, padding: 20, maxWidth: 400, margin: "16px auto" }}>
            <p style={{ color: VC.BRD, fontSize: 14, lineHeight: 1.8 }}>
              クリア: {year}年 ({turn}ターン)<br />
              人口: {village.pop}人 / 幸福度: {village.happiness}<br />
              金貨: {res.gold} / 木材: {res.wood} / 石材: {res.stone}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
            <button onClick={() => window.location.reload()} style={btn()}>もう一度</button>
            <Link href="/" style={{ ...btn(), textDecoration: "none", display: "inline-block" }}>ゲーム一覧</Link>
          </div>
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════
     Game Over Screen
     ═══════════════════════════════════════ */
  if (phase === "gameover") {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center"
        style={{ background: "linear-gradient(180deg, #1a0808 0%, #0a0000 100%)" }}>
        <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" />
        <div className="text-center" style={{ fontFamily: "'DotGothic16', monospace" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>💀</div>
          <h1 style={{ fontSize: 32, color: "#d04040", marginBottom: 8 }}>ゲームオーバー</h1>
          <p style={{ color: "#c08080", fontSize: 16, marginBottom: 24 }}>村は滅びてしまった…</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button onClick={() => window.location.reload()} style={btn()}>もう一度</button>
            <Link href="/" style={{ ...btn(), textDecoration: "none", display: "inline-block" }}>ゲーム一覧</Link>
          </div>
        </div>
      </main>
    );
  }

  /* ═══════════════════════════════════════
     Main Game Screen
     ═══════════════════════════════════════ */
  const sel = selectedTile
    ? { t: terrain[selectedTile[0]][selectedTile[1]], b: buildings[selectedTile[0]][selectedTile[1]] }
    : null;

  return (
    <main className="min-h-screen" style={{ background: VC.BG, fontFamily: "'DotGothic16', monospace" }}>
      <link href="https://fonts.googleapis.com/css2?family=DotGothic16&display=swap" rel="stylesheet" />

      {/* ── Resource Bar ── */}
      <div style={{
        ...vWin, margin: "0 8px", padding: "8px 16px", borderRadius: "0 0 8px 8px",
        display: "flex", flexWrap: "wrap", gap: "6px 16px", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 14 }}>
          <span style={{ color: "#f8d830" }}>💰{res.gold}</span>
          <span style={{ color: "#c89048" }}>🪵{res.wood}</span>
          <span style={{ color: "#a0a0a8" }}>🪨{res.stone}</span>
          <span style={{ color: "#80c840" }}>🌾{res.food}</span>
          <span style={{ color: "#e0d0b0" }}>👥{village.pop}/{village.popCap}</span>
          <span style={{ color: village.happiness >= 50 ? "#80d080" : "#d08080" }}>😊{village.happiness}</span>
          <span style={{ color: "#8888c8" }}>🛡{village.defense}</span>
          <span style={{ color: "#c06060" }}>⚔{village.attack}</span>
        </div>
        <div style={{ color: VC.BRD, fontSize: 13 }}>
          {SEASONS[season].name}・{year}年目・ターン{turn}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div style={{ display: "flex", gap: 8, padding: 8, flexWrap: "wrap" }}>

        {/* ── Canvas ── */}
        <div style={{ ...vWin, padding: 4 }}>
          <canvas ref={canvasRef} width={W} height={H}
            onClick={handleClick}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoveredTile(null)}
            style={{ display: "block", cursor: "pointer", imageRendering: "pixelated", maxWidth: "100%" }}
          />
        </div>

        {/* ── Right Panel ── */}
        <div style={{ minWidth: 250, maxWidth: 310, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>

          {/* Selected tile info */}
          <div style={{ ...vWin, padding: "8px 12px" }}>
            <div style={{ color: VC.BRD, fontSize: 11, marginBottom: 4 }}>選択タイル</div>
            {sel ? (
              <div style={{ color: VC.TXT, fontSize: 13 }}>
                {terrainLabel[sel.t]}
                {sel.b !== BD.NONE && <span style={{ marginLeft: 8 }}>建物: {BLDG[sel.b]?.icon}{BLDG[sel.b]?.name}</span>}
                {sel.t === TR.GRASS && sel.b === BD.NONE && <span style={{ color: "#80c840", marginLeft: 6 }}>✓建設可</span>}
              </div>
            ) : (
              <div style={{ color: "#888068", fontSize: 13 }}>マップをクリック</div>
            )}
          </div>

          {/* Mode toggle */}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setDemolishMode(false)} style={{ ...btn(!demolishMode), flex: 1 }}>🔨 建設</button>
            <button onClick={() => setDemolishMode(true)} style={{ ...btn(demolishMode), flex: 1 }}>💥 解体</button>
          </div>

          {/* Building palette */}
          {!demolishMode && (
            <div style={{ ...vWin, padding: "8px 10px", flex: 1, overflowY: "auto", maxHeight: 340 }}>
              <div style={{ color: VC.BRD, fontSize: 11, marginBottom: 4 }}>建物一覧</div>
              {Object.entries(BLDG).map(([id, info]) => {
                const bId = Number(id);
                const ok = canAfford(bId);
                const isSel = selectedBldg === bId;
                return (
                  <div key={id} onClick={() => setSelectedBldg(bId)} style={{
                    padding: "5px 8px", marginBottom: 2, borderRadius: 4, cursor: "pointer",
                    background: isSel ? "rgba(200,168,96,0.2)" : "transparent",
                    border: isSel ? "1px solid #c8a860" : "1px solid transparent",
                    opacity: ok ? 1 : 0.45,
                  }}>
                    <div style={{ color: VC.TXT, fontSize: 13 }}>{info.icon} {info.name}</div>
                    <div style={{ color: "#a89868", fontSize: 11, marginTop: 1 }}>
                      {info.cost.gold > 0 && <span>💰{info.cost.gold} </span>}
                      {info.cost.wood > 0 && <span>🪵{info.cost.wood} </span>}
                      {info.cost.stone > 0 && <span>🪨{info.cost.stone} </span>}
                      <span style={{ color: "#88a868", marginLeft: 4 }}>{info.desc}</span>
                    </div>
                    {info.req && <div style={{ color: "#c89050", fontSize: 10 }}>※{info.req}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Demolish info */}
          {demolishMode && (
            <div style={{ ...vWin, padding: "10px 12px" }}>
              <div style={{ color: "#d08080", fontSize: 13, lineHeight: 1.6 }}>
                解体モード：タイルを選び解体ボタンを押す<br />
                <span style={{ fontSize: 11, color: "#a08060" }}>（資材の50%を回収）</span>
              </div>
            </div>
          )}

          {/* Production preview */}
          <div style={{ ...vWin, padding: "8px 12px" }}>
            <div style={{ color: VC.BRD, fontSize: 11, marginBottom: 2 }}>次ターン生産予測</div>
            <div style={{ color: VC.TXT, fontSize: 12 }}>
              💰+{preview.gold} 🪵+{preview.wood + SEASONS[season].woodExtra * village.pop} 🪨+{preview.stone} 🌾+{previewFood}
              <span style={{ color: "#d08080", marginLeft: 6 }}>消費🌾-{village.pop}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={placeBuilding} disabled={!selectedTile}
              style={{ ...btn(), flex: 1, opacity: selectedTile ? 1 : 0.5, padding: "8px", fontSize: 14 }}>
              {demolishMode ? "💥 解体" : "🔨 建設"}
            </button>
            <button onClick={endTurn} style={{
              ...btn(), flex: 1, padding: "8px", fontSize: 14,
              background: "linear-gradient(180deg, #305828 0%, #1a3010 100%)",
              borderColor: "#68a850", color: "#b0d898",
            }}>
              ⏩ ターン終了
            </button>
          </div>

          <div style={{ textAlign: "center", marginTop: 2 }}>
            <Link href="/" style={{ color: "#8a6830", fontSize: 12, textDecoration: "none" }}>← ゲーム一覧に戻る</Link>
          </div>
        </div>
      </div>

      {/* ── Event Log ── */}
      <div style={{ ...vWin, margin: "0 8px 8px", padding: "8px 12px", maxHeight: 120, overflowY: "auto" }}>
        <div style={{ color: VC.BRD, fontSize: 11, marginBottom: 2 }}>📜 ログ</div>
        {log.map((msg, i) => (
          <div key={i} style={{ color: i === 0 ? VC.TXT : "#908870", fontSize: 12, lineHeight: 1.5 }}>
            ▸ {msg}
          </div>
        ))}
      </div>
    </main>
  );
}
