// 軽量実績システム: プレイの節目で通知するマイルストーン定義。
// 判定は store.ts の tick() から日次/四半期ごとに呼び出される（checkNewMilestones参照）。

export interface MilestoneContext {
  population: number;
  stationCount: number;
  trainCount: number;
  subsidiaryCount: number;
  hasShinkansen: boolean;
  cash: number;
  loanCount: number;
  // これまでに借入（通常融資＋緊急支援融資）を行った回数の累計
  totalLoansTaken: number;
  // 四半期決算のタイミングでのみ渡される、その四半期の純損益（収入-支出）。
  // それ以外の呼び出し（日次チェック等）ではundefinedで、黒字四半期の判定はスキップされる
  quarterlyNet?: number;
}

export interface MilestoneDef {
  id: string;
  // 通知メッセージ（絵文字付き）
  message: string;
  check: (ctx: MilestoneContext) => boolean;
}

export const MILESTONES: MilestoneDef[] = [
  { id: 'pop_1000', message: '🎉 人口1,000人を突破しました！', check: ctx => ctx.population >= 1000 },
  { id: 'pop_5000', message: '🏘️ 人口5,000人を突破しました！', check: ctx => ctx.population >= 5000 },
  { id: 'pop_10000', message: '🏙️ 人口10,000人を突破しました！', check: ctx => ctx.population >= 10000 },
  { id: 'pop_50000', message: '🌆 人口50,000人の大都市になりました！', check: ctx => ctx.population >= 50000 },
  { id: 'stations_5', message: '🚉 駅を5駅開業しました！', check: ctx => ctx.stationCount >= 5 },
  { id: 'stations_10', message: '🚉✨ 駅を10駅開業しました！', check: ctx => ctx.stationCount >= 10 },
  { id: 'trains_5', message: '🚃 列車を5編成運行しています！', check: ctx => ctx.trainCount >= 5 },
  { id: 'subsidiaries_5', message: '🏢 子会社を5社設立しました！', check: ctx => ctx.subsidiaryCount >= 5 },
  { id: 'shinkansen', message: '🚄 新幹線を導入しました！', check: ctx => ctx.hasShinkansen },
  { id: 'loan_paid_off', message: '🎊 借入をすべて完済しました！', check: ctx => ctx.totalLoansTaken > 0 && ctx.loanCount === 0 },
  // INITIAL_CASH（新規ゲームの初期資金）が30億円のため、閾値は初期資金を上回る100億円に設定
  // （10億円だと開始直後に達成済みになってしまい実績として機能しない）
  { id: 'cash_100oku', message: '💰 資金100億円を達成しました！', check: ctx => ctx.cash >= 10_000_000_000 },
  { id: 'first_profit', message: '💹 初めての黒字四半期を達成しました！', check: ctx => ctx.quarterlyNet !== undefined && ctx.quarterlyNet >= 0 },
];

// 未達成のマイルストーンのうち、今回のctxで新たに達成したものを返す
export function checkNewMilestones(ctx: MilestoneContext, achieved: Set<string>): MilestoneDef[] {
  return MILESTONES.filter(m => !achieved.has(m.id) && m.check(ctx));
}
