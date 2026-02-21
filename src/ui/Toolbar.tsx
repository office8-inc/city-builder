import { useState } from 'react';
import { useGameStore } from '../game/store.ts';
import { TOOL_DEFS } from '../game/constants.ts';
import type { ToolType } from '../game/types.ts';

type ToolCategory = 'rail' | 'station' | 'train' | 'subsidiary' | 'other';

const CATEGORIES: Array<{ id: ToolCategory; label: string; icon: string }> = [
  { id: 'rail', label: '鉄道', icon: '🛤️' },
  { id: 'station', label: '駅', icon: '🏗️' },
  { id: 'train', label: '列車', icon: '🚃' },
  { id: 'subsidiary', label: '施設', icon: '🏢' },
  { id: 'other', label: 'その他', icon: '🔧' },
];

export function Toolbar() {
  const selectedTool = useGameStore(s => s.selectedTool);
  const setSelectedTool = useGameStore(s => s.setSelectedTool);
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
    setActiveCategory(null);
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Tool submenu */}
      {activeCategory && categoryTools.length > 0 && (
        <div className="ml-1 flex flex-col gap-0.5 p-1.5 rounded-lg bg-black/50 backdrop-blur-md border border-white/10">
          {categoryTools.map(({ tool, label, icon }) => {
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
              </button>
            );
          })}
        </div>
      )}

      {/* Category icons */}
      <div className="flex flex-col gap-1 p-1.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 shadow-lg">
        {CATEGORIES.map(({ id, label, icon }) => {
          const isActive = activeCategory === id;
          const hasSelectedTool = TOOL_DEFS.some(t => t.category === id && t.tool === selectedTool);
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
