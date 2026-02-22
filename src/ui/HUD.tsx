import { useGameStore } from '../game/store.ts';
import { formatMoney } from '../game/constants.ts';
import { formatDate, formatClock } from '../game/simulation.ts';
import { Toolbar } from './Toolbar.tsx';
import { StatsPanel } from './StatsPanel.tsx';
import { TimeControls } from './TimeControls.tsx';
import { MiniMap } from './MiniMap.tsx';
import { Notifications } from './Notifications.tsx';
import { BuildingInfo } from './BuildingInfo.tsx';
import { FinancePanel } from './FinancePanel.tsx';

function CabViewButton() {
  const cameraMode = useGameStore(s => s.cameraMode);
  const setCameraMode = useGameStore(s => s.setCameraMode);
  const trains = useGameStore(s => s.trains);
  const followTrainId = useGameStore(s => s.followTrainId);

  const isFollow = cameraMode === 'follow';
  const trainName = followTrainId ? trains.get(followTrainId)?.name : null;

  return (
    <button
      onClick={() => setCameraMode(isFollow ? 'free' : 'follow')}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
        isFollow
          ? 'bg-amber-500/80 text-white shadow-lg shadow-amber-500/30'
          : 'bg-white/10 text-white/80 hover:bg-white/20'
      }`}
      title={isFollow ? 'フリーカメラに戻る (Esc)' : '車窓モード (列車を追尾)'}
    >
      <span>🚃</span>
      <span>{isFollow ? `車窓: ${trainName || '---'}` : '車窓モード'}</span>
    </button>
  );
}

function TopBar() {
  const finance = useGameStore(s => s.finance);
  const population = useGameStore(s => s.population);
  const gameTime = useGameStore(s => s.gameTime);
  const toggleFinancePanel = useGameStore(s => s.toggleFinancePanel);
  const saveGame = useGameStore(s => s.saveGame);
  const loadGame = useGameStore(s => s.loadGame);

  return (
    <div className="absolute top-2 left-16 right-2 flex items-center justify-between px-5 py-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white shadow-lg">
      <div className="flex items-center gap-2">
        <span className="text-xl">🚂</span>
        <span className="text-lg font-bold tracking-wide">A-Train City</span>
      </div>
      <div className="flex gap-3 text-sm font-medium items-center">
        <span className="flex items-center gap-1.5">
          📅 {formatDate(gameTime)}
        </span>
        <span className="flex items-center gap-1.5 font-mono">
          🕐 {formatClock(gameTime)}
        </span>
        <button
          onClick={toggleFinancePanel}
          className="flex items-center gap-1 hover:bg-white/10 px-1.5 py-0.5 rounded transition-all"
          title="財務ダッシュボード (F)"
        >
          <span className={finance.cash < 0 ? 'text-red-400' : 'text-emerald-400'}>
            💰 {formatMoney(finance.cash)}
          </span>
        </button>
        <span className="flex items-center gap-1.5">
          👥 {population.toLocaleString()}人
        </span>
        <CabViewButton />
        <div className="flex gap-1 ml-1">
          <button
            onClick={saveGame}
            className="px-2 py-1 rounded-md text-xs bg-white/10 hover:bg-white/20 transition-all"
            title="セーブ"
          >💾</button>
          <button
            onClick={loadGame}
            className="px-2 py-1 rounded-md text-xs bg-white/10 hover:bg-white/20 transition-all"
            title="ロード"
          >📂</button>
        </div>
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

      {/* Finance panel */}
      <div className="pointer-events-auto absolute top-16 left-16">
        <FinancePanel />
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
