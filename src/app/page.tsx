import Link from "next/link";

const games = [
  {
    title: "グラディウス風シューティング",
    description: "横スクロールのシューティングゲーム",
    href: "/gradius",
    accent: "from-cyan-400/30 to-blue-700/30",
    icon: "🚀",
    tag: "STG",
  },
  {
    title: "マリオ風アクション",
    description: "ジャンプしてコインを集める2Dアクション",
    href: "/mario",
    accent: "from-amber-300/30 to-orange-600/30",
    icon: "🍄",
    tag: "ACT",
  },
  {
    title: "ファイアーエンブレム風SRPG",
    description: "ターン制タクティクス。武器三角形・カウンター攻撃あり",
    href: "/fire-emblem",
    accent: "from-red-500/30 to-orange-700/30",
    icon: "⚔️",
    tag: "SRPG",
  },
  {
    title: "ドラゴンクエスト風RPG",
    description: "フィールド探索＋コマンドバトル。レベルアップして魔王を倒せ！",
    href: "/dragon-quest",
    accent: "from-yellow-400/30 to-yellow-800/30",
    icon: "🧙",
    tag: "RPG",
  },
  {
    title: "村づくり物語",
    description: "建物を建てて村を発展！資源管理＋ランダムイベントで王国を築け",
    href: "/village-sim",
    accent: "from-green-400/30 to-amber-700/30",
    icon: "🏘️",
    tag: "SLG",
  },
  {
    title: "Blade of Mana 〜聖剣の伝説〜",
    description: "見下ろし型アクションRPG。剣と魔法で闇の騎士を倒せ！",
    href: "/seiken",
    accent: "from-purple-400/30 to-indigo-700/30",
    icon: "⚔️",
    tag: "ARPG",
  },
  {
    title: "影の伝説 ― Shadow of the Ninja",
    description: "竹林を駆け抜け城に潜入！手裏剣と刀で敵忍者を倒し姫を救え！",
    href: "/kage",
    accent: "from-indigo-400/30 to-slate-700/30",
    icon: "🥷",
    tag: "ACT",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10">
      <section className="mx-auto max-w-5xl">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight">Private Game Arcade</h1>
        <p className="mt-3 text-slate-300">遊びたいゲームを選んでください（Next.js + TypeScript）。</p>

        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {games.map((game) => (
            <Link
              key={game.href}
              href={game.href}
              className="group rounded-2xl border border-slate-700/80 bg-slate-900/75 p-6 hover:border-cyan-300/70 transition"
            >
              <div className={`rounded-xl bg-linear-to-br ${game.accent} p-5`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{game.icon}</span>
                  <span className="text-xs font-bold bg-black/30 text-slate-200 rounded px-2 py-0.5">{game.tag}</span>
                </div>
                <h2 className="text-xl font-bold text-white group-hover:text-cyan-200 transition">{game.title}</h2>
                <p className="mt-2 text-sm text-slate-100/90">{game.description}</p>
                <p className="mt-4 text-sm text-cyan-200">プレイする →</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
