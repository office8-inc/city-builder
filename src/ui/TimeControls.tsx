import { useGameStore } from '../game/store.ts';
import type { GameSpeed } from '../game/types.ts';

const SPEEDS: Array<{ speed: GameSpeed; label: string }> = [
  { speed: 0, label: '⏸' },
  { speed: 1, label: '▶' },
  { speed: 2, label: '⏩' },
  { speed: 4, label: '⏭' },
];

export function TimeControls() {
  const speed = useGameStore(s => s.speed);
  const setSpeed = useGameStore(s => s.setSpeed);

  return (
    <div className="flex gap-1">
      {SPEEDS.map(({ speed: s, label }) => (
        <button
          key={s}
          onClick={() => setSpeed(s)}
          className={`
            px-2 py-0.5 rounded text-sm transition-colors
            ${speed === s
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
