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
  const date = useGameStore(s => s.date);

  const dateStr = `${date.year}/${String(date.month).padStart(2, '0')}/${String(date.day).padStart(2, '0')}`;
  const moneyStr = money >= 0
    ? `$${money.toLocaleString()}`
    : `-$${Math.abs(money).toLocaleString()}`;

  return (
    <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 py-2 bg-gray-900/80 text-white backdrop-blur-sm">
      <div className="text-lg font-bold">My City</div>
      <div className="flex gap-6 text-sm">
        <span>{dateStr}</span>
        <span className={money < 0 ? 'text-red-400' : 'text-green-400'}>
          {moneyStr}
        </span>
        <span>Pop: {population.toLocaleString()}</span>
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
      <div className="pointer-events-auto absolute bottom-0 left-0 right-0">
        <Toolbar />
      </div>
      <div className="pointer-events-auto absolute top-12 right-2">
        <StatsPanel />
      </div>
      <div className="pointer-events-auto absolute bottom-20 right-2">
        <MiniMap />
      </div>
      <div className="absolute top-14 left-1/2 -translate-x-1/2">
        <Notifications />
      </div>
      <div className="pointer-events-auto absolute bottom-20 left-2">
        <BuildingInfo />
      </div>
    </div>
  );
}
