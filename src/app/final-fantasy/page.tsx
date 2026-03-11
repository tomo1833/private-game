"use client";

import Link from "next/link";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════
   型定義
   ═══════════════════════════════════════════════════════════ */

type ElementType = "fire" | "ice" | "thunder" | "holy" | "dark" | "none";

type StatusEffect = {
  name: string;
  turnsLeft: number;
  type: "poison" | "regen" | "protect" | "shell" | "haste" | "slow" | "blind";
};

type Ability = {
  name: string;
  mpCost: number;
  power: number;
  element: ElementType;
  target: "single" | "all" | "self" | "ally" | "allAllies";
  type: "attack" | "heal" | "buff" | "debuff" | "revive" | "summon";
  description: string;
  statusEffect?: StatusEffect["type"];
  animation?: string;
};

type CharacterJob = "warrior" | "mage" | "healer" | "thief";

type PartyMember = {
  id: string;
  name: string;
  job: CharacterJob;
  emoji: string;
  level: number;
  exp: number;
  expNext: number;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  mag: number;
  mdf: number;
  spd: number;
  abilities: Ability[];
  statusEffects: StatusEffect[];
  atbGauge: number;       // 0-100
  isDefending: boolean;
  row: "front" | "back";  // 前列/後列
};

type Enemy = {
  id: string;
  name: string;
  emoji: string;
  level: number;
  hp: number;
  maxHp: number;
  mp: number;
  atk: number;
  def: number;
  mag: number;
  mdf: number;
  spd: number;
  exp: number;
  gold: number;
  abilities: Ability[];
  weakness: ElementType;
  resist: ElementType;
  isBoss: boolean;
  statusEffects: StatusEffect[];
  atbGauge: number;
};

type BattleAction = {
  actorId: string;
  actorType: "party" | "enemy";
  ability: Ability | null;  // null = たたかう
  targetIds: string[];
};

type BattleLog = {
  text: string;
  type: "damage" | "heal" | "info" | "critical" | "miss" | "levelup" | "element";
};

type DungeonRoom = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  enemies?: EnemyTemplate[];
  treasure?: TreasureItem;
  event?: DungeonEvent;
  isBoss?: boolean;
  isShop?: boolean;
  isSavePoint?: boolean;
  connections: string[];
};

type EnemyTemplate = {
  name: string;
  emoji: string;
  level: number;
  baseHp: number;
  atk: number;
  def: number;
  mag: number;
  mdf: number;
  spd: number;
  exp: number;
  gold: number;
  abilities: Ability[];
  weakness: ElementType;
  resist: ElementType;
  isBoss?: boolean;
};

type TreasureItem = {
  name: string;
  emoji: string;
  type: "potion" | "ether" | "phoenix" | "weapon" | "armor" | "accessory";
  value: number;
  description: string;
};

type DungeonEvent = {
  text: string;
  effect: "heal" | "damage" | "buff" | "story";
  value?: number;
};

type InventoryItem = TreasureItem & { count: number };

type GameScreen =
  | "title"
  | "dungeon"
  | "battle"
  | "battle_command"
  | "battle_target"
  | "battle_magic"
  | "battle_item"
  | "battle_result"
  | "shop"
  | "menu"
  | "game_over"
  | "ending";

/* ═══════════════════════════════════════════════════════════
   定数 & データ
   ═══════════════════════════════════════════════════════════ */

const ELEMENT_EMOJI: Record<ElementType, string> = {
  fire: "🔥", ice: "❄️", thunder: "⚡", holy: "✨", dark: "🌑", none: "",
};

const ELEMENT_COLORS: Record<ElementType, string> = {
  fire: "text-orange-400", ice: "text-cyan-300", thunder: "text-yellow-300",
  holy: "text-amber-200", dark: "text-purple-400", none: "text-white",
};

const JOB_COLORS: Record<CharacterJob, string> = {
  warrior: "text-red-400", mage: "text-blue-400", healer: "text-green-400", thief: "text-yellow-400",
};

const JOB_NAMES: Record<CharacterJob, string> = {
  warrior: "ナイト", mage: "黒魔道士", healer: "白魔道士", thief: "シーフ",
};

/* ── アビリティ定義 ── */
const ABILITIES: Record<string, Ability> = {
  // 戦士
  powerSlash:    { name: "パワースラッシュ", mpCost: 8, power: 180, element: "none", target: "single", type: "attack", description: "渾身の一撃", animation: "⚔️" },
  crossCut:      { name: "十字斬り", mpCost: 16, power: 140, element: "none", target: "all", type: "attack", description: "敵全体を斬りつける", animation: "✖️" },
  sentinel:      { name: "センチネル", mpCost: 6, power: 0, element: "none", target: "self", type: "buff", description: "防御力大幅アップ", statusEffect: "protect", animation: "🛡️" },
  // 黒魔道士
  fire:          { name: "ファイア", mpCost: 6, power: 120, element: "fire", target: "single", type: "attack", description: "炎の魔法", animation: "🔥" },
  blizzard:      { name: "ブリザド", mpCost: 6, power: 120, element: "ice", target: "single", type: "attack", description: "氷の魔法", animation: "❄️" },
  thunder:       { name: "サンダー", mpCost: 6, power: 120, element: "thunder", target: "single", type: "attack", description: "雷の魔法", animation: "⚡" },
  firaga:        { name: "ファイガ", mpCost: 22, power: 200, element: "fire", target: "all", type: "attack", description: "強力な炎魔法", animation: "🔥🔥🔥" },
  blizzaga:      { name: "ブリザガ", mpCost: 22, power: 200, element: "ice", target: "all", type: "attack", description: "強力な氷魔法", animation: "❄️❄️❄️" },
  thundaga:      { name: "サンダガ", mpCost: 22, power: 200, element: "thunder", target: "all", type: "attack", description: "強力な雷魔法", animation: "⚡⚡⚡" },
  meteor:        { name: "メテオ", mpCost: 50, power: 350, element: "none", target: "all", type: "attack", description: "究極の黒魔法", animation: "☄️" },
  // 白魔道士
  cure:          { name: "ケアル", mpCost: 5, power: 100, element: "holy", target: "ally", type: "heal", description: "味方一人を回復", animation: "💚" },
  curaga:        { name: "ケアルガ", mpCost: 20, power: 200, element: "holy", target: "allAllies", type: "heal", description: "味方全体を回復", animation: "💚💚💚" },
  raise:         { name: "レイズ", mpCost: 18, power: 50, element: "holy", target: "ally", type: "revive", description: "戦闘不能の味方を復活", animation: "🕊️" },
  protect:       { name: "プロテス", mpCost: 8, power: 0, element: "none", target: "ally", type: "buff", description: "物理防御アップ", statusEffect: "protect", animation: "🛡️" },
  shell:         { name: "シェル", mpCost: 8, power: 0, element: "none", target: "ally", type: "buff", description: "魔法防御アップ", statusEffect: "shell", animation: "🔰" },
  regen:         { name: "リジェネ", mpCost: 12, power: 0, element: "none", target: "ally", type: "buff", description: "HPを徐々に回復", statusEffect: "regen", animation: "🌿" },
  holy:          { name: "ホーリー", mpCost: 32, power: 280, element: "holy", target: "single", type: "attack", description: "聖なる光の魔法", animation: "✨" },
  // シーフ
  steal:         { name: "ぬすむ", mpCost: 0, power: 0, element: "none", target: "single", type: "attack", description: "アイテムを盗む", animation: "🤏" },
  shadowBlade:   { name: "シャドウブレイド", mpCost: 10, power: 150, element: "dark", target: "single", type: "attack", description: "闇の力を纏った斬撃", animation: "🌑" },
  quickHit:      { name: "クイックヒット", mpCost: 14, power: 100, element: "none", target: "single", type: "attack", description: "素早い連続攻撃×2", animation: "💨" },
  mug:           { name: "ぶんどる", mpCost: 8, power: 120, element: "none", target: "single", type: "attack", description: "攻撃しつつアイテムを盗む", animation: "💰" },
  // 召喚（黒魔道士 or 白魔道士が高レベルで習得）
  ifrit:         { name: "イフリート", mpCost: 36, power: 300, element: "fire", target: "all", type: "summon", description: "炎の召喚獣", animation: "🔥👹🔥" },
  shiva:         { name: "シヴァ", mpCost: 36, power: 300, element: "ice", target: "all", type: "summon", description: "氷の召喚獣", animation: "❄️👸❄️" },
  bahamut:       { name: "バハムート", mpCost: 60, power: 500, element: "none", target: "all", type: "summon", description: "竜王の召喚獣", animation: "🐉✨🐉" },
};

/* ── 初期パーティ ── */
function createParty(): PartyMember[] {
  return [
    {
      id: "cecil", name: "セシル", job: "warrior", emoji: "🗡️",
      level: 1, exp: 0, expNext: 30,
      hp: 180, maxHp: 180, mp: 20, maxMp: 20,
      atk: 22, def: 18, mag: 8, mdf: 10, spd: 12,
      abilities: [ABILITIES.powerSlash, ABILITIES.sentinel],
      statusEffects: [], atbGauge: 0, isDefending: false, row: "front",
    },
    {
      id: "vivi", name: "ビビ", job: "mage", emoji: "🧙",
      level: 1, exp: 0, expNext: 30,
      hp: 100, maxHp: 100, mp: 60, maxMp: 60,
      atk: 8, def: 8, mag: 26, mdf: 18, spd: 10,
      abilities: [ABILITIES.fire, ABILITIES.blizzard, ABILITIES.thunder],
      statusEffects: [], atbGauge: 0, isDefending: false, row: "back",
    },
    {
      id: "rosa", name: "ローザ", job: "healer", emoji: "🏹",
      level: 1, exp: 0, expNext: 30,
      hp: 120, maxHp: 120, mp: 50, maxMp: 50,
      atk: 10, def: 10, mag: 22, mdf: 22, spd: 11,
      abilities: [ABILITIES.cure, ABILITIES.protect, ABILITIES.regen],
      statusEffects: [], atbGauge: 0, isDefending: false, row: "back",
    },
    {
      id: "zidane", name: "ジタン", job: "thief", emoji: "🗡️",
      level: 1, exp: 0, expNext: 30,
      hp: 140, maxHp: 140, mp: 30, maxMp: 30,
      atk: 20, def: 12, mag: 12, mdf: 12, spd: 18,
      abilities: [ABILITIES.steal, ABILITIES.shadowBlade],
      statusEffects: [], atbGauge: 0, isDefending: false, row: "front",
    },
  ];
}

