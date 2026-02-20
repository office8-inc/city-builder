import { useGameStore } from '../game/store.ts';
import { BUILDING_LABELS, BUILDING_COSTS, MONTHLY_UPKEEP } from '../game/constants.ts';

export function BuildingInfo() {
  const hoveredTile = useGameStore(s => s.hoveredTile);
  const grid = useGameStore(s => s.grid);

  if (!hoveredTile) return null;

  const tile = grid[hoveredTile.x][hoveredTile.z];
  const building = tile.building;

  if (!building) return null;

  return (
    <div className="bg-gray-900/80 backdrop-blur-sm text-white rounded p-2 text-xs w-40">
      <div className="font-bold text-sm">{BUILDING_LABELS[building.type]}</div>
      <div className="space-y-0.5 mt-1">
        <div>Level: {building.level}</div>
        <div>Age: {building.age} days</div>
        <div>Cost: ${BUILDING_COSTS[building.type]}</div>
        <div>Upkeep: ${MONTHLY_UPKEEP[building.type]}/mo</div>
      </div>
    </div>
  );
}
