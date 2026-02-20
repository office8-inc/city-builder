import { useGameStore } from '../game/store.ts';
import { BUILDING_LABELS, BUILDING_COSTS, TOOL_ICONS } from '../game/constants.ts';
import type { BuildingType } from '../game/types.ts';

export function BuildingInfo() {
  const hoveredTile = useGameStore(s => s.hoveredTile);
  const grid = useGameStore(s => s.grid);
  const selectedTool = useGameStore(s => s.selectedTool);

  if (!hoveredTile) return null;

  const tile = grid[hoveredTile.x]?.[hoveredTile.z];
  if (!tile) return null;

  const building = tile.building;

  return (
    <div className="p-3 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white text-xs shadow-lg min-w-[140px]">
      <div className="text-white/50 mb-1">
        Tile ({hoveredTile.x}, {hoveredTile.z})
      </div>
      {building ? (
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <span>{TOOL_ICONS[building.type]}</span>
            <span>{BUILDING_LABELS[building.type]}</span>
          </div>
          <div className="text-white/60 mt-1">
            Level {building.level} · {building.age}d old
          </div>
        </div>
      ) : (
        <div className="text-white/60">
          {tile.terrain === 'water' ? '🌊 Water' : '🌿 Empty'}
          {selectedTool !== 'none' && selectedTool !== 'bulldoze' && tile.terrain !== 'water' && (
            <div className="mt-1 text-white/80">
              Click to build {BUILDING_LABELS[selectedTool as BuildingType]} (${BUILDING_COSTS[selectedTool as BuildingType]})
            </div>
          )}
        </div>
      )}
    </div>
  );
}
