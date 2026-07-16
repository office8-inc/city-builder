import { useState } from 'react';
import { useGameStore } from '../game/store.ts';
import { hasSavedGame } from '../game/saveLoad.ts';
import { SCENARIOS } from '../game/scenarios.ts';
import { formatMoney, INITIAL_YEAR } from '../game/constants.ts';


type Screen = 'main' | 'scenario' | 'load';

export function TitleScreen() {
  const setGamePhase = useGameStore(s => s.setGamePhase);
  const loadGame = useGameStore(s => s.loadGame);
  const toggleHelpPanel = useGameStore(s => s.toggleHelpPanel);
  const setConstructionMode = useGameStore(s => s.setConstructionMode);
  const setScenarioId = useGameStore(s => s.setScenarioId);
  const resetForNewGame = useGameStore(s => s.resetForNewGame);

  const [screen, setScreen] = useState<Screen>('main');

  const tutorialDone = localStorage.getItem('atrain-tutorial-done') === '1';

  const handleNewGame = () => {
    resetForNewGame();
    setConstructionMode(false);
    setScenarioId(null);
    if (tutorialDone) {
      setGamePhase('playing');
    } else {
      setGamePhase('tutorial');
    }
  };

  const handleConstruction = () => {
    resetForNewGame();
    setConstructionMode(true);
    setScenarioId(null);
    setGamePhase('playing');
  };

  const handleScenario = (id: string) => {
    const scenario = SCENARIOS.find(s => s.id === id);
    if (!scenario) return;
    resetForNewGame(scenario.mapSeed);
    setConstructionMode(false);
    setScenarioId(id);
    useGameStore.setState({
      finance: { ...useGameStore.getState().finance, cash: scenario.initialCash },
      scenarioStartYear: INITIAL_YEAR,
    });
    setGamePhase('playing');
  };

  const handleMapEditor = () => {
    resetForNewGame();
    setConstructionMode(true);
    setScenarioId(null);
    setGamePhase('map_editor');
  };

  const handleLoadSlot = (slot: number) => {
    loadGame(slot);
    setGamePhase('playing');
  };

  const slots = [0, 1, 2].map(i => ({
    slot: i,
    exists: hasSavedGame(i),
    label: `スロット ${i + 1}`,
  }));

  // URL params for sharing
  const urlParams = new URLSearchParams(window.location.search);
  const seedParam = urlParams.get('seed');
  const scenarioParam = urlParams.get('scenario');
  if (scenarioParam && SCENARIOS.find(s => s.id === scenarioParam)) {
    handleScenario(scenarioParam);
    return null;
  }
  if (seedParam) {
    const seed = parseInt(seedParam, 10);
    if (!isNaN(seed)) {
      resetForNewGame(seed);
      setGamePhase('playing');
      return null;
    }
  }

  if (screen === 'scenario') {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/50" />
        <div className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 shadow-2xl max-w-lg w-full mx-4">
          <h2 className="text-xl font-bold text-white mb-4">シナリオ選択</h2>
          <div className="space-y-3">
            {SCENARIOS.map(s => {
              const diffColor = s.difficulty === 'easy' ? 'text-emerald-400'
                : s.difficulty === 'medium' ? 'text-yellow-400' : 'text-red-400';
              return (
                <button
                  key={s.id}
                  onClick={() => handleScenario(s.id)}
                  className="w-full text-left p-3 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-white font-bold">{s.name}</span>
                    <span className={`text-xs ${diffColor}`}>
                      {s.difficulty === 'easy' ? '初級' : s.difficulty === 'medium' ? '中級' : '上級'}
                    </span>
                  </div>
                  <p className="text-white/50 text-xs mt-1">{s.description}</p>
                  <div className="text-white/30 text-[10px] mt-1">
                    初期資金: {formatMoney(s.initialCash)} / 制限: {s.timeLimit}年
                  </div>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setScreen('main')}
            className="mt-4 w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-all"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'load') {
    return (
      <div className="absolute inset-0 flex items-center justify-center z-50">
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/50" />
        <div className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 shadow-2xl max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-white mb-4">セーブデータ</h2>
          <div className="space-y-2">
            {slots.map(({ slot, exists, label }) => (
              <button
                key={slot}
                onClick={() => exists && handleLoadSlot(slot)}
                className={`w-full p-3 rounded-xl text-left transition-all ${
                  exists
                    ? 'bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/30 text-white'
                    : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                }`}
                disabled={!exists}
              >
                <span className="font-medium">{label}</span>
                <span className="text-xs ml-2">{exists ? 'データあり' : '空き'}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setScreen('main')}
            className="mt-4 w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-all"
          >
            戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50">
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/50" />
      <div className="relative bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-10 shadow-2xl text-center max-w-md w-full mx-4">
        <div className="text-6xl mb-3">🚂</div>
        <h1 className="text-3xl font-bold text-white tracking-wide mb-1">
          A-Train City Builder
        </h1>
        <p className="text-white/60 text-sm mb-8">鉄道で街を作ろう</p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleNewGame}
            className="w-full py-3 px-6 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white font-bold text-lg transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
          >
            新しいゲーム
          </button>

          <button
            onClick={() => setScreen('scenario')}
            className="w-full py-3 px-6 rounded-xl bg-amber-500/80 hover:bg-amber-500 text-white font-bold text-lg transition-all shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40"
          >
            シナリオ
          </button>

          <button
            onClick={() => setScreen('load')}
            className="w-full py-3 px-6 rounded-xl bg-blue-500/80 hover:bg-blue-500 text-white font-bold text-lg transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
          >
            ロード
          </button>

          <div className="flex gap-2">
            <button
              onClick={handleConstruction}
              className="flex-1 py-2.5 px-4 rounded-xl bg-purple-500/60 hover:bg-purple-500/80 text-white font-medium transition-all border border-purple-400/30"
            >
              コンストラクション
            </button>
            <button
              onClick={handleMapEditor}
              className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-500/60 hover:bg-indigo-500/80 text-white font-medium transition-all border border-indigo-400/30"
            >
              マップエディタ
            </button>
          </div>

          <button
            onClick={toggleHelpPanel}
            className="w-full py-2.5 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 font-medium transition-all border border-white/10"
          >
            操作方法
          </button>
        </div>

        <p className="text-white/30 text-xs mt-8">
          Built with Three.js + React
        </p>
      </div>
    </div>
  );
}
