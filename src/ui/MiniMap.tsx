import { useRef, useEffect, useCallback } from 'react';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE, TERRAIN_COLORS } from '../game/constants.ts';

export function MiniMap() {
  const map = useGameStore(s => s.map);
  const tracks = useGameStore(s => s.tracks);
  const stations = useGameStore(s => s.stations);
  const trains = useGameStore(s => s.trains);
  const subsidiaries = useGameStore(s => s.subsidiaries);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const size = 160;
  const scale = size / GRID_SIZE;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#1a2a1a';
    ctx.fillRect(0, 0, size, size);

    // Terrain
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        const px = x * scale;
        const py = z * scale;
        ctx.fillStyle = TERRAIN_COLORS[tile.terrain] ?? '#5a9e3e';
        ctx.fillRect(px, py, Math.ceil(scale), Math.ceil(scale));
      }
    }

    // Tracks as dark lines
    ctx.strokeStyle = '#444444';
    ctx.lineWidth = 1.5;
    for (const track of tracks.values()) {
      const sx = (track.startX + 0.5) * scale;
      const sz = (track.startZ + 0.5) * scale;
      const ex = (track.endX + 0.5) * scale;
      const ez = (track.endZ + 0.5) * scale;
      ctx.beginPath();
      ctx.moveTo(sx, sz);
      ctx.lineTo(ex, ez);
      ctx.stroke();
    }

    // Subsidiaries as yellow dots
    ctx.fillStyle = '#ffaa00';
    for (const sub of subsidiaries.values()) {
      const px = (sub.x + 0.5) * scale;
      const py = (sub.z + 0.5) * scale;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stations as white dots
    ctx.fillStyle = '#ffffff';
    for (const station of stations.values()) {
      const px = (station.x + 0.5) * scale;
      const py = (station.z + 0.5) * scale;
      ctx.beginPath();
      ctx.arc(px, py, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Trains as colored moving dots
    for (const train of trains.values()) {
      const seg = tracks.get(train.currentSegmentId);
      if (!seg) continue;
      const t = train.positionOnSegment;
      const tx = seg.startX + (seg.endX - seg.startX) * t + 0.5;
      const tz = seg.startZ + (seg.endZ - seg.startZ) * t + 0.5;
      const px = tx * scale;
      const py = tz * scale;
      ctx.fillStyle = train.color;
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [map, scale, tracks, stations, trains, subsidiaries]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const gridX = px / scale;
    const gridZ = py / scale;
    window.dispatchEvent(new CustomEvent('minimap-click', {
      detail: { x: gridX, z: gridZ },
    }));
  }, [scale]);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg bg-black/40 backdrop-blur-md p-1.5">
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-lg cursor-pointer"
        style={{ imageRendering: 'pixelated' }}
        onClick={handleClick}
      />
    </div>
  );
}
