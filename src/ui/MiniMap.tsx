import { useRef, useEffect } from 'react';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE, BUILDING_COLORS } from '../game/constants.ts';

export function MiniMap() {
  const grid = useGameStore(s => s.grid);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const size = 130;
  const scale = size / GRID_SIZE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#2a3a2a';
    ctx.fillRect(0, 0, size, size);

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = grid[x][z];
        const px = x * scale;
        const py = z * scale;

        if (tile.building) {
          ctx.fillStyle = BUILDING_COLORS[tile.building.type];
          ctx.fillRect(px, py, Math.ceil(scale), Math.ceil(scale));
        } else if (tile.terrain === 'water') {
          ctx.fillStyle = '#3a7bd5';
          ctx.fillRect(px, py, Math.ceil(scale), Math.ceil(scale));
        } else {
          ctx.fillStyle = '#4a7a38';
          ctx.fillRect(px, py, Math.ceil(scale), Math.ceil(scale));
        }
      }
    }
  }, [grid, scale]);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/40 backdrop-blur-md p-1.5">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  );
}
