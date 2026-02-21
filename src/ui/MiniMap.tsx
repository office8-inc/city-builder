import { useRef, useEffect } from 'react';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE, TERRAIN_COLORS } from '../game/constants.ts';

export function MiniMap() {
  const map = useGameStore(s => s.map);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const size = 140;
  const scale = size / GRID_SIZE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, size, size);

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        const px = x * scale;
        const py = z * scale;

        // Terrain base color
        const baseColor = TERRAIN_COLORS[tile.terrain] ?? '#5a9e3e';

        // Darken based on height for depth
        ctx.fillStyle = baseColor;
        ctx.fillRect(px, py, Math.ceil(scale), Math.ceil(scale));

        // Stations
        if (tile.stationId) {
          ctx.fillStyle = '#ff4444';
          ctx.fillRect(px, py, Math.ceil(scale), Math.ceil(scale));
        }

        // Tracks
        if (tile.trackIds.length > 0) {
          ctx.fillStyle = '#888888';
          ctx.fillRect(px, py, Math.ceil(scale), Math.ceil(scale));
        }
      }
    }
  }, [map, scale]);

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
