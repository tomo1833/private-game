"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

/* ─── 定数 ─── */
const WIDTH = 960;
const HEIGHT = 540;
const GROUND_Y = 420;
const TRACK_TOP = 300;
const TRACK_BOTTOM = 460;

/* ─── 種目 ─── */
type EventType = "100m" | "longjump" | "javelin";
type GamePhase = "menu" | "ready" | "running" | "result";

/* ─── ランナーのアニメーションフレーム ─── */
const RUNNER_COLORS = {
  body: "#e04040",
  skin: "#f5c8a0",
  shorts: "#2050c0",
  shoes: "#ffffff",
};

/* ════════════════════════════════════════
   メインコンポーネント
   ════════════════════════════════════════ */
export default function HyperOlympicsPage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentEvent, setCurrentEvent] = useState<EventType | null>(null);
  const [phase, setPhase] = useState<GamePhase>("menu");
  const [resultText, setResultText] = useState("");
  const [bestRecords, setBestRecords] = useState<Record<EventType, string>>({
    "100m": "--",
    longjump: "--",
    javelin: "--",
  });

  /* ─── ゲームステート (ref) ─── */
  const gameRef = useRef<{
    speed: number;
    distance: number;
    time: number;
    countdown: number;
    phase: GamePhase;
    animFrame: number;
    // 100m用
    playerX: number;
    cameraX: number;
    finishX: number;
    raceTime: number;
    lastTapTime: number;
    tapCount: number;
    speedDecay: number;
    // 幅跳び用
    jumpPhase: "run" | "jump" | "land";
    jumpAngle: number;
    jumpAngleDir: number;
    jumpVx: number;
    jumpVy: number;
    jumpY: number;
    jumpX: number;
    jumpStartX: number;
    jumpDistance: number;
    jumpHeight: number;
    foul: boolean;
    attempt: number;
    bestJump: number;
    landX: number;
    // やり投げ用
    throwPhase: "run" | "angle" | "throw" | "land";
    throwAngle: number;
    throwAngleDir: number;
    throwPower: number;
    javelinX: number;
    javelinY: number;
    javelinVx: number;
    javelinVy: number;
    throwDistance: number;
    throwAttempt: number;
    bestThrow: number;
    // 汎用
    keys: Set<string>;
    particles: { x: number; y: number; vx: number; vy: number; life: number; color: string }[];
    bgOffset: number;
    crowdWave: number;
    falseStart: boolean;
    powerMeter: number;
    powerDir: number;
    showAngleGuide: boolean;
  }>({
    speed: 0, distance: 0, time: 0, countdown: 3, phase: "menu",
    animFrame: 0, playerX: 80, cameraX: 0, finishX: 5000,
    raceTime: 0, lastTapTime: 0, tapCount: 0, speedDecay: 0,
    jumpPhase: "run", jumpAngle: 45, jumpAngleDir: 1,
    jumpVx: 0, jumpVy: 0, jumpY: 0, jumpX: 0, jumpStartX: 0,
    jumpDistance: 0, jumpHeight: 0, foul: false, attempt: 0, bestJump: 0, landX: 0,
    throwPhase: "run", throwAngle: 45, throwAngleDir: 1, throwPower: 0,
    javelinX: 0, javelinY: 0, javelinVx: 0, javelinVy: 0,
    throwDistance: 0, throwAttempt: 0, bestThrow: 0,
    keys: new Set(), particles: [], bgOffset: 0, crowdWave: 0,
    falseStart: false, powerMeter: 0, powerDir: 1, showAngleGuide: false,
  });

  const resetGame = useCallback((evt: EventType) => {
    const g = gameRef.current;
    g.speed = 0; g.distance = 0; g.time = 0; g.countdown = 3;
    g.phase = "ready"; g.animFrame = 0; g.playerX = 80;
    g.cameraX = 0; g.finishX = 5000; g.raceTime = 0;
    g.lastTapTime = 0; g.tapCount = 0; g.speedDecay = 0;
    g.jumpPhase = "run"; g.jumpAngle = 45; g.jumpAngleDir = 1;
    g.jumpVx = 0; g.jumpVy = 0; g.jumpY = 0; g.jumpX = 0;
    g.jumpStartX = 0; g.jumpDistance = 0; g.jumpHeight = 0;
    g.foul = false; g.attempt = 0; g.bestJump = 0; g.landX = 0;
    g.throwPhase = "run"; g.throwAngle = 45; g.throwAngleDir = 1;
    g.throwPower = 0; g.javelinX = 0; g.javelinY = 0;
    g.javelinVx = 0; g.javelinVy = 0; g.throwDistance = 0;
    g.throwAttempt = 0; g.bestThrow = 0;
    g.particles = []; g.bgOffset = 0; g.crowdWave = 0;
    g.falseStart = false; g.powerMeter = 0; g.powerDir = 1;
    g.showAngleGuide = false;
    setCurrentEvent(evt);
    setPhase("ready");
    setResultText("");
  }, []);

  /* ─── メインゲームループ ─── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const g = gameRef.current;

    let animId = 0;
    let lastTime = performance.now();

    /* キー入力 */
    const onKeyDown = (e: KeyboardEvent) => {
      g.keys.add(e.key);

      if (g.phase === "running") {
        // 連打検出 (Z, X, ←, →)
        if (["z", "x", "Z", "X", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          const now = performance.now();
          if (now - g.lastTapTime > 50) { // デバウンス
            g.tapCount++;
            g.lastTapTime = now;

            if (currentEvent === "100m") {
              g.speed = Math.min(g.speed + 35, 800);
            } else if (currentEvent === "longjump") {
              if (g.jumpPhase === "run") {
                g.speed = Math.min(g.speed + 35, 700);
              }
            } else if (currentEvent === "javelin") {
              if (g.throwPhase === "run") {
                g.speed = Math.min(g.speed + 35, 700);
              }
            }
          }
        }

        // スペースキーでアクション
        if (e.key === " " || e.key === "Space") {
          e.preventDefault();
          if (currentEvent === "longjump" && g.jumpPhase === "run" && g.speed > 100) {
            // ジャンプ開始 → 角度決定モード
            g.jumpPhase = "jump";
            g.showAngleGuide = true;
            g.jumpAngle = 10;
            g.jumpAngleDir = 1;
          } else if (currentEvent === "longjump" && g.jumpPhase === "jump" && g.showAngleGuide) {
            // 角度確定 → 飛ぶ
            g.showAngleGuide = false;
            const rad = (g.jumpAngle * Math.PI) / 180;
            const power = g.speed * 1.2;
            g.jumpVx = Math.cos(rad) * power;
            g.jumpVy = -Math.sin(rad) * power;
            g.jumpStartX = g.playerX;
            g.jumpY = 0;
            g.jumpHeight = 0;

            // ファール判定 (踏切線超え)
            if (g.distance > 380) {
              g.foul = true;
            }
          } else if (currentEvent === "javelin" && g.throwPhase === "run" && g.speed > 100) {
            g.throwPhase = "angle";
            g.showAngleGuide = true;
            g.throwAngle = 10;
            g.throwAngleDir = 1;
          } else if (currentEvent === "javelin" && g.throwPhase === "angle" && g.showAngleGuide) {
            g.showAngleGuide = false;
            g.throwPhase = "throw";
            const rad = (g.throwAngle * Math.PI) / 180;
            const power = g.speed * 1.5;
            g.javelinX = g.playerX + 30;
            g.javelinY = GROUND_Y - 60;
            g.javelinVx = Math.cos(rad) * power;
            g.javelinVy = -Math.sin(rad) * power;
          }
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => { g.keys.delete(e.key); };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    /* ── 描画ヘルパー ── */
    const drawRunner = (x: number, y: number, frame: number, scale: number = 1) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);
      const bob = Math.sin(frame * 0.5) * 3;
      const legAngle = Math.sin(frame * 0.5) * 0.6;
      const armAngle = Math.sin(frame * 0.5 + Math.PI) * 0.5;

      // 足
      ctx.strokeStyle = RUNNER_COLORS.skin;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(Math.sin(legAngle) * 15, 20);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(Math.sin(-legAngle) * 15, 20);
      ctx.stroke();

      // 靴
      ctx.fillStyle = RUNNER_COLORS.shoes;
      ctx.fillRect(Math.sin(legAngle) * 15 - 4, 18, 8, 4);
      ctx.fillRect(Math.sin(-legAngle) * 15 - 4, 18, 8, 4);

      // 体
      ctx.fillStyle = RUNNER_COLORS.body;
      ctx.fillRect(-8, -30 + bob, 16, 22);

      // ショーツ
      ctx.fillStyle = RUNNER_COLORS.shorts;
      ctx.fillRect(-8, -12 + bob, 16, 6);

      // 腕
      ctx.strokeStyle = RUNNER_COLORS.skin;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, -24 + bob);
      ctx.lineTo(-8 + Math.sin(armAngle) * 14, -10 + bob);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(8, -24 + bob);
      ctx.lineTo(8 + Math.sin(-armAngle) * 14, -10 + bob);
      ctx.stroke();

      // 頭
      ctx.fillStyle = RUNNER_COLORS.skin;
      ctx.beginPath();
      ctx.arc(0, -38 + bob, 8, 0, Math.PI * 2);
      ctx.fill();

      // 髪
      ctx.fillStyle = "#333";
      ctx.beginPath();
      ctx.arc(0, -41 + bob, 8, Math.PI, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    };

    const drawTrack = (cameraX: number) => {
      // 空
      const skyGrad = ctx.createLinearGradient(0, 0, 0, TRACK_TOP);
      skyGrad.addColorStop(0, "#1a237e");
      skyGrad.addColorStop(1, "#4fc3f7");
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, WIDTH, TRACK_TOP);

      // 観客席
      ctx.fillStyle = "#546e7a";
      ctx.fillRect(0, TRACK_TOP - 60, WIDTH, 60);
      drawCrowd(cameraX);

      // トラック
      ctx.fillStyle = "#d84315";
      ctx.fillRect(0, TRACK_TOP, WIDTH, TRACK_BOTTOM - TRACK_TOP);

      // レーン線
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      for (let i = 0; i <= 4; i++) {
        const ly = TRACK_TOP + i * ((TRACK_BOTTOM - TRACK_TOP) / 4);
        ctx.beginPath();
        ctx.moveTo(0, ly);
        ctx.lineTo(WIDTH, ly);
        ctx.stroke();
      }

      // 距離マーカー
      ctx.fillStyle = "#fff";
      ctx.font = "bold 14px monospace";
      for (let m = 0; m <= 100; m += 10) {
        const mx = (m / 100) * 5000 - cameraX;
        if (mx > -50 && mx < WIDTH + 50) {
          ctx.fillText(`${m}m`, mx, TRACK_TOP - 5);
          ctx.strokeStyle = "#ffffff88";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(mx, TRACK_TOP);
          ctx.lineTo(mx, TRACK_BOTTOM);
          ctx.stroke();
        }
      }

      // 地面
      ctx.fillStyle = "#2e7d32";
      ctx.fillRect(0, TRACK_BOTTOM, WIDTH, HEIGHT - TRACK_BOTTOM);

      // 芝模様
      ctx.fillStyle = "#388e3c";
      for (let i = 0; i < 40; i++) {
        const gx = ((i * 47 + cameraX * 0.5) % WIDTH);
        ctx.fillRect(gx, TRACK_BOTTOM + 5, 2, 8);
      }
    };

    const drawCrowd = (cameraX: number) => {
      const crowdY = TRACK_TOP - 55;
      for (let i = 0; i < 60; i++) {
        const cx = ((i * 18 - cameraX * 0.3) % (WIDTH + 40)) - 20;
        const wave = Math.sin(g.crowdWave + i * 0.5) * 4;
        const colors = ["#e57373", "#64b5f6", "#fff176", "#81c784", "#ce93d8", "#ffb74d"];
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(cx, crowdY + wave, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#555";
        ctx.fillRect(cx - 3, crowdY + wave + 5, 6, 10);
      }
    };

    const drawSandPit = (cameraX: number, startPos: number) => {
      const sx = startPos - cameraX;
      // 踏切板
      ctx.fillStyle = "#fff";
      ctx.fillRect(sx - 10, TRACK_TOP + 50, 10, TRACK_BOTTOM - TRACK_TOP - 100);

      // 砂場
      ctx.fillStyle = "#f9a825";
      ctx.fillRect(sx + 5, TRACK_TOP + 30, 250, TRACK_BOTTOM - TRACK_TOP - 60);
      ctx.strokeStyle = "#f57f17";
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 5, TRACK_TOP + 30, 250, TRACK_BOTTOM - TRACK_TOP - 60);

      // 砂の模様
      ctx.fillStyle = "#fbc02d";
      for (let i = 0; i < 20; i++) {
        const dotX = sx + 10 + (i * 37 % 240);
        const dotY = TRACK_TOP + 40 + (i * 23 % (TRACK_BOTTOM - TRACK_TOP - 80));
        ctx.beginPath();
        ctx.arc(dotX, dotY, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const drawAngleGuide = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);

      // 角度扇形
      ctx.fillStyle = "rgba(255, 255, 0, 0.2)";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, 80, -Math.PI / 2, 0);
      ctx.closePath();
      ctx.fill();

      // 現在角度の線
      const rad = (-angle * Math.PI) / 180;
      ctx.strokeStyle = "#ff0";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(rad) * 80, Math.sin(rad) * 80);
      ctx.stroke();

      // 角度テキスト
      ctx.fillStyle = "#ff0";
      ctx.font = "bold 20px monospace";
      ctx.fillText(`${Math.round(angle)}°`, 10, -60);

      ctx.restore();
    };

    const drawJavelin = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((-angle * Math.PI) / 180);

      // やり本体
      ctx.strokeStyle = "#ffd54f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-20, 0);
      ctx.lineTo(40, 0);
      ctx.stroke();

      // 先端
      ctx.fillStyle = "#ccc";
      ctx.beginPath();
      ctx.moveTo(40, 0);
      ctx.lineTo(50, -3);
      ctx.lineTo(50, 3);
      ctx.closePath();
      ctx.fill();

      // グリップ
      ctx.fillStyle = "#8d6e63";
      ctx.fillRect(5, -2, 10, 4);

      ctx.restore();
    };

    const addParticles = (x: number, y: number, count: number, color: string) => {
      for (let i = 0; i < count; i++) {
        g.particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 200,
          vy: (Math.random() - 1) * 150,
          life: 0.5 + Math.random() * 0.5,
          color,
        });
      }
    };

    const drawParticles = (dt: number) => {
      g.particles = g.particles.filter((p) => {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 300 * dt;
        p.life -= dt;
        if (p.life <= 0) return false;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
        return true;
      });
      ctx.globalAlpha = 1;
    };

    const drawSpeedMeter = (speed: number, maxSpeed: number) => {
      const barW = 200;
      const barH = 16;
      const x = WIDTH - barW - 20;
      const y = 60;
      const ratio = speed / maxSpeed;

      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(x - 2, y - 2, barW + 4, barH + 4);

      const grad = ctx.createLinearGradient(x, y, x + barW, y);
      grad.addColorStop(0, "#4caf50");
      grad.addColorStop(0.5, "#ffeb3b");
      grad.addColorStop(1, "#f44336");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, barW * ratio, barH);

      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, barW, barH);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 12px monospace";
      ctx.fillText("SPEED", x, y - 4);
    };

    const drawHUD = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, 0, WIDTH, 50);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px monospace";

      if (currentEvent === "100m") {
        ctx.fillText(`🏃 100m DASH`, 20, 32);
        ctx.fillText(`TIME: ${g.raceTime.toFixed(2)}s`, WIDTH / 2 - 60, 32);
      } else if (currentEvent === "longjump") {
        ctx.fillText(`🦘 LONG JUMP`, 20, 32);
        ctx.fillText(`ATTEMPT: ${g.attempt + 1}/3`, WIDTH / 2 - 80, 32);
        ctx.fillText(`BEST: ${g.bestJump > 0 ? g.bestJump.toFixed(2) + "m" : "--"}`, WIDTH / 2 + 60, 32);
      } else if (currentEvent === "javelin") {
        ctx.fillText(`🏹 JAVELIN THROW`, 20, 32);
        ctx.fillText(`ATTEMPT: ${g.throwAttempt + 1}/3`, WIDTH / 2 - 80, 32);
        ctx.fillText(`BEST: ${g.bestThrow > 0 ? g.bestThrow.toFixed(2) + "m" : "--"}`, WIDTH / 2 + 60, 32);
      }
    };

    const drawCountdown = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      const count = Math.ceil(g.countdown);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 120px monospace";
      ctx.textAlign = "center";
      if (count > 0) {
        ctx.fillText(`${count}`, WIDTH / 2, HEIGHT / 2 + 30);
      } else {
        ctx.fillStyle = "#ffd700";
        ctx.fillText("GO!", WIDTH / 2, HEIGHT / 2 + 30);
      }
      ctx.textAlign = "left";

      ctx.fillStyle = "#aaa";
      ctx.font = "bold 16px monospace";
      ctx.textAlign = "center";
      ctx.fillText("Z・Xキーを交互に連打して走れ！", WIDTH / 2, HEIGHT / 2 + 80);
      if (currentEvent === "longjump" || currentEvent === "javelin") {
        ctx.fillText("スペースキーでアクション！", WIDTH / 2, HEIGHT / 2 + 105);
      }
      ctx.textAlign = "left";
    };

    const drawMenu = () => {
      // 背景
      const bgGrad = ctx.createLinearGradient(0, 0, 0, HEIGHT);
      bgGrad.addColorStop(0, "#0d47a1");
      bgGrad.addColorStop(1, "#1a237e");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      // 星
      ctx.fillStyle = "#ffffff44";
      for (let i = 0; i < 50; i++) {
        const sx = (i * 73 + g.bgOffset * 0.2) % WIDTH;
        const sy = (i * 47) % (HEIGHT - 100);
        ctx.fillRect(sx, sy, 2, 2);
      }

      // タイトル
      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 52px monospace";
      ctx.textAlign = "center";
      ctx.fillText("HYPER OLYMPICS", WIDTH / 2, 100);

      // 五輪風リング
      const ringColors = ["#0085c7", "#000", "#f4c300", "#009f3d", "#df0024"];
      const ringY = 150;
      const ringSpacing = 50;
      const ringR = 20;
      ringColors.forEach((color, i) => {
        const rx = WIDTH / 2 - ringSpacing * 2 + i * ringSpacing;
        const ry = ringY + (i % 2 === 1 ? 15 : 0);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(rx, ry, ringR, 0, Math.PI * 2);
        ctx.stroke();
      });

      // イベント選択
      const events: { key: EventType; label: string; icon: string; desc: string }[] = [
        { key: "100m", label: "100m DASH", icon: "🏃", desc: "連打で走れ！最速タイムを目指せ！" },
        { key: "longjump", label: "LONG JUMP", icon: "🦘", desc: "走って跳べ！角度が大事！" },
        { key: "javelin", label: "JAVELIN THROW", icon: "🏹", desc: "走って投げろ！遠くへ飛ばせ！" },
      ];

      events.forEach((evt, i) => {
        const bx = WIDTH / 2 - 180;
        const by = 210 + i * 90;
        const bw = 360;
        const bh = 70;

        // ホバー演出
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 2;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 24px monospace";
        ctx.fillText(`${evt.icon} ${evt.label}`, WIDTH / 2, by + 30);

        ctx.fillStyle = "#aaa";
        ctx.font = "14px monospace";
        ctx.fillText(evt.desc, WIDTH / 2, by + 55);

        // ベスト記録
        const rec = bestRecords[evt.key];
        if (rec !== "--") {
          ctx.fillStyle = "#ffd700";
          ctx.font = "bold 12px monospace";
          ctx.fillText(`BEST: ${rec}`, WIDTH / 2 + 140, by + 30);
        }
      });

      ctx.fillStyle = "#888";
      ctx.font = "14px monospace";
      ctx.fillText("1・2・3 キーで種目を選択", WIDTH / 2, HEIGHT - 40);
      ctx.textAlign = "left";
    };

    const drawResult = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = "#ffd700";
      ctx.font = "bold 48px monospace";
      ctx.textAlign = "center";
      ctx.fillText("RESULT", WIDTH / 2, 160);

      ctx.fillStyle = "#fff";
      ctx.font = "bold 36px monospace";
      ctx.fillText(resultText, WIDTH / 2, 250);

      // ベスト記録表示
      ctx.fillStyle = "#aaa";
      ctx.font = "18px monospace";
      ctx.fillText("ベスト記録", WIDTH / 2, 310);
      if (currentEvent) {
        ctx.fillStyle = "#ffd700";
        ctx.font = "bold 24px monospace";
        ctx.fillText(bestRecords[currentEvent], WIDTH / 2, 345);
      }

      ctx.fillStyle = "#888";
      ctx.font = "16px monospace";
      ctx.fillText("ENTER: リトライ / ESC: メニューに戻る", WIDTH / 2, HEIGHT - 60);
      ctx.textAlign = "left";
    };

    /* ── メニューキー処理 ── */
    const handleMenuKeys = () => {
      if (g.keys.has("1")) {
        g.keys.delete("1");
        resetGame("100m");
      } else if (g.keys.has("2")) {
        g.keys.delete("2");
        resetGame("longjump");
      } else if (g.keys.has("3")) {
        g.keys.delete("3");
        resetGame("javelin");
      }
    };

    const handleResultKeys = () => {
      if (g.keys.has("Enter")) {
        g.keys.delete("Enter");
        if (currentEvent) resetGame(currentEvent);
      } else if (g.keys.has("Escape")) {
        g.keys.delete("Escape");
        g.phase = "menu";
        setPhase("menu");
        setCurrentEvent(null);
      }
    };

    /* ══ ゲームループ ══ */
    const loop = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      g.bgOffset += dt * 20;
      g.crowdWave += dt * 3;

      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      if (g.phase === "menu" || !currentEvent) {
        drawMenu();
        handleMenuKeys();
        animId = requestAnimationFrame(loop);
        return;
      }

      if (g.phase === "result") {
        drawTrack(g.cameraX);
        drawResult();
        handleResultKeys();
        animId = requestAnimationFrame(loop);
        return;
      }

      /* ─── カウントダウン ─── */
      if (g.phase === "ready") {
        g.countdown -= dt;
        drawTrack(0);
        if (currentEvent === "longjump") {
          drawSandPit(0, 400);
        }
        drawRunner(80, GROUND_Y, 0);
        drawHUD();
        drawCountdown();

        if (g.countdown <= -0.5) {
          g.phase = "running";
          setPhase("running");
          g.raceTime = 0;
        }

        animId = requestAnimationFrame(loop);
        return;
      }

      /* ═══════════════════
         100m DASH
         ═══════════════════ */
      if (currentEvent === "100m") {
        g.raceTime += dt;
        g.speed = Math.max(g.speed - 120 * dt, 0); // 減速
        g.playerX += g.speed * dt;
        g.cameraX = Math.max(0, g.playerX - 150);
        g.animFrame += g.speed * dt * 0.02;

        // 足跡パーティクル
        if (g.speed > 200 && Math.random() < 0.3) {
          addParticles(g.playerX - g.cameraX, GROUND_Y + 10, 2, "#d84315");
        }

        drawTrack(g.cameraX);
        drawSpeedMeter(g.speed, 800);
        drawRunner(g.playerX - g.cameraX, GROUND_Y, g.animFrame);

        // ゴール線
        const finishScreenX = g.finishX - g.cameraX;
        if (finishScreenX > -10 && finishScreenX < WIDTH + 10) {
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 4;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(finishScreenX, TRACK_TOP);
          ctx.lineTo(finishScreenX, TRACK_BOTTOM);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = "#ff0";
          ctx.font = "bold 16px monospace";
          ctx.fillText("FINISH", finishScreenX - 25, TRACK_TOP - 10);
        }

        drawHUD();
        drawParticles(dt);

        // ゴール判定
        if (g.playerX >= g.finishX) {
          const timeStr = `${g.raceTime.toFixed(2)} sec`;
          setResultText(timeStr);
          g.phase = "result";
          setPhase("result");

          if (bestRecords["100m"] === "--" || g.raceTime < parseFloat(bestRecords["100m"])) {
            setBestRecords((prev) => ({ ...prev, "100m": g.raceTime.toFixed(2) + " sec" }));
          }

          addParticles(g.playerX - g.cameraX, GROUND_Y - 20, 30, "#ffd700");
        }
      }

      /* ═══════════════════
         LONG JUMP
         ═══════════════════ */
      if (currentEvent === "longjump") {
        const pitStartX = 400;
        
        if (g.jumpPhase === "run") {
          g.speed = Math.max(g.speed - 100 * dt, 0);
          g.playerX += g.speed * dt;
          g.distance += g.speed * dt * 0.1;
          g.cameraX = Math.max(0, g.playerX - 150);
          g.animFrame += g.speed * dt * 0.02;

          if (g.speed > 200 && Math.random() < 0.3) {
            addParticles(g.playerX - g.cameraX, GROUND_Y + 10, 1, "#d84315");
          }
        } else if (g.jumpPhase === "jump") {
          if (g.showAngleGuide) {
            // 角度バーが動いている
            g.jumpAngle += g.jumpAngleDir * 120 * dt;
            if (g.jumpAngle >= 80) g.jumpAngleDir = -1;
            if (g.jumpAngle <= 10) g.jumpAngleDir = 1;
          } else {
            // 飛んでいる
            g.playerX += g.jumpVx * dt;
            g.jumpVy += 600 * dt; // 重力
            g.jumpY += g.jumpVy * dt;
            g.cameraX = Math.max(0, g.playerX - 200);

            if (g.jumpY >= 0 && g.jumpVy > 0) {
              // 着地
              g.jumpPhase = "land";
              g.jumpY = 0;
              g.jumpDistance = (g.playerX - g.jumpStartX) * 0.015;
              g.landX = g.playerX;

              if (!g.foul && g.jumpDistance > g.bestJump) {
                g.bestJump = g.jumpDistance;
              }

              addParticles(g.playerX - g.cameraX, GROUND_Y, 15, "#f9a825");

              // 結果表示タイマー
              setTimeout(() => {
                const gg = gameRef.current;
                gg.attempt++;
                if (gg.attempt >= 3) {
                  // 3回終了
                  const res = gg.bestJump > 0 ? `${gg.bestJump.toFixed(2)} m` : "FOUL";
                  setResultText(res);
                  gg.phase = "result";
                  setPhase("result");
                  if (gg.bestJump > 0) {
                    const recStr = `${gg.bestJump.toFixed(2)} m`;
                    setBestRecords((prev) => {
                      if (prev.longjump === "--" || gg.bestJump > parseFloat(prev.longjump)) {
                        return { ...prev, longjump: recStr };
                      }
                      return prev;
                    });
                  }
                } else {
                  // 次の試技
                  gg.speed = 0;
                  gg.playerX = 80;
                  gg.cameraX = 0;
                  gg.distance = 0;
                  gg.jumpPhase = "run";
                  gg.jumpVx = 0;
                  gg.jumpVy = 0;
                  gg.jumpY = 0;
                  gg.foul = false;
                  gg.showAngleGuide = false;
                  gg.animFrame = 0;
                }
              }, 1500);
            }
          }
        }

        drawTrack(g.cameraX);
        drawSandPit(g.cameraX, pitStartX);
        drawSpeedMeter(g.speed, 700);

        // ランナー描画 (ジャンプ中はY位置を上げる)
        const drawY = g.jumpPhase === "jump" && !g.showAngleGuide
          ? GROUND_Y + g.jumpY * 0.3
          : GROUND_Y;
        drawRunner(g.playerX - g.cameraX, drawY, g.animFrame);

        // 角度ガイド
        if (g.showAngleGuide) {
          drawAngleGuide(g.playerX - g.cameraX, GROUND_Y - 40, g.jumpAngle);
        }

        // ファール表示
        if (g.foul && g.jumpPhase === "land") {
          ctx.fillStyle = "#f44336";
          ctx.font = "bold 48px monospace";
          ctx.textAlign = "center";
          ctx.fillText("FOUL!", WIDTH / 2, HEIGHT / 2 - 50);
          ctx.textAlign = "left";
        }

        // 着地時の距離表示
        if (g.jumpPhase === "land" && !g.foul) {
          ctx.fillStyle = "#ffd700";
          ctx.font = "bold 36px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${g.jumpDistance.toFixed(2)} m`, WIDTH / 2, HEIGHT / 2 - 50);
          ctx.textAlign = "left";
        }

        drawHUD();
        drawParticles(dt);
      }

      /* ═══════════════════
         JAVELIN THROW
         ═══════════════════ */
      if (currentEvent === "javelin") {
        if (g.throwPhase === "run") {
          g.speed = Math.max(g.speed - 100 * dt, 0);
          g.playerX += g.speed * dt;
          g.distance += g.speed * dt * 0.1;
          g.cameraX = Math.max(0, g.playerX - 150);
          g.animFrame += g.speed * dt * 0.02;

          if (g.speed > 200 && Math.random() < 0.3) {
            addParticles(g.playerX - g.cameraX, GROUND_Y + 10, 1, "#d84315");
          }

          // ファールライン
          if (g.distance > 400) {
            g.foul = true;
            g.throwPhase = "land";
            setTimeout(() => {
              const gg = gameRef.current;
              gg.throwAttempt++;
              if (gg.throwAttempt >= 3) {
                const res = gg.bestThrow > 0 ? `${gg.bestThrow.toFixed(2)} m` : "FOUL";
                setResultText(res);
                gg.phase = "result";
                setPhase("result");
                if (gg.bestThrow > 0) {
                  const recStr = `${gg.bestThrow.toFixed(2)} m`;
                  setBestRecords((prev) => {
                    if (prev.javelin === "--" || gg.bestThrow > parseFloat(prev.javelin)) {
                      return { ...prev, javelin: recStr };
                    }
                    return prev;
                  });
                }
              } else {
                gg.speed = 0; gg.playerX = 80; gg.cameraX = 0;
                gg.distance = 0; gg.throwPhase = "run";
                gg.foul = false; gg.showAngleGuide = false;
                gg.javelinX = 0; gg.javelinY = 0;
                gg.animFrame = 0;
              }
            }, 1500);
          }
        } else if (g.throwPhase === "angle") {
          g.throwAngle += g.throwAngleDir * 100 * dt;
          if (g.throwAngle >= 75) g.throwAngleDir = -1;
          if (g.throwAngle <= 10) g.throwAngleDir = 1;
          g.cameraX = Math.max(0, g.playerX - 150);
        } else if (g.throwPhase === "throw") {
          g.javelinX += g.javelinVx * dt;
          g.javelinVy += 400 * dt; // 重力
          g.javelinY += g.javelinVy * dt;
          g.cameraX = Math.max(0, g.javelinX - 200);

          // 着地判定
          if (g.javelinY >= GROUND_Y - 20) {
            g.throwPhase = "land";
            g.throwDistance = (g.javelinX - g.playerX) * 0.12;

            if (!g.foul && g.throwDistance > g.bestThrow) {
              g.bestThrow = g.throwDistance;
            }

            addParticles(g.javelinX - g.cameraX, GROUND_Y, 10, "#4caf50");

            setTimeout(() => {
              const gg = gameRef.current;
              gg.throwAttempt++;
              if (gg.throwAttempt >= 3) {
                const res = gg.bestThrow > 0 ? `${gg.bestThrow.toFixed(2)} m` : "FOUL";
                setResultText(res);
                gg.phase = "result";
                setPhase("result");
                if (gg.bestThrow > 0) {
                  const recStr = `${gg.bestThrow.toFixed(2)} m`;
                  setBestRecords((prev) => {
                    if (prev.javelin === "--" || gg.bestThrow > parseFloat(prev.javelin)) {
                      return { ...prev, javelin: recStr };
                    }
                    return prev;
                  });
                }
              } else {
                gg.speed = 0; gg.playerX = 80; gg.cameraX = 0;
                gg.distance = 0; gg.throwPhase = "run";
                gg.foul = false; gg.showAngleGuide = false;
                gg.javelinX = 0; gg.javelinY = 0;
                gg.javelinVx = 0; gg.javelinVy = 0;
                gg.animFrame = 0;
              }
            }, 1500);
          }
        }

        drawTrack(g.cameraX);

        // ファールライン描画
        const foulLineX = (400 / 0.1) * (1 / g.speed || 0);
        const foulScreenX = 450 - g.cameraX;
        ctx.strokeStyle = "#f44336";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(foulScreenX, TRACK_TOP);
        ctx.lineTo(foulScreenX, TRACK_BOTTOM);
        ctx.stroke();
        ctx.fillStyle = "#f44336";
        ctx.font = "bold 12px monospace";
        ctx.fillText("FOUL LINE", foulScreenX - 30, TRACK_TOP - 5);

        drawSpeedMeter(g.speed, 700);
        drawRunner(g.playerX - g.cameraX, GROUND_Y, g.animFrame);

        // やり描画
        if (g.throwPhase === "throw" || g.throwPhase === "land") {
          const jAngle = Math.atan2(-g.javelinVy, g.javelinVx) * (180 / Math.PI);
          drawJavelin(g.javelinX - g.cameraX, Math.min(g.javelinY, GROUND_Y - 5), jAngle);
        } else if (g.throwPhase === "run" || g.throwPhase === "angle") {
          // 手に持っているやり
          drawJavelin(g.playerX - g.cameraX + 10, GROUND_Y - 40, 10);
        }

        // 角度ガイド
        if (g.throwPhase === "angle" && g.showAngleGuide) {
          drawAngleGuide(g.playerX - g.cameraX + 20, GROUND_Y - 50, g.throwAngle);
        }

        // ファール表示
        if (g.foul && g.throwPhase === "land") {
          ctx.fillStyle = "#f44336";
          ctx.font = "bold 48px monospace";
          ctx.textAlign = "center";
          ctx.fillText("FOUL!", WIDTH / 2, HEIGHT / 2 - 50);
          ctx.textAlign = "left";
        }

        // 着地時の距離表示
        if (g.throwPhase === "land" && !g.foul) {
          ctx.fillStyle = "#ffd700";
          ctx.font = "bold 36px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${g.throwDistance.toFixed(2)} m`, WIDTH / 2, HEIGHT / 2 - 50);
          ctx.textAlign = "left";
        }

        drawHUD();
        drawParticles(dt);
      }

      /* ─── 操作ガイド ─── */
      if (g.phase === "running") {
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.fillRect(10, HEIGHT - 40, 380, 30);
        ctx.fillStyle = "#ccc";
        ctx.font = "13px monospace";
        if (currentEvent === "100m") {
          ctx.fillText("Z / X を交互に連打して加速！", 20, HEIGHT - 20);
        } else if (currentEvent === "longjump") {
          ctx.fillText("Z / X 連打で加速 → SPACE でジャンプ＆角度決定", 20, HEIGHT - 20);
        } else if (currentEvent === "javelin") {
          ctx.fillText("Z / X 連打で加速 → SPACE で角度決定＆投げる", 20, HEIGHT - 20);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [currentEvent, phase, bestRecords, resetGame, resultText]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="mb-4">
        <Link
          href="/"
          className="text-cyan-400 hover:text-cyan-200 text-sm transition"
        >
          ← ゲーム一覧に戻る
        </Link>
      </div>

      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        className="rounded-xl border-2 border-slate-700 shadow-2xl shadow-blue-900/30 bg-black"
        tabIndex={0}
        onFocus={(e) => e.currentTarget.focus()}
      />

      <div className="mt-4 text-slate-400 text-sm space-y-1 text-center">
        <p>🎮 <strong>Z / X キー</strong>: 交互に連打で加速</p>
        <p>🚀 <strong>SPACE キー</strong>: ジャンプ / 投げる（角度決定）</p>
        <p>🔢 <strong>1 / 2 / 3 キー</strong>: 種目選択</p>
        <p>↩️ <strong>ENTER</strong>: リトライ / <strong>ESC</strong>: メニューへ</p>
      </div>
    </div>
  );
}
