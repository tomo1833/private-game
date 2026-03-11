"use client";

import Link from "next/link";
import { useState, useCallback, useMemo, useEffect, useRef } from "react";

/* ═══════════════════════════════════════════════════════════
   型定義
   ═══════════════════════════════════════════════════════════ */

/** パラメータ名 */
type StatName = "学力" | "運動" | "芸術" | "雑学" | "容姿" | "根性";

/** プレイヤーステータス */
type Stats = Record<StatName, number>;

/** 好感度情報 */
type Affection = { value: number; met: boolean };

/** キャラクター定義 */
type Character = {
  id: string;
  name: string;
  emoji: string;
  color: string;        // Tailwind テキスト色
  bgColor: string;      // Tailwind 背景色
  description: string;
  preference: StatName; // 最重視パラメータ
  secondPref: StatName; // 次に重視
  dialogues: {
    greeting: string[];
    dateAccept: string[];
    dateReject: string[];
    highAffection: string[];
    lowAffection: string[];
    confession: string[];
    confessionReject: string[];
  };
};

/** イベント */
type GameEvent = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  effect: Partial<Stats>;
  affectionBonus?: { characterId: string; value: number }[];
  month?: number; // 発生月（undefined なら通年）
};

/** コマンド選択肢 */
type Command = {
  label: string;
  emoji: string;
  statGain: Partial<Stats>;
  stressDelta: number;
  description: string;
};

/** ゲーム画面 */
type Screen =
  | "title"
  | "command"
  | "result"
  | "date_select"
  | "date_scene"
  | "event"
  | "phone"
  | "ending"
  | "status"
  | "calendar";

/* ═══════════════════════════════════════════════════════════
   キャラクターデータ
   ═══════════════════════════════════════════════════════════ */

