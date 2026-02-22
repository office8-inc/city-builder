import { useState } from 'react';
import { useGameStore } from '../game/store.ts';
import { TOOL_DEFS, SUBSIDIARY_COSTS, TRAIN_TYPES, formatMoney } from '../game/constants.ts';
import type { ToolType, SubsidiaryType, TrainVehicleType } from '../game/types.ts';

type ToolCategory = 'rail' | 'station' | 'train' | 'subsidiary' | 'other';

const CATEGORIES: Array<{ id: ToolCategory; label: string; icon: string }> = [
  { id: 'rail', label: '鉄道', icon: '🛤️' },
  { id: 'station', label: '駅', icon: '🏗️' },
  { id: 'train', label: '列車', icon: '🚃' },
  { id: 'subsidiary', label: '施設', icon: '🏢' },
  { id: 'other', label: 'その他', icon: '🔧' },
];

const SUBSIDIARY_MENU: Array<{ type: SubsidiaryType; icon: string; label: string }> = [
  { type: 'factory', icon: '🏭', label: '工場' },
  { type: 'hotel', icon: '🏨', label: 'ホテル' },
  { type: 'department_store', icon: '🏬', label: 'デパート' },
  { type: 'power_plant', icon: '⚡', label: '発電所' },
  { type: 'depot', icon: '🔧', label: '車両基地' },
  { type: 'material_yard', icon: '📦', label: '資材置場' },
  { type: 'warehouse', icon: '🏚️', label: '倉庫' },
  { type: 'resort_hotel', icon: '🏖️', label: 'リゾートホテル' },
  { type: 'convenience_store', icon: '🏪', label: 'コンビニ' },
  { type: 'supermarket', icon: '🛒', label: 'スーパー' },
  { type: 'office_building', icon: '🏢', label: 'オフィスビル' },
  { type: 'apartment', icon: '🏠', label: 'マンション' },
  { type: 'amusement_park', icon: '🎡', label: '遊園地' },
  { type: 'stadium', icon: '🏟️', label: 'スタジアム' },
  { type: 'broadcast_tower', icon: '📡', label: '電波塔' },
];

const TRAIN_MENU: Array<{ type: TrainVehicleType; icon: string }> = [
  { type: 'local', icon: '🚃' },
  { type: 'suburban', icon: '🚈' },
  { type: 'express', icon: '🚅' },
  { type: 'diesel', icon: '🚂' },
  { type: 'freight', icon: '🚛' },
  { type: 'shinkansen', icon: '🚄' },
  { type: 'steam', icon: '🚂' },
];

