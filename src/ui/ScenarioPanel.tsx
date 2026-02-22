import { useMemo } from 'react';
import { useGameStore } from '../game/store.ts';
import { SCENARIOS, checkObjectives } from '../game/scenarios.ts';
import { formatMoney } from '../game/constants.ts';

export function ScenarioPanel() {
  const scenarioId = useGameStore(s => s.scenarioId);
  const population = useGameStore(s => s.population);
  const finance = useGameStore(s => s.finance);
  const stations = useGameStore(s => s.stations);
  const trains = useGameStore(s => s.trains);
  const tracks = useGameStore(s => s.tracks);
  const gameTime = useGameStore(s => s.gameTime);

  const scenario = useMemo(() => SCENARIOS.find(s => s.id === scenarioId), [scenarioId]);

  const result = useMemo(() => {
    if (!scenario) return null;
    return checkObjectives(scenario, { population, finance, stations, trains, tracks });
  }, [scenario, population, finance, stations, trains, tracks]);

  if (!scenario || !result) return null;

  const yearsLeft = scenario.timeLimit
    ? Math.max(0, scenario.timeLimit - (gameTime.year - 2000))
    : null;

  const difficultyColor = scenario.difficulty === 'easy' ? 'text-emerald-400'
    : scenario.difficulty === 'medium' ? 'text-yellow-400'
    : 'text-red-400';

  return (
    <div className="p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs shadow-lg min-w-[180px]">
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-white/70 text-[10px] uppercase tracking-wider">
          {scenario.name}
        </span>
        <span className={`text-[9px] ${difficultyColor}`}>
          {scenario.difficulty === 'easy' ? '初級' : scenario.difficulty === 'medium' ? '中級' : '上級'}
        </span>
      </div>

      {yearsLeft !== null && (
        <div className="text-white/40 text-[10px] mb-1.5">
          残り {yearsLeft}年
        </div>
      )}

      <div className="space-y-1">
        {result.objectives.map(obj => {
          let current = 0;
          const qi = finance.quarterlyIncome;
          switch (obj.type) {
            case 'population': current = population; break;
            case 'income': current = qi.railFare + qi.subsidiary + qi.other + qi.landRent; break;
            case 'stations': current = stations.size; break;
            case 'trains': current = trains.size; break;
            case 'tracks': current = tracks.size; break;
            case 'cash': current = finance.cash; break;
          }
          const progress = Math.min(1, current / obj.target);
          const display = obj.type === 'cash' || obj.type === 'income'
            ? `${formatMoney(current)} / ${formatMoney(obj.target)}`
            : `${current.toLocaleString()} / ${obj.target.toLocaleString()}`;

          return (
            <div key={obj.id}>
              <div className="flex items-center gap-1">
                <span className={obj.completed ? 'text-emerald-400' : 'text-white/60'}>
                  {obj.completed ? '✓' : '○'}
                </span>
                <span className="text-white/80 flex-1">{obj.description}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${obj.completed ? 'bg-emerald-500' : 'bg-blue-500'}`}
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <span className="text-white/40 text-[9px] w-24 text-right">{display}</span>
              </div>
            </div>
          );
        })}
      </div>

      {result.allComplete && (
        <div className="mt-2 py-1.5 text-center bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-emerald-300 font-bold text-sm">
          目標達成！おめでとうございます！
        </div>
      )}
    </div>
  );
}
