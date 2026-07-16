import { useState } from 'react';
import { useGameStore } from '../game/store.ts';
import { setMasterVolume, setBGMVolume, setSEVolume } from '../utils/audio.ts';

export function SettingsPanel() {
  const showSettingsPanel = useGameStore(s => s.showSettingsPanel);
  const toggleSettingsPanel = useGameStore(s => s.toggleSettingsPanel);

  const [master, setMaster] = useState(50);
  const [bgm, setBgm] = useState(30);
  const [se, setSe] = useState(50);

  if (!showSettingsPanel) return null;

  return (
    <div className="w-64 p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white shadow-lg max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">設定</span>
        <button
          onClick={toggleSettingsPanel}
          className="text-white/40 hover:text-white/80 text-xs"
        >
          &times;
        </button>
      </div>

      {/* Volume controls */}
      <div className="space-y-3 text-xs">
        <div>
          <div className="flex justify-between mb-1">
            <span className="text-white/60">マスター音量</span>
            <span className="text-white/40">{master}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={master}
            onChange={e => {
              const v = Number(e.target.value);
              setMaster(v);
              setMasterVolume(v / 100);
            }}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-white/60">BGM</span>
            <span className="text-white/40">{bgm}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={bgm}
            onChange={e => {
              const v = Number(e.target.value);
              setBgm(v);
              setBGMVolume(v / 100);
            }}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>

        <div>
          <div className="flex justify-between mb-1">
            <span className="text-white/60">効果音</span>
            <span className="text-white/40">{se}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={se}
            onChange={e => {
              const v = Number(e.target.value);
              setSe(v);
              setSEVolume(v / 100);
            }}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>

      {/* Keyboard shortcuts */}
      <div className="border-t border-white/10 mt-3 pt-2 text-[10px] text-white/40 space-y-0.5">
        <div className="text-white/50 font-bold uppercase tracking-wider mb-1">ショートカット</div>
        <div className="flex justify-between"><span>一時停止</span><span>Space</span></div>
        <div className="flex justify-between"><span>速度 1-5</span><span>1-5</span></div>
        <div className="flex justify-between"><span>財務</span><span>F</span></div>
        <div className="flex justify-between"><span>ダイヤ設定</span><span>G</span></div>
        <div className="flex justify-between"><span>設定</span><span>O</span></div>
        <div className="flex justify-between"><span>ヘルプ</span><span>H / ?</span></div>
        <div className="flex justify-between"><span>車窓モード</span><span>T</span></div>
        <div className="flex justify-between"><span>視点切替</span><span>V</span></div>
        <div className="flex justify-between"><span>回転（クォータービュー）</span><span>Q / E</span></div>
        <div className="flex justify-between"><span>移動（クォータービュー）</span><span>WASD</span></div>
        <div className="flex justify-between"><span>列車切替</span><span>Tab</span></div>
        <div className="flex justify-between"><span>セーブ</span><span>S</span></div>
        <div className="flex justify-between"><span>ロード</span><span>L</span></div>
        <div className="flex justify-between"><span>閉じる</span><span>Esc</span></div>
      </div>
    </div>
  );
}
