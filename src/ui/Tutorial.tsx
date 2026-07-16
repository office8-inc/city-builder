import { useGameStore } from '../game/store.ts';
import { TUTORIAL_STEPS } from '../game/constants.ts';

const STEPS = TUTORIAL_STEPS;

export function Tutorial() {
  const tutorialStep = useGameStore(s => s.tutorialStep);
  const nextTutorialStep = useGameStore(s => s.nextTutorialStep);
  const skipTutorial = useGameStore(s => s.skipTutorial);

  // Welcome modal (step 0 initial state shown as overlay)
  const step = STEPS[tutorialStep];
  if (!step) return null;

  // Position hint based on highlight area
  const positionClass =
    step.highlight === 'left'
      ? 'top-1/2 left-20 -translate-y-1/2'
      : step.highlight === 'top'
        ? 'top-20 left-1/2 -translate-x-1/2'
        : 'bottom-1/3 left-1/2 -translate-x-1/2';

  return (
    <div className="absolute inset-0 z-40 pointer-events-none">
      {/* Semi-transparent overlay to focus attention */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Tutorial hint card */}
      <div className={`absolute ${positionClass} pointer-events-auto`}>
        <div className="bg-black/70 backdrop-blur-lg border border-white/20 rounded-2xl p-5 shadow-2xl max-w-sm animate-pulse-slow">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-white/50 font-medium">
              ステップ {tutorialStep + 1} / {STEPS.length}
            </span>
            <div className="flex gap-1 ml-auto">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i <= tutorialStep ? 'bg-emerald-400' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">{step.icon}</span>
            <p className="text-white text-sm leading-relaxed">{step.text}</p>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={skipTutorial}
              className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition-all"
            >
              スキップ
            </button>
            <button
              onClick={nextTutorialStep}
              className="px-4 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/80 hover:bg-emerald-500 text-white transition-all"
            >
              {tutorialStep < STEPS.length - 1 ? '次へ' : '完了'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
