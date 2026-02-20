import { useRef, useEffect } from 'react';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE, BUILDING_COLORS } from '../game/constants.ts';
import { PALETTE } from '../utils/colors.ts';

const MAP_SIZE = 128;
const SCALE = MAP_SIZE / GRID_SIZE;

export function MiniMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grid = useGameStore(s => s.grid);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw terrain
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = grid[x][z];
        if (tile.building) {
          ctx.fillStyle = BUILDING_COLORS[tile.building.type];
        } else {
          ctx.fillStyle = tile.terrain === 'water' ? PALETTE.water : PALETTE.grass;
        }
        ctx.fillRect(x * SCALE, z * SCALE, SCALE, SCALE);
      }
    }
  }, [grid]);

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm rounded p-1">
      <canvas
        ref={canvasRef}
        width={MAP_SIZE}
        height={MAP_SIZE}
        className="rounded"
        style={{ width: MAP_SIZE, height: MAP_SIZE, imageRendering: 'pixelated' }}
      />
    </div>
  );
}
