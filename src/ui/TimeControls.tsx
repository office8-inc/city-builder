import { useGameStore } from '../game/store.ts';
import type { GameSpeed } from '../game/types.ts';

const SPEEDS: Array<{ speed: GameSpeed; label: string; icon: string }> = [
  { speed: 0, label: '一時停止', icon: '⏸' },
  { speed: 1, label: '1x', icon: '▶' },
  { speed: 2, label: '2x', icon: '⏩' },
  { speed: 4, label: '4x', icon: '⏭' },
  { speed: 8, label: '8x', icon: '⚡' },
];

export function TimeControls() {
  const currentSpeed = useGameStore(s => s.speed);
  const setSpeed = useGameStore(s => s.setSpeed);

  return (
    <div className="flex gap-1">
      {SPEEDS.map(({ speed, label, icon }) => (
        <button
          key={speed}
          onClick={() => setSpeed(speed)}
          className={`
            w-8 h-8 rounded-lg text-sm flex items-center justify-center transition-all
            ${currentSpeed === speed
              ? 'bg-white/25 text-white shadow-inner border border-white/20'
              : 'bg-white/5 text-white/60 hover:bg-white/15 border border-transparent'
            }
          `}
          title={label}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