/* ── レベルアップ時の成長率 ── */
const GROWTH: Record<CharacterJob, { hp: number; mp: number; atk: number; def: number; mag: number; mdf: number; spd: number }> = {
  warrior: { hp: 28, mp: 3, atk: 4, def: 3, mag: 1, mdf: 1, spd: 1 },
  mage:    { hp: 12, mp: 8, atk: 1, def: 1, mag: 5, mdf: 3, spd: 1 },
  healer:  { hp: 16, mp: 7, atk: 1, def: 1, mag: 4, mdf: 4, spd: 1 },
  thief:   { hp: 18, mp: 4, atk: 3, def: 2, mag: 2, mdf: 2, spd: 3 },
};

/* ── レベルアップ時に覚えるアビリティ ── */
const LEARN_ABILITIES: Record<string, { level: number; ability: Ability }[]> = {
  cecil:  [{ level: 3, ability: ABILITIES.crossCut }, { level: 7, ability: ABILITIES.powerSlash }],
  vivi:   [{ level: 3, ability: ABILITIES.firaga }, { level: 5, ability: ABILITIES.blizzaga }, { level: 5, ability: ABILITIES.thundaga }, { level: 8, ability: ABILITIES.meteor }, { level: 10, ability: ABILITIES.ifrit }],
  rosa:   [{ level: 3, ability: ABILITIES.curaga }, { level: 4, ability: ABILITIES.shell }, { level: 5, ability: ABILITIES.raise }, { level: 7, ability: ABILITIES.holy }, { level: 10, ability: ABILITIES.shiva }],
  zidane: [{ level: 3, ability: ABILITIES.quickHit }, { level: 5, ability: ABILITIES.mug }, { level: 9, ability: ABILITIES.shadowBlade }],
};

/* ── 敵テンプレート ── */
const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = {
  goblin:     { name: "ゴブリン", emoji: "👺", level: 1, baseHp: 45, atk: 12, def: 6, mag: 4, mdf: 4, spd: 8, exp: 12, gold: 15, abilities: [], weakness: "fire", resist: "none" },
  skeleton:   { name: "スケルトン", emoji: "💀", level: 2, baseHp: 55, atk: 14, def: 8, mag: 6, mdf: 4, spd: 7, exp: 16, gold: 20, abilities: [], weakness: "holy", resist: "dark" },
  bat:        { name: "バット", emoji: "🦇", level: 1, baseHp: 30, atk: 10, def: 4, mag: 4, mdf: 6, spd: 14, exp: 10, gold: 8, abilities: [], weakness: "thunder", resist: "none" },
  wolf:       { name: "ダイアウルフ", emoji: "🐺", level: 3, baseHp: 70, atk: 18, def: 10, mag: 4, mdf: 6, spd: 12, exp: 20, gold: 25, abilities: [], weakness: "fire", resist: "ice" },
  mage_enemy: { name: "ダークメイジ", emoji: "🧛", level: 4, baseHp: 60, atk: 8, def: 8, mag: 22, mdf: 16, spd: 9, exp: 28, gold: 35, abilities: [ABILITIES.fire, ABILITIES.blizzard], weakness: "holy", resist: "dark" },
  golem:      { name: "ゴーレム", emoji: "🗿", level: 5, baseHp: 120, atk: 22, def: 20, mag: 4, mdf: 8, spd: 5, exp: 35, gold: 40, abilities: [], weakness: "thunder", resist: "fire" },
  dragon:     { name: "ワイバーン", emoji: "🐲", level: 6, baseHp: 150, atk: 28, def: 16, mag: 18, mdf: 14, spd: 10, exp: 50, gold: 60, abilities: [ABILITIES.fire], weakness: "ice", resist: "fire" },
  gargoyle:   { name: "ガーゴイル", emoji: "👿", level: 5, baseHp: 100, atk: 20, def: 18, mag: 14, mdf: 14, spd: 8, exp: 32, gold: 45, abilities: [ABILITIES.thunder], weakness: "holy", resist: "dark" },
  demon:      { name: "デーモン", emoji: "😈", level: 7, baseHp: 180, atk: 30, def: 18, mag: 24, mdf: 18, spd: 9, exp: 55, gold: 70, abilities: [ABILITIES.fire, ABILITIES.shadowBlade], weakness: "holy", resist: "dark" },
  // ボス
  boss_knight:  { name: "暗黒騎士ガルド", emoji: "⚔️", level: 5, baseHp: 400, atk: 28, def: 18, mag: 14, mdf: 12, spd: 10, exp: 120, gold: 200, abilities: [ABILITIES.powerSlash, ABILITIES.shadowBlade], weakness: "holy", resist: "dark", isBoss: true },
  boss_dragon:  { name: "紅蓮竜イグニス", emoji: "🐉", level: 8, baseHp: 700, atk: 35, def: 22, mag: 30, mdf: 20, spd: 11, exp: 250, gold: 400, abilities: [ABILITIES.firaga, ABILITIES.powerSlash], weakness: "ice", resist: "fire", isBoss: true },
  boss_final:   { name: "冥皇カオス", emoji: "👁️", level: 12, baseHp: 1500, atk: 42, def: 28, mag: 40, mdf: 30, spd: 13, exp: 0, gold: 0, abilities: [ABILITIES.meteor, ABILITIES.firaga, ABILITIES.thundaga, ABILITIES.shadowBlade], weakness: "holy", resist: "dark", isBoss: true },
};

/* ── ダンジョンマップ ── */
function createDungeon(): DungeonRoom[] {
  return [
    { id: "start", name: "クリスタルの洞窟 入口", description: "冒険の始まり。微かな光が奥から漏れている。", emoji: "🏔️", connections: ["cave1", "save1"], treasure: { name: "ポーション", emoji: "🧪", type: "potion", value: 50, description: "HPを50回復" } },
    { id: "save1", name: "セーブクリスタル", description: "青く輝くクリスタルがHPとMPを回復してくれる。", emoji: "💎", isSavePoint: true, connections: ["start"], event: { text: "クリスタルの光に包まれ、傷が癒された！", effect: "heal", value: 999 } },
    { id: "cave1", name: "薄暗い洞窟", description: "コウモリの鳴き声が聞こえる。", emoji: "🦇", enemies: [ENEMY_TEMPLATES.goblin, ENEMY_TEMPLATES.bat], connections: ["start", "cave2", "cave3"] },
    { id: "cave2", name: "地下水路", description: "冷たい水が流れる通路。", emoji: "💧", enemies: [ENEMY_TEMPLATES.skeleton, ENEMY_TEMPLATES.goblin], connections: ["cave1", "cave4"], treasure: { name: "エーテル", emoji: "💧", type: "ether", value: 30, description: "MPを30回復" } },
    { id: "cave3", name: "廃鉱道", description: "かつて鉱石が採掘されていた場所。", emoji: "⛏️", enemies: [ENEMY_TEMPLATES.wolf, ENEMY_TEMPLATES.skeleton], connections: ["cave1", "cave4"], treasure: { name: "フェニックスの尾", emoji: "🪶", type: "phoenix", value: 1, description: "戦闘不能を回復" } },
    { id: "cave4", name: "暗闇の大広間", description: "広大な空間。不気味な気配が漂う。", emoji: "🏛️", enemies: [ENEMY_TEMPLATES.mage_enemy, ENEMY_TEMPLATES.wolf], connections: ["cave2", "cave3", "boss1_room", "save2"] },
    { id: "save2", name: "セーブクリスタル", description: "心強い輝き。体力が回復する。", emoji: "💎", isSavePoint: true, connections: ["cave4"], event: { text: "クリスタルの癒しの光…！全回復した！", effect: "heal", value: 999 } },
    { id: "boss1_room", name: "暗黒の間", description: "暗黒騎士ガルドが待ち構えている！", emoji: "⚔️", enemies: [ENEMY_TEMPLATES.boss_knight], isBoss: true, connections: ["cave4", "floor2_1"] },
    // 第二層
    { id: "floor2_1", name: "炎の回廊", description: "壁から炎が噴き出す危険な通路。", emoji: "🔥", enemies: [ENEMY_TEMPLATES.golem, ENEMY_TEMPLATES.gargoyle], connections: ["boss1_room", "floor2_2", "floor2_3"] },
    { id: "floor2_2", name: "竜の巣", description: "翼竜が巣を作っている。", emoji: "🐲", enemies: [ENEMY_TEMPLATES.dragon, ENEMY_TEMPLATES.dragon], connections: ["floor2_1", "floor2_4"], treasure: { name: "ハイポーション", emoji: "🧪", type: "potion", value: 150, description: "HPを150回復" } },
    { id: "floor2_3", name: "魔法図書館", description: "古代の魔導書が並ぶ。", emoji: "📖", enemies: [ENEMY_TEMPLATES.mage_enemy, ENEMY_TEMPLATES.mage_enemy], connections: ["floor2_1", "floor2_4"], treasure: { name: "エリクサー", emoji: "✨", type: "ether", value: 999, description: "MPを全回復" } },
    { id: "floor2_4", name: "溶岩の間", description: "灼熱の広間。巨大な影が見える…", emoji: "🌋", enemies: [ENEMY_TEMPLATES.demon, ENEMY_TEMPLATES.gargoyle], connections: ["floor2_2", "floor2_3", "boss2_room", "save3"] },
    { id: "save3", name: "セーブクリスタル", description: "最後の安らぎ。力を蓄えよう。", emoji: "💎", isSavePoint: true, connections: ["floor2_4"], event: { text: "クリスタルに祈りを捧げた。全回復！", effect: "heal", value: 999 } },
    { id: "boss2_room", name: "紅蓮の巣窟", description: "紅蓮竜イグニスが咆哮を上げる！", emoji: "🐉", enemies: [ENEMY_TEMPLATES.boss_dragon], isBoss: true, connections: ["floor2_4", "final_hall"] },
    // 最終層
    { id: "final_hall", name: "虚無の回廊", description: "すべての光が吸い込まれていく…", emoji: "🌑", enemies: [ENEMY_TEMPLATES.demon, ENEMY_TEMPLATES.demon], connections: ["boss2_room", "save_final", "final_boss"] },
    { id: "save_final", name: "最後のクリスタル", description: "かすかに輝くクリスタル。最後の希望。", emoji: "💎", isSavePoint: true, connections: ["final_hall"], event: { text: "仲間と力を合わせて…最後の戦いへ！全回復！", effect: "heal", value: 999 } },
    { id: "final_boss", name: "冥界の玉座", description: "冥皇カオスが世界を闇に沈めようとしている！", emoji: "👁️", enemies: [ENEMY_TEMPLATES.boss_final], isBoss: true, connections: ["final_hall"] },
  ];
}