export function Toolbar() {
  const selectedTool = useGameStore(s => s.selectedTool);
  const setSelectedTool = useGameStore(s => s.setSelectedTool);
  const selectedSubsidiaryType = useGameStore(s => s.selectedSubsidiaryType);
  const setSelectedSubsidiaryType = useGameStore(s => s.setSelectedSubsidiaryType);
  const selectedTrainType = useGameStore(s => s.selectedTrainType);
  const setSelectedTrainType = useGameStore(s => s.setSelectedTrainType);
  const [activeCategory, setActiveCategory] = useState<ToolCategory | null>(null);

  const categoryTools = activeCategory
    ? TOOL_DEFS.filter(t => t.category === activeCategory)
    : [];

  const handleCategoryClick = (cat: ToolCategory) => {
    if (activeCategory === cat) {
      setActiveCategory(null);
    } else {
      setActiveCategory(cat);
    }
  };

  const handleToolSelect = (tool: ToolType) => {
    setSelectedTool(tool);
    if (tool !== 'subsidiary_build') {
      setSelectedSubsidiaryType(null);
    }
    setActiveCategory(null);
  };

  const handleSubsidiarySelect = (type: SubsidiaryType) => {
    setSelectedTool('subsidiary_build');
    setSelectedSubsidiaryType(type);
    setActiveCategory(null);
  };

  const handleTrainTypeSelect = (type: TrainVehicleType) => {
    setSelectedTrainType(type);
    setSelectedTool('train_place');
    setActiveCategory(null);
  };

  const showSubsidiaryMenu = activeCategory === 'subsidiary';
  const showTrainMenu = activeCategory === 'train';

  return (
    <div className="flex flex-col gap-1">
      {/* Tool submenu */}
      {activeCategory && !showSubsidiaryMenu && !showTrainMenu && categoryTools.length > 0 && (
        <div className="ml-1 flex flex-col gap-0.5 p-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 max-h-[60vh] overflow-y-auto">
          {categoryTools.map(({ tool, label, icon, cost }) => {
            const isSelected = selectedTool === tool;
            return (
              <button
                key={tool}
                onClick={() => handleToolSelect(tool)}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all whitespace-nowrap
                  ${isSelected
                    ? 'bg-blue-500/80 text-white border border-blue-400/50'
                    : 'text-gray-200 hover:bg-white/15 border border-transparent'
                  }
                `}
              >
                <span className="text-base">{icon}</span>
                <span className="font-medium">{label}</span>
                {cost && <span className="text-white/40 ml-auto text-[10px]">{formatMoney(cost)}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Train submenu */}
      {showTrainMenu && (
        <div className="ml-1 flex flex-col gap-0.5 p-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 max-h-[60vh] overflow-y-auto">
          {TRAIN_MENU.map(({ type, icon }) => {
            const info = TRAIN_TYPES[type];
            const isSelected = selectedTool === 'train_place' && selectedTrainType === type;
            return (
              <button
                key={type}
                onClick={() => handleTrainTypeSelect(type)}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all whitespace-nowrap
                  ${isSelected
                    ? 'bg-blue-500/80 text-white border border-blue-400/50'
                    : 'text-gray-200 hover:bg-white/15 border border-transparent'
                  }
                `}
              >
                <span className="text-base">{icon}</span>
                <span className="font-medium">{info.name}</span>
                <span className="text-white/40 ml-auto text-[10px]">{formatMoney(info.cost)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Subsidiary submenu */}
      {showSubsidiaryMenu && (
        <div className="ml-1 flex flex-col gap-0.5 p-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 max-h-[60vh] overflow-y-auto">
          {SUBSIDIARY_MENU.map(({ type, icon, label }) => {
            const cost = SUBSIDIARY_COSTS[type];
            const isSelected = selectedTool === 'subsidiary_build' && selectedSubsidiaryType === type;
            return (
              <button
                key={type}
                onClick={() => handleSubsidiarySelect(type)}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-all whitespace-nowrap
                  ${isSelected
                    ? 'bg-blue-500/80 text-white border border-blue-400/50'
                    : 'text-gray-200 hover:bg-white/15 border border-transparent'
                  }
                `}
              >
                <span className="text-base">{icon}</span>
                <span className="font-medium">{label}</span>
                <span className="text-white/40 ml-auto text-[10px]">{formatMoney(cost.build)}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Category icons */}
      <div className="flex flex-col gap-1 p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
        {CATEGORIES.map(({ id, label, icon }) => {
          const isActive = activeCategory === id;
          const hasSelectedTool = TOOL_DEFS.some(t => t.category === id && t.tool === selectedTool) ||
            (id === 'subsidiary' && selectedTool === 'subsidiary_build') ||
            (id === 'train' && selectedTool === 'train_place');
          return (
            <button
              key={id}
              onClick={() => handleCategoryClick(id)}
              className={`
                w-11 h-11 rounded-lg flex flex-col items-center justify-center text-xs transition-all
                ${isActive
                  ? 'bg-blue-500/80 text-white shadow-md border border-blue-400/50'
                  : hasSelectedTool
                    ? 'bg-white/20 text-white border border-white/20'
                    : 'bg-white/5 text-white/70 hover:bg-white/15 border border-transparent'
                }
              `}
              title={label}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-[8px] mt-0.5 leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
