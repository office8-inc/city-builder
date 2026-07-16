import { useEffect } from 'react';
import { GameScene } from './components/Scene.tsx';
import { HUD } from './ui/HUD.tsx';
import { TitleScreen } from './ui/TitleScreen.tsx';
import { Tutorial } from './ui/Tutorial.tsx';
import { HelpPanel } from './ui/HelpPanel.tsx';
import { ConfirmDialog } from './ui/ConfirmDialog.tsx';
import { MapEditor } from './ui/MapEditor.tsx';
import { useGameStore } from './game/store.ts';
import { formatMoney } from './game/constants.ts';
import { SCENARIOS, checkObjectives } from './game/scenarios.ts';
import { resumeAudio, startAmbient, stopAmbient } from './utils/audio.ts';

function GameOverScreen() {
  const finance = useGameStore(s => s.finance);
  const population = useGameStore(s => s.population);
  const gameTime = useGameStore(s => s.gameTime);
  const bailoutUsed = useGameStore(s => s.bailoutUsed);
  const takeBailout = useGameStore(s => s.takeBailout);

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
          {!bailoutUsed && (
            <button
              onClick={() => takeBailout()}
              className="px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium transition-all"
            >
              緊急支援を受ける（1回限り）
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioClearScreen() {
  const scenarioId = useGameStore(s => s.scenarioId);
  const finance = useGameStore(s => s.finance);
  const population = useGameStore(s => s.population);
  const gameTime = useGameStore(s => s.gameTime);
  const scenarioStartYear = useGameStore(s => s.scenarioStartYear);
  const setGamePhase = useGameStore(s => s.setGamePhase);

  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  const elapsedYears = scenarioStartYear !== null ? gameTime.year - scenarioStartYear : 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
      <div className="bg-gray-900/90 border border-emerald-500/50 rounded-2xl p-8 max-w-md text-center shadow-2xl">
        <div className="text-5xl mb-4">🏆</div>
        <h1 className="text-3xl font-bold text-emerald-400 mb-2">シナリオクリア！</h1>
        <p className="text-white/60 text-sm mb-6">{scenario?.name ?? ''}</p>
        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between text-white/70">
            <span>資金</span>
            <span className="text-emerald-400 font-bold">{formatMoney(finance.cash)}</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>人口</span>
            <span className="text-white">{population.toLocaleString()}人</span>
          </div>
          <div className="flex justify-between text-white/70">
            <span>経過年数</span>
            <span className="text-white">{elapsedYears}年</span>
          </div>
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all"
          >
            タイトルへ
          </button>
          <button
            onClick={() => setGamePhase('playing')}
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white/80 font-medium transition-all"
          >
            続けて遊ぶ
          </button>
        </div>
      </div>
    </div>
  );
}

function ScenarioFailedScreen() {
  const scenarioId = useGameStore(s => s.scenarioId);
  const population = useGameStore(s => s.population);
  const finance = useGameStore(s => s.finance);
  const stations = useGameStore(s => s.stations);
  const trains = useGameStore(s => s.trains);
  const tracks = useGameStore(s => s.tracks);
  const setGamePhase = useGameStore(s => s.setGamePhase);
  const setScenarioId = useGameStore(s => s.setScenarioId);

  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  const incompleteObjectives = scenario
    ? checkObjectives(scenario, { population, finance, stations, trains, tracks }).objectives.filter(o => !o.completed)
    : [];

  const handleContinue = () => {
    // フリープレイとして続行するため、以後シナリオの成否判定は行わない
    setScenarioId(null);
    setGamePhase('playing');
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-50">
      <div className="bg-gray-900/90 border border-red-500/50 rounded-2xl p-8 max-w-md text-center shadow-2xl">
        <div className="text-5xl mb-4">⏱️</div>
        <h1 className="text-3xl font-bold text-red-400 mb-2">シナリオ失敗…</h1>
        <p className="text-white/60 text-sm mb-4">
          {scenario?.name ?? ''} — 制限時間内に目標を達成できませんでした。
        </p>
        <div className="space-y-1.5 text-sm mb-6 text-left">
          {incompleteObjectives.map(obj => (
            <div key={obj.id} className="flex items-center gap-2 text-white/70">
              <span className="text-red-400">✗</span>
              <span>{obj.description}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-all"
          >
            タイトルへ
          </button>
          <button
            onClick={handleContinue}
            className="px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white/80 font-medium transition-all"
          >
            このまま続ける
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const gamePhase = useGameStore(s => s.gamePhase);

  // ブラウザのautoplayポリシー対応: 最初のユーザー操作でAudioContextを再開する
  useEffect(() => {
    const handleFirstGesture = () => {
      resumeAudio();
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
    window.addEventListener('pointerdown', handleFirstGesture, { once: true });
    window.addEventListener('keydown', handleFirstGesture, { once: true });
    return () => {
      window.removeEventListener('pointerdown', handleFirstGesture);
      window.removeEventListener('keydown', handleFirstGesture);
    };
  }, []);

  // プレイ中（本編/チュートリアル）のみ環境音を鳴らす
  useEffect(() => {
    if (gamePhase === 'playing' || gamePhase === 'tutorial') {
      startAmbient();
    } else {
      stopAmbient();
    }
  }, [gamePhase]);

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
      {gamePhase === 'scenario_clear' && (
        <>
          <HUD />
          <ScenarioClearScreen />
        </>
      )}
      {gamePhase === 'scenario_failed' && (
        <>
          <HUD />
          <ScenarioFailedScreen />
        </>
      )}
      <HelpPanel />
      <ConfirmDialog />
    </div>
  );
}
