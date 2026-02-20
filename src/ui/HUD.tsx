import { useGameStore } from '../game/store.ts';
import { Toolbar } from './Toolbar.tsx';
import { StatsPanel } from './StatsPanel.tsx';
import { TimeControls } from './TimeControls.tsx';
import { MiniMap } from './MiniMap.tsx';
import { Notifications } from './Notifications.tsx';
import { BuildingInfo } from './BuildingInfo.tsx';

function TopBar() {
  const money = useGameStore(s => s.money);
  const population = useGameStore(s => s.population);
  const happiness = useGameStore(s => s.happiness);
  const date = useGameStore(s => s.date);

  const dateStr = `${date.year}/${String(date.month).padStart(2, '0')}/${String(date.day).padStart(2, '0')}`;
  const moneyStr = money >= 0
    ? `$${money.toLocaleString()}`
    : `-$${Math.abs(money).toLocaleString()}`;

  return (
    <div className="absolute top-2 left-2 right-2 flex items-center justify-between px-5 py-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">🏙️</span>
        <span className="text-lg font-bold tracking-wide">My City</span>
      </div>
      <div className="flex gap-5 text-sm font-medium">
        <span className="flex items-center gap-1.5">
          📅 {dateStr}
        </span>
        <span className={`flex items-center gap-1.5 ${money < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
          💰 {moneyStr}
        </span>
        <span className="flex items-center gap-1.5">
          👥 {population.toLocaleString()}
        </span>
        <span className="flex items-center gap-1.5">
          😊 {happiness}%
        </span>
      </div>
      <TimeControls />
    </div>
  );
}

export function HUD() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="pointer-events-auto">
        <TopBar />
      </div>
      <div className="pointer-events-auto absolute bottom-2 left-2 right-2">
        <Toolbar />
      </div>
      <div className="pointer-events-auto absolute top-16 right-2">
        <StatsPanel />
      </div>
      <div className="pointer-events-auto absolute bottom-24 right-2">
        <MiniMap />
      </div>
      <div className="absolute top-16 left-1/2 -translate-x-1/2">
        <Notifications />
      </div>
      <div className="pointer-events-auto absolute bottom-24 left-2">
        <BuildingInfo />
      </div>
    </div>
  );
}
