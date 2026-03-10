"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";

/* ═══════════════════════════════════════════════════════════
   影の伝説風 忍者アクションゲーム
   - 高ジャンプ＆空中ジャンプ（2段ジャンプ）
   - 手裏剣（遠距離）＆刀斬り（近距離）
   - 森ステージ → 城壁ステージ → 天守閣ボス
   ═══════════════════════════════════════════════════════════ */

/* ─── 定数 ─── */
const WIDTH = 960;
const HEIGHT = 640;
const GRAVITY = 1800;
const PLAYER_SPEED = 260;
const JUMP_POWER = -680;
const MAX_JUMPS = 2;
const SHURIKEN_SPEED = 600;
const SHURIKEN_COOLDOWN = 0.18;
const SLASH_DURATION = 0.22;
const SLASH_RANGE = 52;
const SCROLL_SPEED = 80;
const STAGE_LENGTH = 6000;

/* ─── 型定義 ─── */
type Vec2 = { x: number; y: number };
type Shuriken = Vec2 & { vx: number; vy: number };
type EnemyShuriken = Vec2 & { vx: number; vy: number };

type EnemyKind = "red" | "blue" | "boss";
type Enemy = Vec2 & {
  vx: number;
  vy: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  onGround: boolean;
  shootTimer: number;
  facingLeft: boolean;
  jumpTimer: number;
  active: boolean;
};

type Tree = { x: number; trunkH: number; foliageR: number; shade: string };
type CastleBrick = { x: number; y: number; w: number; h: number };
type Particle = Vec2 & { vx: number; vy: number; life: number; maxLife: number; color: string; size: number };
type Pickup = Vec2 & { kind: "scroll" | "health"; collected: boolean };

type Stage = "forest" | "castle" | "boss";

/* ─── ヘルパー ─── */
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
function dist(a: Vec2, b: Vec2) { return Math.hypot(a.x - b.x, a.y - b.y); }
function rng(lo: number, hi: number) { return lo + Math.random() * (hi - lo); }
function rngInt(lo: number, hi: number) { return Math.floor(rng(lo, hi + 1)); }

