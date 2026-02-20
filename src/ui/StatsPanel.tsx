import { useGameStore } from '../game/store.ts';

function DemandBar({ label, value, color }: { label: string; value: number; color: string }) {
  const width = Math.abs(value);
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 font-bold text-white/80">{label}</span>
      <div className="flex-1 h-3 bg-black/30 rounded-full overflow-hidden relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-px h-full bg-white/20" />
        </div>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${width / 2}%`,
            backgroundColor: color,
            marginLeft: isPositive ? '50%' : `${50 - width / 2}%`,
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}

export function StatsPanel() {
  const demand = useGameStore(s => s.demand);
  const monthlyIncome = useGameStore(s => s.monthlyIncome);
  const monthlyExpenses = useGameStore(s => s.monthlyExpenses);

  return (
    <div className="w-44 p-3 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg">
      <div className="text-xs font-bold mb-2 text-white/70 uppercase tracking-wider">Demand</div>
      <div className="space-y-1.5 mb-3">
        <DemandBar label="R" value={demand.residential} color="#4ade80" />
        <DemandBar label="C" value={demand.commercial} color="#60a5fa" />
        <DemandBar label="I" value={demand.industrial} color="#fb923c" />
      </div>
      <div className="border-t border-white/10 pt-2 space-y-1 text-xs">
        <div className="flex justify-between">
          <span className="text-white/60">Income</span>
          <span className="text-emerald-400 font-medium">+${monthlyIncome.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/60">Expenses</span>
          <span className="text-red-400 font-medium">-${monthlyExpenses.toLocaleString()}</span>
        </div>
        <div className="flex justify-between border-t border-white/10 pt-1">
          <span className="text-white/60">Net</span>
          <span className={`font-bold ${monthlyIncome - monthlyExpenses >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${(monthlyIncome - monthlyExpenses).toLocaleString()}/mo
          </span>
        </div>
      </div>
    </div>
  );
}
