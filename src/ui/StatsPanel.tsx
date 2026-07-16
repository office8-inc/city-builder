import { useMemo } from 'react';
import { useGameStore } from '../game/store.ts';
import type { BuildingCategory } from '../game/types.ts';

/** Compact money format for narrow panels: 5.7億円, 1234万円 */
function compactMoney(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  if (abs >= 100_000_000) {
    const oku = (abs / 100_000_000).toFixed(1);
    return `${sign}${oku}億円`;
  }
  if (abs >= 10_000) {
    return `${sign}${Math.floor(abs / 10_000)}万円`;
  }
  return `${sign}${abs.toLocaleString()}円`;
}

const CATEGORY_LABELS: Record<BuildingCategory, string> = {
  residential: '住宅',
  commercial: '商業',
  office: 'オフィス',
  industrial: '工業',
  leisure: 'レジャー',
  culture: '文化',
  agriculture: '農業',
};

export function StatsPanel() {
  const finance = useGameStore(s => s.finance);
  const population = useGameStore(s => s.population);
  const tracks = useGameStore(s => s.tracks);
  const stations = useGameStore(s => s.stations);
  const trains = useGameStore(s => s.trains);
  const buildings = useGameStore(s => s.buildings);
  const subsidiaries = useGameStore(s => s.subsidiaries);

  const buildingCounts = useMemo(() => {
    const counts: Partial<Record<BuildingCategory, number>> = {};
    for (const b of buildings.values()) {
      counts[b.type] = (counts[b.type] || 0) + 1;
    }
    return counts;
  }, [buildings]);

  const income = finance.quarterlyIncome;
  const expenses = finance.quarterlyExpenses;
  const totalIncome = income.railFare + income.subsidiary + income.other + income.landRent + income.materialTransport;
  const totalExpenses = expenses.trackMaintenance + expenses.trainMaintenance +
    expenses.staffCost + expenses.subsidiaryRunning + expenses.interestPayment;

  return (
    <div className="w-48 p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg max-h-[calc(100vh-8rem)] overflow-y-auto">
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
        {subsidiaries.size > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">子会社</span>
            <span className="font-medium">{subsidiaries.size}施設</span>
          </div>
        )}
      </div>

      {buildings.size > 0 && (
        <div className="border-t border-white/10 pt-2 mt-2 space-y-1 text-xs">
          <div className="text-white/50 font-bold text-[10px] uppercase tracking-wider">建物 ({buildings.size})</div>
          {(Object.keys(CATEGORY_LABELS) as BuildingCategory[]).map(cat => {
            const count = buildingCounts[cat];
            if (!count) return null;
            return (
              <div key={cat} className="flex justify-between">
                <span className="text-white/60">{CATEGORY_LABELS[cat]}</span>
                <span className="font-medium">{count}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-white/10 pt-2 mt-2 space-y-1 text-xs">
        <div className="text-white/50 font-bold text-[10px] uppercase tracking-wider">四半期収支</div>
        <div className="flex justify-between">
          <span className="text-white/60">運賃</span>
          <span className="text-emerald-400 font-medium">{compactMoney(income.railFare)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">子会社</span>
          <span className="text-emerald-400 font-medium">{compactMoney(income.subsidiary)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">税収</span>
          <span className="text-emerald-400 font-medium">{compactMoney(income.other)}</span>
        </div>
        {income.landRent > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">地代</span>
            <span className="text-emerald-400 font-medium">{compactMoney(income.landRent)}</span>
          </div>
        )}
        {income.materialTransport > 0 && (
          <div className="flex justify-between">
            <span className="text-white/60">資材輸送</span>
            <span className="text-emerald-400 font-medium">{compactMoney(income.materialTransport)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-white/60">支出</span>
          <span className="text-red-400 font-medium">{compactMoney(totalExpenses)}</span>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-1">
          <span className="text-white/60">損益</span>
          <span className={`font-bold ${totalIncome - totalExpenses >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {compactMoney(totalIncome - totalExpenses)}
          </span>
        </div>
      </div>
    </div>
  );
}
