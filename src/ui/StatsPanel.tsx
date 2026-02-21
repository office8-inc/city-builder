import { useGameStore } from '../game/store.ts';
import { formatMoney } from '../game/constants.ts';

export function StatsPanel() {
  const finance = useGameStore(s => s.finance);
  const population = useGameStore(s => s.population);
  const tracks = useGameStore(s => s.tracks);
  const stations = useGameStore(s => s.stations);
  const trains = useGameStore(s => s.trains);

  const income = finance.quarterlyIncome;
  const expenses = finance.quarterlyExpenses;
  const totalIncome = income.railFare + income.subsidiary + income.other;
  const totalExpenses = expenses.trackMaintenance + expenses.trainMaintenance +
    expenses.staffCost + expenses.subsidiaryRunning + expenses.interestPayment;

  return (
    <div className="w-48 p-3 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg">
      <div className="text-xs font-bold mb-2 text-white/70 uppercase tracking-wider">経営情報</div>

      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-white/60">人口</span>
          <span className="font-medium">{population.toLocaleString()}人</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">路線</span>
          <span className="font-medium">{tracks.size}区間</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">駅</span>
          <span className="font-medium">{stations.size}駅</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">列車</span>
          <span className="font-medium">{trains.size}編成</span>
        </div>
      </div>

      <div className="border-t border-white/10 pt-2 mt-2 space-y-1 text-xs">
        <div className="text-white/50 font-bold text-[10px] uppercase tracking-wider">四半期収支</div>
        <div className="flex justify-between">
          <span className="text-white/60">収入</span>
          <span className="text-emerald-400 font-medium">{formatMoney(totalIncome)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">支出</span>
          <span className="text-red-400 font-medium">{formatMoney(totalExpenses)}</span>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-1">
          <span className="text-white/60">損益</span>
          <span className={`font-bold ${totalIncome - totalExpenses >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatMoney(totalIncome - totalExpenses)}
          </span>
        </div>
      </div>
    </div>
  );
}
