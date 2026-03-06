"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

// ===================== Types =====================

type UnitClass = "Sword" | "Lance" | "Axe" | "Mage" | "Archer";
type Team = "player" | "enemy";

interface Unit {
  id: number;
  name: string;
  team: Team;
  cls: UnitClass;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  mov: number;
  range: number; // attack range (1 = melee, 2 = ranged)
  moved: boolean;
  acted: boolean;
}

type Phase = "player" | "enemy";
type GameResult = "playing" | "victory" | "defeat";
type SelectState = "none" | "selected" | "attacking";

// ===================== Constants =====================

const TILE = 64;
const COLS = 14;
const ROWS = 10;
const W = COLS * TILE;
const H = ROWS * TILE;

// Weapon triangle: Sword > Axe > Lance > Sword
const TRIANGLE_BONUS: Record<UnitClass, UnitClass[]> = {
  Sword: ["Axe"],
  Lance: ["Sword"],
  Axe: ["Lance"],
  Mage: [],
  Archer: [],
};

const CLASS_COLOR: Record<UnitClass, string> = {
  Sword: "#3b82f6",
  Lance: "#22c55e",
  Axe: "#ef4444",
  Mage: "#a855f7",
  Archer: "#f59e0b",
};

const CLASS_ICON: Record<UnitClass, string> = {
  Sword: "⚔",
  Lance: "🏹",
  Axe: "🪓",
  Mage: "✨",
  Archer: "🏹",
};

// ===================== Map / Terrain =====================

// 0 = plain, 1 = forest(def+1), 2 = mountain(mov cost 2), 3 = wall(impassable)
type Terrain = 0 | 1 | 2 | 3;
const MAP: Terrain[][] = [
  [0, 0, 0, 1, 1, 0, 3, 0, 0, 0, 1, 0, 0, 0],
  [0, 3, 0, 0, 1, 0, 3, 0, 1, 0, 0, 0, 3, 0],
  [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0],
  [0, 0, 0, 1, 0, 2, 2, 0, 1, 0, 0, 0, 0, 0],
  [0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0],
  [0, 0, 2, 2, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0],
  [0, 0, 0, 1, 0, 2, 2, 0, 1, 0, 0, 0, 0, 0],
  [0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0],
  [0, 3, 0, 0, 1, 0, 3, 0, 1, 0, 0, 0, 3, 0],
  [0, 0, 0, 1, 1, 0, 3, 0, 0, 0, 1, 0, 0, 0],
];

const TERRAIN_COLOR: Record<Terrain, string> = {
  0: "#6b8e4e",
  1: "#2d6a2d",
  2: "#9ca3af",
  3: "#374151",
};

// ===================== Initial Units =====================

const createUnits = (): Unit[] => [
  // Player units
  { id: 1, name: "マルス", team: "player", cls: "Sword", x: 1, y: 4, hp: 28, maxHp: 28, atk: 12, def: 6, mov: 5, range: 1, moved: false, acted: false },
  { id: 2, name: "カイン", team: "player", cls: "Lance", x: 1, y: 5, hp: 25, maxHp: 25, atk: 11, def: 5, mov: 5, range: 1, moved: false, acted: false },
  { id: 3, name: "マリク", team: "player", cls: "Mage", x: 0, y: 3, hp: 18, maxHp: 18, atk: 14, def: 2, mov: 4, range: 2, moved: false, acted: false },
  { id: 4, name: "ゴードン", team: "player", cls: "Archer", x: 0, y: 6, hp: 20, maxHp: 20, atk: 13, def: 3, mov: 4, range: 2, moved: false, acted: false },
  // Enemy units
  { id: 5, name: "アーマー", team: "enemy", cls: "Axe", x: 12, y: 4, hp: 32, maxHp: 32, atk: 11, def: 9, mov: 4, range: 1, moved: false, acted: false },
  { id: 6, name: "ソルジャー", team: "enemy", cls: "Lance", x: 12, y: 5, hp: 24, maxHp: 24, atk: 10, def: 4, mov: 5, range: 1, moved: false, acted: false },
  { id: 7, name: "ドラゴン", team: "enemy", cls: "Sword", x: 13, y: 3, hp: 26, maxHp: 26, atk: 13, def: 5, mov: 6, range: 1, moved: false, acted: false },
  { id: 8, name: "ボス", team: "enemy", cls: "Axe", x: 13, y: 6, hp: 36, maxHp: 36, atk: 14, def: 10, mov: 3, range: 1, moved: false, acted: false },
];