const CHARACTERS: Character[] = [
  {
    id: "sakura",
    name: "桜井 美咲",
    emoji: "🌸",
    color: "text-pink-300",
    bgColor: "bg-pink-500/20",
    description: "文武両道の学級委員長。真面目で努力家だが、実は少しドジ。",
    preference: "学力",
    secondPref: "根性",
    dialogues: {
      greeting: [
        "あ、おはよう！今日も勉強頑張ろうね！",
        "テストの範囲、もう確認した？",
        "図書室で一緒に勉強しない？",
      ],
      dateAccept: [
        "え、一緒にお出かけ？…うん、いいよ！",
        "わ、嬉しい！どこに行く？",
      ],
      dateReject: [
        "ごめんね、今日はちょっと予定があって…",
        "また今度誘ってくれると嬉しいな。",
      ],
      highAffection: [
        "最近、あなたと話すのが一番楽しいかも…♪",
        "あなたって、すごく頑張り屋さんだよね。尊敬する！",
        "あなたのこと…もっと知りたいな。",
      ],
      lowAffection: [
        "あ、うん…こんにちは。",
        "ちょっと忙しいから…ごめんね。",
      ],
      confession: [
        "ずっと言えなかったけど…私、あなたのことが好きです！\n一緒にいると、心が温かくなるの。\nこれからも…ずっと隣にいてくれますか？",
      ],
      confessionReject: [
        "あなたのことは好きだけど…友達として、かな。\nごめんね…。",
      ],
    },
  },
  {
    id: "hinata",
    name: "日向 陽菜",
    emoji: "☀️",
    color: "text-yellow-300",
    bgColor: "bg-yellow-500/20",
    description: "いつも元気いっぱいのスポーツ少女。天真爛漫で友達が多い。",
    preference: "運動",
    secondPref: "根性",
    dialogues: {
      greeting: [
        "やっほー！今日もいい天気だね！",
        "ねぇねぇ、放課後一緒に走らない？",
        "うーん、今日は何して遊ぶ？",
      ],
      dateAccept: [
        "マジで！？行く行く！！",
        "やったー！楽しみ！",
      ],
      dateReject: [
        "あー、ごめん！今日は部活の試合なんだ〜",
        "また誘ってよ！次は絶対空けとくから！",
      ],
      highAffection: [
        "なんかさ、あなたといると元気100倍って感じ！",
        "ねぇ、ずっとこうして一緒にいられたらいいのにね。",
        "あなたのこと考えると、胸がドキドキするんだ…なんでだろ？",
      ],
      lowAffection: [
        "おーす。じゃーねー。",
        "ん？なんか用？",
      ],
      confession: [
        "あのさ…ずっと気づいてたんだけど、認めたくなくて。\nでも…やっぱり好き！大好きだよ！！\nこれからも一緒に走ってくれる？",
      ],
      confessionReject: [
        "あたし達、最高のライバルだよね！\n…そういう気持ちとはちょっと違うかな。ごめん！",
      ],
    },
  },
  {
    id: "tsuki",
    name: "月島 静",
    emoji: "🌙",
    color: "text-blue-300",
    bgColor: "bg-blue-500/20",
    description: "ミステリアスな美術部員。物静かだが、独特の感性を持つ。",
    preference: "芸術",
    secondPref: "容姿",
    dialogues: {
      greeting: [
        "…あら、奇遇ね。",
        "今日の空の色…とても綺麗。",
        "新しい絵を描いているの。見たい？",
      ],
      dateAccept: [
        "…いいわよ。たまには外の風景を見たいし。",
        "あなたとなら…悪くないわね。",
      ],
      dateReject: [
        "ごめんなさい、今は絵に集中したいの。",
        "…また、気が向いたら声をかけて。",
      ],
      highAffection: [
        "あなたの瞳の色…描いてみたいわ。",
        "不思議ね。あなたといると、インスピレーションが湧くの。",
        "あなただけよ…こんなに心を開けるのは。",
      ],
      lowAffection: [
        "…何か用？",
        "ひとりにしてもらえる？",
      ],
      confession: [
        "私…人との距離を取るのが得意だったの。\nでもあなたは…いつの間にか私の心の中に入ってきた。\n…好きよ。あなたのことが。",
      ],
      confessionReject: [
        "あなたの気持ちは嬉しいわ。\nでも…私にはまだ、絵しか見えないの。ごめんなさい。",
      ],
    },
  },
  {
    id: "riko",
    name: "理子 千明",
    emoji: "📚",
    color: "text-emerald-300",
    bgColor: "bg-emerald-500/20",
    description: "知識欲旺盛な科学オタク。眼鏡の奥に情熱を秘めている。",
    preference: "雑学",
    secondPref: "学力",
    dialogues: {
      greeting: [
        "知ってる？今日は面白い科学ニュースがあったの！",
        "あ、ちょうどいいところに。この実験手伝って！",
        "図書館に新しい本が入ったの。一緒に見に行かない？",
      ],
      dateAccept: [
        "データ収集…じゃなくて、うん、行きたい！",
        "わ、わたしでいいの？…嬉しい！",
      ],
      dateReject: [
        "ごめん、実験がちょうどいいところで…",
        "レポートの締め切りが…また今度ね！",
      ],
      highAffection: [
        "あなたといると、脳内のドーパミンが…って、ごめん、つい。好きってこと！",
        "この気持ちを科学的に説明するのは…難しいわね。",
        "私のつまらない話を聞いてくれるの、あなただけだよ。",
      ],
      lowAffection: [
        "あ、うん。今忙しいから。",
        "…データ不足ね。",
      ],
      confession: [
        "えっと…何度計算しても、この気持ちは変わらなくて。\n恋愛感情の確率は99.9%…いえ、100%です。\nあなたが好きです！",
      ],
      confessionReject: [
        "分析の結果…あなたとは良き研究仲間、という結論に。\nごめんなさい…。",
      ],
    },
  },
  {
    id: "kaede",
    name: "楓 あかり",
    emoji: "🍁",
    color: "text-orange-300",
    bgColor: "bg-orange-500/20",
    description: "おっとりした幼なじみ。いつもあなたのそばにいてくれる。",
    preference: "容姿",
    secondPref: "芸術",
    dialogues: {
      greeting: [
        "おはよう♪ 今日も一緒に学校行こ？",
        "えへへ、また会えたね。",
        "お弁当、ちょっと多く作っちゃった。食べる？",
      ],
      dateAccept: [
        "うん！昔みたいにお出かけしよ！",
        "わーい！どこ行こうか♪",
      ],
      dateReject: [
        "ごめんね…今日はお母さんの手伝いがあって。",
        "次は絶対一緒に行こうね！約束！",
      ],
      highAffection: [
        "ねぇ…私たち、ずっとこのままでいられるかな。",
        "子供の頃の約束…覚えてる？",
        "あなたの隣が、世界で一番好きな場所なの。",
      ],
      lowAffection: [
        "…最近、あんまり話してくれないね。",
        "私のこと…忘れちゃった？",
      ],
      confession: [
        "小さい頃からずっと…ずっと好きだったの。\nお嫁さんになるって約束、覚えてくれてた？\n私の気持ち…受け取ってくれますか？",
      ],
      confessionReject: [
        "そっか…あの頃のままじゃ、いられないよね。\nでも、幼なじみとしてこれからも仲良くしてね。",
      ],
    },
  },
];

/* ═══════════════════════════════════════════════════════════
   コマンド定義
   ═══════════════════════════════════════════════════════════ */

