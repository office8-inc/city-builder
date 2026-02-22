import { useGameStore } from '../game/store.ts';
import { hasSavedGame } from '../game/saveLoad.ts';

export function TitleScreen() {
  const setGamePhase = useGameStore(s => s.setGamePhase);
  const loadGame = useGameStore(s => s.loadGame);
  const toggleHelpPanel = useGameStore(s => s.toggleHelpPanel);

  const savedExists = hasSavedGame();
  const tutorialDone = localStorage.getItem('atrain-tutorial-done') === '1';

  const handleNewGame = () => {
    if (tutorialDone) {
      setGamePhase('playing');
    } else {
      setGamePhase('tutorial');
    }
  };

  const handleContinue = () => {
    loadGame();
    setGamePhase('playing');
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50">
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/50 to-black/70" />

      {/* Glassmorphism card */}
      <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 shadow-2xl text-center max-w-md w-full mx-4">
        {/* Title */}
        <div className="text-6xl mb-3">🚂</div>
        <h1 className="text-3xl font-bold text-white tracking-wide mb-1">
          A-Train City Builder
        </h1>
        <p className="text-white/60 text-sm mb-8">鉄道で街を作ろう</p>

        {/* Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleNewGame}
            className="w-full py-3 px-6 rounded-xl bg-emerald-500/80 hover:bg-emerald-500 text-white font-bold text-lg transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40"
          >
            新しいゲーム
          </button>

          {savedExists && (
            <button
              onClick={handleContinue}
              className="w-full py-3 px-6 rounded-xl bg-blue-500/80 hover:bg-blue-500 text-white font-bold text-lg transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40"
            >
              続きから
            </button>
          )}

          <button
            onClick={toggleHelpPanel}
            className="w-full py-2.5 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 font-medium transition-all border border-white/10"
          >
            操作方法
          </button>
        </div>

        {/* Footer */}
        <p className="text-white/30 text-xs mt-8">
          Built with Three.js + React
        </p>
      </div>
    </div>
  );
}
