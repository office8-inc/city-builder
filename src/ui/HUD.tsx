import { useGameStore } from '../game/store.ts';
import { formatMoney } from '../game/constants.ts';
import { formatDate, formatClock } from '../game/simulation.ts';
import { Toolbar } from './Toolbar.tsx';
import { StatsPanel } from './StatsPanel.tsx';
import { TimeControls } from './TimeControls.tsx';
import { MiniMap } from './MiniMap.tsx';
import { Notifications } from './Notifications.tsx';
import { BuildingInfo } from './BuildingInfo.tsx';

function TopBar() {
  const finance = useGameStore(s => s.finance);
  const population = useGameStore(s => s.population);
  const gameTime = useGameStore(s => s.gameTime);

  return (
    <div className="absolute top-2 left-16 right-2 flex items-center justify-between px-5 py-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">🚂</span>
        <span className="text-lg font-bold tracking-wide">A-Train City</span>
      </div>
      <div className="flex gap-5 text-sm font-medium">
        <span className="flex items-center gap-1.5">
          📅 {formatDate(gameTime)}
        </span>
        <span className="flex items-center gap-1.5 font-mono">
          🕐 {formatClock(gameTime)}
        </span>
        <span className={`flex items-center gap-1.5 ${finance.cash < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          💰 {formatMoney(finance.cash)}
        </span>
        <span className="flex items-center gap-1.5">
          👥 {population.toLocaleString()}人
        </span>
      </div>
      <TimeControls />
    </div>
  );
}

export function HUD() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top bar */}
      <div className="pointer-events-auto">
        <TopBar />
      </div>

      {/* Left sidebar - tool categories */}
      <div className="pointer-events-auto absolute top-2 left-2 bottom-2">
        <Toolbar />
      </div>

      {/* Right panel - stats */}
      <div className="pointer-events-auto absolute top-16 right-2">
        <StatsPanel />
      </div>

      {/* Bottom right - minimap */}
      <div className="pointer-events-auto absolute bottom-2 right-2">
        <MiniMap />
      </div>

      {/* Center top - notifications */}
      <div className="absolute top-16 left-1/2 -translate-x-1/2">
        <Notifications />
      </div>

      {/* Bottom left (above toolbar) - tile info */}
      <div className="pointer-events-auto absolute bottom-2 left-16">
        <BuildingInfo />
      </div>
    </div>
  );
}