// ===================== Game Logic Helpers =====================

function manhattan(ax: number, ay: number, bx: number, by: number) {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

function inBounds(x: number, y: number) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function getReachable(unit: Unit, units: Unit[]): Set<string> {
  const occupied = new Set(units.filter((u) => u.id !== unit.id).map((u) => `${u.x},${u.y}`));
  const visited = new Map<string, number>();
  const queue: { x: number; y: number; remaining: number }[] = [
    { x: unit.x, y: unit.y, remaining: unit.mov },
  ];
  visited.set(`${unit.x},${unit.y}`, unit.mov);

  while (queue.length) {
    const cur = queue.shift()!;
    const dirs = [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ];
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!inBounds(nx, ny)) continue;
      const terrain = MAP[ny][nx];
      if (terrain === 3) continue;
      const cost = terrain === 2 ? 2 : 1;
      const rem = cur.remaining - cost;
      if (rem < 0) continue;
      const key = `${nx},${ny}`;
      // can't move onto enemy, but can stop on ally (but not stack)
      const blocker = units.find((u) => u.x === nx && u.y === ny && u.id !== unit.id);
      if (blocker && blocker.team !== unit.team) continue; // enemy blocks
      if (blocker && blocker.team === unit.team && rem === 0) continue; // can't end on ally
      if (!visited.has(key) || visited.get(key)! < rem) {
        visited.set(key, rem);
        queue.push({ x: nx, y: ny, remaining: rem });
      }
    }
  }

  // Remove tiles occupied by allied units (can pass through but not stop)
  const allied = new Set(
    units.filter((u) => u.id !== unit.id && u.team === unit.team).map((u) => `${u.x},${u.y}`),
  );
  const result = new Set<string>();
  for (const key of visited.keys()) {
    if (!occupied.has(key) || !allied.has(key)) {
      result.add(key);
    }
  }
  return result;
}

function getAttackable(unit: Unit, fromX: number, fromY: number, units: Unit[]): Unit[] {
  return units.filter((u) => u.team !== unit.team && manhattan(fromX, fromY, u.x, u.y) === unit.range);
}

function calcDamage(attacker: Unit, defender: Unit): number {
  let atk = attacker.atk;
  if (TRIANGLE_BONUS[attacker.cls]?.includes(defender.cls)) atk += 2;
  if (TRIANGLE_BONUS[defender.cls]?.includes(attacker.cls)) atk -= 2;
  const dmg = Math.max(0, atk - defender.def);
  return dmg;
}

function battleCalc(attacker: Unit, defender: Unit) {
  const atkDmg = calcDamage(attacker, defender);
  const defDmg = calcDamage(defender, attacker);
  // counterattack only if defender can reach attacker
  const canCounter = manhattan(attacker.x, attacker.y, defender.x, defender.y) === defender.range;
  return { atkDmg, defDmg: canCounter ? defDmg : 0 };
}

// Simple AI: move toward nearest player and attack
function aiMove(enemy: Unit, allUnits: Unit[]): { x: number; y: number } {
  const reachable = getReachable(enemy, allUnits);
  const players = allUnits.filter((u) => u.team === "player");
  if (players.length === 0) return { x: enemy.x, y: enemy.y };

  let bestTile = { x: enemy.x, y: enemy.y };
  let bestDist = Infinity;

  for (const key of reachable) {
    const [tx, ty] = key.split(",").map(Number);
    for (const p of players) {
      const d = manhattan(tx, ty, p.x, p.y);
      if (d < bestDist) {
        bestDist = d;
        bestTile = { x: tx, y: ty };
      }
    }
  }
  return bestTile;
}

// ===================== Main Component =====================

