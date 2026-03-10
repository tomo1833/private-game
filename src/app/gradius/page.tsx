"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

/* ─── 型定義 ─── */
type Bullet = { x: number; y: number; vx: number; vy: number; radius: number; isLaser?: boolean };
type EnemyBullet = { x: number; y: number; vx: number; vy: number; radius: number };
type Enemy = {
  x: number; y: number; vx: number; vy: number;
  radius: number; hp: number; maxHp: number;
  kind: "normal" | "big" | "capsule" | "boss";
  shootTimer?: number;
};
type Star = { x: number; y: number; speed: number; size: number; color: string };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
type PowerCapsule = { x: number; y: number; vx: number };
type OptionOrb = { x: number; y: number; trail: { x: number; y: number }[] };

/* ─── パワーアップゲージ（グラディウス仕様） ─── */
const POWER_LABELS = ["SPEED UP", "MISSILE", "DOUBLE", "LASER", "OPTION", "SHIELD"] as const;
type PowerLabel = (typeof POWER_LABELS)[number];

/* ─── 定数 ─── */
const WIDTH = 960;
const HEIGHT = 540;
const BASE_SPEED = 280;
const SPEED_INCREMENT = 60;
const BULLET_SPEED = 720;
const LASER_SPEED = 1100;
const ENEMY_SPAWN_INTERVAL = 0.75;
const MAX_OPTIONS = 4;
const OPTION_TRAIL_LEN = 14;

