import { useGameStore } from '../game/store.ts';
import { TERRAIN_COLORS } from '../game/constants.ts';

const TERRAIN_LABELS: Record<string, string> = {
  flat: '平地',
  hill: '丘陵',
  mountain: '山岳',
  water: '水域',
  forest: '森林',
};

export function BuildingInfo() {
  const hoveredTile = useGameStore(s => s.hoveredTile);
  const map = useGameStore(s => s.map);
  const selectedTool = useGameStore(s => s.selectedTool);
  const stations = useGameStore(s => s.stations);
  const trains = useGameStore(s => s.trains);
  const tracks = useGameStore(s => s.tracks);

  if (!hoveredTile) return null;

  const tile = map[hoveredTile.x]?.[hoveredTile.z];
  if (!tile) return null;

  const terrainLabel = TERRAIN_LABELS[tile.terrain] ?? tile.terrain;
  const terrainColor = TERRAIN_COLORS[tile.terrain] ?? '#888';

  // Check for station at this tile
  const station = tile.stationId ? stations.get(tile.stationId) : null;

  // Check for train on a segment covering this tile
  let trainAtTile = null;
  for (const train of trains.values()) {
    const segment = tracks.get(train.currentSegmentId);
    if (!segment) continue;
    if (
      (segment.startX === hoveredTile.x && segment.startZ === hoveredTile.z) ||
      (segment.endX === hoveredTile.x && segment.endZ === hoveredTile.z)
    ) {
      trainAtTile = train;
      break;
    }
  }

  return (
    <div className="p-3 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs shadow-lg min-w-[140px]">
      <div className="text-white/50 mb-1">
        タイル ({hoveredTile.x}, {hoveredTile.z})
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: terrainColor }} />
        <span className="font-medium">{terrainLabel}</span>
        <span className="text-white/40">高度 {tile.height}</span>
      </div>
      {tile.landValue > 0 && (
        <div className="text-white/60 mt-1">地価: {tile.landValue}</div>
      )}

      {/* Station info */}
      {station && (
        <div className="border-t border-white/10 mt-1.5 pt-1.5">
          <div className="font-medium text-yellow-300">{station.name}駅</div>
          <div className="text-white/60">乗降客数: {station.dailyPassengers.toLocaleString()}人/日</div>
        </div>
      )}

      {/* Train info */}
      {trainAtTile && (
        <div className="border-t border-white/10 mt-1.5 pt-1.5">
          <div className="font-medium" style={{ color: trainAtTile.color }}>{trainAtTile.name}</div>
          <div className="text-white/60">速度: {trainAtTile.maxSpeed}km/h</div>
          <div className="text-white/60">乗客: {trainAtTile.passengers}/{trainAtTile.capacity}人</div>
        </div>
      )}

      {selectedTool !== 'none' && !station && !trainAtTile && (tile.terrain === 'flat' || tile.terrain === 'hill' || tile.terrain === 'forest') && (
        <div className="mt-1 text-white/80 text-[10px]">
          クリックで設置
        </div>
      )}
    </div>
  );
}