/* ── アイテム定義 ── */
function initialInventory(): InventoryItem[] {
  return [
    { name: "ポーション", emoji: "🧪", type: "potion", value: 50, description: "HPを50回復", count: 5 },
    { name: "エーテル", emoji: "💧", type: "ether", value: 30, description: "MPを30回復", count: 3 },
    { name: "フェニックスの尾", emoji: "🪶", type: "phoenix", value: 1, description: "戦闘不能を回復", count: 2 },
  ];
}

/* ═══════════════════════════════════════════════════════════
   ユーティリティ
   ═══════════════════════════════════════════════════════════ */

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v: number, mn: number, mx: number) { return Math.max(mn, Math.min(mx, v)); }
function rng(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function spawnEnemy(tpl: EnemyTemplate, idx: number): Enemy {
  const variance = 1 + (Math.random() * 0.2 - 0.1);
  return {
    id: `enemy_${idx}_${Date.now()}`,
    name: tpl.name,
    emoji: tpl.emoji,
    level: tpl.level,
    hp: Math.floor(tpl.baseHp * variance),
    maxHp: Math.floor(tpl.baseHp * variance),
    mp: 99,
    atk: Math.floor(tpl.atk * variance),
    def: Math.floor(tpl.def * variance),
    mag: Math.floor(tpl.mag * variance),
    mdf: Math.floor(tpl.mdf * variance),
    spd: Math.floor(tpl.spd * variance),
    exp: tpl.exp,
    gold: tpl.gold,
    abilities: tpl.abilities,
    weakness: tpl.weakness,
    resist: tpl.resist,
    isBoss: tpl.isBoss || false,
    statusEffects: [],
    atbGauge: 0,
  };
}

/* ═══════════════════════════════════════════════════════════
   メインコンポーネント
   ═══════════════════════════════════════════════════════════ */

export default function FinalFantasyPage() {
  /* ── ゲーム状態 ── */
  const [screen, setScreen] = useState<GameScreen>("title");
  const [party, setParty] = useState<PartyMember[]>(createParty);
  const [gold, setGold] = useState(100);
  const [inventory, setInventory] = useState<InventoryItem[]>(initialInventory);
  const [dungeon, setDungeon] = useState<DungeonRoom[]>(createDungeon);
  const [currentRoomId, setCurrentRoomId] = useState("start");
  const [visitedRooms, setVisitedRooms] = useState<Set<string>>(new Set(["start"]));

  /* ── バトル状態 ── */
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [battleLog, setBattleLog] = useState<BattleLog[]>([]);
  const [activeCharId, setActiveCharId] = useState<string | null>(null);
  const [selectedAbility, setSelectedAbility] = useState<Ability | null>(null);
  const [battleReward, setBattleReward] = useState<{ exp: number; gold: number; items: string[] } | null>(null);
  const [isBossBattle, setIsBossBattle] = useState(false);
  const [turnCount, setTurnCount] = useState(0);
  const [animatingAction, setAnimatingAction] = useState<string | null>(null);

  /* ── UI状態 ── */
  const [eventMessage, setEventMessage] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const currentRoom = useMemo(() => dungeon.find((r) => r.id === currentRoomId)!, [dungeon, currentRoomId]);

  // バトルログ自動スクロール
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [battleLog]);

  /* ── ATBシステム（簡略版：ターン制に見せかけるが速度順） ── */
  const getNextActor = useCallback((): { id: string; type: "party" | "enemy" } | null => {
    const aliveParty = party.filter((p) => p.hp > 0);
    const aliveEnemies = enemies.filter((e) => e.hp > 0);
    if (aliveParty.length === 0 || aliveEnemies.length === 0) return null;

    // 全員のATBを速度に基づいて進める
    let fastest: { id: string; type: "party" | "enemy"; spd: number } | null = null;

    for (const p of aliveParty) {
      const effectiveSpd = p.statusEffects.some((s) => s.type === "haste") ? p.spd * 1.5 : p.spd;
      if (!fastest || effectiveSpd > fastest.spd) {
        fastest = { id: p.id, type: "party", spd: effectiveSpd };
      }
    }
    for (const e of aliveEnemies) {
      const effectiveSpd = e.statusEffects.some((s) => s.type === "haste") ? e.spd * 1.5 : e.spd;
      if (!fastest || effectiveSpd > fastest.spd) {
        fastest = { id: e.id, type: "enemy", spd: effectiveSpd };
      }
    }

    return fastest;
  }, [party, enemies]);

  /* ── ダメージ計算 ── */
  const calcDamage = useCallback((
    power: number, atkStat: number, defStat: number, element: ElementType,
    targetWeakness: ElementType, targetResist: ElementType, isMagic: boolean,
  ): { damage: number; critical: boolean; effective: "weak" | "resist" | "normal" } => {
    const base = Math.floor((power / 100) * atkStat * (1 + Math.random() * 0.3));
    const defReduction = Math.max(1, base - Math.floor(defStat * 0.6));
    let damage = defReduction;
    let effective: "weak" | "resist" | "normal" = "normal";

    if (element !== "none") {
      if (element === targetWeakness) {
        damage = Math.floor(damage * 1.8);
        effective = "weak";
      } else if (element === targetResist) {
        damage = Math.floor(damage * 0.4);
        effective = "resist";
      }
    }

    const critical = !isMagic && Math.random() < 0.1;
    if (critical) damage = Math.floor(damage * 1.8);

    return { damage: Math.max(1, damage), critical, effective };
  }, []);

  /* ── アクション実行 ── */
  const executeAction = useCallback((
    actorId: string, actorType: "party" | "enemy",
    ability: Ability | null, targetIds: string[],
  ) => {
    setAnimatingAction(ability?.animation || "⚔️");

    const actor = actorType === "party"
      ? party.find((p) => p.id === actorId)!
      : enemies.find((e) => e.id === actorId)!;

    const logs: BattleLog[] = [];
    let newParty = [...party];
    let newEnemies = [...enemies];

    // MP消費
    if (ability && ability.mpCost > 0) {
      if (actorType === "party") {
        const idx = newParty.findIndex((p) => p.id === actorId);
        newParty[idx] = { ...newParty[idx], mp: Math.max(0, newParty[idx].mp - ability.mpCost) };
      }
    }

    // たたかう（ability === null）
    if (!ability) {
      const target = actorType === "party"
        ? newEnemies.find((e) => targetIds.includes(e.id) && e.hp > 0)
        : newParty.find((p) => targetIds.includes(p.id) && p.hp > 0) || newParty.find((p) => p.hp > 0);

      if (target) {
        const { damage, critical } = calcDamage(
          100, actor.atk, target.def, "none",
          "weakness" in target ? (target as Enemy).weakness : "none",
          "resist" in target ? (target as Enemy).resist : "none",
          false,
        );

        if (actorType === "party") {
          const idx = newEnemies.findIndex((e) => e.id === target.id);
          newEnemies[idx] = { ...newEnemies[idx], hp: Math.max(0, newEnemies[idx].hp - damage) };
        } else {
          const idx = newParty.findIndex((p) => p.id === target.id);
          const defBonus = newParty[idx].isDefending ? 0.5 : 1;
          const protBonus = newParty[idx].statusEffects.some((s) => s.type === "protect") ? 0.7 : 1;
          const actualDmg = Math.max(1, Math.floor(damage * defBonus * protBonus));
          newParty[idx] = { ...newParty[idx], hp: Math.max(0, newParty[idx].hp - actualDmg) };
          logs.push({ text: `${actor.emoji} ${actor.name} の攻撃！ → ${newParty[idx].name} に ${actualDmg} ダメージ！`, type: critical ? "critical" : "damage" });
          if (newParty[idx].hp <= 0) logs.push({ text: `💀 ${newParty[idx].name} は倒れた…`, type: "info" });
        }

        if (actorType === "party") {
          const eidx = newEnemies.findIndex((e) => e.id === target.id);
          logs.push({ text: `${actor.emoji} ${actor.name} の攻撃！ → ${target.name} に ${damage} ダメージ！${critical ? " クリティカル！💥" : ""}`, type: critical ? "critical" : "damage" });
          if (newEnemies[eidx].hp <= 0) logs.push({ text: `💀 ${target.name} を倒した！`, type: "info" });
        }
      }
    }
    // アビリティ使用
    else if (ability.type === "attack" || ability.type === "summon") {
      const isMagic = ability.element !== "none" || ability.type === "summon";
      const atkStat = isMagic ? actor.mag : actor.atk;

      if (ability.name === "ぬすむ" || ability.name === "ぶんどる") {
        // 盗む
        const target = newEnemies.find((e) => targetIds.includes(e.id) && e.hp > 0);
        if (target) {
          const stealChance = 0.5 + (actor.spd - target.spd) * 0.03;
          if (Math.random() < stealChance) {
            logs.push({ text: `${actor.emoji} ${actor.name} は ${target.name} からアイテムを盗んだ！ 🧪ポーション を手に入れた！`, type: "info" });
            // インベントリに追加
            setInventory((prev) => {
              const existing = prev.find((i) => i.name === "ポーション");
              if (existing) return prev.map((i) => i.name === "ポーション" ? { ...i, count: i.count + 1 } : i);
              return [...prev, { name: "ポーション", emoji: "🧪", type: "potion", value: 50, description: "HPを50回復", count: 1 }];
            });
          } else {
            logs.push({ text: `${actor.emoji} ${actor.name} は盗みに失敗した…`, type: "miss" });
          }
          // ぶんどるは追加ダメージ
          if (ability.name === "ぶんどる") {
            const { damage } = calcDamage(ability.power, atkStat, target.def, ability.element, target.weakness, target.resist, isMagic);
            const eidx = newEnemies.findIndex((e) => e.id === target.id);
            newEnemies[eidx] = { ...newEnemies[eidx], hp: Math.max(0, newEnemies[eidx].hp - damage) };
            logs.push({ text: `  さらに ${damage} ダメージ！`, type: "damage" });
            if (newEnemies[eidx].hp <= 0) logs.push({ text: `💀 ${target.name} を倒した！`, type: "info" });
          }
        }
      } else if (ability.name === "クイックヒット") {
        // 2回攻撃
        const target = newEnemies.find((e) => targetIds.includes(e.id) && e.hp > 0);
        if (target) {
          logs.push({ text: `${actor.emoji} ${actor.name} の ${ability.name}！`, type: "info" });
          for (let i = 0; i < 2; i++) {
            const { damage, critical } = calcDamage(ability.power, atkStat, target.def, ability.element, target.weakness, target.resist, false);
            const eidx = newEnemies.findIndex((e) => e.id === target.id);
            newEnemies[eidx] = { ...newEnemies[eidx], hp: Math.max(0, newEnemies[eidx].hp - damage) };
            logs.push({ text: `  ${i + 1}Hit → ${damage} ダメージ！${critical ? " クリティカル！💥" : ""}`, type: critical ? "critical" : "damage" });
            if (newEnemies[eidx].hp <= 0) { logs.push({ text: `💀 ${target.name} を倒した！`, type: "info" }); break; }
          }
        }
      } else if (ability.target === "all") {
        // 全体攻撃
        if (ability.type === "summon") {
          logs.push({ text: `${actor.emoji} ${actor.name} は ${ability.name} を召喚した！ ${ability.animation}`, type: "element" });
        } else {
          logs.push({ text: `${actor.emoji} ${actor.name} の ${ability.name}！ ${ability.animation || ""}`, type: "element" });
        }
        const targetList = actorType === "party" ? newEnemies : newParty;
        for (let i = 0; i < targetList.length; i++) {
          if (targetList[i].hp <= 0) continue;
          const t = targetList[i];
          const defStat = isMagic ? t.mdf : t.def;
          const tw = "weakness" in t ? (t as Enemy).weakness : "none" as ElementType;
          const tr = "resist" in t ? (t as Enemy).resist : "none" as ElementType;
          const { damage, effective } = calcDamage(ability.power, atkStat, defStat, ability.element, tw, tr, isMagic);

          let actualDmg = damage;
          if (actorType === "enemy") {
            const pm = t as PartyMember;
            const defBonus = pm.isDefending ? 0.5 : 1;
            const shellBonus = pm.statusEffects.some((s) => s.type === "shell") && isMagic ? 0.7 : 1;
            actualDmg = Math.max(1, Math.floor(damage * defBonus * shellBonus));
          }

          if (actorType === "party") {
            newEnemies[i] = { ...newEnemies[i], hp: Math.max(0, newEnemies[i].hp - actualDmg) };
          } else {
            const pidx = newParty.findIndex((p) => p.id === t.id);
            newParty[pidx] = { ...newParty[pidx], hp: Math.max(0, newParty[pidx].hp - actualDmg) };
          }

          const effText = effective === "weak" ? " 🔥弱点！" : effective === "resist" ? " 🛡️耐性…" : "";
          logs.push({ text: `  → ${t.name} に ${actualDmg} ダメージ！${effText}`, type: effective === "weak" ? "element" : "damage" });
          if (actorType === "party" && newEnemies[i].hp <= 0) logs.push({ text: `  💀 ${t.name} を倒した！`, type: "info" });
          if (actorType === "enemy" && (newParty.find((p) => p.id === t.id)?.hp ?? 1) <= 0) logs.push({ text: `  💀 ${t.name} は倒れた…`, type: "info" });
        }
      } else {
        // 単体攻撃
        const target = actorType === "party"
          ? newEnemies.find((e) => targetIds.includes(e.id) && e.hp > 0)
          : newParty.find((p) => targetIds.includes(p.id) && p.hp > 0) || newParty.find((p) => p.hp > 0);

        if (target) {
          const defStat = isMagic ? target.mdf : target.def;
          const tw = "weakness" in target ? (target as Enemy).weakness : "none" as ElementType;
          const tr = "resist" in target ? (target as Enemy).resist : "none" as ElementType;
          const { damage, critical, effective } = calcDamage(ability.power, atkStat, defStat, ability.element, tw, tr, isMagic);

          let actualDmg = damage;
          if (actorType === "enemy") {
            const pm = target as PartyMember;
            const defBonus = pm.isDefending ? 0.5 : 1;
            const shellBonus = pm.statusEffects.some((s) => s.type === "shell") && isMagic ? 0.7 : 1;
            actualDmg = Math.max(1, Math.floor(damage * defBonus * shellBonus));
          }

          if (actorType === "party") {
            const eidx = newEnemies.findIndex((e) => e.id === target.id);
            newEnemies[eidx] = { ...newEnemies[eidx], hp: Math.max(0, newEnemies[eidx].hp - actualDmg) };
          } else {
            const pidx = newParty.findIndex((p) => p.id === target.id);
            newParty[pidx] = { ...newParty[pidx], hp: Math.max(0, newParty[pidx].hp - actualDmg) };
          }

          const effText = effective === "weak" ? " 🔥弱点！" : effective === "resist" ? " 🛡️耐性…" : "";
          logs.push({ text: `${actor.emoji} ${actor.name} の ${ability.name}！ ${ability.animation || ""} → ${target.name} に ${actualDmg} ダメージ！${critical ? " クリティカル！💥" : ""}${effText}`, type: effective === "weak" ? "element" : critical ? "critical" : "damage" });

          if (actorType === "party") {
            const eidx = newEnemies.findIndex((e) => e.id === target.id);
            if (newEnemies[eidx].hp <= 0) logs.push({ text: `💀 ${target.name} を倒した！`, type: "info" });
          } else {
            if ((newParty.find((p) => p.id === target.id)?.hp ?? 1) <= 0) logs.push({ text: `💀 ${target.name} は倒れた…`, type: "info" });
          }
        }
      }
    }
    // 回復魔法
    else if (ability.type === "heal") {
      const healAmt = Math.floor((ability.power / 100) * actor.mag * (1 + Math.random() * 0.2));
      if (ability.target === "allAllies") {
        logs.push({ text: `${actor.emoji} ${actor.name} の ${ability.name}！ ${ability.animation}`, type: "heal" });
        for (let i = 0; i < newParty.length; i++) {
          if (newParty[i].hp <= 0) continue;
          const before = newParty[i].hp;
          newParty[i] = { ...newParty[i], hp: Math.min(newParty[i].maxHp, newParty[i].hp + healAmt) };
          logs.push({ text: `  → ${newParty[i].name} のHPが ${newParty[i].hp - before} 回復！`, type: "heal" });
        }
      } else {
        const target = newParty.find((p) => targetIds.includes(p.id));
        if (target && target.hp > 0) {
          const idx = newParty.findIndex((p) => p.id === target.id);
          const before = newParty[idx].hp;
          newParty[idx] = { ...newParty[idx], hp: Math.min(newParty[idx].maxHp, newParty[idx].hp + healAmt) };
          logs.push({ text: `${actor.emoji} ${actor.name} の ${ability.name}！ ${ability.animation} → ${target.name} のHPが ${newParty[idx].hp - before} 回復！`, type: "heal" });
        }
      }
    }
    // 蘇生
    else if (ability.type === "revive") {
      const target = newParty.find((p) => targetIds.includes(p.id));
      if (target && target.hp <= 0) {
        const idx = newParty.findIndex((p) => p.id === target.id);
        const reviveHp = Math.floor(newParty[idx].maxHp * (ability.power / 100));
        newParty[idx] = { ...newParty[idx], hp: reviveHp };
        logs.push({ text: `${actor.emoji} ${actor.name} の ${ability.name}！ ${ability.animation} → ${target.name} が復活した！ (HP: ${reviveHp})`, type: "heal" });
      }
    }
    // バフ
    else if (ability.type === "buff") {
      const targetId = ability.target === "self" ? actorId : targetIds[0];
      const target = newParty.find((p) => p.id === targetId);
      if (target) {
        const idx = newParty.findIndex((p) => p.id === targetId);
        const effect: StatusEffect = { name: ability.name, turnsLeft: 5, type: ability.statusEffect! };
        newParty[idx] = {
          ...newParty[idx],
          statusEffects: [...newParty[idx].statusEffects.filter((s) => s.type !== effect.type), effect],
        };
        logs.push({ text: `${actor.emoji} ${actor.name} の ${ability.name}！ ${ability.animation} → ${target.name} に効果付与！`, type: "info" });
      }
    }

    // 防御解除
    newParty = newParty.map((p) => ({ ...p, isDefending: false }));

    setParty(newParty);
    setEnemies(newEnemies);
    setBattleLog((prev) => [...prev, ...logs]);

    // 勝利・敗北チェック
    setTimeout(() => {
      setAnimatingAction(null);
      const allEnemiesDead = newEnemies.every((e) => e.hp <= 0);
      const allPartyDead = newParty.every((p) => p.hp <= 0);

      if (allEnemiesDead) {
        // 勝利！
        const totalExp = newEnemies.reduce((sum, e) => sum + e.exp, 0);
        const totalGold = newEnemies.reduce((sum, e) => sum + e.gold, 0);
        setGold((g) => g + totalGold);

        // レベルアップ処理
        const leveledParty = newParty.map((p) => {
          if (p.hp <= 0) return p;
          let member = { ...p, exp: p.exp + totalExp };
          const learnedAbilities: string[] = [];

          while (member.exp >= member.expNext) {
            member.exp -= member.expNext;
            member.level += 1;
            member.expNext = Math.floor(member.expNext * 1.4);
            const g = GROWTH[member.job];
            member.maxHp += g.hp;
            member.hp = member.maxHp;
            member.maxMp += g.mp;
            member.mp = member.maxMp;
            member.atk += g.atk;
            member.def += g.def;
            member.mag += g.mag;
            member.mdf += g.mdf;
            member.spd += g.spd;

            // 新アビリティ習得
            const learns = LEARN_ABILITIES[member.id] || [];
            for (const l of learns) {
              if (l.level === member.level && !member.abilities.some((a) => a.name === l.ability.name)) {
                member.abilities = [...member.abilities, l.ability];
                learnedAbilities.push(l.ability.name);
              }
            }
          }

          if (member.level > p.level) {
            setBattleLog((prev) => [
              ...prev,
              { text: `🎉 ${member.name} はレベル ${member.level} になった！`, type: "levelup" as const },
              ...learnedAbilities.map((a) => ({ text: `  ✨ ${a} を覚えた！`, type: "levelup" as const })),
            ]);
          }
          return member;
        });

        setParty(leveledParty);

        // ラスボス撃破
        if (newEnemies.some((e) => e.isBoss && ENEMY_TEMPLATES.boss_final.name === e.name)) {
          setBattleReward({ exp: totalExp, gold: totalGold, items: [] });
          setTimeout(() => setScreen("ending"), 1500);
          return;
        }

        setBattleReward({ exp: totalExp, gold: totalGold, items: [] });
        setScreen("battle_result");
      } else if (allPartyDead) {
        setBattleLog((prev) => [...prev, { text: "💀 全滅した…", type: "info" }]);
        setTimeout(() => setScreen("game_over"), 1500);
      } else {
        // 次のターン
        processTurn(newParty, newEnemies);
      }
    }, 600);
  }, [party, enemies, calcDamage]);

  /* ── ターン処理 ── */
  const processTurn = useCallback((currentParty: PartyMember[], currentEnemies: Enemy[]) => {
    // ステータス効果処理（リジェネ等）
    let updatedParty = currentParty.map((p) => {
      if (p.hp <= 0) return p;
      let hp = p.hp;
      const effects = p.statusEffects
        .map((e) => ({ ...e, turnsLeft: e.turnsLeft - 1 }))
        .filter((e) => e.turnsLeft > 0);

      if (p.statusEffects.some((s) => s.type === "regen")) {
        hp = Math.min(p.maxHp, hp + Math.floor(p.maxHp * 0.08));
      }
      if (p.statusEffects.some((s) => s.type === "poison")) {
        hp = Math.max(1, hp - Math.floor(p.maxHp * 0.05));
      }

      return { ...p, hp, statusEffects: effects };
    });

    setParty(updatedParty);
    setTurnCount((t) => t + 1);

    // 速度ベースでソート → 最速キャラのコマンド入力
    const aliveParty = updatedParty.filter((p) => p.hp > 0);
    const aliveEnemies = currentEnemies.filter((e) => e.hp > 0);

    // 全員のSPDをまとめてソート
    type Actor = { id: string; type: "party" | "enemy"; spd: number };
    const actors: Actor[] = [
      ...aliveParty.map((p) => ({ id: p.id, type: "party" as const, spd: p.spd + rng(-2, 2) })),
      ...aliveEnemies.map((e) => ({ id: e.id, type: "enemy" as const, spd: e.spd + rng(-2, 2) })),
    ].sort((a, b) => b.spd - a.spd);

    // 最速が味方ならコマンド入力、敵ならAI行動
    const next = actors[0];
    if (next.type === "party") {
      setActiveCharId(next.id);
      setScreen("battle_command");
    } else {
      // 敵AI行動
      enemyAI(next.id, updatedParty, aliveEnemies);
    }
  }, []);

  /* ── 敵AI ── */
  const enemyAI = useCallback((enemyId: string, currentParty: PartyMember[], currentEnemies: Enemy[]) => {
    const enemy = currentEnemies.find((e) => e.id === enemyId);
    if (!enemy || enemy.hp <= 0) return;

    const aliveParty = currentParty.filter((p) => p.hp > 0);
    if (aliveParty.length === 0) return;

    // アビリティがあって MP 足りれば使う（30%）
    let ability: Ability | null = null;
    const usableAbilities = enemy.abilities.filter((a) => a.mpCost <= enemy.mp);
    if (usableAbilities.length > 0 && Math.random() < 0.35) {
      ability = pick(usableAbilities);
    }

    // ターゲット選択
    let targets: string[];
    if (ability && (ability.target === "all" || ability.target === "allAllies")) {
      targets = aliveParty.map((p) => p.id);
    } else {
      // HPが低い味方を狙いやすい
      const sorted = [...aliveParty].sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp));
      targets = [Math.random() < 0.4 ? sorted[0].id : pick(aliveParty).id];
    }

    executeAction(enemyId, "enemy", ability, targets);
  }, [executeAction]);

  /* ── バトル開始 ── */
  const startBattle = useCallback((enemyTemplates: EnemyTemplate[]) => {
    const spawned = enemyTemplates.map((t, i) => spawnEnemy(t, i));
    setEnemies(spawned);
    setBattleLog([{ text: `⚔️ ${spawned.map((e) => e.name).join("、")} が現れた！`, type: "info" }]);
    setIsBossBattle(spawned.some((e) => e.isBoss));
    setBattleReward(null);
    setTurnCount(0);

    // 初期パーティのステータス効果リセット、防御解除
    setParty((prev) => prev.map((p) => ({ ...p, statusEffects: [], isDefending: false })));

    // 速度ソートで最初のアクターを決定
    const aliveParty = party.filter((p) => p.hp > 0);
    type Actor = { id: string; type: "party" | "enemy"; spd: number };
    const actors: Actor[] = [
      ...aliveParty.map((p) => ({ id: p.id, type: "party" as const, spd: p.spd + rng(-2, 2) })),
      ...spawned.map((e) => ({ id: e.id, type: "enemy" as const, spd: e.spd + rng(-2, 2) })),
    ].sort((a, b) => b.spd - a.spd);

    const first = actors[0];
    if (first.type === "party") {
      setActiveCharId(first.id);
      setScreen("battle_command");
    } else {
      setActiveCharId(null);
      setScreen("battle");
      setTimeout(() => {
        enemyAI(first.id, party, spawned);
      }, 800);
    }
  }, [party, enemyAI]);

  /* ── 部屋移動 ── */
  const moveToRoom = useCallback((roomId: string) => {
    setCurrentRoomId(roomId);
    setVisitedRooms((prev) => new Set([...prev, roomId]));
    setEventMessage(null);

    const room = dungeon.find((r) => r.id === roomId)!;

    // セーブポイント（回復）
    if (room.event && room.event.effect === "heal") {
      setParty((prev) => prev.map((p) => ({ ...p, hp: p.maxHp, mp: p.maxMp, statusEffects: [] })));
      setEventMessage(room.event.text);
    }

    // ランダムエンカウント（非ボス部屋で敵がいる場合）
    if (room.enemies && !room.isBoss && Math.random() < 0.6) {
      const count = Math.min(room.enemies.length, rng(1, 3));
      const selected: EnemyTemplate[] = [];
      for (let i = 0; i < count; i++) selected.push(pick(room.enemies));
      setTimeout(() => startBattle(selected), 500);
    }
  }, [dungeon, startBattle]);

  /* ── アイテム使用（バトル中） ── */
  const useItem = useCallback((item: InventoryItem, targetId: string) => {
    let newParty = [...party];
    const logs: BattleLog[] = [];

    const idx = newParty.findIndex((p) => p.id === targetId);
    if (idx < 0) return;

    if (item.type === "potion") {
      if (newParty[idx].hp <= 0) { logs.push({ text: "戦闘不能のキャラには使えない！", type: "info" }); return; }
      const before = newParty[idx].hp;
      newParty[idx] = { ...newParty[idx], hp: Math.min(newParty[idx].maxHp, newParty[idx].hp + item.value) };
      logs.push({ text: `🧪 ${item.name} を使った！ → ${newParty[idx].name} のHPが ${newParty[idx].hp - before} 回復！`, type: "heal" });
    } else if (item.type === "ether") {
      if (newParty[idx].hp <= 0) { logs.push({ text: "戦闘不能のキャラには使えない！", type: "info" }); return; }
      const before = newParty[idx].mp;
      newParty[idx] = { ...newParty[idx], mp: Math.min(newParty[idx].maxMp, newParty[idx].mp + item.value) };
      logs.push({ text: `💧 ${item.name} を使った！ → ${newParty[idx].name} のMPが ${newParty[idx].mp - before} 回復！`, type: "heal" });
    } else if (item.type === "phoenix") {
      if (newParty[idx].hp > 0) { logs.push({ text: "生きているキャラには使えない！", type: "info" }); return; }
      newParty[idx] = { ...newParty[idx], hp: Math.floor(newParty[idx].maxHp * 0.3) };
      logs.push({ text: `🪶 ${item.name} を使った！ → ${newParty[idx].name} が復活した！`, type: "heal" });
    }

    // アイテム消費
    setInventory((prev) => prev.map((i) => i.name === item.name ? { ...i, count: i.count - 1 } : i).filter((i) => i.count > 0));
    setParty(newParty);
    setBattleLog((prev) => [...prev, ...logs]);

    // 次のターンへ
    setTimeout(() => {
      const aliveEnemies = enemies.filter((e) => e.hp > 0);
      if (aliveEnemies.length > 0) processTurn(newParty, aliveEnemies);
    }, 600);
  }, [party, enemies, processTurn]);

  /* ── 新しいゲーム ── */
  const newGame = useCallback(() => {
    setParty(createParty());
    setGold(100);
    setInventory(initialInventory());
    setDungeon(createDungeon());
    setCurrentRoomId("start");
    setVisitedRooms(new Set(["start"]));
    setEnemies([]);
    setBattleLog([]);
    setActiveCharId(null);
    setBattleReward(null);
    setScreen("dungeon");
  }, []);

  /* ═══════════════════════════════════════════════════════════
     レンダリング
     ═══════════════════════════════════════════════════════════ */

  /* ── HP/MPバー ── */
  const HPBar = ({ current, max, color = "bg-green-500" }: { current: number; max: number; color?: string }) => (
    <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
      <div className={`h-full ${color} rounded-full transition-all duration-300`}
        style={{ width: `${Math.max(0, (current / max) * 100)}%` }} />
    </div>
  );

  /* ── タイトル画面 ── */
  if (screen === "title") {
    return (
      <main className="min-h-screen bg-linear-to-b from-slate-950 via-blue-950 to-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* クリスタル的なキラキラ */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="absolute text-blue-300/30 animate-pulse"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, fontSize: `${8 + Math.random() * 12}px`, animationDelay: `${Math.random() * 3}s` }}>
              ✦
            </div>
          ))}
        </div>
        <div className="relative z-10 text-center">
          <p className="text-blue-300/80 text-xs tracking-[0.6em] mb-3">♦ CRYSTAL FANTASY ♦</p>
          <h1 className="text-5xl md:text-7xl font-extrabold bg-linear-to-r from-blue-300 via-cyan-200 to-purple-300 bg-clip-text text-transparent">
            CRYSTAL FANTASY
          </h1>
          <p className="mt-2 text-lg text-blue-200/70">〜 光と闇のクリスタル 〜</p>

          <div className="mt-6 space-y-2 text-sm text-slate-300 max-w-md mx-auto">
            <p>闇の力に蝕まれたクリスタルを取り戻すため、</p>
            <p>4人の光の戦士が冒険に旅立つ──</p>
          </div>

          <div className="mt-6 flex justify-center gap-4 text-3xl">
            {createParty().map((c) => (
              <div key={c.id} className="text-center">
                <span className="block text-3xl">{c.emoji}</span>
                <span className={`text-xs ${JOB_COLORS[c.job]}`}>{c.name}</span>
              </div>
            ))}
          </div>

          <button onClick={newGame}
            className="mt-8 px-10 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white text-xl font-bold rounded-2xl shadow-lg shadow-blue-500/30 hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-105 active:scale-95">
            ⚔️ 冒険を始める
          </button>
          <Link href="/" className="block mt-4 text-sm text-slate-400 hover:text-slate-200 transition">
            ← ゲーム一覧に戻る
          </Link>
        </div>
      </main>
    );
  }

  /* ── パーティステータスバー（共通） ── */
  const PartyStatus = ({ compact = false }: { compact?: boolean }) => (
    <div className={`grid ${compact ? "grid-cols-4 gap-1" : "grid-cols-2 md:grid-cols-4 gap-2"}`}>
      {party.map((p) => (
        <div key={p.id} className={`rounded-lg border p-2 ${
          p.hp <= 0 ? "bg-slate-900/80 border-slate-700/40 opacity-60"
            : activeCharId === p.id ? "bg-blue-900/40 border-blue-400/60 ring-1 ring-blue-400/40"
              : "bg-slate-800/60 border-slate-700/40"
        }`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-lg">{p.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span className={`text-xs font-bold ${JOB_COLORS[p.job]} truncate`}>{p.name}</span>
                <span className="text-[10px] text-slate-500">Lv{p.level}</span>
              </div>
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-green-400 w-5">HP</span>
              <HPBar current={p.hp} max={p.maxHp} color={p.hp / p.maxHp < 0.25 ? "bg-red-500" : p.hp / p.maxHp < 0.5 ? "bg-yellow-500" : "bg-green-500"} />
              <span className="text-[10px] text-slate-400 w-12 text-right">{p.hp}/{p.maxHp}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-blue-400 w-5">MP</span>
              <HPBar current={p.mp} max={p.maxMp} color="bg-blue-500" />
              <span className="text-[10px] text-slate-400 w-12 text-right">{p.mp}/{p.maxMp}</span>
            </div>
          </div>
          {p.statusEffects.length > 0 && (
            <div className="flex gap-0.5 mt-1 flex-wrap">
              {p.statusEffects.map((s, i) => (
                <span key={i} className="text-[9px] bg-slate-700/60 px-1 rounded">
                  {s.type === "protect" ? "🛡️" : s.type === "shell" ? "🔰" : s.type === "regen" ? "🌿" : s.type === "haste" ? "⚡" : s.type === "poison" ? "☠️" : ""}
                  {s.turnsLeft}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  /* ── 敵表示 ── */
  const EnemyDisplay = ({ selectable = false, onSelect }: { selectable?: boolean; onSelect?: (id: string) => void }) => (
    <div className="flex justify-center gap-4 flex-wrap">
      {enemies.map((e) => (
        <button key={e.id} disabled={!selectable || e.hp <= 0}
          onClick={() => onSelect?.(e.id)}
          className={`text-center px-4 py-3 rounded-xl border transition ${
            e.hp <= 0 ? "opacity-30 border-slate-700/30"
              : selectable ? "border-red-500/40 hover:bg-red-900/30 hover:border-red-400/60 cursor-pointer"
                : "border-slate-700/40"
          } ${e.isBoss ? "bg-red-950/30" : "bg-slate-800/40"}`}>
          <div className="text-4xl mb-1">{e.emoji}</div>
          <div className={`text-sm font-bold ${e.isBoss ? "text-red-300" : "text-white"}`}>{e.name}</div>
          <div className="text-[10px] text-slate-400">Lv{e.level}</div>
          <div className="w-20 mt-1">
            <HPBar current={e.hp} max={e.maxHp} color={e.isBoss ? "bg-red-500" : "bg-orange-500"} />
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{e.hp}/{e.maxHp}</div>
        </button>
      ))}
    </div>
  );

  /* ── バトルログ表示 ── */
  const BattleLogDisplay = () => (
    <div ref={logRef} className="bg-slate-900/80 rounded-lg border border-slate-700/40 p-3 h-32 overflow-y-auto text-sm space-y-0.5">
      {battleLog.map((log, i) => (
        <p key={i} className={`${
          log.type === "damage" ? "text-slate-300"
            : log.type === "critical" ? "text-yellow-300 font-bold"
              : log.type === "heal" ? "text-green-300"
                : log.type === "element" ? "text-orange-300"
                  : log.type === "miss" ? "text-slate-500"
                    : log.type === "levelup" ? "text-amber-300 font-bold"
                      : "text-slate-400"
        }`}>{log.text}</p>
      ))}
      {battleLog.length === 0 && <p className="text-slate-500">...</p>}
    </div>
  );

  /* ── バトルコマンド画面 ── */
  if (screen === "battle_command" && activeCharId) {
    const activeChar = party.find((p) => p.id === activeCharId)!;
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col">
        {/* 敵エリア */}
        <div className={`flex-1 ${isBossBattle ? "bg-linear-to-b from-red-950/40 to-slate-950" : "bg-linear-to-b from-indigo-950/40 to-slate-950"} p-4 flex flex-col justify-center`}>
          {animatingAction && (
            <div className="text-center text-4xl mb-4 animate-bounce">{animatingAction}</div>
          )}
          <EnemyDisplay />
        </div>

        {/* バトルログ */}
        <div className="px-4 py-2">
          <BattleLogDisplay />
        </div>

        {/* コマンド + パーティ */}
        <div className="bg-slate-900/95 border-t border-slate-700/60 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">{activeChar.emoji}</span>
            <span className={`font-bold ${JOB_COLORS[activeChar.job]}`}>{activeChar.name}</span>
            <span className="text-xs text-slate-400">のターン</span>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-3">
            <button onClick={() => {
              setSelectedAbility(null);
              setScreen("battle_target");
            }} className="bg-slate-700/60 border border-slate-600/40 rounded-lg py-2 text-sm font-bold hover:bg-slate-600/60 transition">
              ⚔️ たたかう
            </button>
            <button onClick={() => setScreen("battle_magic")}
              className="bg-blue-900/40 border border-blue-700/40 rounded-lg py-2 text-sm font-bold hover:bg-blue-800/40 transition text-blue-300">
              🔮 まほう
            </button>
            <button onClick={() => setScreen("battle_item")}
              className="bg-green-900/40 border border-green-700/40 rounded-lg py-2 text-sm font-bold hover:bg-green-800/40 transition text-green-300">
              🎒 アイテム
            </button>
            <button onClick={() => {
              // 防御
              setParty((prev) => prev.map((p) => p.id === activeCharId ? { ...p, isDefending: true } : p));
              setBattleLog((prev) => [...prev, { text: `${activeChar.emoji} ${activeChar.name} は防御した！ 🛡️`, type: "info" }]);
              const aliveEnemies = enemies.filter((e) => e.hp > 0);
              setTimeout(() => processTurn(party.map((p) => p.id === activeCharId ? { ...p, isDefending: true } : p), aliveEnemies), 400);
            }} className="bg-amber-900/40 border border-amber-700/40 rounded-lg py-2 text-sm font-bold hover:bg-amber-800/40 transition text-amber-300">
              🛡️ ぼうぎょ
            </button>
          </div>

          <PartyStatus compact />
        </div>
      </main>
    );
  }

  /* ── ターゲット選択 ── */
  if (screen === "battle_target") {
    const isAllyTarget = selectedAbility && (selectedAbility.target === "ally" || selectedAbility.target === "allAllies");
    const isRevive = selectedAbility?.type === "revive";

    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col">
        <div className={`flex-1 ${isBossBattle ? "bg-linear-to-b from-red-950/40 to-slate-950" : "bg-linear-to-b from-indigo-950/40 to-slate-950"} p-4 flex flex-col justify-center`}>
          {isAllyTarget ? (
            <div className="max-w-2xl mx-auto w-full">
              <p className="text-center text-sm text-slate-400 mb-4">
                {selectedAbility?.target === "allAllies" ? "味方全体に使用します" : "対象の味方を選んでください"}
              </p>
              {selectedAbility?.target === "allAllies" ? (
                <button onClick={() => {
                  const targets = party.filter((p) => p.hp > 0).map((p) => p.id);
                  executeAction(activeCharId!, "party", selectedAbility, targets);
                }} className="w-full py-3 bg-green-800/40 border border-green-600/40 rounded-xl text-green-300 font-bold hover:bg-green-700/40 transition">
                  ✨ 味方全体に使用
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {party.map((p) => (
                    <button key={p.id}
                      disabled={isRevive ? p.hp > 0 : p.hp <= 0}
                      onClick={() => {
                        executeAction(activeCharId!, "party", selectedAbility!, [p.id]);
                      }}
                      className={`p-3 rounded-xl border text-left transition ${
                        (isRevive ? p.hp > 0 : p.hp <= 0) ? "opacity-30 border-slate-700/30"
                          : "border-green-500/40 hover:bg-green-900/30 cursor-pointer"
                      }`}>
                      <span className="text-lg">{p.emoji}</span>
                      <span className={`ml-2 font-bold ${JOB_COLORS[p.job]}`}>{p.name}</span>
                      <span className="text-xs text-slate-400 ml-2">HP {p.hp}/{p.maxHp}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <p className="text-center text-sm text-slate-400 mb-4">攻撃対象を選んでください</p>
              <EnemyDisplay selectable onSelect={(id) => {
                executeAction(activeCharId!, "party", selectedAbility, [id]);
              }} />
            </>
          )}
        </div>
        <div className="bg-slate-900/95 border-t border-slate-700/60 p-4">
          <button onClick={() => setScreen("battle_command")} className="text-sm text-slate-400 hover:text-slate-200 transition">
            ← 戻る
          </button>
          <div className="mt-2">
            <PartyStatus compact />
          </div>
        </div>
      </main>
    );
  }

  /* ── 魔法選択 ── */
  if (screen === "battle_magic" && activeCharId) {
    const activeChar = party.find((p) => p.id === activeCharId)!;
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col">
        <div className="flex-1 bg-linear-to-b from-blue-950/40 to-slate-950 p-4">
          <h3 className="text-lg font-bold mb-4">🔮 まほう</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-2xl">
            {activeChar.abilities.map((ability) => (
              <button key={ability.name}
                disabled={activeChar.mp < ability.mpCost}
                onClick={() => {
                  setSelectedAbility(ability);
                  if (ability.target === "self") {
                    executeAction(activeCharId, "party", ability, [activeCharId]);
                  } else {
                    setScreen("battle_target");
                  }
                }}
                className={`p-3 rounded-xl border text-left transition ${
                  activeChar.mp < ability.mpCost ? "opacity-40 border-slate-700/30"
                    : "border-blue-600/40 hover:bg-blue-900/30 hover:border-blue-400/60"
                }`}>
                <div className="flex items-center gap-2">
                  <span>{ability.animation || "✨"}</span>
                  <span className={`text-sm font-bold ${ELEMENT_COLORS[ability.element]}`}>{ability.name}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  MP {ability.mpCost} | {ability.description}
                </div>
                {ability.element !== "none" && (
                  <span className="text-[10px] text-slate-500">{ELEMENT_EMOJI[ability.element]} {ability.element}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="bg-slate-900/95 border-t border-slate-700/60 p-4">
          <button onClick={() => setScreen("battle_command")} className="text-sm text-slate-400 hover:text-slate-200 transition">
            ← 戻る
          </button>
          <div className="mt-2"><PartyStatus compact /></div>
        </div>
      </main>
    );
  }

  /* ── アイテム選択（バトル中） ── */
  if (screen === "battle_item") {
    const usableItems = inventory.filter((i) => ["potion", "ether", "phoenix"].includes(i.type));
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col">
        <div className="flex-1 bg-linear-to-b from-green-950/40 to-slate-950 p-4">
          <h3 className="text-lg font-bold mb-4">🎒 アイテム</h3>
          {usableItems.length === 0 ? (
            <p className="text-slate-400">使えるアイテムがない…</p>
          ) : (
            <div className="space-y-2 max-w-md">
              {usableItems.map((item) => (
                <div key={item.name} className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold">{item.emoji} {item.name} ×{item.count}</span>
                    <span className="text-xs text-slate-400">{item.description}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {party.map((p) => (
                      <button key={p.id}
                        disabled={item.type === "phoenix" ? p.hp > 0 : p.hp <= 0}
                        onClick={() => {
                          useItem(item, p.id);
                          setScreen("battle");
                        }}
                        className={`text-xs px-2 py-1 rounded border transition ${
                          (item.type === "phoenix" ? p.hp > 0 : p.hp <= 0)
                            ? "opacity-30 border-slate-700/30"
                            : "border-green-600/40 hover:bg-green-900/30"
                        }`}>
                        {p.emoji} {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="bg-slate-900/95 border-t border-slate-700/60 p-4">
          <button onClick={() => setScreen("battle_command")} className="text-sm text-slate-400 hover:text-slate-200 transition">
            ← 戻る
          </button>
          <div className="mt-2"><PartyStatus compact /></div>
        </div>
      </main>
    );
  }

  /* ── バトルアニメーション中 ── */
  if (screen === "battle") {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col">
        <div className={`flex-1 ${isBossBattle ? "bg-linear-to-b from-red-950/40 to-slate-950" : "bg-linear-to-b from-indigo-950/40 to-slate-950"} p-4 flex flex-col justify-center`}>
          {animatingAction && <div className="text-center text-4xl mb-4 animate-bounce">{animatingAction}</div>}
          <EnemyDisplay />
        </div>
        <div className="px-4 py-2"><BattleLogDisplay /></div>
        <div className="bg-slate-900/95 border-t border-slate-700/60 p-4">
          <PartyStatus compact />
        </div>
      </main>
    );
  }

  /* ── バトル結果 ── */
  if (screen === "battle_result" && battleReward) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="bg-linear-to-br from-amber-900/30 to-slate-900/80 rounded-2xl p-8 border border-amber-700/40 text-center max-w-md w-full">
          <h2 className="text-2xl font-bold text-amber-200 mb-4">🏆 勝利！</h2>
          <div className="space-y-2 text-lg">
            <p>✨ 経験値 <span className="font-bold text-amber-300">{battleReward.exp}</span> を獲得！</p>
            <p>💰 <span className="font-bold text-yellow-300">{battleReward.gold}</span> ギル を手に入れた！</p>
          </div>
          {/* 宝箱チェック */}
          {currentRoom.treasure && !visitedRooms.has(currentRoomId + "_treasure") && (
            <div className="mt-4 p-3 bg-amber-800/30 rounded-xl border border-amber-600/40">
              <p className="text-amber-200">🎁 {currentRoom.treasure.emoji} {currentRoom.treasure.name} を見つけた！</p>
            </div>
          )}
          <button onClick={() => {
            // 宝箱回収
            if (currentRoom.treasure && !visitedRooms.has(currentRoomId + "_treasure")) {
              setVisitedRooms((prev) => new Set([...prev, currentRoomId + "_treasure"]));
              const t = currentRoom.treasure;
              setInventory((prev) => {
                const existing = prev.find((i) => i.name === t.name);
                if (existing) return prev.map((i) => i.name === t.name ? { ...i, count: i.count + 1 } : i);
                return [...prev, { ...t, count: 1 }];
              });
            }
            setScreen("dungeon");
          }} className="mt-6 px-8 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-105 active:scale-95">
            次へ →
          </button>
        </div>
      </main>
    );
  }

  /* ── ダンジョン探索画面 ── */
  if (screen === "dungeon") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        {/* ヘッダー */}
        <div className="bg-slate-900/90 border-b border-slate-700/60 px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{currentRoom.emoji}</span>
              <div>
                <span className="text-lg font-bold">{currentRoom.name}</span>
                <span className="text-xs text-yellow-400 ml-2">💰 {gold} ギル</span>
              </div>
            </div>
            <button onClick={() => setScreen("menu")}
              className="text-xs px-3 py-1 bg-slate-700/60 text-slate-300 rounded-lg hover:bg-slate-600/60 transition">
              📋 メニュー
            </button>
          </div>
        </div>

        <div className="max-w-4xl mx-auto p-4">
          {/* 現在地の説明 */}
          <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4 mb-4">
            <p className="text-slate-300">{currentRoom.description}</p>
            {currentRoom.isSavePoint && (
              <p className="text-cyan-300 mt-2">💎 セーブクリスタルが輝いている。体力が全回復した！</p>
            )}
            {eventMessage && (
              <p className="text-green-300 mt-2">✨ {eventMessage}</p>
            )}
          </div>

          {/* パーティステータス */}
          <div className="mb-4">
            <PartyStatus />
          </div>

          {/* ボス部屋なら戦闘ボタン */}
          {currentRoom.isBoss && currentRoom.enemies && (
            <div className="mb-4">
              <button onClick={() => startBattle(currentRoom.enemies!)}
                className="w-full py-4 bg-red-900/40 border border-red-600/40 rounded-xl text-red-200 font-bold text-lg hover:bg-red-800/40 transition">
                ⚔️ {currentRoom.enemies[0].name} に挑む！
              </button>
            </div>
          )}

          {/* 移動先 */}
          <div>
            <h3 className="text-sm font-bold text-slate-400 mb-2">🚪 移動先</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {currentRoom.connections.map((connId) => {
                const room = dungeon.find((r) => r.id === connId)!;
                const visited = visitedRooms.has(connId);
                return (
                  <button key={connId} onClick={() => moveToRoom(connId)}
                    className={`p-3 rounded-xl border text-left transition ${
                      room.isBoss ? "border-red-600/40 hover:bg-red-900/20 bg-red-950/20"
                        : room.isSavePoint ? "border-cyan-600/40 hover:bg-cyan-900/20 bg-cyan-950/20"
                          : "border-slate-700/40 hover:bg-slate-700/40"
                    }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{room.emoji}</span>
                      <div>
                        <span className="text-sm font-bold">{room.name}</span>
                        {visited && <span className="text-[10px] text-slate-500 ml-1">（探索済）</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    );
  }

  /* ── メニュー画面 ── */
  if (screen === "menu") {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-4">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">📋 メニュー</h2>

          {/* パーティ詳細 */}
          <div className="space-y-3 mb-6">
            {party.map((p) => (
              <div key={p.id} className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{p.emoji}</span>
                  <div>
                    <span className={`font-bold text-lg ${JOB_COLORS[p.job]}`}>{p.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{JOB_NAMES[p.job]} Lv.{p.level}</span>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="text-xs text-slate-400">EXP: {p.exp}/{p.expNext}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-2">
                  <div className="flex justify-between"><span className="text-green-400">HP</span><span>{p.hp}/{p.maxHp}</span></div>
                  <div className="flex justify-between"><span className="text-blue-400">MP</span><span>{p.mp}/{p.maxMp}</span></div>
                  <div className="flex justify-between"><span className="text-red-400">ATK</span><span>{p.atk}</span></div>
                  <div className="flex justify-between"><span className="text-amber-400">DEF</span><span>{p.def}</span></div>
                  <div className="flex justify-between"><span className="text-purple-400">MAG</span><span>{p.mag}</span></div>
                  <div className="flex justify-between"><span className="text-cyan-400">MDF</span><span>{p.mdf}</span></div>
                  <div className="flex justify-between"><span className="text-yellow-400">SPD</span><span>{p.spd}</span></div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {p.abilities.map((a) => (
                    <span key={a.name} className="text-[10px] bg-slate-700/60 px-1.5 py-0.5 rounded">
                      {a.animation || "✨"} {a.name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* 所持品 */}
          <div className="bg-slate-800/60 rounded-xl border border-slate-700/40 p-4 mb-6">
            <h3 className="font-bold mb-2">🎒 アイテム</h3>
            {inventory.length === 0 ? (
              <p className="text-slate-400 text-sm">アイテムなし</p>
            ) : (
              <div className="space-y-1">
                {inventory.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <span>{item.emoji} {item.name}</span>
                    <span className="text-slate-400">×{item.count}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-yellow-400 text-sm mt-2">💰 {gold} ギル</p>
          </div>

          <button onClick={() => setScreen("dungeon")}
            className="px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition">
            ← 戻る
          </button>
        </div>
      </main>
    );
  }

  /* ── ゲームオーバー ── */
  if (screen === "game_over") {
    return (
      <main className="min-h-screen bg-linear-to-b from-red-950 via-slate-950 to-slate-950 text-white flex flex-col items-center justify-center p-6">
        <div className="text-center">
          <div className="text-6xl mb-6">💀</div>
          <h1 className="text-4xl font-extrabold text-red-300 mb-4">GAME OVER</h1>
          <p className="text-slate-300 mb-8">光の戦士は倒れた…しかし、希望は消えない。</p>
          <div className="flex flex-col gap-3">
            <button onClick={newGame}
              className="px-8 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-105">
              🔄 最初からやり直す
            </button>
            <Link href="/" className="text-sm text-slate-400 hover:text-slate-200 transition">
              ← ゲーム一覧に戻る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ── エンディング ── */
  if (screen === "ending") {
    return (
      <main className="min-h-screen bg-linear-to-b from-blue-950 via-purple-950 to-slate-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="absolute text-blue-200/20 animate-pulse"
              style={{ left: `${Math.random() * 100}%`, top: `${Math.random() * 100}%`, fontSize: `${6 + Math.random() * 14}px`, animationDelay: `${Math.random() * 4}s` }}>
              ✦
            </div>
          ))}
        </div>
        <div className="relative z-10 text-center max-w-xl">
          <div className="text-6xl mb-4">💎</div>
          <h1 className="text-4xl md:text-5xl font-extrabold bg-linear-to-r from-blue-300 via-cyan-200 to-purple-300 bg-clip-text text-transparent mb-6">
            CRYSTAL FANTASY
          </h1>
          <div className="bg-slate-900/60 rounded-2xl p-6 border border-blue-700/40 mb-8 text-left space-y-3 text-slate-200">
            <p>冥皇カオスは倒れ、世界に光が戻った。</p>
            <p>4つのクリスタルは再び輝きを取り戻し、<br />大地には穏やかな風が吹いた。</p>
            <p className="text-center text-2xl">🌍✨</p>
            <p>セシルは剣を鞘に収め、空を見上げた。<br />「みんな…ありがとう。」</p>
            <p>ビビは魔導書をそっと閉じ、<br />ローザは祈りの手を解いた。</p>
            <p>ジタンは仲間の肩を叩いて笑った。<br />「さぁ、帰ろうぜ！」</p>
            <p className="text-center font-bold text-blue-300 mt-4">
              光の戦士たちの物語は、こうして幕を閉じた──<br />
              しかし、クリスタルの輝きは永遠に続く。
            </p>
          </div>

          <div className="bg-slate-800/40 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-bold text-slate-400 mb-3">── 最終ステータス ──</h3>
            <div className="grid grid-cols-2 gap-2">
              {party.map((p) => (
                <div key={p.id} className="bg-slate-900/40 rounded-lg p-2 text-center">
                  <span className="text-lg">{p.emoji}</span>
                  <span className={`ml-1 text-sm font-bold ${JOB_COLORS[p.job]}`}>{p.name}</span>
                  <div className="text-xs text-slate-400">Lv.{p.level} {JOB_NAMES[p.job]}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500 mb-6 tracking-[0.3em]">♦ FIN ♦</p>

          <div className="flex flex-col gap-3">
            <button onClick={() => setScreen("title")}
              className="px-10 py-4 bg-linear-to-r from-blue-600 to-purple-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:from-blue-500 hover:to-purple-500 transition-all hover:scale-105 active:scale-95">
              🏠 タイトルに戻る
            </button>
            <Link href="/" className="text-sm text-slate-400 hover:text-slate-200 transition">
              ← ゲーム一覧に戻る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  /* ── フォールバック ── */
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <button onClick={() => setScreen("dungeon")} className="text-cyan-300 hover:underline">
        ダンジョンに戻る
      </button>
    </main>
  );
}