export default function GradiusPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const pauseRef = useRef(false);

  const togglePause = useCallback(() => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (!ctx) return;

    const keys = new Set<string>();
    const bullets: Bullet[] = [];
    const enemyBullets: EnemyBullet[] = [];
    const enemies: Enemy[] = [];
    const particles: Particle[] = [];
    const capsules: PowerCapsule[] = [];
    const options: OptionOrb[] = [];

    /* 星フィールド（多層） */
    const starColors = ["#94a3b8", "#cbd5e1", "#e0f2fe", "#7dd3fc", "#a78bfa"];
    const stars: Star[] = Array.from({ length: 120 }).map(() => ({
      x: Math.random() * WIDTH,
      y: Math.random() * HEIGHT,
      speed: 15 + Math.random() * 180,
      size: 0.6 + Math.random() * 2.4,
      color: starColors[Math.floor(Math.random() * starColors.length)],
    }));

    const player = {
      x: 120, y: HEIGHT / 2,
      shootCooldown: 0, invincible: 2,
      speedLevel: 0, hasMissile: false, hasDouble: false,
      hasLaser: false, hasShield: false, shieldHp: 0,
    };

    let powerGauge = 0;
    let localScore = 0;
    let localLives = 3;
    let isGameOver = false;
    let enemySpawnTimer = 0;
    let spawnWave = 0;
    let prev = performance.now();
    let raf = 0;
    let screenShake = 0;
    let titleAlpha = 1;
    let highScore = 0;

    /* ─── ヘルパー ─── */
    const dist2 = (ax: number, ay: number, bx: number, by: number) => {
      const dx = ax - bx, dy = ay - by;
      return dx * dx + dy * dy;
    };

    const spawnParticles = (x: number, y: number, count: number, color: string, speed = 200) => {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const v = 30 + Math.random() * speed;
        particles.push({
          x, y, vx: Math.cos(angle) * v, vy: Math.sin(angle) * v,
          life: 0.3 + Math.random() * 0.5, maxLife: 0.3 + Math.random() * 0.5,
          color, size: 1.5 + Math.random() * 3,
        });
      }
    };

    const firePlayerBullet = (ox: number, oy: number) => {
      if (player.hasLaser) {
        bullets.push({ x: ox + 18, y: oy, vx: LASER_SPEED, vy: 0, radius: 2, isLaser: true });
      } else {
        bullets.push({ x: ox + 18, y: oy, vx: BULLET_SPEED, vy: 0, radius: 3 });
        if (player.hasDouble) {
          bullets.push({ x: ox + 12, y: oy - 8, vx: BULLET_SPEED * 0.92, vy: -BULLET_SPEED * 0.3, radius: 3 });
        }
      }
      if (player.hasMissile) {
        bullets.push({ x: ox + 4, y: oy + 10, vx: BULLET_SPEED * 0.55, vy: BULLET_SPEED * 0.25, radius: 2 });
      }
    };

    /* ─── パワーアップ適用 ─── */
    const applyPowerUp = () => {
      const label = POWER_LABELS[powerGauge];
      let applied = false;
      switch (label) {
        case "SPEED UP":
          if (player.speedLevel < 5) { player.speedLevel++; applied = true; }
          break;
        case "MISSILE":
          if (!player.hasMissile) { player.hasMissile = true; applied = true; }
          break;
        case "DOUBLE":
          player.hasDouble = true; player.hasLaser = false; applied = true;
          break;
        case "LASER":
          player.hasLaser = true; player.hasDouble = false; applied = true;
          break;
        case "OPTION":
          if (options.length < MAX_OPTIONS) {
            options.push({ x: player.x - 30 * (options.length + 1), y: player.y, trail: [] });
            applied = true;
          }
          break;
        case "SHIELD":
          player.hasShield = true; player.shieldHp = 3; applied = true;
          break;
      }
      if (applied) {
        powerGauge = 0;
        spawnParticles(player.x, player.y, 10, "#34d399", 100);
      }
    };

    /* ─── イベント ─── */
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright", "enter"].includes(key)) e.preventDefault();
      keys.add(key);

      if (key === "p" || key === "escape") { togglePause(); return; }

      if (isGameOver && key === "enter") {
        highScore = Math.max(highScore, localScore);
        localScore = 0; localLives = 3; isGameOver = false;
        enemies.length = 0; bullets.length = 0; enemyBullets.length = 0;
        particles.length = 0; capsules.length = 0; options.length = 0;
        player.x = 120; player.y = HEIGHT / 2; player.invincible = 2;
        player.speedLevel = 0; player.hasMissile = false; player.hasDouble = false;
        player.hasLaser = false; player.hasShield = false; player.shieldHp = 0;
        powerGauge = 0; spawnWave = 0;
        setScore(0); setLives(3); setGameOver(false);
        return;
      }

      if (!isGameOver && key === "enter") {
        applyPowerUp();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());

    /* ─── 描画: プレイヤー ─── */
    const drawPlayer = () => {
      const blink = player.invincible > 0 && Math.floor(player.invincible * 16) % 2 === 0;
      if (blink) return;

      ctx.save();
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 18;

      // 本体
      ctx.fillStyle = "#0ea5e9";
      ctx.beginPath();
      ctx.moveTo(player.x + 22, player.y);
      ctx.lineTo(player.x - 12, player.y - 14);
      ctx.lineTo(player.x - 6, player.y - 6);
      ctx.lineTo(player.x - 18, player.y - 8);
      ctx.lineTo(player.x - 14, player.y);
      ctx.lineTo(player.x - 18, player.y + 8);
      ctx.lineTo(player.x - 6, player.y + 6);
      ctx.lineTo(player.x - 12, player.y + 14);
      ctx.closePath();
      ctx.fill();

      // ウイングのハイライト
      ctx.fillStyle = "rgba(56, 189, 248, 0.4)";
      ctx.beginPath();
      ctx.moveTo(player.x + 22, player.y);
      ctx.lineTo(player.x - 12, player.y - 14);
      ctx.lineTo(player.x - 6, player.y - 6);
      ctx.lineTo(player.x + 4, player.y);
      ctx.closePath();
      ctx.fill();

      // コックピット
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#67e8f9";
      ctx.beginPath();
      ctx.ellipse(player.x + 4, player.y, 6, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      // エンジン炎
      const flicker = 6 + Math.random() * 10;
      const fGrad = ctx.createLinearGradient(player.x - 18, player.y, player.x - 18 - flicker, player.y);
      fGrad.addColorStop(0, "#fbbf24");
      fGrad.addColorStop(0.5, "#f97316");
      fGrad.addColorStop(1, "transparent");
      ctx.fillStyle = fGrad;
      ctx.beginPath();
      ctx.moveTo(player.x - 14, player.y - 5);
      ctx.lineTo(player.x - 18 - flicker, player.y);
      ctx.lineTo(player.x - 14, player.y + 5);
      ctx.closePath();
      ctx.fill();

      // シールド
      if (player.hasShield && player.shieldHp > 0) {
        const t = performance.now() * 0.003;
        ctx.strokeStyle = `rgba(96, 165, 250, ${0.35 + Math.sin(t) * 0.15})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(player.x + 2, player.y, 24, -0.5, Math.PI * 2 - 0.5);
        ctx.stroke();
        ctx.strokeStyle = `rgba(147, 197, 253, ${0.15 + Math.sin(t + 1) * 0.1})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(player.x + 2, player.y, 27, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    /* ─── 描画: オプション ─── */
    const drawOption = (opt: OptionOrb) => {
      ctx.save();
      ctx.shadowColor = "#fb923c";
      ctx.shadowBlur = 16;
      const t = performance.now() * 0.005;
      const r = 8 + Math.sin(t) * 1;
      const grad = ctx.createRadialGradient(opt.x, opt.y, 0, opt.x, opt.y, r);
      grad.addColorStop(0, "#fef3c7");
      grad.addColorStop(0.4, "#f97316");
      grad.addColorStop(1, "rgba(249,115,22,0.05)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(opt.x, opt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(opt.x - 2, opt.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    /* ─── 描画: 敵 ─── */
    const drawEnemy = (e: Enemy) => {
      ctx.save();
      if (e.kind === "capsule") {
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 12;
        ctx.fillStyle = "#f87171";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.45)";
        ctx.beginPath();
        ctx.arc(e.x - e.radius * 0.25, e.y - e.radius * 0.25, e.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "boss") {
        ctx.shadowColor = "#dc2626";
        ctx.shadowBlur = 24;
        const grad = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.radius);
        grad.addColorStop(0, "#fca5a5");
        grad.addColorStop(0.35, "#dc2626");
        grad.addColorStop(1, "#7f1d1d");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
        // 装飾リング
        ctx.strokeStyle = "rgba(252,165,165,0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        // HPバー
        ctx.shadowBlur = 0;
        const barW = e.radius * 2.2;
        const barH = 5;
        const barX = e.x - barW / 2;
        const barY = e.y - e.radius - 14;
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        const hpRatio = e.hp / e.maxHp;
        const hpColor = hpRatio > 0.5 ? "#ef4444" : hpRatio > 0.25 ? "#f97316" : "#fbbf24";
        ctx.fillStyle = hpColor;
        ctx.fillRect(barX, barY, barW * hpRatio, barH);
      } else {
        const isBig = e.kind === "big";
        ctx.shadowColor = isBig ? "#f97316" : "#a855f7";
        ctx.shadowBlur = 10;
        const grad = ctx.createLinearGradient(e.x - e.radius, e.y, e.x + e.radius, e.y);
        if (isBig) {
          grad.addColorStop(0, "#f97316");
          grad.addColorStop(1, "#ef4444");
        } else {
          grad.addColorStop(0, "#a855f7");
          grad.addColorStop(1, "#ec4899");
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        const sides = isBig ? 6 : 5;
        const rotOffset = performance.now() * 0.001;
        for (let s = 0; s < sides; s++) {
          const a = (Math.PI * 2 / sides) * s - Math.PI / 2 + rotOffset;
          const px = e.x + Math.cos(a) * e.radius;
          const py = e.y + Math.sin(a) * e.radius;
          s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();

        // 目
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.beginPath();
        ctx.ellipse(e.x - e.radius * 0.15, e.y, e.radius * 0.3, e.radius * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(e.x - e.radius * 0.1, e.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    /* ─── 描画: 弾 ─── */
    const drawBullets = () => {
      bullets.forEach((b) => {
        ctx.save();
        if (b.isLaser) {
          ctx.shadowColor = "#22d3ee";
          ctx.shadowBlur = 14;
          ctx.strokeStyle = "#67e8f9";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - 32, b.y);
          ctx.stroke();
          ctx.strokeStyle = "rgba(255,255,255,0.6)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y);
          ctx.lineTo(b.x - 32, b.y);
          ctx.stroke();
        } else {
          ctx.shadowColor = "#fde68a";
          ctx.shadowBlur = 8;
          ctx.fillStyle = "#fef08a";
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });
      enemyBullets.forEach((b) => {
        ctx.save();
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 8;
        ctx.fillStyle = "#fca5a5";
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });
    };

    /* ─── 描画: パーティクル ─── */
    const drawParticles = () => {
      particles.forEach((p) => {
        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };

    /* ─── 描画: パワーカプセル ─── */
    const drawCapsules = () => {
      capsules.forEach((c) => {
        ctx.save();
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 12;
        const t = performance.now() * 0.004;
        const pulseR = 10 + Math.sin(t) * 2;
        const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, pulseR);
        grad.addColorStop(0, "#fecaca");
        grad.addColorStop(0.5, "#ef4444");
        grad.addColorStop(1, "#991b1b");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(c.x, c.y, pulseR, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px system-ui";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("P", c.x, c.y + 1);
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.restore();
      });
    };

    /* ─── 描画: パワーアップゲージ（画面下部） ─── */
    const drawPowerGauge = () => {
      const gaugeY = HEIGHT - 34;
      const gaugeH = 24;
      const cellW = 92;
      const totalW = cellW * POWER_LABELS.length;
      const startX = (WIDTH - totalW) / 2;

      ctx.fillStyle = "rgba(0,0,0,0.7)";
      const rr = 4;
      ctx.beginPath();
      ctx.moveTo(startX - 6 + rr, gaugeY - 4);
      ctx.arcTo(startX + totalW + 6, gaugeY - 4, startX + totalW + 6, gaugeY + gaugeH + 4, rr);
      ctx.arcTo(startX + totalW + 6, gaugeY + gaugeH + 4, startX - 6, gaugeY + gaugeH + 4, rr);
      ctx.arcTo(startX - 6, gaugeY + gaugeH + 4, startX - 6, gaugeY - 4, rr);
      ctx.arcTo(startX - 6, gaugeY - 4, startX + totalW + 6, gaugeY - 4, rr);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = "rgba(148,163,184,0.25)";
      ctx.lineWidth = 1;
      ctx.stroke();

      POWER_LABELS.forEach((label, i) => {
        const x = startX + i * cellW;
        const isActive = i === powerGauge;
        const isOwned =
          (label === "SPEED UP" && player.speedLevel > 0) ||
          (label === "MISSILE" && player.hasMissile) ||
          (label === "DOUBLE" && player.hasDouble) ||
          (label === "LASER" && player.hasLaser) ||
          (label === "OPTION" && options.length > 0) ||
          (label === "SHIELD" && player.hasShield);

        if (isActive) {
          const pulse = 0.5 + Math.sin(performance.now() * 0.006) * 0.2;
          ctx.fillStyle = `rgba(251,146,60,${pulse})`;
          ctx.fillRect(x + 1, gaugeY, cellW - 3, gaugeH);
          ctx.strokeStyle = "#fb923c";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(x + 1, gaugeY, cellW - 3, gaugeH);
        } else if (isOwned) {
          ctx.fillStyle = "rgba(34,197,94,0.18)";
          ctx.fillRect(x + 1, gaugeY, cellW - 3, gaugeH);
        }

        ctx.strokeStyle = "rgba(148,163,184,0.15)";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x + 1, gaugeY, cellW - 3, gaugeH);

        ctx.fillStyle = isActive ? "#fff" : isOwned ? "#86efac" : "#64748b";
        ctx.font = isActive ? "bold 11px 'Courier New', monospace" : "11px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, x + (cellW - 2) / 2, gaugeY + gaugeH / 2);
      });

      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    };

    /* ─── 描画: HUD ─── */
    const drawHud = () => {
      const hudGrad = ctx.createLinearGradient(0, 0, 0, 52);
      hudGrad.addColorStop(0, "rgba(0,0,0,0.6)");
      hudGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = hudGrad;
      ctx.fillRect(0, 0, WIDTH, 52);

      // SCORE
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillText("SCORE", 16, 16);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.fillText(String(localScore).padStart(8, "0"), 16, 38);

      // HIGH SCORE
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillText("HIGH SCORE", 190, 16);
      ctx.fillStyle = "#fde68a";
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.fillText(String(Math.max(highScore, localScore)).padStart(8, "0"), 190, 38);

      // SHIPS
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillText("SHIPS", 400, 16);
      for (let i = 0; i < localLives; i++) {
        const lx = 402 + i * 22;
        const ly = 32;
        ctx.fillStyle = "#0ea5e9";
        ctx.beginPath();
        ctx.moveTo(lx + 9, ly);
        ctx.lineTo(lx - 3, ly - 5);
        ctx.lineTo(lx - 3, ly + 5);
        ctx.closePath();
        ctx.fill();
      }

      // STATUS
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px 'Courier New', monospace";
      ctx.fillText("STATUS", 540, 16);
      const statusParts: string[] = [];
      if (player.speedLevel > 0) statusParts.push(`SPD×${player.speedLevel}`);
      if (player.hasMissile) statusParts.push("MSL");
      if (player.hasDouble) statusParts.push("DBL");
      if (player.hasLaser) statusParts.push("LSR");
      if (options.length > 0) statusParts.push(`OPT×${options.length}`);
      if (player.hasShield) statusParts.push(`SLD(${player.shieldHp})`);
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 12px 'Courier New', monospace";
      ctx.fillText(statusParts.length ? statusParts.join(" ") : "---", 540, 34);

      // WAVE
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 11px 'Courier New', monospace";
      const waveNum = Math.floor(spawnWave / 30) + 1;
      ctx.fillText("WAVE", WIDTH - 100, 16);
      ctx.fillStyle = "#c4b5fd";
      ctx.font = "bold 20px 'Courier New', monospace";
      ctx.fillText(String(waveNum).padStart(3, "0"), WIDTH - 100, 38);

      // パワーゲージ
      drawPowerGauge();

      // 開始タイトル
      if (titleAlpha > 0) {
        ctx.globalAlpha = Math.max(0, titleAlpha);
        ctx.save();
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 30;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 36px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("G R A D I U S", WIDTH / 2, HEIGHT / 2 - 70);
        ctx.restore();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("ARROW / WASD: 移動   SPACE / Z: 攻撃   ENTER: パワーアップ選択", WIDTH / 2, HEIGHT / 2 - 36);
        ctx.fillText("赤い敵を倒してカプセルを集め、ゲージを進めよう！", WIDTH / 2, HEIGHT / 2 - 14);
        ctx.textAlign = "left";
        ctx.globalAlpha = 1;
      }

      // GAME OVER
      if (isGameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.75)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        const goGrad = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 0, WIDTH / 2, HEIGHT / 2, 320);
        goGrad.addColorStop(0, "rgba(220,38,38,0.1)");
        goGrad.addColorStop(1, "transparent");
        ctx.fillStyle = goGrad;
        ctx.fillRect(0, 0, WIDTH, HEIGHT);

        ctx.save();
        ctx.shadowColor = "#ef4444";
        ctx.shadowBlur = 40;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 52px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 30);
        ctx.restore();

        ctx.fillStyle = "#fde68a";
        ctx.font = "bold 22px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText(`SCORE  ${String(localScore).padStart(8, "0")}`, WIDTH / 2, HEIGHT / 2 + 14);

        ctx.fillStyle = "#94a3b8";
        ctx.font = "15px system-ui";
        ctx.fillText("Enter キーでリスタート", WIDTH / 2, HEIGHT / 2 + 52);
        ctx.textAlign = "left";
      }

      // PAUSE
      if (pauseRef.current && !isGameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.save();
        ctx.shadowColor = "#22d3ee";
        ctx.shadowBlur = 20;
        ctx.fillStyle = "#fff";
        ctx.font = "bold 40px 'Courier New', monospace";
        ctx.textAlign = "center";
        ctx.fillText("P A U S E D", WIDTH / 2, HEIGHT / 2 - 6);
        ctx.restore();
        ctx.fillStyle = "#94a3b8";
        ctx.font = "15px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("P / ESC で再開", WIDTH / 2, HEIGHT / 2 + 32);
        ctx.textAlign = "left";
      }
    };

    /* ─── 敵スポーン ─── */
    const spawnEnemy = () => {
      spawnWave++;
      const wave = Math.floor(spawnWave / 30) + 1;

      if (spawnWave % 5 === 0) {
        enemies.push({
          x: WIDTH + 12, y: 30 + Math.random() * (HEIGHT - 100),
          vx: -(100 + Math.random() * 120), vy: (Math.random() - 0.5) * 60,
          radius: 12, hp: 1, maxHp: 1, kind: "capsule",
        });
        return;
      }
      if (spawnWave % 50 === 0) {
        const radius = 32 + wave * 3;
        enemies.push({
          x: WIDTH + radius, y: HEIGHT / 2,
          vx: -35, vy: 55,
          radius, hp: 18 + wave * 5, maxHp: 18 + wave * 5, kind: "boss", shootTimer: 0,
        });
        return;
      }

      const isBig = Math.random() < 0.22 + wave * 0.02;
      const radius = isBig ? 15 + Math.random() * 8 : 8 + Math.random() * 6;
      enemies.push({
        x: WIDTH + radius,
        y: 30 + Math.random() * (HEIGHT - 100),
        vx: -(100 + Math.random() * 140 + wave * 12),
        vy: (Math.random() - 0.5) * (60 + wave * 10),
        radius, hp: isBig ? 2 + Math.floor(wave / 3) : 1,
        maxHp: isBig ? 2 + Math.floor(wave / 3) : 1,
        kind: isBig ? "big" : "normal",
        shootTimer: isBig ? Math.random() * 2.5 : undefined,
      });
    };

    /* ─── メインループ ─── */
    const loop = (now: number) => {
      const dt = Math.min((now - prev) / 1000, 0.033);
      prev = now;

      if (pauseRef.current) {
        drawHud();
        raf = requestAnimationFrame(loop);
        return;
      }

      if (titleAlpha > 0) titleAlpha -= dt * 0.35;

      // 背景
      ctx.fillStyle = "#030712";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // グリッド
      ctx.strokeStyle = "rgba(148,163,184,0.03)";
      ctx.lineWidth = 1;
      for (let gx = 0; gx < WIDTH; gx += 80) {
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, HEIGHT); ctx.stroke();
      }
      for (let gy = 0; gy < HEIGHT; gy += 80) {
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(WIDTH, gy); ctx.stroke();
      }

      // スクリーンシェイク
      if (screenShake > 0) {
        ctx.save();
        ctx.translate((Math.random() - 0.5) * screenShake * 6, (Math.random() - 0.5) * screenShake * 6);
        screenShake = Math.max(0, screenShake - dt * 4);
      }

      // 星
      stars.forEach((star) => {
        star.x -= star.speed * dt;
        if (star.x < -star.size) { star.x = WIDTH + star.size; star.y = Math.random() * HEIGHT; }
        ctx.fillStyle = star.color;
        ctx.globalAlpha = Math.min(1, 0.15 + star.size / 3);
        ctx.fillRect(star.x, star.y, star.size, star.size);
      });
      ctx.globalAlpha = 1;

      if (!isGameOver) {
        // 移動
        const speed = BASE_SPEED + player.speedLevel * SPEED_INCREMENT;
        if (keys.has("arrowup") || keys.has("w")) player.y -= speed * dt;
        if (keys.has("arrowdown") || keys.has("s")) player.y += speed * dt;
        if (keys.has("arrowleft") || keys.has("a")) player.x -= speed * dt;
        if (keys.has("arrowright") || keys.has("d")) player.x += speed * dt;
        player.x = Math.max(18, Math.min(WIDTH - 18, player.x));
        player.y = Math.max(18, Math.min(HEIGHT - 50, player.y));

        // オプション追尾
        options.forEach((opt, idx) => {
          opt.trail.unshift({ x: player.x, y: player.y });
          const maxLen = OPTION_TRAIL_LEN * (idx + 1);
          if (opt.trail.length > maxLen) opt.trail.length = maxLen;
          const target = opt.trail[opt.trail.length - 1] || { x: player.x - 30, y: player.y };
          opt.x = target.x;
          opt.y = target.y;
        });

        // 射撃
        player.shootCooldown -= dt;
        if ((keys.has(" ") || keys.has("z")) && player.shootCooldown <= 0) {
          firePlayerBullet(player.x, player.y);
          options.forEach((opt) => firePlayerBullet(opt.x, opt.y));
          player.shootCooldown = player.hasLaser ? 0.07 : 0.12;
        }

        player.invincible = Math.max(0, player.invincible - dt);

        // 敵スポーン
        enemySpawnTimer += dt;
        const interval = Math.max(0.3, ENEMY_SPAWN_INTERVAL - spawnWave * 0.003);
        if (enemySpawnTimer >= interval) { enemySpawnTimer = 0; spawnEnemy(); }

        // 弾更新
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.x > WIDTH + 30 || b.y < -20 || b.y > HEIGHT + 20) bullets.splice(i, 1);
        }

        // 敵弾更新
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
          const eb = enemyBullets[i];
          eb.x += eb.vx * dt;
          eb.y += eb.vy * dt;
          if (eb.x < -10 || eb.x > WIDTH + 10 || eb.y < -10 || eb.y > HEIGHT + 10) {
            enemyBullets.splice(i, 1); continue;
          }
          if (player.invincible <= 0) {
            if (dist2(player.x, player.y, eb.x, eb.y) <= (eb.radius + 10) ** 2) {
              enemyBullets.splice(i, 1);
              if (player.hasShield && player.shieldHp > 0) {
                player.shieldHp--;
                if (player.shieldHp <= 0) player.hasShield = false;
                screenShake = 0.3;
              } else {
                localLives--; setLives(localLives);
                player.invincible = 2; screenShake = 1;
                spawnParticles(player.x, player.y, 15, "#60a5fa");
                if (localLives <= 0) { isGameOver = true; setGameOver(true); }
              }
            }
          }
        }

        // 敵更新
        for (let i = enemies.length - 1; i >= 0; i--) {
          const e = enemies[i];
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.y < e.radius + 52 || e.y > HEIGHT - e.radius - 40) e.vy *= -1;
          if (e.x < -e.radius - 40) { enemies.splice(i, 1); continue; }

          // 敵射撃
          if (e.shootTimer !== undefined) {
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
              e.shootTimer = e.kind === "boss" ? 0.55 : 2.2;
              const angle = Math.atan2(player.y - e.y, player.x - e.x);
              const spd = 170 + Math.floor(spawnWave / 30) * 18;
              enemyBullets.push({ x: e.x - e.radius, y: e.y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd, radius: e.kind === "boss" ? 5 : 3 });
              if (e.kind === "boss") {
                enemyBullets.push({ x: e.x - e.radius, y: e.y, vx: Math.cos(angle + 0.18) * spd, vy: Math.sin(angle + 0.18) * spd, radius: 4 });
                enemyBullets.push({ x: e.x - e.radius, y: e.y, vx: Math.cos(angle - 0.18) * spd, vy: Math.sin(angle - 0.18) * spd, radius: 4 });
              }
            }
          }

          // 弾 vs 敵
          for (let b = bullets.length - 1; b >= 0; b--) {
            const bullet = bullets[b];
            const r = bullet.radius + e.radius;
            if (dist2(bullet.x, bullet.y, e.x, e.y) <= r * r) {
              if (!bullet.isLaser) bullets.splice(b, 1);
              else if (Math.random() < 0.25) bullets.splice(b, 1);
              e.hp--;
              spawnParticles(bullet.x, bullet.y, 4, "#fde68a", 80);
              if (e.hp <= 0) {
                enemies.splice(i, 1);
                const pts = e.kind === "boss" ? 2000 : e.kind === "big" ? 200 : 100;
                localScore += pts; setScore(localScore);
                const col = e.kind === "capsule" ? "#f87171" : e.kind === "boss" ? "#ef4444" : "#f97316";
                spawnParticles(e.x, e.y, e.kind === "boss" ? 45 : 14, col);
                if (e.kind === "boss") { screenShake = 1.5; spawnParticles(e.x, e.y, 30, "#fde68a", 300); }
                if (e.kind === "capsule") capsules.push({ x: e.x, y: e.y, vx: -55 });
              }
              break;
            }
          }

          if (i >= enemies.length) continue;

          // プレイヤー vs 敵
          if (player.invincible <= 0 && dist2(player.x, player.y, e.x, e.y) <= (e.radius + 11) ** 2) {
            enemies.splice(i, 1);
            if (player.hasShield && player.shieldHp > 0) {
              player.shieldHp--;
              if (player.shieldHp <= 0) player.hasShield = false;
              screenShake = 0.4;
            } else {
              localLives--; setLives(localLives);
              player.invincible = 2; screenShake = 1;
              spawnParticles(player.x, player.y, 20, "#60a5fa");
              if (localLives <= 0) { isGameOver = true; setGameOver(true); }
            }
          }
        }

        // カプセル
        for (let i = capsules.length - 1; i >= 0; i--) {
          const c = capsules[i];
          c.x += c.vx * dt;
          if (c.x < -15) { capsules.splice(i, 1); continue; }
          if (dist2(player.x, player.y, c.x, c.y) <= 22 ** 2) {
            capsules.splice(i, 1);
            powerGauge = (powerGauge + 1) % POWER_LABELS.length;
            spawnParticles(c.x, c.y, 10, "#ef4444", 100);
          }
        }
      }

      // パーティクル
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) particles.splice(i, 1);
      }

      // 描画順序
      drawParticles();
      drawCapsules();
      enemies.forEach(drawEnemy);
      drawBullets();
      options.forEach(drawOption);
      drawPlayer();
      drawHud();

      if (screenShake > 0) ctx.restore();
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
  }, [togglePause]);

  return (
    <main className="min-h-screen bg-gray-950 text-slate-100 flex flex-col items-center justify-center p-4 selection:bg-cyan-500/30">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 mb-3">
        <div className="text-3xl">🚀</div>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-[0.25em] bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 bg-clip-text text-transparent">
            GRADIUS
          </h1>
          <p className="text-[10px] text-slate-500 tracking-wider font-mono">
            HORIZONTAL SHOOTING — NEXT.JS EDITION
          </p>
        </div>
      </div>

      {/* 操作説明 */}
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 mb-3 text-xs">
        <KbdGroup label="移動" keys={["↑","↓","←","→"]} alt="WASD" />
        <KbdGroup label="攻撃" keys={["Space"]} alt="Z" />
        <KbdGroup label="パワーアップ" keys={["Enter"]} />
        <KbdGroup label="ポーズ" keys={["P"]} alt="ESC" />
      </div>

      {/* キャンバス */}
      <div className="relative w-full max-w-[980px] rounded-xl overflow-hidden border border-cyan-400/15 shadow-[0_0_60px_rgba(34,211,238,0.08),_0_0_120px_rgba(34,211,238,0.03)]">
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-40"
          style={{
            background:
              "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.04) 2px, rgba(0,0,0,0.04) 4px)",
          }}
        />
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-auto bg-gray-950 block"
          tabIndex={0}
        />
      </div>

      {/* パワーアップ説明 */}
      <div className="mt-3 grid grid-cols-3 md:grid-cols-6 gap-1.5 max-w-[660px] w-full">
        {POWER_LABELS.map((label) => (
          <div
            key={label}
            className="flex flex-col items-center rounded-lg border border-slate-800/60 bg-slate-900/50 px-1.5 py-1.5 text-center backdrop-blur-sm"
          >
            <span className="text-[10px] font-bold text-slate-400 font-mono">{label}</span>
            <span className="text-[9px] text-slate-600 mt-0.5">{powerDesc(label)}</span>
          </div>
        ))}
      </div>

      {/* ステータス */}
      <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
        <span>SCORE: <span className="text-white font-mono">{String(score).padStart(8, "0")}</span></span>
        <span>SHIPS: <span className="text-cyan-400 font-mono">{lives}</span></span>
        {gameOver && (
          <span className="text-amber-400 animate-pulse font-medium">Enter キーで再スタート</span>
        )}
        {isPaused && (
          <span className="text-cyan-400 font-medium">— PAUSED —</span>
        )}
      </div>

      <Link
        href="/"
        className="mt-3 text-sm text-cyan-400/70 hover:text-cyan-300 transition-colors underline underline-offset-4"
      >
        ← トップへ戻る
      </Link>
    </main>
  );
}

/* ─── 小コンポーネント ─── */
function KbdGroup({ label, keys, alt }: { label: string; keys: string[]; alt?: string }) {
  return (
    <span className="flex items-center gap-1 text-slate-400">
      <span className="text-slate-500 text-[11px]">{label}:</span>
      {keys.map((k) => (
        <kbd
          key={k}
          className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700/60 text-[10px] font-mono text-slate-300 shadow-sm"
        >
          {k}
        </kbd>
      ))}
      {alt && <span className="text-slate-600 text-[10px]">/ {alt}</span>}
    </span>
  );
}

function powerDesc(label: PowerLabel): string {
  switch (label) {
    case "SPEED UP": return "速度+";
    case "MISSILE": return "下方ミサイル";
    case "DOUBLE": return "斜め2連射";
    case "LASER": return "貫通レーザー";
    case "OPTION": return "追従ユニット";
    case "SHIELD": return "バリア(3回)";
  }
}
