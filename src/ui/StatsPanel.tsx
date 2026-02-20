import { useGameStore } from '../game/store.ts';

function DemandBar({ label, value, color }: { label: string; value: number; color: string }) {
  const width = Math.abs(value);
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="w-4 font-bold" style={{ color }}>{label}</span>
      <div className="w-20 h-3 bg-gray-700 rounded overflow-hidden relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-1/2" />
          <div className="w-px h-full bg-gray-500" />
        </div>
        <div
          className="h-full rounded transition-all duration-300"
          style={{
            width: `${width / 2}%`,
            backgroundColor: color,
            marginLeft: isPositive ? '50%' : `${50 - width / 2}%`,
          }}
        />
      </div>
    </div>
  );
}

export function StatsPanel() {
  const happiness = useGameStore(s => s.happiness);
  const jobs = useGameStore(s => s.jobs);
  const population = useGameStore(s => s.population);
  const demand = useGameStore(s => s.demand);
  const monthlyIncome = useGameStore(s => s.monthlyIncome);
  const monthlyExpenses = useGameStore(s => s.monthlyExpenses);

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm text-white rounded p-2 text-xs w-36 space-y-2">
      <div className="font-bold text-center text-sm border-b border-gray-700 pb-1">Stats</div>

      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Happiness</span>
          <span>{happiness}%</span>
        </div>
        <div className="flex justify-between">
          <span>Jobs</span>
          <span>{jobs}</span>
        </div>
        <div className="flex justify-between">
          <span>Workers</span>
          <span>{population}</span>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-1 space-y-1">
        <div className="flex justify-between">
          <span>Income</span>
          <span className="text-green-400">${monthlyIncome}/mo</span>
        </div>
        <div className="flex justify-between">
          <span>Expenses</span>
          <span className="text-red-400">${monthlyExpenses}/mo</span>
        </div>
        <div className="flex justify-between font-bold">
          <span>Net</span>
          <span className={monthlyIncome - monthlyExpenses >= 0 ? 'text-green-400' : 'text-red-400'}>
            ${monthlyIncome - monthlyExpenses}/mo
          </span>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-1">
        <div className="font-bold mb-1">Demand</div>
        <DemandBar label="R" value={demand.residential} color="#4ade80" />
        <DemandBar label="C" value={demand.commercial} color="#60a5fa" />
        <DemandBar label="I" value={demand.industrial} color="#fb923c" />
      </div>
    </div>
  );
}
