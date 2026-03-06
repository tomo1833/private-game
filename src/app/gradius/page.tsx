"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Bullet = {
  x: number;
  y: number;
  vx: number;
  radius: number;
};

type Enemy = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
};

type Star = {
  x: number;
  y: number;
  speed: number;
  size: number;
};

const WIDTH = 960;
const HEIGHT = 540;
const PLAYER_SPEED = 320;
const BULLET_SPEED = 720;
const ENEMY_SPAWN_INTERVAL = 0.8;

export default function GradiusPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const keys = new Set<string>();
    const bullets: Bullet[] = [];
    const enemies: Enemy[] = [];
    const stars: Star[] = Array.from({ length: 90 }).map(() => ({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      speed: 20 + Math.random() * 140,
      size: 1 + Math.random() * 2,
    }));

    const player = {
      x: 120,
      y: HEIGHT / 2,
      shootCooldown: 0,
      invincible: 0,
    };

    let localScore = 0;
    let localLives = 3;
    let isGameOver = false;
    let enemySpawnTimer = 0;
    let prev = performance.now();
    let raf = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
        e.preventDefault();
      }

      keys.add(key);

      if (isGameOver && key === "enter") {
        localScore = 0;
        localLives = 3;
        isGameOver = false;
        enemies.length = 0;
        bullets.length = 0;
        player.x = 120;
        player.y = HEIGHT / 2;
        player.invincible = 2;
        setScore(localScore);
        setLives(localLives);
        setGameOver(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keys.delete(e.key.toLowerCase());
    };

    const drawPlayer = () => {
      const blink = player.invincible > 0 && Math.floor(player.invincible * 16) % 2 === 0;
      if (blink) return;

      ctx.fillStyle = "#6ee7ff";
      ctx.beginPath();
      ctx.moveTo(player.x + 18, player.y);
      ctx.lineTo(player.x - 16, player.y - 10);
      ctx.lineTo(player.x - 8, player.y);
      ctx.lineTo(player.x - 16, player.y + 10);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = "#34d399";
      ctx.fillRect(player.x - 6, player.y - 3, 16, 6);
    };

    const drawHud = () => {
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, 0, WIDTH, 44);

      ctx.fillStyle = "#ecfeff";
      ctx.font = "bold 18px system-ui";
      ctx.fillText(`SCORE: ${localScore}`, 16, 28);

      ctx.fillStyle = "#fde68a";
      ctx.fillText(`LIVES: ${localLives}`, 180, 28);

      if (isGameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 52px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 10);
        ctx.font = "22px system-ui";
        ctx.fillText("Enter でリスタート", WIDTH / 2, HEIGHT / 2 + 38);
        ctx.textAlign = "left";
      }
    };

    const spawnEnemy = () => {
      const radius = 11 + Math.random() * 10;
      enemies.push({
        x: WIDTH + radius,
        y: 30 + Math.random() * (HEIGHT - 60),
        vx: -(130 + Math.random() * 170),
        vy: (Math.random() - 0.5) * 80,
        radius,
        hp: radius > 17 ? 2 : 1,
      });
    };

    const loop = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.033);
      prev = now;

      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      stars.forEach((star) => {
        star.x -= star.speed * dt;
        if (star.x < -star.size) {
          star.x = WIDTH + star.size;
          star.y = Math.random() * HEIGHT;
        }

        const alpha = Math.min(1, 0.35 + star.size / 3);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });

      if (!isGameOver) {
        if (keys.has("arrowup") || keys.has("w")) player.y -= PLAYER_SPEED * dt;
        if (keys.has("arrowdown") || keys.has("s")) player.y += PLAYER_SPEED * dt;
        if (keys.has("arrowleft") || keys.has("a")) player.x -= PLAYER_SPEED * dt;
        if (keys.has("arrowright") || keys.has("d")) player.x += PLAYER_SPEED * dt;

        player.x = Math.max(18, Math.min(WIDTH - 18, player.x));
        player.y = Math.max(18, Math.min(HEIGHT - 18, player.y));

        player.shootCooldown -= dt;
        if ((keys.has(" ") || keys.has("z")) && player.shootCooldown <= 0) {
          bullets.push({
            x: player.x + 18,
            y: player.y,
            vx: BULLET_SPEED,
            radius: 4,
          });
          player.shootCooldown = 0.12;
        }

        player.invincible = Math.max(0, player.invincible - dt);

        enemySpawnTimer += dt;
        if (enemySpawnTimer >= ENEMY_SPAWN_INTERVAL) {
          enemySpawnTimer = 0;
          spawnEnemy();
        }

        for (let i = bullets.length - 1; i >= 0; i -= 1) {
          const bullet = bullets[i];
          bullet.x += bullet.vx * dt;
          if (bullet.x > WIDTH + bullet.radius) {
            bullets.splice(i, 1);
          }
        }

        for (let i = enemies.length - 1; i >= 0; i -= 1) {
          const enemy = enemies[i];
          enemy.x += enemy.vx * dt;
          enemy.y += enemy.vy * dt;

          if (enemy.y < enemy.radius || enemy.y > HEIGHT - enemy.radius) {
            enemy.vy *= -1;
          }

          if (enemy.x < -enemy.radius - 20) {
            enemies.splice(i, 1);
            continue;
          }

          for (let b = bullets.length - 1; b >= 0; b -= 1) {
            const bullet = bullets[b];
            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;
            const r = bullet.radius + enemy.radius;

            if (dx * dx + dy * dy <= r * r) {
              bullets.splice(b, 1);
              enemy.hp -= 1;

              if (enemy.hp <= 0) {
                enemies.splice(i, 1);
                localScore += 100;
                setScore(localScore);
              }
              break;
            }
          }

          if (i >= enemies.length) continue;

          if (player.invincible <= 0) {
            const dx = player.x - enemy.x;
            const dy = player.y - enemy.y;
            const r = enemy.radius + 11;

            if (dx * dx + dy * dy <= r * r) {
              enemies.splice(i, 1);
              localLives -= 1;
              setLives(localLives);
              player.invincible = 2;

              if (localLives <= 0) {
                isGameOver = true;
                setGameOver(true);
              }
            }
          }
        }
      }

      bullets.forEach((bullet) => {
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(bullet.x, bullet.y, bullet.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      enemies.forEach((enemy) => {
        const grad = ctx.createLinearGradient(
          enemy.x - enemy.radius,
          enemy.y,
          enemy.x + enemy.radius,
          enemy.y,
        );
        grad.addColorStop(0, "#f97316");
        grad.addColorStop(1, "#ef4444");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#111827";
        ctx.fillRect(enemy.x - enemy.radius * 0.45, enemy.y - 2, enemy.radius * 0.9, 4);
      });

      drawPlayer();
      drawHud();

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
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl md:text-2xl font-bold tracking-wide">GRADIUS Mini (Next.js + TypeScript)</h1>
      <p className="text-sm md:text-base text-slate-300 text-center">
        移動: 矢印キー / WASD ・ 攻撃: Space / Z ・ スコア: {score} ・ 残機: {lives}
      </p>

      <div className="w-full max-w-[980px] border border-cyan-300/40 shadow-[0_0_28px_rgba(34,211,238,0.22)] rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-auto bg-slate-900"
        />
      </div>

      {gameOver ? (
        <p className="text-amber-300 text-sm">Enter キーで再スタートできます。</p>
      ) : (
        <p className="text-slate-400 text-xs">敵に当たらずに撃破し続けてください。</p>
      )}

      <Link
        href="/"
        className="mt-2 text-sm text-cyan-300 hover:text-cyan-200 underline underline-offset-4"
      >
        ← トップへ戻る
      </Link>
    </main>
  );
}