/* ═════════════════════════════════════════════════════════ */
export default function KagePage() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentStage, setCurrentStage] = useState<Stage>("forest");
  const [bossDefeated, setBossDefeated] = useState(false);
  const pauseRef = useRef(false);

  const togglePause = useCallback(() => {
    pauseRef.current = !pauseRef.current;
    setIsPaused(pauseRef.current);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    /* ─── キー入力 ─── */
    const keys: Record<string, boolean> = {};
    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key.toLowerCase()] = true;
      if (e.key === "Escape") { pauseRef.current = !pauseRef.current; setIsPaused(pauseRef.current); }
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " ", "z", "x", "c"].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onKeyUp = (e: KeyboardEvent) => { keys[e.key.toLowerCase()] = false; };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    /* ─── ゲーム状態 ─── */
    const GROUND_Y = HEIGHT - 80;
    let cameraX = 0;
    let stageProgress = 0;
    let stage: Stage = "forest";
    let stageTransitionTimer = 0;
    let stageMessage = "第一幕 ― 竹林";
    let messageTimer = 3;

    // プレイヤー
    const player = {
      x: 120, y: GROUND_Y - 28,
      vx: 0, vy: 0,
      w: 24, h: 36,
      onGround: true,
      jumpsLeft: MAX_JUMPS,
      facingRight: true,
      invincible: 0,
      slashTimer: 0,
      shurikenCooldown: 0,
      hp: 3,
      maxHp: 3,
      score: 0,
      lives: 3,
      comboCount: 0,
      comboTimer: 0,
    };

    let shurikens: Shuriken[] = [];
    let enemyShurikens: EnemyShuriken[] = [];
    let enemies: Enemy[] = [];
    let particles: Particle[] = [];
    let pickups: Pickup[] = [];
    let trees: Tree[] = [];
    let castleBricks: CastleBrick[] = [];
    let platforms: { x: number; y: number; w: number }[] = [];
    let enemySpawnTimer = 0;
    let gameOverFlag = false;
    let bossSpawned = false;

    /* ─── ステージ生成 ─── */
    function generateForest() {
      trees = [];
      platforms = [];
      for (let i = 0; i < 120; i++) {
        trees.push({
          x: i * 100 + rng(-30, 30),
          trunkH: rng(180, 380),
          foliageR: rng(40, 70),
          shade: `hsl(${rngInt(100, 150)}, ${rngInt(30, 55)}%, ${rngInt(18, 32)}%)`,
        });
      }
      // 木の枝プラットフォーム
      for (let i = 0; i < 80; i++) {
        platforms.push({
          x: rng(200, STAGE_LENGTH - 200),
          y: rng(GROUND_Y - 320, GROUND_Y - 100),
          w: rng(60, 140),
        });
      }
      // アイテム配置
      for (let i = 0; i < 12; i++) {
        pickups.push({
          x: rng(400, STAGE_LENGTH - 400),
          y: rng(GROUND_Y - 250, GROUND_Y - 50),
          kind: Math.random() < 0.4 ? "health" : "scroll",
          collected: false,
        });
      }
    }

    function generateCastle() {
      trees = [];
      platforms = [];
      castleBricks = [];
      pickups = [];
      // 城壁ブロック
      for (let i = 0; i < 60; i++) {
        castleBricks.push({
          x: i * 100,
          y: GROUND_Y,
          w: 100,
          h: 80,
        });
      }
      // 足場
      for (let i = 0; i < 70; i++) {
        platforms.push({
          x: rng(100, STAGE_LENGTH - 200),
          y: rng(GROUND_Y - 350, GROUND_Y - 80),
          w: rng(80, 160),
        });
      }
      for (let i = 0; i < 8; i++) {
        pickups.push({
          x: rng(400, STAGE_LENGTH - 400),
          y: rng(GROUND_Y - 250, GROUND_Y - 50),
          kind: Math.random() < 0.5 ? "health" : "scroll",
          collected: false,
        });
      }
    }

    function spawnEnemy(forceKind?: EnemyKind) {
      const side = Math.random() < 0.5;
      const ex = cameraX + (side ? WIDTH + 40 : -40);
      const ey = rng(GROUND_Y - 300, GROUND_Y - 40);
      const kind = forceKind || (Math.random() < 0.35 ? "blue" : "red");
      enemies.push({
        x: ex, y: ey,
        vx: side ? -rng(60, 140) : rng(60, 140),
        vy: 0,
        kind,
        hp: kind === "blue" ? 2 : kind === "boss" ? 40 : 1,
        maxHp: kind === "blue" ? 2 : kind === "boss" ? 40 : 1,
        onGround: false,
        shootTimer: rng(0.5, 2),
        facingLeft: side,
        jumpTimer: rng(1, 3),
        active: true,
      });
    }

    function spawnBoss() {
      enemies.push({
        x: cameraX + WIDTH - 100,
        y: GROUND_Y - 60,
        vx: -40,
        vy: 0,
        kind: "boss",
        hp: 40,
        maxHp: 40,
        onGround: true,
        shootTimer: 0.8,
        facingLeft: true,
        jumpTimer: 2,
        active: true,
      });
      bossSpawned = true;
      messageTimer = 3;
      stageMessage = "⚔ 大ボス出現！ ⚔";
    }

    function spawnParticles(x: number, y: number, color: string, count: number) {
      for (let i = 0; i < count; i++) {
        particles.push({
          x, y,
          vx: rng(-200, 200),
          vy: rng(-300, 50),
          life: rng(0.2, 0.6),
          maxLife: 0.6,
          color,
          size: rng(2, 5),
        });
      }
    }

    function advanceStage() {
      if (stage === "forest") {
        stage = "castle";
        setCurrentStage("castle");
        stageProgress = 0;
        cameraX = 0;
        player.x = 120;
        player.y = GROUND_Y - 28;
        enemies = [];
        shurikens = [];
        enemyShurikens = [];
        bossSpawned = false;
        generateCastle();
        stageMessage = "第二幕 ― 天守閣";
        messageTimer = 3;
      } else if (stage === "castle") {
        stage = "boss";
        setCurrentStage("boss");
        stageMessage = "最終幕 ― 宿命の対決";
        messageTimer = 3;
        if (!bossSpawned) spawnBoss();
      }
    }

    // 初期化
    generateForest();

    /* ─── 更新 ─── */
    function update(dt: number) {
      if (gameOverFlag) return;
      if (pauseRef.current) return;

      messageTimer = Math.max(0, messageTimer - dt);
      player.invincible = Math.max(0, player.invincible - dt);
      player.slashTimer = Math.max(0, player.slashTimer - dt);
      player.shurikenCooldown = Math.max(0, player.shurikenCooldown - dt);
      player.comboTimer = Math.max(0, player.comboTimer - dt);
      if (player.comboTimer <= 0) player.comboCount = 0;

      /* プレイヤー移動 */
      player.vx = 0;
      if (keys["arrowleft"] || keys["a"]) { player.vx = -PLAYER_SPEED; player.facingRight = false; }
      if (keys["arrowright"] || keys["d"]) { player.vx = PLAYER_SPEED; player.facingRight = true; }

      // ジャンプ（高いジャンプ＋2段ジャンプ）
      if ((keys["arrowup"] || keys["w"] || keys[" "] || keys["z"]) && player.jumpsLeft > 0) {
        player.vy = JUMP_POWER;
        player.jumpsLeft--;
        keys["arrowup"] = false; keys["w"] = false; keys[" "] = false; keys["z"] = false;
        spawnParticles(player.x, player.y + player.h / 2, "#aaf", 4);
      }

      // 手裏剣
      if ((keys["x"]) && player.shurikenCooldown <= 0) {
        const dir = player.facingRight ? 1 : -1;
        shurikens.push({
          x: player.x + dir * 16,
          y: player.y,
          vx: SHURIKEN_SPEED * dir,
          vy: 0,
        });
        player.shurikenCooldown = SHURIKEN_COOLDOWN;
      }

      // 刀斬り
      if (keys["c"] && player.slashTimer <= 0) {
        player.slashTimer = SLASH_DURATION;
        // 近接攻撃判定
        const slashX = player.x + (player.facingRight ? SLASH_RANGE : -SLASH_RANGE);
        for (const e of enemies) {
          if (!e.active) continue;
          if (dist({ x: slashX, y: player.y }, e) < SLASH_RANGE + 20) {
            e.hp -= 3;
            spawnParticles(e.x, e.y, "#ff0", 8);
            if (e.hp <= 0) {
              e.active = false;
              const pts = e.kind === "boss" ? 5000 : e.kind === "blue" ? 300 : 100;
              player.score += pts * (1 + player.comboCount * 0.5);
              player.comboCount++;
              player.comboTimer = 2;
              spawnParticles(e.x, e.y, e.kind === "boss" ? "#f0f" : "#f80", 15);
            }
          }
        }
        keys["c"] = false;
      }

      // 物理
      player.vy += GRAVITY * dt;
      player.x += player.vx * dt;
      player.y += player.vy * dt;

      // 地面判定
      if (player.y >= GROUND_Y - player.h / 2) {
        player.y = GROUND_Y - player.h / 2;
        player.vy = 0;
        player.onGround = true;
        player.jumpsLeft = MAX_JUMPS;
      } else {
        player.onGround = false;
      }

      // プラットフォーム判定
      for (const p of platforms) {
        const px = p.x - cameraX;
        if (
          player.vy > 0 &&
          player.x > p.x - cameraX - 8 && player.x < p.x - cameraX + p.w + 8 &&
          player.y + player.h / 2 >= p.y && player.y + player.h / 2 - player.vy * dt <= p.y + 6
        ) {
          // Actually let's use world coordinates
        }
      }
      // プラットフォーム (ワールド座標)
      for (const p of platforms) {
        const worldPX = player.x + cameraX; // player in world coords
        if (
          player.vy > 0 &&
          worldPX > p.x - 8 && worldPX < p.x + p.w + 8 &&
          player.y + player.h / 2 >= p.y && player.y + player.h / 2 - player.vy * dt <= p.y + 6
        ) {
          player.y = p.y - player.h / 2;
          player.vy = 0;
          player.onGround = true;
          player.jumpsLeft = MAX_JUMPS;
        }
      }

      // 画面端制限
      player.x = clamp(player.x, 20, WIDTH - 20);
      player.y = clamp(player.y, 10, GROUND_Y - player.h / 2);

      // カメラスクロール
      if (stage !== "boss") {
        const scrollDelta = SCROLL_SPEED * dt;
        if (player.x > WIDTH * 0.6) {
          const extra = (player.x - WIDTH * 0.6) * 2 * dt;
          cameraX += scrollDelta + extra;
          player.x -= extra;
        } else {
          cameraX += scrollDelta;
        }
        stageProgress = cameraX;
        if (stageProgress > STAGE_LENGTH) {
          advanceStage();
        }
      }

      /* 手裏剣更新 */
      for (const s of shurikens) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
      }
      shurikens = shurikens.filter(s => s.x > -20 && s.x < WIDTH + 20 && s.y > -20 && s.y < HEIGHT + 20);

      /* 敵手裏剣更新 */
      for (const es of enemyShurikens) {
        es.x += es.vx * dt;
        es.y += es.vy * dt;
      }
      enemyShurikens = enemyShurikens.filter(es => es.x > -50 && es.x < WIDTH + 50 && es.y > -50 && es.y < HEIGHT + 50);

      /* 敵スポーン */
      enemySpawnTimer -= dt;
      if (enemySpawnTimer <= 0 && stage !== "boss") {
        enemySpawnTimer = rng(0.6, 1.8);
        if (enemies.filter(e => e.active).length < 12) {
          spawnEnemy();
        }
      }

      /* 敵更新 */
      for (const e of enemies) {
        if (!e.active) continue;

        // 画面内の敵座標（スクリーン座標）
        const screenX = e.x - cameraX;

        // AI: プレイヤーに向かう
        const dx = player.x - screenX;
        const dy = player.y - e.y;

        if (e.kind === "boss") {
          // ボスAI
          e.vx = dx > 0 ? 80 : -80;
          e.facingLeft = dx < 0;
          e.jumpTimer -= dt;
          if (e.jumpTimer <= 0 && e.onGround) {
            e.vy = JUMP_POWER * 0.7;
            e.onGround = false;
            e.jumpTimer = rng(1.5, 3);
          }
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            // 3方向手裏剣
            for (let angle = -0.3; angle <= 0.3; angle += 0.3) {
              const speed = 320;
              const baseAngle = Math.atan2(dy, dx);
              enemyShurikens.push({
                x: screenX, y: e.y,
                vx: Math.cos(baseAngle + angle) * speed,
                vy: Math.sin(baseAngle + angle) * speed,
              });
            }
            e.shootTimer = rng(0.6, 1.2);
          }
        } else {
          // 通常AI
          if (e.kind === "blue") {
            // 青忍者: 素早い、ジャンプ多い
            e.vx += (dx > 0 ? 400 : -400) * dt;
            e.vx = clamp(e.vx, -200, 200);
            e.jumpTimer -= dt;
            if (e.jumpTimer <= 0 && e.onGround) {
              e.vy = JUMP_POWER * 0.8;
              e.onGround = false;
              e.jumpTimer = rng(0.8, 2);
            }
          } else {
            // 赤忍者: 基本的
            e.vx += (dx > 0 ? 200 : -200) * dt;
            e.vx = clamp(e.vx, -120, 120);
            e.jumpTimer -= dt;
            if (e.jumpTimer <= 0 && e.onGround) {
              e.vy = JUMP_POWER * 0.6;
              e.onGround = false;
              e.jumpTimer = rng(1.5, 3.5);
            }
          }
          e.facingLeft = dx < 0;

          // 敵手裏剣発射
          e.shootTimer -= dt;
          if (e.shootTimer <= 0 && Math.abs(dx) < 500) {
            const speed = 240;
            const angle = Math.atan2(dy, dx);
            enemyShurikens.push({
              x: screenX, y: e.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
            });
            e.shootTimer = e.kind === "blue" ? rng(1, 2) : rng(1.5, 3);
          }
        }

        // 物理
        e.vy += GRAVITY * dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        if (e.y >= GROUND_Y - 18) {
          e.y = GROUND_Y - 18;
          e.vy = 0;
          e.onGround = true;
        }

        // 画面外で消す（ボス以外）
        if (e.kind !== "boss" && (screenX < -200 || screenX > WIDTH + 200)) {
          e.active = false;
        }

        // プレイヤーとの衝突
        if (player.invincible <= 0 && dist({ x: screenX, y: e.y }, player) < 30) {
          playerHit();
        }
      }
      enemies = enemies.filter(e => e.active);

      /* 手裏剣と敵の衝突 */
      for (const s of shurikens) {
        for (const e of enemies) {
          if (!e.active) continue;
          const screenX = e.x - cameraX;
          if (dist(s, { x: screenX, y: e.y }) < (e.kind === "boss" ? 40 : 22)) {
            e.hp--;
            s.x = -999;
            spawnParticles(screenX, e.y, "#ff0", 5);
            if (e.hp <= 0) {
              e.active = false;
              const pts = e.kind === "boss" ? 5000 : e.kind === "blue" ? 300 : 100;
              player.score += pts * (1 + player.comboCount * 0.5);
              player.comboCount++;
              player.comboTimer = 2;
              spawnParticles(screenX, e.y, e.kind === "boss" ? "#f0f" : "#f80", 20);
              if (e.kind === "boss") {
                setBossDefeated(true);
                stageMessage = "姫を救出した！ ― 完 ―";
                messageTimer = 999;
              }
            }
          }
        }
      }
      shurikens = shurikens.filter(s => s.x > -100);

      /* 敵手裏剣とプレイヤーの衝突 */
      for (const es of enemyShurikens) {
        if (player.invincible <= 0 && dist(es, player) < 18) {
          playerHit();
          es.x = -999;
        }
      }
      enemyShurikens = enemyShurikens.filter(es => es.x > -100);

      /* アイテム拾得 */
      for (const p of pickups) {
        if (p.collected) continue;
        const worldPX = player.x + cameraX;
        if (dist({ x: worldPX, y: player.y }, p) < 30) {
          p.collected = true;
          if (p.kind === "health") {
            player.hp = Math.min(player.maxHp, player.hp + 1);
            spawnParticles(player.x, player.y, "#0f0", 8);
          } else {
            player.score += 500;
            spawnParticles(player.x, player.y, "#ff0", 8);
          }
        }
      }

      /* パーティクル更新 */
      for (const p of particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 400 * dt;
        p.life -= dt;
      }
      particles = particles.filter(p => p.life > 0);

      setScore(Math.floor(player.score));
    }

    function playerHit() {
      if (player.invincible > 0) return;
      player.hp--;
      player.invincible = 1.5;
      spawnParticles(player.x, player.y, "#f00", 10);
      if (player.hp <= 0) {
        player.lives--;
        setLives(player.lives);
        if (player.lives <= 0) {
          gameOverFlag = true;
          setGameOver(true);
        } else {
          player.hp = player.maxHp;
          player.y = GROUND_Y - player.h / 2;
          player.vy = 0;
        }
      }
    }

    /* ─── 描画 ─── */
    function draw() {
      ctx.fillStyle = stage === "forest" ? "#0a1628" : "#1a0a28";
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      /* 月 */
      const moonX = WIDTH - 120;
      const moonY = 80;
      ctx.save();
      ctx.beginPath();
      ctx.arc(moonX, moonY, 40, 0, Math.PI * 2);
      ctx.fillStyle = stage === "forest" ? "#ffe8a0" : "#ffb0b0";
      ctx.shadowColor = stage === "forest" ? "#ffe8a0" : "#ff6060";
      ctx.shadowBlur = 40;
      ctx.fill();
      ctx.restore();

      /* 星 */
      ctx.fillStyle = "#fff";
      for (let i = 0; i < 60; i++) {
        const sx = (i * 137.5 + cameraX * 0.02 * (i % 3 + 1)) % WIDTH;
        const sy = (i * 89.3) % (HEIGHT * 0.5);
        ctx.globalAlpha = 0.3 + (Math.sin(i * 3.7 + cameraX * 0.01) * 0.3);
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1;

      /* 遠景の山 */
      ctx.fillStyle = stage === "forest" ? "#0d2040" : "#200d30";
      ctx.beginPath();
      ctx.moveTo(0, HEIGHT);
      for (let x = 0; x <= WIDTH; x += 20) {
        const h = Math.sin(x * 0.003 + cameraX * 0.0003) * 80 + Math.sin(x * 0.007 + 1) * 40;
        ctx.lineTo(x, HEIGHT * 0.45 - h);
      }
      ctx.lineTo(WIDTH, HEIGHT);
      ctx.fill();

      if (stage === "forest") {
        drawForest();
      } else {
        drawCastle();
      }

      /* 地面 */
      ctx.fillStyle = stage === "forest" ? "#1a3a20" : "#2a1a3a";
      ctx.fillRect(0, GROUND_Y, WIDTH, HEIGHT - GROUND_Y);
      ctx.fillStyle = stage === "forest" ? "#2a5a30" : "#3a2a4a";
      ctx.fillRect(0, GROUND_Y, WIDTH, 3);

      /* プラットフォーム描画 */
      for (const p of platforms) {
        const sx = p.x - cameraX;
        if (sx < -200 || sx > WIDTH + 200) continue;
        if (stage === "forest") {
          ctx.fillStyle = "#3a2a1a";
          ctx.fillRect(sx, p.y, p.w, 8);
          ctx.fillStyle = "#2a4a2a";
          ctx.fillRect(sx, p.y, p.w, 3);
        } else {
          ctx.fillStyle = "#4a3a5a";
          ctx.fillRect(sx, p.y, p.w, 10);
          ctx.fillStyle = "#5a4a6a";
          ctx.fillRect(sx, p.y, p.w, 3);
        }
      }

      /* アイテム描画 */
      for (const p of pickups) {
        if (p.collected) continue;
        const sx = p.x - cameraX;
        if (sx < -50 || sx > WIDTH + 50) continue;
        if (p.kind === "health") {
          ctx.fillStyle = "#f44";
          ctx.beginPath();
          ctx.arc(sx, p.y, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff";
          ctx.fillRect(sx - 4, p.y - 1.5, 8, 3);
          ctx.fillRect(sx - 1.5, p.y - 4, 3, 8);
        } else {
          ctx.fillStyle = "#ff0";
          ctx.save();
          ctx.translate(sx, p.y);
          ctx.rotate(cameraX * 0.01);
          ctx.fillRect(-6, -8, 12, 16);
          ctx.fillStyle = "#a80";
          ctx.font = "10px serif";
          ctx.textAlign = "center";
          ctx.fillText("巻", 0, 4);
          ctx.restore();
        }
      }

      /* 敵描画 */
      for (const e of enemies) {
        if (!e.active) continue;
        const sx = e.x - cameraX;
        if (sx < -60 || sx > WIDTH + 60) continue;
        drawEnemy(sx, e.y, e);
      }

      /* 手裏剣描画 */
      ctx.fillStyle = "#ccc";
      for (const s of shurikens) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(Date.now() * 0.01);
        drawShurikenShape(ctx, 6);
        ctx.restore();
      }

      /* 敵手裏剣描画 */
      ctx.fillStyle = "#f66";
      for (const es of enemyShurikens) {
        ctx.save();
        ctx.translate(es.x, es.y);
        ctx.rotate(Date.now() * 0.012);
        drawShurikenShape(ctx, 5);
        ctx.restore();
      }

      /* プレイヤー描画 */
      drawPlayer();

      /* パーティクル */
      for (const p of particles) {
        const alpha = p.life / p.maxLife;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
      ctx.globalAlpha = 1;

      /* HUD */
      drawHUD();

      /* ステージメッセージ */
      if (messageTimer > 0) {
        const alpha = messageTimer > 2.5 ? (3 - messageTimer) * 2 : messageTimer > 0.5 ? 1 : messageTimer * 2;
        ctx.globalAlpha = clamp(alpha, 0, 1);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 36px 'MS Gothic', monospace";
        ctx.textAlign = "center";
        ctx.shadowColor = "#000";
        ctx.shadowBlur = 10;
        ctx.fillText(stageMessage, WIDTH / 2, HEIGHT / 2 - 40);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }

      /* ゲームオーバー */
      if (gameOverFlag) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#f44";
        ctx.font = "bold 48px 'MS Gothic', monospace";
        ctx.textAlign = "center";
        ctx.fillText("GAME OVER", WIDTH / 2, HEIGHT / 2 - 20);
        ctx.fillStyle = "#fff";
        ctx.font = "20px 'MS Gothic', monospace";
        ctx.fillText(`最終スコア: ${Math.floor(player.score)}`, WIDTH / 2, HEIGHT / 2 + 30);
        ctx.fillText("Rキーでリスタート", WIDTH / 2, HEIGHT / 2 + 70);
      }

      /* ポーズ */
      if (pauseRef.current && !gameOverFlag) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 36px 'MS Gothic', monospace";
        ctx.textAlign = "center";
        ctx.fillText("⏸ PAUSE", WIDTH / 2, HEIGHT / 2);
      }

      /* ボス撃破 */
      if (bossDefeated) {
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        ctx.fillStyle = "#ff0";
        ctx.font = "bold 40px 'MS Gothic', monospace";
        ctx.textAlign = "center";
        ctx.fillText("🎉 姫を救出した！ 🎉", WIDTH / 2, HEIGHT / 2 - 40);
        ctx.fillStyle = "#fff";
        ctx.font = "24px 'MS Gothic', monospace";
        ctx.fillText(`最終スコア: ${Math.floor(player.score)}`, WIDTH / 2, HEIGHT / 2 + 20);
        ctx.fillText("Rキーでリスタート", WIDTH / 2, HEIGHT / 2 + 60);
      }
    }

    function drawForest() {
      for (const t of trees) {
        const sx = t.x - cameraX;
        if (sx < -100 || sx > WIDTH + 100) continue;
        // 幹
        ctx.fillStyle = "#2a1a0a";
        ctx.fillRect(sx - 6, GROUND_Y - t.trunkH, 12, t.trunkH);
        // 竹の節
        ctx.fillStyle = "#3a2a1a";
        for (let ny = GROUND_Y - t.trunkH; ny < GROUND_Y; ny += 40) {
          ctx.fillRect(sx - 7, ny, 14, 3);
        }
        // 葉
        ctx.fillStyle = t.shade;
        ctx.beginPath();
        ctx.arc(sx, GROUND_Y - t.trunkH - t.foliageR * 0.3, t.foliageR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx - t.foliageR * 0.5, GROUND_Y - t.trunkH + t.foliageR * 0.2, t.foliageR * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sx + t.foliageR * 0.5, GROUND_Y - t.trunkH + t.foliageR * 0.2, t.foliageR * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawCastle() {
      // 城壁
      const brickW = 48;
      const brickH = 24;
      for (let row = 0; row < 4; row++) {
        for (let col = -1; col < WIDTH / brickW + 2; col++) {
          const bx = col * brickW - (cameraX * 0.3) % brickW + (row % 2) * brickW / 2;
          const by = GROUND_Y - 60 + row * brickH;
          if (by >= GROUND_Y) continue;
          ctx.fillStyle = row % 2 === 0 ? "#4a3050" : "#3a2040";
          ctx.fillRect(bx, by, brickW - 2, brickH - 2);
          ctx.strokeStyle = "#2a1030";
          ctx.strokeRect(bx, by, brickW - 2, brickH - 2);
        }
      }
      // 城の窓
      for (let i = 0; i < 6; i++) {
        const wx = (i * 180 - cameraX * 0.2) % (WIDTH + 200) - 100;
        ctx.fillStyle = "#ff8";
        ctx.globalAlpha = 0.3 + Math.sin(Date.now() * 0.002 + i) * 0.1;
        ctx.fillRect(wx, GROUND_Y - 50, 16, 24);
        ctx.globalAlpha = 1;
      }
      // 屋根の装飾
      ctx.fillStyle = "#5a2030";
      for (let x = -100; x < WIDTH + 100; x += 200) {
        const rx = x - (cameraX * 0.3) % 200;
        ctx.beginPath();
        ctx.moveTo(rx - 30, GROUND_Y - 60);
        ctx.lineTo(rx, GROUND_Y - 100);
        ctx.lineTo(rx + 30, GROUND_Y - 60);
        ctx.fill();
      }
    }

    function drawPlayer() {
      const px = player.x;
      const py = player.y;
      const dir = player.facingRight ? 1 : -1;

      if (player.invincible > 0 && Math.floor(player.invincible * 10) % 2 === 0) return;

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(dir, 1);

      // 体（忍者装束）
      ctx.fillStyle = "#1a3a6a";
      ctx.fillRect(-10, -14, 20, 28);

      // 頭
      ctx.fillStyle = "#e8c8a0";
      ctx.beginPath();
      ctx.arc(0, -20, 10, 0, Math.PI * 2);
      ctx.fill();

      // 頭巾
      ctx.fillStyle = "#1a3a6a";
      ctx.fillRect(-11, -28, 22, 10);
      // 鉢金
      ctx.fillStyle = "#888";
      ctx.fillRect(-10, -20, 20, 3);

      // 目
      ctx.fillStyle = "#fff";
      ctx.fillRect(2, -22, 6, 3);
      ctx.fillStyle = "#000";
      ctx.fillRect(5, -22, 3, 3);

      // 帯
      ctx.fillStyle = "#a02020";
      ctx.fillRect(-10, -2, 20, 4);

      // 脚
      ctx.fillStyle = "#1a2a4a";
      if (!player.onGround) {
        // 空中ポーズ
        ctx.fillRect(-8, 14, 7, 12);
        ctx.fillRect(1, 10, 7, 16);
      } else {
        ctx.fillRect(-8, 14, 7, 14);
        ctx.fillRect(1, 14, 7, 14);
      }

      // 足
      ctx.fillStyle = "#333";
      ctx.fillRect(-9, 26, 9, 4);
      ctx.fillRect(0, 26, 9, 4);

      // 刀（背中）
      if (player.slashTimer <= 0) {
        ctx.fillStyle = "#aaa";
        ctx.save();
        ctx.rotate(-0.4);
        ctx.fillRect(-4, -38, 3, 28);
        ctx.fillStyle = "#a02020";
        ctx.fillRect(-5, -12, 5, 4);
        ctx.restore();
      }

      // 刀斬りエフェクト
      if (player.slashTimer > 0) {
        const slashProgress = 1 - player.slashTimer / SLASH_DURATION;
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 3;
        ctx.globalAlpha = 1 - slashProgress;
        ctx.beginPath();
        const startAngle = -Math.PI * 0.6;
        const endAngle = startAngle + Math.PI * 1.2 * slashProgress;
        ctx.arc(8, -5, SLASH_RANGE - 10, startAngle, endAngle);
        ctx.stroke();
        // 刀本体
        ctx.fillStyle = "#ddd";
        const sAngle = startAngle + Math.PI * 1.2 * slashProgress;
        ctx.save();
        ctx.rotate(sAngle);
        ctx.fillRect(0, -2, 40, 3);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      // マフラーのたなびき
      ctx.fillStyle = "#c03030";
      const mufflerWave = Math.sin(Date.now() * 0.008) * 5;
      ctx.beginPath();
      ctx.moveTo(-10, -18);
      ctx.quadraticCurveTo(-25 + mufflerWave, -15, -30 + mufflerWave * 1.5, -22 + Math.sin(Date.now() * 0.01) * 3);
      ctx.quadraticCurveTo(-25 + mufflerWave, -10, -10, -12);
      ctx.fill();

      ctx.restore();
    }

    function drawEnemy(sx: number, sy: number, e: Enemy) {
      ctx.save();
      ctx.translate(sx, sy);
      const dir = e.facingLeft ? -1 : 1;
      ctx.scale(dir, 1);

      if (e.kind === "boss") {
        // ボス（大きい鬼武者風）
        const scale = 1.8;
        ctx.scale(scale, scale);

        // 体
        ctx.fillStyle = "#4a0a2a";
        ctx.fillRect(-14, -16, 28, 32);

        // 鎧
        ctx.fillStyle = "#6a1a3a";
        ctx.fillRect(-16, -12, 32, 24);
        ctx.fillStyle = "#8a2a4a";
        ctx.fillRect(-14, -10, 28, 4);

        // 頭
        ctx.fillStyle = "#c0a080";
        ctx.beginPath();
        ctx.arc(0, -22, 12, 0, Math.PI * 2);
        ctx.fill();

        // 兜
        ctx.fillStyle = "#4a0a2a";
        ctx.beginPath();
        ctx.moveTo(-14, -24);
        ctx.lineTo(0, -40);
        ctx.lineTo(14, -24);
        ctx.fill();
        // 角
        ctx.fillStyle = "#aa8800";
        ctx.beginPath();
        ctx.moveTo(-4, -38);
        ctx.lineTo(-8, -52);
        ctx.lineTo(0, -40);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(4, -38);
        ctx.lineTo(8, -52);
        ctx.lineTo(0, -40);
        ctx.fill();

        // 目
        ctx.fillStyle = "#f00";
        ctx.fillRect(2, -25, 6, 4);
        ctx.fillRect(-8, -25, 6, 4);

        // HP バー
        ctx.scale(1 / scale, 1 / scale);
        const hpRatio = e.hp / e.maxHp;
        ctx.fillStyle = "#400";
        ctx.fillRect(-30, -70, 60, 6);
        ctx.fillStyle = hpRatio > 0.5 ? "#f00" : "#ff0";
        ctx.fillRect(-30, -70, 60 * hpRatio, 6);
      } else {
        // 通常の敵忍者
        const isBlue = e.kind === "blue";

        // 体
        ctx.fillStyle = isBlue ? "#1a2a5a" : "#5a1a1a";
        ctx.fillRect(-8, -12, 16, 24);

        // 頭
        ctx.fillStyle = "#d0b090";
        ctx.beginPath();
        ctx.arc(0, -16, 8, 0, Math.PI * 2);
        ctx.fill();

        // 頭巾
        ctx.fillStyle = isBlue ? "#1a2a5a" : "#5a1a1a";
        ctx.fillRect(-9, -22, 18, 8);

        // 目
        ctx.fillStyle = "#fff";
        ctx.fillRect(1, -18, 5, 2);
        ctx.fillStyle = isBlue ? "#0af" : "#f00";
        ctx.fillRect(3, -18, 3, 2);

        // 脚
        ctx.fillStyle = isBlue ? "#0a1a3a" : "#3a0a0a";
        ctx.fillRect(-7, 12, 6, 10);
        ctx.fillRect(1, 12, 6, 10);

        // マフラー
        ctx.fillStyle = isBlue ? "#4488ff" : "#ff4444";
        const wave = Math.sin(Date.now() * 0.01 + e.x) * 3;
        ctx.beginPath();
        ctx.moveTo(-8, -14);
        ctx.quadraticCurveTo(-18 + wave, -10, -22 + wave, -16);
        ctx.quadraticCurveTo(-18 + wave, -8, -8, -10);
        ctx.fill();
      }

      ctx.restore();
    }

    function drawShurikenShape(c: CanvasRenderingContext2D, r: number) {
      c.beginPath();
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        c.moveTo(0, 0);
        c.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        c.lineTo(Math.cos(angle + Math.PI / 4) * r * 0.4, Math.sin(angle + Math.PI / 4) * r * 0.4);
      }
      c.closePath();
      c.fill();
    }

    function drawHUD() {
      // スコア
      ctx.fillStyle = "#fff";
      ctx.font = "bold 18px 'MS Gothic', monospace";
      ctx.textAlign = "left";
      ctx.fillText(`SCORE: ${Math.floor(player.score)}`, 16, 30);

      // コンボ
      if (player.comboCount > 1) {
        ctx.fillStyle = "#ff0";
        ctx.font = "bold 16px 'MS Gothic', monospace";
        ctx.fillText(`${player.comboCount} COMBO!`, 16, 52);
      }

      // 残機
      ctx.fillStyle = "#fff";
      ctx.font = "16px 'MS Gothic', monospace";
      ctx.fillText(`残機: ${"❤".repeat(player.lives)}`, 16, HEIGHT - 16);

      // HP
      ctx.fillStyle = "#400";
      ctx.fillRect(WIDTH - 180, 14, 160, 14);
      ctx.fillStyle = player.hp > 1 ? "#0c0" : "#f00";
      ctx.fillRect(WIDTH - 180, 14, 160 * (player.hp / player.maxHp), 14);
      ctx.strokeStyle = "#fff";
      ctx.strokeRect(WIDTH - 180, 14, 160, 14);
      ctx.fillStyle = "#fff";
      ctx.font = "11px 'MS Gothic', monospace";
      ctx.textAlign = "right";
      ctx.fillText("体力", WIDTH - 186, 26);

      // ステージ進行
      if (stage !== "boss") {
        const progress = stageProgress / STAGE_LENGTH;
        ctx.fillStyle = "#333";
        ctx.fillRect(WIDTH / 2 - 100, 10, 200, 8);
        ctx.fillStyle = "#0af";
        ctx.fillRect(WIDTH / 2 - 100, 10, 200 * progress, 8);
        ctx.strokeStyle = "#fff";
        ctx.strokeRect(WIDTH / 2 - 100, 10, 200, 8);
        ctx.fillStyle = "#fff";
        ctx.font = "10px 'MS Gothic', monospace";
        ctx.textAlign = "center";
        ctx.fillText(stage === "forest" ? "竹林" : "天守閣", WIDTH / 2, 30);
      }

      // 操作説明（最初だけ）
      if (cameraX < 200 && stage === "forest") {
        ctx.globalAlpha = clamp(1 - cameraX / 200, 0, 0.8);
        ctx.fillStyle = "#fff";
        ctx.font = "14px 'MS Gothic', monospace";
        ctx.textAlign = "center";
        const baseY = HEIGHT - 140;
        ctx.fillText("← → : 移動　　↑ / Z / Space : ジャンプ（2段OK）", WIDTH / 2, baseY);
        ctx.fillText("X : 手裏剣　　C : 刀斬り", WIDTH / 2, baseY + 22);
        ctx.fillText("ESC : ポーズ", WIDTH / 2, baseY + 44);
        ctx.globalAlpha = 1;
      }
    }

    /* ─── リスタート ─── */
    function restart() {
      player.x = 120;
      player.y = GROUND_Y - player.h / 2;
      player.vx = 0;
      player.vy = 0;
      player.hp = player.maxHp;
      player.lives = 3;
      player.score = 0;
      player.invincible = 2;
      player.comboCount = 0;
      player.jumpsLeft = MAX_JUMPS;
      cameraX = 0;
      stageProgress = 0;
      stage = "forest";
      setCurrentStage("forest");
      enemies = [];
      shurikens = [];
      enemyShurikens = [];
      particles = [];
      pickups = [];
      bossSpawned = false;
      gameOverFlag = false;
      setGameOver(false);
      setBossDefeated(false);
      setLives(3);
      setScore(0);
      generateForest();
      stageMessage = "第一幕 ― 竹林";
      messageTimer = 3;
    }

    /* ─── ゲームループ ─── */
    let lastTime = performance.now();
    let animId = 0;

    function loop(now: number) {
      const rawDt = (now - lastTime) / 1000;
      const dt = Math.min(rawDt, 0.05);
      lastTime = now;

      // Rキーでリスタート
      if (keys["r"] && (gameOverFlag || bossDefeated)) {
        restart();
        keys["r"] = false;
      }

      update(dt);
      draw();
      animId = requestAnimationFrame(loop);
    }
    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center py-6">
      <div className="w-full max-w-[980px] px-4">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-sm text-cyan-300 hover:underline">
            ← ゲーム一覧
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            🥷 影の伝説 ― Shadow of the Ninja
          </h1>
          <button onClick={togglePause} className="text-sm bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded">
            {isPaused ? "▶ 再開" : "⏸ 一時停止"}
          </button>
        </div>

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            className="border-2 border-slate-600 rounded-lg bg-black"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <div className="mt-4 flex justify-between items-center text-sm text-slate-400">
          <span>SCORE: {score.toLocaleString()}</span>
          <span>
            ステージ: {currentStage === "forest" ? "🌲 竹林" : currentStage === "castle" ? "🏯 天守閣" : "⚔ ボス戦"}
          </span>
          <span>残機: {"❤".repeat(lives)}</span>
        </div>

        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs text-slate-400">
          <div className="bg-slate-800/60 rounded-lg p-3">
            <div className="text-lg mb-1">← →</div>
            <div>移動</div>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3">
            <div className="text-lg mb-1">↑ / Z / Space</div>
            <div>ジャンプ（2段OK）</div>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3">
            <div className="text-lg mb-1">X</div>
            <div>手裏剣</div>
          </div>
          <div className="bg-slate-800/60 rounded-lg p-3">
            <div className="text-lg mb-1">C</div>
            <div>刀斬り</div>
          </div>
        </div>

        <div className="mt-4 text-xs text-slate-500 text-center">
          ESC でポーズ / ゲームオーバーまたはクリア時は R でリスタート
        </div>
      </div>
    </main>
  );
}
