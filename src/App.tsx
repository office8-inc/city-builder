import { GameScene } from './components/Scene.tsx';
import { HUD } from './ui/HUD.tsx';
import { TitleScreen } from './ui/TitleScreen.tsx';
import { Tutorial } from './ui/Tutorial.tsx';
import { HelpPanel } from './ui/HelpPanel.tsx';
import { ConfirmDialog } from './ui/ConfirmDialog.tsx';
import { MapEditor } from './ui/MapEditor.tsx';
import { useGameStore } from './game/store.ts';
import { formatMoney } from './game/constants.ts';

function GameOverScreen() {
  const finance = useGameStore(s => s.finance);
  const population = useGameStore(s => s.population);
  const gameTime = useGameStore(s => s.gameTime);
  const setGamePhase = useGameStore(s => s.setGamePhase);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
      <div className="bg-gray-900/90 border border-red-500/50 rounded-2xl p-8 max-w-md text-center shadow-2xl">
        <div className="text-5xl mb-4">💀</div>
        <h1 className="text-3xl font-bold text-red-400 mb-2">経営破綻</h1>
        <p className="text-white/60 text-sm mb-6">
          {gameTime.year}年{gameTime.month}月 — 資金が枯渇し、会社は破産しました。
        </p>
        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between text-white/70">
            <span>最終資金</span>
            <span className="text-red-400 font-bold">{formatMoney(finance.cash)}</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>負債総額</span>
            <span className="text-red-400 font-bold">{formatMoney(finance.debt)}</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>最終人口</span>
            <span className="text-white">{population.toLocaleString()}人</span>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all"
          >
            タイトルに戻る
          </button>
          <button
            onClick={() => setGamePhase('playing')}
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white/80 font-medium transition-all"
          >
            続ける
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const gamePhase = useGameStore(s => s.gamePhase);

  return (
    <div className="w-full h-full relative">
      <GameScene />
      {gamePhase === 'title' && <TitleScreen />}
      {gamePhase === 'tutorial' && (
        <>
          <HUD />
          <Tutorial />
        </>
      )}
      {gamePhase === 'playing' && <HUD />}
      {gamePhase === 'map_editor' && (
        <>
          <HUD />
          <MapEditor />
        </>
      )}
      {gamePhase === 'gameover' && (
        <>
          <HUD />
          <GameOverScreen />
        </>
      )}
      <HelpPanel />
      <ConfirmDialog />
    </div>
  );
}