export default function FireEmblemPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [units, setUnits] = useState<Unit[]>(createUnits);
  const [phase, setPhase] = useState<Phase>("player");
  const [selected, setSelected] = useState<Unit | null>(null);
  const [selectState, setSelectState] = useState<SelectState>("none");
  const [reachable, setReachable] = useState<Set<string>>(new Set());
  const [attackable, setAttackable] = useState<Unit[]>([]);
  const [log, setLog] = useState<string[]>(["ゲーム開始！プレイヤーフェイズ"]);
  const [result, setResult] = useState<GameResult>("playing");
  const [cursor, setCursor] = useState({ x: 0, y: 0 });

  const pushLog = useCallback((msg: string) => {
    setLog((prev) => [msg, ...prev].slice(0, 6));
  }, []);

  const resetGame = useCallback(() => {
    setUnits(createUnits());
    setPhase("player");
    setSelected(null);
    setSelectState("none");
    setReachable(new Set());
    setAttackable([]);
    setLog(["ゲーム開始！プレイヤーフェイズ"]);
    setResult("playing");
  }, []);

  // ---- End turn ----
  const endPlayerTurn = useCallback((currentUnits: Unit[]) => {
    const reset = currentUnits.map((u) => ({ ...u, moved: false, acted: false }));
    setUnits(reset);
    setPhase("enemy");
    setSelected(null);
    setSelectState("none");
    setReachable(new Set());
    setAttackable([]);
    pushLog("エネミーフェイズ開始");
  }, [pushLog]);

  // ---- Enemy Phase AI ----
  useEffect(() => {
    if (phase !== "enemy") return;
    let current = [...units];
    const enemies = current.filter((u) => u.team === "enemy");

    const processNext = (idx: number) => {
      if (idx >= enemies.length) {
        const reset = current.map((u) => ({ ...u, moved: false, acted: false }));
        setUnits(reset);
        setPhase("player");
        pushLog("プレイヤーフェイズ開始");
        return;
      }

      setTimeout(() => {
        const enemyId = enemies[idx].id;
        const enemy = current.find((u) => u.id === enemyId);
        if (!enemy || enemy.hp <= 0) {
          processNext(idx + 1);
          return;
        }

        // Move
        const dest = aiMove(enemy, current);
        current = current.map((u) => u.id === enemy.id ? { ...u, x: dest.x, y: dest.y, moved: true } : u);
        setUnits([...current]);

        // Attack
        const movedEnemy = current.find((u) => u.id === enemy.id)!;
        const targets = getAttackable(movedEnemy, dest.x, dest.y, current);
        if (targets.length > 0) {
          const target = targets.reduce((a, b) => a.hp < b.hp ? a : b); // attack lowest hp
          const { atkDmg, defDmg } = battleCalc(movedEnemy, target);

          current = current.map((u) => {
            if (u.id === target.id) return { ...u, hp: Math.max(0, u.hp - atkDmg) };
            if (u.id === movedEnemy.id) return { ...u, hp: Math.max(0, u.hp - defDmg), acted: true };
            return u;
          });

          const killed = current.find((u) => u.id === target.id)!.hp <= 0;
          pushLog(`${movedEnemy.name} → ${target.name} ${atkDmg}ダメージ${killed ? " (撃破)" : ""}`);
          if (defDmg > 0) {
            const eKilled = current.find((u) => u.id === movedEnemy.id)!.hp <= 0;
            pushLog(`${target.name} 反撃 ${defDmg}ダメージ${eKilled ? " (撃破)" : ""}`);
          }

          current = current.filter((u) => u.hp > 0);
          setUnits([...current]);

          const playerDead = current.filter((u) => u.team === "player").length === 0;
          const enemyDead = current.filter((u) => u.team === "enemy").length === 0;
          if (playerDead) { setResult("defeat"); return; }
          if (enemyDead) { setResult("victory"); return; }
        }

        processNext(idx + 1);
      }, 500 + idx * 300);
    };

    processNext(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---- Canvas drawing ----
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    // Draw tiles
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const terrain = MAP[row][col];
        ctx.fillStyle = TERRAIN_COLOR[terrain];
        ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.strokeRect(col * TILE, row * TILE, TILE, TILE);
      }
    }

    // Reachable overlay
    for (const key of reachable) {
      const [rx, ry] = key.split(",").map(Number);
      ctx.fillStyle = "rgba(59,130,246,0.35)";
      ctx.fillRect(rx * TILE, ry * TILE, TILE, TILE);
    }

    // Attackable overlay
    for (const target of attackable) {
      ctx.fillStyle = "rgba(239,68,68,0.45)";
      ctx.fillRect(target.x * TILE, target.y * TILE, TILE, TILE);
    }

    // Draw units
    for (const unit of units) {
      const px = unit.x * TILE;
      const py = unit.y * TILE;
      const alpha = unit.moved && unit.acted ? 0.45 : 1;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = unit.team === "player" ? CLASS_COLOR[unit.cls] : "#991b1b";
      ctx.beginPath();
      ctx.roundRect(px + 6, py + 6, TILE - 12, TILE - 12, 6);
      ctx.fill();

      // HP bar
      const barW = TILE - 12;
      const hpRatio = unit.hp / unit.maxHp;
      ctx.fillStyle = "#1f2937";
      ctx.fillRect(px + 6, py + TILE - 16, barW, 6);
      ctx.fillStyle = hpRatio > 0.5 ? "#22c55e" : hpRatio > 0.25 ? "#f59e0b" : "#ef4444";
      ctx.fillRect(px + 6, py + TILE - 16, Math.round(barW * hpRatio), 6);

      // Icon
      ctx.globalAlpha = 1;
      ctx.font = `${unit.team === "player" ? "24" : "22"}px serif`;
      ctx.textAlign = "center";
      ctx.fillText(unit.team === "player" ? "🧙" : "👹", px + TILE / 2, py + TILE / 2 + 4);

      // Selected highlight
      if (selected?.id === unit.id) {
        ctx.strokeStyle = "#facc15";
        ctx.lineWidth = 3;
        ctx.strokeRect(px + 4, py + 4, TILE - 8, TILE - 8);
        ctx.lineWidth = 1;
      }
    }
    ctx.globalAlpha = 1;

    // Cursor
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.strokeRect(cursor.x * TILE + 1, cursor.y * TILE + 1, TILE - 2, TILE - 2);
    ctx.lineWidth = 1;
  }, [units, reachable, attackable, selected, cursor]);

  // ---- Input ----
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (phase !== "player" || result !== "playing") return;

      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const scaleX = W / rect.width;
      const scaleY = H / rect.height;
      const cx = Math.floor(((e.clientX - rect.left) * scaleX) / TILE);
      const cy = Math.floor(((e.clientY - rect.top) * scaleY) / TILE);
      if (!inBounds(cx, cy)) return;

      setCursor({ x: cx, y: cy });

      const clickedUnit = units.find((u) => u.x === cx && u.y === cy);

      // -------- Phase: none → select unit --------
      if (selectState === "none") {
        if (clickedUnit && clickedUnit.team === "player" && !clickedUnit.acted) {
          setSelected(clickedUnit);
          setSelectState("selected");
          setReachable(getReachable(clickedUnit, units));
          setAttackable([]);
          pushLog(`${clickedUnit.name} を選択 (HP:${clickedUnit.hp}/${clickedUnit.maxHp})`);
        }
        return;
      }

      // -------- Phase: selected → move or attack-in-place --------
      if (selectState === "selected" && selected) {
        // Self-click → deselect
        if (clickedUnit?.id === selected.id) {
          setSelected(null);
          setSelectState("none");
          setReachable(new Set());
          setAttackable([]);
          return;
        }

        // Click another friendly unit → switch selection
        if (clickedUnit && clickedUnit.team === "player" && !clickedUnit.acted) {
          setSelected(clickedUnit);
          setReachable(getReachable(clickedUnit, units));
          setAttackable([]);
          pushLog(`${clickedUnit.name} を選択 (HP:${clickedUnit.hp}/${clickedUnit.maxHp})`);
          return;
        }

        // Click reachable empty tile → move unit immediately, enter attack phase
        if (
          reachable.has(`${cx},${cy}`) &&
          !units.find((u) => u.x === cx && u.y === cy && u.id !== selected.id)
        ) {
          const nextUnits = units.map((u) =>
            u.id === selected.id ? { ...u, x: cx, y: cy, moved: true } : u,
          );
          const movedUnit = nextUnits.find((u) => u.id === selected.id)!;
          const targets = getAttackable(movedUnit, cx, cy, nextUnits);
          setUnits(nextUnits);
          setSelected(movedUnit);
          setReachable(new Set());
          setAttackable(targets);
          setSelectState("attacking");
          pushLog(
            targets.length > 0
              ? `${movedUnit.name} が (${cx},${cy}) へ移動 — 攻撃対象を選択`
              : `${movedUnit.name} が (${cx},${cy}) へ移動 — 待機するにはマップをクリック`,
          );
          return;
        }

        // Click adjacent enemy directly (attack without moving)
        const adjacentTargets = getAttackable(selected, selected.x, selected.y, units);
        const directTarget = adjacentTargets.find((u) => u.x === cx && u.y === cy);
        if (directTarget) {
          const { atkDmg, defDmg } = battleCalc(selected, directTarget);
          let next = units.map((u) => {
            if (u.id === directTarget.id) return { ...u, hp: Math.max(0, u.hp - atkDmg) };
            if (u.id === selected.id) return { ...u, hp: Math.max(0, u.hp - defDmg), moved: true, acted: true };
            return u;
          });
          const killed = next.find((u) => u.id === directTarget.id)!.hp <= 0;
          pushLog(`${selected.name} → ${directTarget.name} ${atkDmg}ダメージ${killed ? " (撃破)" : ""}`);
          if (defDmg > 0) {
            pushLog(`${directTarget.name} 反撃 ${defDmg}ダメージ`);
          }
          next = next.filter((u) => u.hp > 0);
          setUnits(next);
          setSelected(null);
          setSelectState("none");
          setReachable(new Set());
          setAttackable([]);
          const playerDead = next.filter((u) => u.team === "player").length === 0;
          const enemyDead = next.filter((u) => u.team === "enemy").length === 0;
          if (playerDead) { setResult("defeat"); return; }
          if (enemyDead) { setResult("victory"); return; }
          return;
        }

        // Click elsewhere → deselect
        setSelected(null);
        setSelectState("none");
        setReachable(new Set());
        setAttackable([]);
        return;
      }

      // -------- Phase: attacking → attack enemy or wait --------
      if (selectState === "attacking" && selected) {
        const target = attackable.find((u) => u.x === cx && u.y === cy);
        if (target) {
          // Execute battle
          const { atkDmg, defDmg } = battleCalc(selected, target);
          let next = units.map((u) => {
            if (u.id === target.id) return { ...u, hp: Math.max(0, u.hp - atkDmg) };
            if (u.id === selected.id) return { ...u, hp: Math.max(0, u.hp - defDmg), acted: true };
            return u;
          });
          const killed = next.find((u) => u.id === target.id)!.hp <= 0;
          pushLog(`${selected.name} → ${target.name} ${atkDmg}ダメージ${killed ? " (撃破)" : ""}`);
          if (defDmg > 0) {
            const atkKilled = next.find((u) => u.id === selected.id)!.hp <= 0;
            pushLog(`${target.name} 反撃 ${defDmg}ダメージ${atkKilled ? " (撃破)" : ""}`);
          }
          next = next.filter((u) => u.hp > 0);
          setUnits(next);
          setSelected(null);
          setSelectState("none");
          setReachable(new Set());
          setAttackable([]);
          const playerDead = next.filter((u) => u.team === "player").length === 0;
          const enemyDead = next.filter((u) => u.team === "enemy").length === 0;
          if (playerDead) { setResult("defeat"); return; }
          if (enemyDead) { setResult("victory"); return; }
        } else {
          // No target clicked → wait (confirm move without attacking)
          const next = units.map((u) =>
            u.id === selected.id ? { ...u, acted: true } : u,
          );
          setUnits(next);
          setSelected(null);
          setSelectState("none");
          setReachable(new Set());
          setAttackable([]);
          pushLog(`${selected.name} 待機`);
        }
      }
    },
    [phase, result, units, selected, selectState, reachable, attackable, pushLog],
  );

  const handleEndTurn = useCallback(() => {
    if (phase !== "player" || result !== "playing") return;
    endPlayerTurn(units);
  }, [phase, result, units, endPlayerTurn]);

  const phaseColor = phase === "player" ? "text-blue-300" : "text-red-400";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 gap-4">
      <h1 className="text-xl md:text-2xl font-bold tracking-wide">Fire Emblem風 ターン制SRPG</h1>

      <div className="flex flex-col lg:flex-row gap-4 w-full max-w-[1200px]">
        {/* Canvas */}
        <div className="flex-1">
          <div className="relative w-full border border-slate-600 rounded-lg overflow-hidden shadow-lg">
            <canvas
              ref={canvasRef}
              width={W}
              height={H}
              className="w-full h-auto cursor-pointer"
              onClick={handleCanvasClick}
            />

            {result !== "playing" && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
                <p className={`text-4xl font-extrabold ${result === "victory" ? "text-yellow-300" : "text-red-400"}`}>
                  {result === "victory" ? "🏆 Victory!" : "💀 Game Over"}
                </p>
                <button
                  onClick={resetGame}
                  className="px-6 py-2 rounded-full bg-slate-100 text-slate-900 font-bold hover:bg-white transition"
                >
                  もう一度プレイ
                </button>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className={`font-bold ${phaseColor} text-base`}>
              {phase === "player" ? "👤 プレイヤーフェイズ" : "👹 エネミーフェイズ"}
            </span>
            {phase === "player" && result === "playing" && (
              <button
                onClick={handleEndTurn}
                className="ml-auto px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-sm font-bold transition"
              >
                ターン終了
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-full lg:w-64 flex flex-col gap-3">
          {/* Unit status */}
          <div className="rounded-xl bg-slate-800 p-3 text-xs">
            <p className="font-bold text-slate-300 mb-2">ユニット状態</p>
            {units.map((u) => (
              <div key={u.id} className="flex items-center gap-1.5 mb-1">
                <span>{u.team === "player" ? "🧙" : "👹"}</span>
                <span className={`w-16 truncate ${u.acted ? "text-slate-500" : "text-slate-100"}`}>{u.name}</span>
                <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${u.hp / u.maxHp > 0.5 ? "bg-green-500" : u.hp / u.maxHp > 0.25 ? "bg-yellow-500" : "bg-red-500"}`}
                    style={{ width: `${(u.hp / u.maxHp) * 100}%` }}
                  />
                </div>
                <span className="text-slate-300 w-10 text-right">{u.hp}/{u.maxHp}</span>
              </div>
            ))}
          </div>

          {/* Battle log */}
          <div className="rounded-xl bg-slate-800 p-3 text-xs flex-1">
            <p className="font-bold text-slate-300 mb-2">バトルログ</p>
            {log.map((l, i) => (
              <p key={i} className={`text-slate-300 leading-5 ${i === 0 ? "text-slate-100" : "text-slate-500"}`}>{l}</p>
            ))}
          </div>

          {/* Legend */}
          <div className="rounded-xl bg-slate-800 p-3 text-xs">
            <p className="font-bold text-slate-300 mb-1.5">操作方法</p>
            <p className="text-slate-400 leading-5">① 味方ユニットをクリック選択</p>
            <p className="text-slate-400 leading-5">② 青いマスをクリックで移動</p>
            <p className="text-slate-400 leading-5">③ 赤い敵をクリックで攻撃</p>
            <p className="text-slate-400 leading-5">③ 敵以外をクリックで待機</p>
            <p className="text-slate-400 leading-5 mt-1">⚔ 武器三角形あり</p>
            <p className="text-slate-400 leading-5">剣 ＞ 斧 ＞ 槍 ＞ 剣</p>
          </div>
        </aside>
      </div>

      <Link href="/" className="text-sm text-slate-400 hover:text-white underline underline-offset-4">
        ← トップへ戻る
      </Link>
    </main>
  );
}
