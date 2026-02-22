import { useState } from 'react';
import { useGameStore } from '../game/store.ts';
import type { TerrainType } from '../game/types.ts';

const BRUSHES: Array<{ terrain: TerrainType; label: string; color: string }> = [
  { terrain: 'flat', label: '平地', color: '#5a9a3a' },
  { terrain: 'hill', label: '丘陵', color: '#7a8a4a' },
  { terrain: 'mountain', label: '山岳', color: '#8a8a7a' },
  { terrain: 'water', label: '水域', color: '#1a7fcc' },
  { terrain: 'forest', label: '森林', color: '#2d6a2d' },
];

export function MapEditor() {
  const gamePhase = useGameStore(s => s.gamePhase);
  const setTileType = useGameStore(s => s.setTileType);
  const hoveredTile = useGameStore(s => s.hoveredTile);
  const setGamePhase = useGameStore(s => s.setGamePhase);

  const [brush, setBrush] = useState<TerrainType>('flat');
  const [brushSize, setBrushSize] = useState(1);
  const [brushHeight, setBrushHeight] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);

  if (gamePhase !== 'map_editor') return null;

  const paint = () => {
    if (!hoveredTile) return;
    const half = Math.floor(brushSize / 2);
    for (let dx = -half; dx <= half; dx++) {
      for (let dz = -half; dz <= half; dz++) {
        setTileType(hoveredTile.x + dx, hoveredTile.z + dz, brush, brushHeight);
      }
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-40">
      {/* Top bar */}
      <div className="pointer-events-auto absolute top-2 left-2 right-2 flex items-center gap-2 px-4 py-2 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white">
        <span className="text-sm font-bold">マップエディタ</span>
        <div className="flex-1" />

        {/* Brush type */}
        <div className="flex gap-1">
          {BRUSHES.map(b => (
            <button
              key={b.terrain}
              onClick={() => setBrush(b.terrain)}
              className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 transition-all ${
                brush === b.terrain
                  ? 'bg-blue-500/60 text-white border border-blue-400/50'
                  : 'bg-white/10 text-white/60 hover:bg-white/20 border border-transparent'
              }`}
            >
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: b.color }} />
              {b.label}
            </button>
          ))}
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-1 text-xs text-white/60">
          <span>サイズ:</span>
          {[1, 3, 5].map(s => (
            <button
              key={s}
              onClick={() => setBrushSize(s)}
              className={`w-6 h-6 rounded text-[10px] ${brushSize === s ? 'bg-blue-500/60 text-white' : 'bg-white/10 text-white/50'}`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Height */}
        <div className="flex items-center gap-1 text-xs text-white/60">
          <span>高さ:</span>
          <input
            type="range"
            min={0}
            max={10}
            value={brushHeight}
            onChange={e => setBrushHeight(Number(e.target.value))}
            className="w-16 h-1 accent-blue-500"
          />
          <span className="text-white/40 w-4">{brushHeight}</span>
        </div>

        <button
          onClick={() => setGamePhase('playing')}
          className="px-3 py-1 rounded-lg text-xs bg-emerald-600/60 hover:bg-emerald-600/80 text-white"
        >
          完了
        </button>
      </div>

      {/* Drawing area handler */}
      <div
        className="pointer-events-auto absolute inset-0 top-14 cursor-crosshair"
        onPointerDown={() => { setIsDrawing(true); paint(); }}
        onPointerMove={() => { if (isDrawing) paint(); }}
        onPointerUp={() => setIsDrawing(false)}
        onPointerLeave={() => setIsDrawing(false)}
      />
    </div>
  );
}