const COMMANDS: Command[] = [
  { label: "勉強する", emoji: "📖", statGain: { "学力": 3, "雑学": 1 }, stressDelta: 8, description: "教科書を読んで知識を深める" },
  { label: "運動する", emoji: "🏃", statGain: { "運動": 3, "根性": 1 }, stressDelta: 5, description: "グラウンドで体を動かす" },
  { label: "芸術鑑賞", emoji: "🎨", statGain: { "芸術": 3, "容姿": 1 }, stressDelta: 3, description: "美術館に行って感性を磨く" },
  { label: "雑学探求", emoji: "🔬", statGain: { "雑学": 3, "学力": 1 }, stressDelta: 6, description: "色々なことを調べて知識を広げる" },
  { label: "おしゃれ", emoji: "✨", statGain: { "容姿": 3, "芸術": 1 }, stressDelta: 2, description: "服や髪型に気を使う" },
  { label: "筋トレ", emoji: "💪", statGain: { "根性": 3, "運動": 1 }, stressDelta: 7, description: "自分を追い込んでメンタルを鍛える" },
  { label: "休憩する", emoji: "😴", statGain: {}, stressDelta: -20, description: "ゆっくり休んでストレスを解消" },
];

/* ═══════════════════════════════════════════════════════════
   イベント定義
   ═══════════════════════════════════════════════════════════ */

const EVENTS: GameEvent[] = [
  { id: "sports_fest", title: "体育祭", description: "体育祭で大活躍！みんなの注目を集めた！", emoji: "🏅", effect: { "運動": 5, "根性": 3 }, month: 6, affectionBonus: [{ characterId: "hinata", value: 10 }] },
  { id: "culture_fest", title: "文化祭", description: "文化祭の展示が大好評！", emoji: "🎭", effect: { "芸術": 5, "雑学": 3 }, month: 10, affectionBonus: [{ characterId: "tsuki", value: 10 }] },
  { id: "midterm", title: "中間テスト", description: "テストの結果が返ってきた！", emoji: "📝", effect: { "学力": 4 }, month: 5 },
  { id: "final_exam", title: "期末テスト", description: "期末テストに挑んだ！", emoji: "📝", effect: { "学力": 4 }, month: 7 },
  { id: "summer", title: "夏休み", description: "夏休みを満喫！海で遊んでリフレッシュ！", emoji: "🏖️", effect: { "容姿": 3, "運動": 2 }, month: 8 },
  { id: "christmas", title: "クリスマス", description: "クリスマスイブ。街はイルミネーションで輝いている…", emoji: "🎄", effect: { "容姿": 2 }, month: 12 },
  { id: "newyear", title: "お正月", description: "新年を迎えた！初詣で気持ちも新たに。", emoji: "🎍", effect: { "根性": 3 }, month: 1 },
  { id: "valentines", title: "バレンタイン", description: "バレンタインデー。チョコをもらえるかな？", emoji: "🍫", effect: { "容姿": 2 }, month: 2 },
  { id: "sakura_bloom", title: "桜の開花", description: "桜が満開！新しい季節の始まり。", emoji: "🌸", effect: { "芸術": 2, "容姿": 1 }, month: 4 },
  { id: "random_study", title: "勉強会", description: "クラスメートと自主勉強会を開いた！", emoji: "📚", effect: { "学力": 3, "雑学": 2 }, affectionBonus: [{ characterId: "sakura", value: 5 }, { characterId: "riko", value: 5 }] },
  { id: "random_sport", title: "放課後マラソン", description: "放課後、友達と走った！", emoji: "🏃", effect: { "運動": 3, "根性": 2 }, affectionBonus: [{ characterId: "hinata", value: 5 }] },
];

/* ═══════════════════════════════════════════════════════════
   デートスポット
   ═══════════════════════════════════════════════════════════ */

const DATE_SPOTS = [
  { name: "映画館", emoji: "🎬", statBonus: "芸術" as StatName },
  { name: "遊園地", emoji: "🎢", statBonus: "運動" as StatName },
  { name: "図書館", emoji: "📚", statBonus: "学力" as StatName },
  { name: "カフェ", emoji: "☕", statBonus: "容姿" as StatName },
  { name: "博物館", emoji: "🏛️", statBonus: "雑学" as StatName },
  { name: "公園", emoji: "🌳", statBonus: "根性" as StatName },
];

/* ═══════════════════════════════════════════════════════════
   ユーティリティ
   ═══════════════════════════════════════════════════════════ */

const STAT_NAMES: StatName[] = ["学力", "運動", "芸術", "雑学", "容姿", "根性"];
const STAT_EMOJI: Record<StatName, string> = { "学力": "📖", "運動": "🏃", "芸術": "🎨", "雑学": "🔬", "容姿": "✨", "根性": "💪" };
const MONTHS = ["4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月", "1月", "2月", "3月"];
const TOTAL_TURNS = 36; // 3年 × 12ヶ月

function initialStats(): Stats {
  return { "学力": 10, "運動": 10, "芸術": 10, "雑学": 10, "容姿": 10, "根性": 10 };
}

