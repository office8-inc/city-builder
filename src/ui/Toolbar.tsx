import { useGameStore } from '../game/store.ts';
import { BUILDING_COSTS, TOOL_ICONS, BUILDING_LABELS } from '../game/constants.ts';
import type { ToolType, BuildingType } from '../game/types.ts';

const TOOLS: Array<{ tool: ToolType; label: string; cost?: number }> = [
  { tool: 'none', label: 'Select' },
  { tool: 'bulldoze', label: 'Bulldoze' },
  { tool: 'road', label: 'Road', cost: BUILDING_COSTS.road },
  { tool: 'residential', label: BUILDING_LABELS.residential, cost: BUILDING_COSTS.residential },
  { tool: 'commercial', label: BUILDING_LABELS.commercial, cost: BUILDING_COSTS.commercial },
  { tool: 'industrial', label: BUILDING_LABELS.industrial, cost: BUILDING_COSTS.industrial },
  { tool: 'park', label: BUILDING_LABELS.park, cost: BUILDING_COSTS.park },
  { tool: 'power_plant', label: BUILDING_LABELS.power_plant, cost: BUILDING_COSTS.power_plant },
  { tool: 'water_tower', label: BUILDING_LABELS.water_tower, cost: BUILDING_COSTS.water_tower },
];

export function Toolbar() {
  const selectedTool = useGameStore(s => s.selectedTool);
  const setSelectedTool = useGameStore(s => s.setSelectedTool);
  const money = useGameStore(s => s.money);

  return (
    <div className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
      {TOOLS.map(({ tool, label, cost }) => {
        const isSelected = selectedTool === tool;
        const canAfford = cost === undefined || money >= cost;
        const icon = TOOL_ICONS[tool as BuildingType | 'bulldoze' | 'none'];

        return (
          <button
            key={tool}
            onClick={() => setSelectedTool(tool)}
            disabled={!canAfford && tool !== 'none' && tool !== 'bulldoze'}
            className={`
              flex flex-col items-center px-3 py-2 rounded-lg text-xs transition-all min-w-[64px]
              ${isSelected
                ? 'bg-blue-500/80 text-white shadow-md shadow-blue-500/30 scale-105 border border-blue-400/50'
                : canAfford
                  ? 'bg-white/10 text-gray-200 hover:bg-white/20 hover:scale-102 border border-transparent'
                  : 'bg-black/20 text-gray-500 cursor-not-allowed border border-transparent'
              }
            `}
            title={cost !== undefined ? `${label} - $${cost}` : label}
          >
            <span className="text-xl leading-none mb-0.5">{icon}</span>
            <span className="font-medium">{label}</span>
            {cost !== undefined && (
              <span className={`text-[10px] ${isSelected ? 'text-blue-200' : 'text-gray-400'}`}>${cost}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
