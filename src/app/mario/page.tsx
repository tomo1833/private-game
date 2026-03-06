"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Platform = { x: number; y: number; w: number; h: number };
type Coin = { x: number; y: number; r: number; taken: boolean };
type Enemy = { x: number; y: number; w: number; h: number; minX: number; maxX: number; vx: number };

const WIDTH = 960;
const HEIGHT = 540;
const WORLD_WIDTH = 3200;
const GROUND_Y = 470;
const GRAVITY = 1800;
const RUN_SPEED = 260;
const JUMP_VELOCITY = 760;

export default function MarioLikePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [status, setStatus] = useState<"playing" | "gameover" | "clear">("playing");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const keys = new Set<string>();

    const initialPlatforms: Platform[] = [
      { x: 0, y: GROUND_Y, w: WORLD_WIDTH, h: HEIGHT - GROUND_Y },
      { x: 260, y: 400, w: 180, h: 20 },
      { x: 560, y: 350, w: 150, h: 20 },
      { x: 840, y: 300, w: 160, h: 20 },
      { x: 1190, y: 380, w: 220, h: 20 },
      { x: 1540, y: 330, w: 170, h: 20 },
      { x: 1880, y: 280, w: 150, h: 20 },
      { x: 2220, y: 380, w: 180, h: 20 },
      { x: 2550, y: 330, w: 170, h: 20 },
      { x: 2860, y: 280, w: 190, h: 20 },
    ];

    const initialCoins: Coin[] = [
      { x: 330, y: 360, r: 10, taken: false },
      { x: 620, y: 310, r: 10, taken: false },
      { x: 900, y: 260, r: 10, taken: false },
      { x: 1260, y: 340, r: 10, taken: false },
      { x: 1620, y: 290, r: 10, taken: false },
      { x: 1940, y: 240, r: 10, taken: false },
      { x: 2280, y: 340, r: 10, taken: false },
      { x: 2610, y: 290, r: 10, taken: false },
      { x: 2960, y: 240, r: 10, taken: false },
    ];

    const initialEnemies: Enemy[] = [
      { x: 680, y: GROUND_Y - 26, w: 26, h: 26, minX: 610, maxX: 780, vx: 80 },
      { x: 1430, y: GROUND_Y - 26, w: 26, h: 26, minX: 1360, maxX: 1540, vx: 95 },
      { x: 2130, y: GROUND_Y - 26, w: 26, h: 26, minX: 2050, maxX: 2240, vx: 110 },
      { x: 2740, y: GROUND_Y - 26, w: 26, h: 26, minX: 2670, maxX: 2870, vx: 85 },
    ];

    const player = {
      x: 80,
      y: GROUND_Y - 42,
      w: 30,
      h: 42,
      vx: 0,
      vy: 0,
      onGround: false,
    };

    let platforms = initialPlatforms.map((p) => ({ ...p }));
    let coins = initialCoins.map((c) => ({ ...c }));
    let enemies = initialEnemies.map((e) => ({ ...e }));
    let cameraX = 0;
    let localCoinCount = 0;
    let localStatus: "playing" | "gameover" | "clear" = "playing";
    let prev = performance.now();
    let raf = 0;

    const resetGame = () => {
      player.x = 80;
      player.y = GROUND_Y - player.h;
      player.vx = 0;
      player.vy = 0;
      player.onGround = false;
      platforms = initialPlatforms.map((p) => ({ ...p }));
      coins = initialCoins.map((c) => ({ ...c }));
      enemies = initialEnemies.map((e) => ({ ...e }));
      cameraX = 0;
      localCoinCount = 0;
      localStatus = "playing";
      setCoinsCollected(0);
      setStatus("playing");
    };

    const intersects = (
      ax: number,
      ay: number,
      aw: number,
      ah: number,
      bx: number,
      by: number,
      bw: number,
      bh: number,
    ) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
      }

      keys.add(key);

      if (localStatus !== "playing" && key === "enter") {
        resetGame();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    const drawPlayer = (x: number, y: number) => {
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(x, y + 10, player.w, player.h - 10);
      ctx.fillStyle = "#facc15";
      ctx.fillRect(x + 4, y, player.w - 8, 12);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(x + 5, y + 20, 6, 6);
      ctx.fillRect(x + player.w - 11, y + 20, 6, 6);
    };

    const loop = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.033);
      prev = now;

      const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      sky.addColorStop(0, "#38bdf8");
      sky.addColorStop(1, "#0ea5e9");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      for (let i = 0; i < 8; i += 1) {
        const mx = ((i * 460 - cameraX * 0.3) % (WIDTH + 260)) - 130;
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.beginPath();
        ctx.arc(mx + 60, 100 + (i % 3) * 20, 28, 0, Math.PI * 2);
        ctx.arc(mx + 85, 95 + (i % 3) * 20, 22, 0, Math.PI * 2);
        ctx.arc(mx + 36, 95 + (i % 3) * 20, 22, 0, Math.PI * 2);
        ctx.fill();
      }

      if (localStatus === "playing") {
        player.vx = 0;
        if (keys.has("arrowleft") || keys.has("a")) player.vx = -RUN_SPEED;
        if (keys.has("arrowright") || keys.has("d")) player.vx = RUN_SPEED;

        if ((keys.has("arrowup") || keys.has("w") || keys.has(" ")) && player.onGround) {
          player.vy = -JUMP_VELOCITY;
          player.onGround = false;
        }

        player.vy += GRAVITY * dt;

        player.x += player.vx * dt;
        player.x = Math.max(0, Math.min(WORLD_WIDTH - player.w, player.x));

        player.y += player.vy * dt;
        player.onGround = false;

        for (const p of platforms) {
          if (
            intersects(player.x, player.y, player.w, player.h, p.x, p.y, p.w, p.h) &&
            player.vy >= 0 &&
            player.y + player.h - player.vy * dt <= p.y + 5
          ) {
            player.y = p.y - player.h;
            player.vy = 0;
            player.onGround = true;
          }
        }

        if (player.y > HEIGHT + 80) {
          localStatus = "gameover";
          setStatus("gameover");
        }

        for (const enemy of enemies) {
          enemy.x += enemy.vx * dt;
          if (enemy.x < enemy.minX || enemy.x > enemy.maxX) {
            enemy.vx *= -1;
          }

          if (intersects(player.x, player.y, player.w, player.h, enemy.x, enemy.y, enemy.w, enemy.h)) {
            localStatus = "gameover";
            setStatus("gameover");
          }
        }

        for (const coin of coins) {
          if (coin.taken) continue;
          const dx = player.x + player.w / 2 - coin.x;
          const dy = player.y + player.h / 2 - coin.y;
          if (dx * dx + dy * dy <= (coin.r + 12) * (coin.r + 12)) {
            coin.taken = true;
            localCoinCount += 1;
            setCoinsCollected(localCoinCount);
          }
        }

        if (player.x >= WORLD_WIDTH - 140) {
          localStatus = "clear";
          setStatus("clear");
        }
      }

      cameraX = Math.max(0, Math.min(WORLD_WIDTH - WIDTH, player.x - 220));

      ctx.fillStyle = "#16a34a";
      ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);

      for (const p of platforms) {
        if (p.y === GROUND_Y) continue;
        const sx = p.x - cameraX;
        if (sx + p.w < -40 || sx > WIDTH + 40) continue;
        ctx.fillStyle = "#92400e";
        ctx.fillRect(sx, p.y, p.w, p.h);
        ctx.fillStyle = "#d97706";
        ctx.fillRect(sx, p.y, p.w, 5);
      }

      for (const coin of coins) {
        if (coin.taken) continue;
        const sx = coin.x - cameraX;
        if (sx < -30 || sx > WIDTH + 30) continue;
        ctx.fillStyle = "#facc15";
        ctx.beginPath();
        ctx.arc(sx, coin.y, coin.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fde68a";
        ctx.fillRect(sx - 2, coin.y - 6, 4, 12);
      }

      for (const enemy of enemies) {
        const sx = enemy.x - cameraX;
        if (sx + enemy.w < -30 || sx > WIDTH + 30) continue;
        ctx.fillStyle = "#7c2d12";
        ctx.fillRect(sx, enemy.y, enemy.w, enemy.h);
        ctx.fillStyle = "#111827";
        ctx.fillRect(sx + 5, enemy.y + 8, 4, 4);
        ctx.fillRect(sx + enemy.w - 9, enemy.y + 8, 4, 4);
      }

      const flagX = WORLD_WIDTH - 80 - cameraX;
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(flagX, 180, 6, GROUND_Y - 180);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(flagX + 6, 190, 40, 22);

      drawPlayer(player.x - cameraX, player.y);

      ctx.fillStyle = "rgba(2,6,23,0.45)";
      ctx.fillRect(0, 0, WIDTH, 48);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 18px system-ui";
      ctx.fillText(`COINS: ${localCoinCount}/${coins.length}`, 14, 30);
      ctx.fillText("GOAL: 右端の旗まで進む", 210, 30);

      if (localStatus !== "playing") {
        ctx.fillStyle = "rgba(2,6,23,0.6)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = "bold 58px system-ui";
        ctx.fillText(localStatus === "clear" ? "STAGE CLEAR" : "GAME OVER", WIDTH / 2, HEIGHT / 2 - 10);
        ctx.font = "24px system-ui";
        ctx.fillText("Enter でリスタート", WIDTH / 2, HEIGHT / 2 + 36);
        ctx.textAlign = "left";
      }

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    window.addEventListener("keyup", onKeyUp);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <main className="min-h-screen bg-sky-900 text-white flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl md:text-2xl font-bold tracking-wide">Mario-like Platformer Mini</h1>
      <p className="text-sm md:text-base text-sky-100 text-center">
        移動: 矢印キー / AD ・ ジャンプ: Space / W / ↑ ・ コイン: {coinsCollected}
      </p>

      <div className="w-full max-w-[980px] border border-sky-200/50 shadow-[0_0_28px_rgba(125,211,252,0.25)] rounded-lg overflow-hidden">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="w-full h-auto bg-sky-500" />
      </div>

      <p className="text-sm text-amber-200">
        {status === "playing" ? "右に進み、コインを集めて旗まで到達しましょう。" : "Enter キーで再スタートできます。"}
      </p>

      <Link
        href="/"
        className="text-sm text-sky-200 hover:text-white underline underline-offset-4"
      >
        ← トップへ戻る
      </Link>
    </main>
  );
}
