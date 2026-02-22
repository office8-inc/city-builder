import { useGameStore } from '../game/store.ts';

const SHORTCUTS = [
  { key: 'Space', desc: '一時停止/再開' },
  { key: '1-4', desc: '速度変更' },
  { key: 'F', desc: '財務パネル' },
  { key: 'T', desc: '車窓モード' },
  { key: 'H', desc: 'ヘルプ表示/非表示' },
  { key: 'S', desc: 'セーブ' },
  { key: 'L', desc: 'ロード' },
  { key: 'Tab', desc: '列車切替（車窓モード中）' },
  { key: 'Esc', desc: 'ツール解除/パネルを閉じる' },
];

export function HelpPanel() {
  const show = useGameStore(s => s.showHelpPanel);
  const toggle = useGameStore(s => s.toggleHelpPanel);

  if (!show) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={toggle} />

      {/* Panel */}
      <div className="relative bg-gray-900/90 backdrop-blur-xl border border-white/15 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">キーボードショートカット</h2>
          <button
            onClick={toggle}
            className="text-white/40 hover:text-white/80 text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-1.5">
          {SHORTCUTS.map(s => (
            <div key={s.key} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5">
              <kbd className="bg-white/10 border border-white/20 rounded-md px-2 py-0.5 text-xs font-mono text-white/90 min-w-[3rem] text-center">
                {s.key}
              </kbd>
              <span className="text-sm text-white/70">{s.desc}</span>
            </div>
          ))}
        </div>

        <p className="text-white/30 text-xs mt-4 text-center">
          H または ? キーでこのパネルを表示
        </p>
      </div>
    </div>
  );
}