function initialAffections(): Record<string, Affection> {
  const aff: Record<string, Affection> = {};
  CHARACTERS.forEach((c) => { aff[c.id] = { value: 20, met: false }; });
  // 幼なじみは最初から出会っている
  aff["kaede"] = { value: 40, met: true };
  return aff;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function getSeasonEmoji(monthIdx: number): string {
  const m = ((monthIdx + 3) % 12) + 1; // 4月→1月に対応
  if (m >= 3 && m <= 5) return "🌸";
  if (m >= 6 && m <= 8) return "☀️";
  if (m >= 9 && m <= 11) return "🍂";
  return "❄️";
}

function getYearAndMonth(turn: number): { year: number; monthLabel: string; monthNum: number } {
  const year = Math.floor(turn / 12) + 1;
  const monthLabel = MONTHS[turn % 12];
  const monthNum = ((turn % 12) + 4 - 1) % 12 + 1; // 1-12
  return { year, monthLabel, monthNum };
}

/* ═══════════════════════════════════════════════════════════
   メインコンポーネント
   ═══════════════════════════════════════════════════════════ */

export default function TokimekiPage() {
  /* ── ゲーム状態 ── */
  const [screen, setScreen] = useState<Screen>("title");
  const [stats, setStats] = useState<Stats>(initialStats);
  const [affections, setAffections] = useState<Record<string, Affection>>(initialAffections);
  const [stress, setStress] = useState(0);
  const [turn, setTurn] = useState(0);
  const [message, setMessage] = useState("");
  const [selectedChar, setSelectedChar] = useState<Character | null>(null);
  const [currentEvent, setCurrentEvent] = useState<GameEvent | null>(null);
  const [endingChar, setEndingChar] = useState<Character | null>(null);
  const [endingType, setEndingType] = useState<"good" | "normal" | "bad">("bad");
  const [dialogueText, setDialogueText] = useState("");
  const [dateSpot, setDateSpot] = useState<typeof DATE_SPOTS[0] | null>(null);
  const [showStatChange, setShowStatChange] = useState<Partial<Stats>>({});
  const [bombWarning, setBombWarning] = useState<string | null>(null);

  /* ── アニメーション用 ── */
  const [fadeIn, setFadeIn] = useState(true);
  const messageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFadeIn(true);
  }, [screen]);

  /* ── 爆弾チェック（好感度が高いキャラを放置すると爆発） ── */
  const checkBomb = useCallback(() => {
    for (const c of CHARACTERS) {
      const aff = affections[c.id];
      if (aff.met && aff.value >= 80) {
        // 高好感度のキャラを3ターン以上放置すると怒る
        if (Math.random() < 0.15) {
          setBombWarning(`${c.emoji} ${c.name}の好感度が下がった！他の子にばかり構わないで！`);
          setAffections((prev) => ({
            ...prev,
            [c.id]: { ...prev[c.id], value: Math.max(0, prev[c.id].value - 15) },
          }));
          return true;
        }
      }
    }
    return false;
  }, [affections]);

  /* ── コマンド実行 ── */
  const executeCommand = useCallback((cmd: Command) => {
    const newStats = { ...stats };
    const changes: Partial<Stats> = {};
    for (const [key, val] of Object.entries(cmd.statGain)) {
      const k = key as StatName;
      const bonus = stress > 80 ? Math.floor(val / 2) : val;
      newStats[k] = clamp(newStats[k] + bonus, 0, 999);
      changes[k] = bonus;
    }

    // ストレスが高いと体調を崩す
    const newStress = clamp(stress + cmd.stressDelta, 0, 100);
    if (newStress >= 100) {
      setMessage("⚠️ 体調を崩してしまった！ステータスが少し下がった…");
      for (const k of STAT_NAMES) {
        newStats[k] = Math.max(0, newStats[k] - 2);
      }
      setStress(50);
    } else {
      setStress(newStress);
    }

    setStats(newStats);
    setShowStatChange(changes);

    // ランダム出会いイベント
    const unmetChars = CHARACTERS.filter((c) => !affections[c.id].met);
    if (unmetChars.length > 0 && Math.random() < 0.3) {
      const met = pick(unmetChars);
      setAffections((prev) => ({
        ...prev,
        [met.id]: { ...prev[met.id], met: true },
      }));
      setMessage(`${cmd.emoji} ${cmd.label}をした！\n\n✨ ${met.emoji} ${met.name}と出会った！\n「${pick(met.dialogues.greeting)}」`);
    } else if (newStress < 100) {
      setMessage(`${cmd.emoji} ${cmd.label}をした！`);
    }

    setScreen("result");
  }, [stats, stress, affections]);

  /* ── ターン進行 ── */
  const advanceTurn = useCallback(() => {
    const nextTurn = turn + 1;

    // ゲーム終了チェック
    if (nextTurn >= TOTAL_TURNS) {
      // エンディング判定
      let bestChar: Character | null = null;
      let bestAff = 0;
      for (const c of CHARACTERS) {
        if (affections[c.id].met && affections[c.id].value > bestAff) {
          bestAff = affections[c.id].value;
          bestChar = c;
        }
      }
      if (bestChar && bestAff >= 80) {
        setEndingChar(bestChar);
        setEndingType("good");
        setDialogueText(pick(bestChar.dialogues.confession));
      } else if (bestChar && bestAff >= 50) {
        setEndingChar(bestChar);
        setEndingType("normal");
        setDialogueText(`${bestChar.name}とは良い友達になれた。\nもう少し頑張れば…もっと近づけたかもしれない。`);
      } else {
        setEndingChar(null);
        setEndingType("bad");
        setDialogueText("高校3年間が終わった。\n特に誰とも深い関係にはなれなかった…。\nでも、この経験はきっと無駄じゃない。");
      }
      setScreen("ending");
      return;
    }

    setTurn(nextTurn);
    setBombWarning(null);

    // 月イベントチェック
    const { monthNum } = getYearAndMonth(nextTurn);
    const monthEvents = EVENTS.filter((e) => e.month === monthNum);
    const randomEvents = EVENTS.filter((e) => !e.month);

    let event: GameEvent | null = null;
    if (monthEvents.length > 0) {
      event = pick(monthEvents);
    } else if (Math.random() < 0.25 && randomEvents.length > 0) {
      event = pick(randomEvents);
    }

    if (event) {
      // イベント効果適用
      const newStats = { ...stats };
      for (const [key, val] of Object.entries(event.effect)) {
        newStats[key as StatName] = clamp(newStats[key as StatName] + val, 0, 999);
      }
      setStats(newStats);

      if (event.affectionBonus) {
        setAffections((prev) => {
          const next = { ...prev };
          for (const bonus of event.affectionBonus!) {
            if (next[bonus.characterId]?.met) {
              next[bonus.characterId] = {
                ...next[bonus.characterId],
                value: clamp(next[bonus.characterId].value + bonus.value, 0, 100),
              };
            }
          }
          return next;
        });
      }

      setCurrentEvent(event);
      setScreen("event");
    } else {
      checkBomb();
      setScreen("command");
    }
  }, [turn, stats, affections, checkBomb]);

  /* ── 電話（好感度チェック） ── */
  const callCharacter = useCallback((char: Character) => {
    const aff = affections[char.id];
    if (!aff.met) return;

    let dialogue: string;
    if (aff.value >= 70) {
      dialogue = pick(char.dialogues.highAffection);
    } else if (aff.value >= 30) {
      dialogue = pick(char.dialogues.greeting);
    } else {
      dialogue = pick(char.dialogues.lowAffection);
    }
    setSelectedChar(char);
    setDialogueText(dialogue);
    setScreen("phone");
  }, [affections]);

  /* ── デート ── */
  const startDate = useCallback((char: Character) => {
    const aff = affections[char.id];
    if (!aff.met) return;

    setSelectedChar(char);
    setScreen("date_select");
  }, [affections]);

  const goOnDate = useCallback((spot: typeof DATE_SPOTS[0]) => {
    if (!selectedChar) return;
    const aff = affections[selectedChar.id];

    // デート受諾判定（好感度依存）
    const acceptChance = aff.value / 100;
    if (Math.random() > acceptChance && aff.value < 50) {
      setDialogueText(pick(selectedChar.dialogues.dateReject));
      setDateSpot(spot);
      setScreen("date_scene");
      return;
    }

    // デート成功
    const affGain = selectedChar.preference === spot.statBonus ? 12 :
      selectedChar.secondPref === spot.statBonus ? 8 : 5;

    setAffections((prev) => ({
      ...prev,
      [selectedChar.id]: {
        ...prev[selectedChar.id],
        value: clamp(prev[selectedChar.id].value + affGain, 0, 100),
      },
    }));

    setDialogueText(pick(selectedChar.dialogues.dateAccept) + `\n\n${spot.emoji} ${spot.name}で楽しい時間を過ごした！\n💕 好感度が上がった！`);
    setDateSpot(spot);
    setScreen("date_scene");
  }, [selectedChar, affections]);

  /* ── 新しいゲーム ── */
  const newGame = useCallback(() => {
    setStats(initialStats());
    setAffections(initialAffections());
    setStress(0);
    setTurn(0);
    setMessage("");
    setSelectedChar(null);
    setCurrentEvent(null);
    setEndingChar(null);
    setBombWarning(null);
    setScreen("command");
  }, []);

  /* ── 現在の時間情報 ── */
  const { year, monthLabel, monthNum } = useMemo(() => getYearAndMonth(turn), [turn]);
  const seasonEmoji = useMemo(() => getSeasonEmoji(turn), [turn]);

  /* ── 出会い済みキャラ ── */
  const metCharacters = useMemo(
    () => CHARACTERS.filter((c) => affections[c.id].met),
    [affections],
  );

  /* ═══════════════════════════════════════════════════════════
     レンダリング
     ═══════════════════════════════════════════════════════════ */

  /* タイトル画面 */
  if (screen === "title") {
    return (
      <main className="min-h-screen bg-linear-to-b from-pink-950 via-slate-950 to-purple-950 text-white flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* 桜パーティクル風背景 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute text-pink-300/40 animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                fontSize: `${12 + Math.random() * 16}px`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${5 + Math.random() * 5}s`,
              }}
            >
              🌸
            </div>
          ))}
        </div>

        <div className="relative z-10 text-center">
          <p className="text-pink-300 text-sm tracking-[0.5em] mb-4">♪ TOKIMEKI SIMULATION ♪</p>
          <h1 className="text-5xl md:text-7xl font-extrabold bg-linear-to-r from-pink-300 via-rose-200 to-purple-300 bg-clip-text text-transparent drop-shadow-lg">
            ときめき学園
          </h1>
          <p className="mt-2 text-lg text-pink-200/80">〜 青春の3年間 〜</p>

          <div className="mt-6 space-y-3 text-sm text-slate-300 max-w-md mx-auto">
            <p>高校3年間で自分を磨き、運命の人と結ばれよう！</p>
            <p>コマンドを選んでパラメータを上げ、女の子とデートしよう。</p>
            <p>卒業式の日、あなたを待つのは…？</p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <button
              onClick={newGame}
              className="px-10 py-4 bg-linear-to-r from-pink-500 to-rose-500 text-white text-xl font-bold rounded-2xl shadow-lg shadow-pink-500/30 hover:from-pink-400 hover:to-rose-400 transition-all hover:scale-105 active:scale-95"
            >
              🌸 はじめる
            </button>
            <Link href="/" className="text-sm text-slate-400 hover:text-slate-200 transition mt-2">
              ← ゲーム一覧に戻る
            </Link>
          </div>

          <div className="mt-10 flex justify-center gap-4 text-3xl">
            {CHARACTERS.map((c) => (
              <span key={c.id} title={c.name} className="hover:scale-125 transition cursor-default">
                {c.emoji}
              </span>
            ))}
          </div>
        </div>
      </main>
    );
  }

  /* ── ヘッダーUI ── */
  const Header = () => {
    const turnsLeft = TOTAL_TURNS - turn;
    return (
      <div className="bg-slate-900/90 backdrop-blur border-b border-slate-700/60 px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{seasonEmoji}</span>
            <div>
              <span className="text-lg font-bold text-white">{year}年目 {monthLabel}</span>
              <span className="text-xs text-slate-400 ml-2">（残り{turnsLeft}ターン）</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400">ストレス</span>
              <div className="w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    stress > 80 ? "bg-red-500" : stress > 50 ? "bg-yellow-500" : "bg-green-500"
                  }`}
                  style={{ width: `${stress}%` }}
                />
              </div>
              <span className="text-xs text-slate-300">{stress}%</span>
            </div>
            <button
              onClick={() => setScreen("status")}
              className="text-xs px-3 py-1 bg-slate-700/60 text-slate-300 rounded-lg hover:bg-slate-600/60 transition"
            >
              📊 Status
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ── ステータス画面 ── */
  if (screen === "status") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="max-w-4xl mx-auto p-6">
          <h2 className="text-2xl font-bold mb-6">📊 ステータス</h2>

          {/* パラメータ */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {STAT_NAMES.map((s) => (
              <div key={s} className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/40">
                <div className="flex items-center gap-2 mb-2">
                  <span>{STAT_EMOJI[s]}</span>
                  <span className="font-bold">{s}</span>
                </div>
                <div className="text-3xl font-bold text-cyan-300">{stats[s]}</div>
                <div className="w-full h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-cyan-500 to-blue-500 rounded-full transition-all"
                    style={{ width: `${Math.min(stats[s], 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* キャラクター好感度 */}
          <h3 className="text-xl font-bold mb-4">💕 好感度</h3>
          <div className="space-y-3 mb-8">
            {CHARACTERS.map((c) => {
              const aff = affections[c.id];
              return (
                <div key={c.id} className={`${c.bgColor} rounded-xl p-4 border border-slate-700/40 ${!aff.met ? "opacity-40" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{c.emoji}</span>
                      <div>
                        <span className={`font-bold ${c.color}`}>{aff.met ? c.name : "？？？"}</span>
                        {aff.met && <p className="text-xs text-slate-400">{c.description}</p>}
                      </div>
                    </div>
                    {aff.met && (
                      <div className="text-right">
                        <div className="text-lg font-bold">{aff.value}%</div>
                        <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              aff.value >= 80 ? "bg-pink-400" : aff.value >= 50 ? "bg-yellow-400" : "bg-slate-400"
                            }`}
                            style={{ width: `${aff.value}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setScreen("command")}
            className="px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition"
          >
            ← 戻る
          </button>
        </div>
      </main>
    );
  }

  /* ── コマンド選択画面 ── */
  if (screen === "command") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />
        {bombWarning && (
          <div className="bg-red-900/60 border-b border-red-700/60 px-4 py-2 text-center text-red-200 text-sm">
            💣 {bombWarning}
          </div>
        )}
        <div className="max-w-4xl mx-auto p-6">
          <h2 className="text-xl font-bold mb-2">今月は何をする？</h2>
          <p className="text-sm text-slate-400 mb-6">コマンドを選んでパラメータを上げよう。ストレスに注意！</p>

          {/* コマンドグリッド */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            {COMMANDS.map((cmd) => (
              <button
                key={cmd.label}
                onClick={() => executeCommand(cmd)}
                className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 hover:bg-slate-700/60 hover:border-cyan-500/40 transition text-left group"
              >
                <div className="text-2xl mb-2">{cmd.emoji}</div>
                <div className="font-bold text-sm group-hover:text-cyan-300 transition">{cmd.label}</div>
                <div className="text-xs text-slate-400 mt-1">{cmd.description}</div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(cmd.statGain).map(([k, v]) => (
                    <span key={k} className="text-xs bg-cyan-900/40 text-cyan-300 px-1.5 py-0.5 rounded">
                      {k}+{v}
                    </span>
                  ))}
                  {cmd.stressDelta !== 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      cmd.stressDelta > 0 ? "bg-red-900/40 text-red-300" : "bg-green-900/40 text-green-300"
                    }`}>
                      ストレス{cmd.stressDelta > 0 ? "+" : ""}{cmd.stressDelta}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* デート・電話 */}
          <div className="border-t border-slate-700/60 pt-6">
            <h3 className="text-lg font-bold mb-4">💕 コミュニケーション</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {metCharacters.map((c) => (
                <div key={c.id} className={`${c.bgColor} rounded-xl p-4 border border-slate-700/40`}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{c.emoji}</span>
                    <div>
                      <span className={`font-bold ${c.color}`}>{c.name}</span>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              affections[c.id].value >= 80 ? "bg-pink-400" : affections[c.id].value >= 50 ? "bg-yellow-400" : "bg-slate-400"
                            }`}
                            style={{ width: `${affections[c.id].value}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400">{affections[c.id].value}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => callCharacter(c)}
                      className="flex-1 text-sm px-3 py-2 bg-slate-700/60 rounded-lg hover:bg-slate-600/60 transition"
                    >
                      📞 電話する
                    </button>
                    <button
                      onClick={() => startDate(c)}
                      className="flex-1 text-sm px-3 py-2 bg-pink-700/40 rounded-lg hover:bg-pink-600/40 transition"
                    >
                      💝 デートに誘う
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {metCharacters.length === 0 && (
              <p className="text-sm text-slate-400">まだ誰とも出会っていません。コマンドを実行すると出会いが…？</p>
            )}
          </div>
        </div>
      </main>
    );
  }

  /* ── 結果画面 ── */
  if (screen === "result") {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="bg-slate-800/60 rounded-2xl p-8 border border-slate-700/40 text-center max-w-lg w-full">
            <p className="text-lg whitespace-pre-line leading-relaxed">{message}</p>

            {Object.keys(showStatChange).length > 0 && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {Object.entries(showStatChange).map(([k, v]) => (
                  <span key={k} className="text-sm bg-cyan-900/40 text-cyan-300 px-3 py-1 rounded-lg">
                    {STAT_EMOJI[k as StatName]} {k} +{v}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={advanceTurn}
              className="mt-6 px-8 py-3 bg-linear-to-r from-pink-500 to-rose-500 text-white font-bold rounded-xl shadow-lg hover:from-pink-400 hover:to-rose-400 transition-all hover:scale-105 active:scale-95"
            >
              次へ →
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── イベント画面 ── */
  if (screen === "event" && currentEvent) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className="bg-linear-to-br from-amber-900/30 to-orange-900/30 rounded-2xl p-8 border border-amber-700/40 text-center max-w-lg w-full">
            <div className="text-5xl mb-4">{currentEvent.emoji}</div>
            <h2 className="text-2xl font-bold text-amber-200 mb-2">✨ {currentEvent.title}</h2>
            <p className="text-slate-200 mb-4">{currentEvent.description}</p>

            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {Object.entries(currentEvent.effect).map(([k, v]) => (
                <span key={k} className="text-sm bg-amber-900/40 text-amber-200 px-3 py-1 rounded-lg">
                  {STAT_EMOJI[k as StatName]} {k} +{v}
                </span>
              ))}
            </div>

            <button
              onClick={() => {
                checkBomb();
                setScreen("command");
              }}
              className="mt-4 px-8 py-3 bg-linear-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:from-amber-400 hover:to-orange-400 transition-all hover:scale-105 active:scale-95"
            >
              次へ →
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── 電話画面 ── */
  if (screen === "phone" && selectedChar) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className={`${selectedChar.bgColor} rounded-2xl p-8 border border-slate-700/40 text-center max-w-lg w-full`}>
            <div className="text-5xl mb-4">{selectedChar.emoji}</div>
            <h3 className={`text-xl font-bold ${selectedChar.color} mb-4`}>{selectedChar.name}</h3>
            <div className="bg-slate-900/60 rounded-xl p-4 mb-6">
              <p className="text-lg leading-relaxed whitespace-pre-line">「{dialogueText}」</p>
            </div>
            <button
              onClick={() => setScreen("command")}
              className="px-6 py-3 bg-slate-700 text-white rounded-xl hover:bg-slate-600 transition"
            >
              電話を切る
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── デートスポット選択 ── */
  if (screen === "date_select" && selectedChar) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="max-w-2xl mx-auto p-6">
          <h2 className="text-xl font-bold mb-2">
            {selectedChar.emoji} {selectedChar.name}とのデート先を選ぼう
          </h2>
          <p className="text-sm text-slate-400 mb-6">相手の好みに合ったスポットだと好感度が上がりやすいよ！</p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            {DATE_SPOTS.map((spot) => (
              <button
                key={spot.name}
                onClick={() => goOnDate(spot)}
                className="bg-slate-800/60 border border-slate-700/40 rounded-xl p-4 hover:bg-pink-900/30 hover:border-pink-500/40 transition text-center group"
              >
                <div className="text-3xl mb-2">{spot.emoji}</div>
                <div className="font-bold group-hover:text-pink-300 transition">{spot.name}</div>
                <div className="text-xs text-slate-400 mt-1">{spot.statBonus}向き</div>
              </button>
            ))}
          </div>

          <button
            onClick={() => setScreen("command")}
            className="px-6 py-2 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            ← やめる
          </button>
        </div>
      </main>
    );
  }

  /* ── デートシーン ── */
  if (screen === "date_scene" && selectedChar) {
    return (
      <main className="min-h-screen bg-slate-950 text-white">
        <Header />
        <div className="max-w-2xl mx-auto p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <div className={`${selectedChar.bgColor} rounded-2xl p-8 border border-slate-700/40 text-center max-w-lg w-full`}>
            <div className="text-5xl mb-4">{selectedChar.emoji}</div>
            <h3 className={`text-xl font-bold ${selectedChar.color} mb-4`}>{selectedChar.name}</h3>
            <div className="bg-slate-900/60 rounded-xl p-4 mb-6">
              <p className="text-lg leading-relaxed whitespace-pre-line">「{dialogueText}」</p>
            </div>
            <button
              onClick={advanceTurn}
              className="px-8 py-3 bg-linear-to-r from-pink-500 to-rose-500 text-white font-bold rounded-xl shadow-lg hover:from-pink-400 hover:to-rose-400 transition-all hover:scale-105 active:scale-95"
            >
              次へ →
            </button>
          </div>
        </div>
      </main>
    );
  }

  /* ── エンディング画面 ── */
  if (screen === "ending") {
    const gradients = {
      good: "from-pink-950 via-rose-950 to-purple-950",
      normal: "from-slate-950 via-blue-950 to-slate-950",
      bad: "from-slate-950 via-gray-900 to-slate-950",
    };
    const titles = {
      good: "🌸 True Ending 🌸",
      normal: "☀️ Normal Ending",
      bad: "🌙 Lonely Ending",
    };

    return (
      <main className={`min-h-screen bg-linear-to-b ${gradients[endingType]} text-white flex flex-col items-center justify-center p-6`}>
        <div className="max-w-lg text-center">
          <p className="text-sm tracking-[0.3em] text-slate-400 mb-4">── 卒業式の日 ──</p>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-6 bg-linear-to-r from-pink-300 to-purple-300 bg-clip-text text-transparent">
            {titles[endingType]}
          </h1>

          {endingChar && (
            <div className="mb-6">
              <div className="text-6xl mb-4">{endingChar.emoji}</div>
              <h2 className={`text-2xl font-bold ${endingChar.color}`}>{endingChar.name}</h2>
            </div>
          )}

          <div className={`${endingChar?.bgColor || "bg-slate-800/40"} rounded-2xl p-6 border border-slate-700/40 mb-8`}>
            <p className="text-lg leading-relaxed whitespace-pre-line">
              {endingType === "good" && "「"}
              {dialogueText}
              {endingType === "good" && "」"}
            </p>
          </div>

          {/* 最終ステータス */}
          <div className="bg-slate-800/40 rounded-xl p-4 mb-8">
            <h3 className="text-sm font-bold text-slate-400 mb-3">── 最終ステータス ──</h3>
            <div className="grid grid-cols-3 gap-2">
              {STAT_NAMES.map((s) => (
                <div key={s} className="text-center">
                  <div className="text-lg">{STAT_EMOJI[s]}</div>
                  <div className="text-xs text-slate-400">{s}</div>
                  <div className="text-lg font-bold text-cyan-300">{stats[s]}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => {
                setScreen("title");
              }}
              className="px-10 py-4 bg-linear-to-r from-pink-500 to-rose-500 text-white text-xl font-bold rounded-2xl shadow-lg hover:from-pink-400 hover:to-rose-400 transition-all hover:scale-105 active:scale-95"
            >
              🌸 もう一度プレイする
            </button>
            <Link href="/" className="text-sm text-slate-400 hover:text-slate-200 transition mt-2">
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
      <button onClick={() => setScreen("command")} className="text-cyan-300 hover:underline">
        コマンド画面に戻る
      </button>
    </main>
  );
}
