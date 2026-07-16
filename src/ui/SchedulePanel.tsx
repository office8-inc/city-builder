import { useState, useMemo } from 'react';
import { useGameStore } from '../game/store.ts';
import type { ScheduleStop, Train } from '../game/types.ts';

function TrainScheduleEditor({ train }: { train: Train }) {
  const stations = useGameStore(s => s.stations);
  const updateSchedule = useGameStore(s => s.updateTrainSchedule);
  const restartTerminatedTrain = useGameStore(s => s.restartTerminatedTrain);
  const stationList = useMemo(() => Array.from(stations.values()), [stations]);

  const [editStops, setEditStops] = useState<ScheduleStop[]>(train.schedule.stops);
  const [loopMode, setLoopMode] = useState(train.schedule.loopMode);

  const addStop = (stationId: string) => {
    setEditStops([...editStops, { stationId, action: 'stop', waitTime: 30 }]);
  };

  const removeStop = (index: number) => {
    setEditStops(editStops.filter((_, i) => i !== index));
  };

  const toggleAction = (index: number) => {
    const newStops = [...editStops];
    newStops[index] = {
      ...newStops[index],
      action: newStops[index].action === 'stop' ? 'pass' : 'stop',
    };
    setEditStops(newStops);
  };

  const setWaitTime = (index: number, time: number) => {
    const newStops = [...editStops];
    newStops[index] = { ...newStops[index], waitTime: time };
    setEditStops(newStops);
  };

  const applySchedule = () => {
    if (updateSchedule) {
      updateSchedule(train.id, { stops: editStops, currentStopIndex: 0, loopMode });
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: train.color }} />
        <span className="font-medium text-sm">{train.name}</span>
        <span className="text-white/40 text-[10px]">{train.type}</span>
        {train.terminated && (
          <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/40 text-red-200">終着</span>
        )}
      </div>

      {/* 片道運行で終着した列車: 再出発ボタンを表示（進行方向を反転して運行再開） */}
      {train.terminated && (
        <button
          onClick={() => restartTerminatedTrain(train.id)}
          className="w-full mb-2 py-1.5 rounded-lg text-xs bg-orange-600/60 hover:bg-orange-600/80 text-white font-medium transition-all"
        >
          反対方向へ再出発
        </button>
      )}

      {/* Loop mode */}
      <div className="flex gap-1 text-[10px]">
        {(['loop', 'bounce', 'one-way'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setLoopMode(mode)}
            className={`px-2 py-0.5 rounded ${loopMode === mode ? 'bg-blue-500/60 text-white' : 'bg-white/10 text-white/50 hover:bg-white/20'}`}
          >
            {mode === 'loop' ? '循環' : mode === 'bounce' ? '往復' : '片道'}
          </button>
        ))}
      </div>

      {/* Stops list */}
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {editStops.map((stop, i) => {
          const station = stations.get(stop.stationId);
          return (
            <div key={i} className="flex items-center gap-1 text-[10px] bg-white/5 rounded px-1.5 py-1">
              <span className="text-white/40 w-4">{i + 1}</span>
              <span className="flex-1 text-white/80">{station?.name ?? '???'}駅</span>
              <button
                onClick={() => toggleAction(i)}
                className={`px-1.5 py-0.5 rounded text-[9px] ${stop.action === 'stop' ? 'bg-emerald-500/40 text-emerald-300' : 'bg-yellow-500/40 text-yellow-300'}`}
              >
                {stop.action === 'stop' ? '停車' : '通過'}
              </button>
              {stop.action === 'stop' && (
                <select
                  value={stop.waitTime}
                  onChange={e => setWaitTime(i, Number(e.target.value))}
                  className="bg-black/50 text-white/70 text-[9px] rounded px-1 py-0.5 border border-white/10"
                >
                  <option value={10}>10秒</option>
                  <option value={30}>30秒</option>
                  <option value={60}>1分</option>
                  <option value={120}>2分</option>
                  <option value={300}>5分</option>
                </select>
              )}
              <button
                onClick={() => removeStop(i)}
                className="text-red-400/60 hover:text-red-400 px-1"
              >
                x
              </button>
            </div>
          );
        })}
      </div>

      {/* Add stop */}
      {stationList.length > 0 && (
        <div className="flex gap-1 items-center">
          <select
            id={`add-stop-${train.id}`}
            className="flex-1 bg-black/50 text-white/70 text-[10px] rounded px-1.5 py-1 border border-white/10"
            defaultValue=""
          >
            <option value="" disabled>駅を追加...</option>
            {stationList.map(s => (
              <option key={s.id} value={s.id}>{s.name}駅</option>
            ))}
          </select>
          <button
            onClick={() => {
              const sel = document.getElementById(`add-stop-${train.id}`) as HTMLSelectElement;
              if (sel?.value) {
                addStop(sel.value);
                sel.value = '';
              }
            }}
            className="px-2 py-1 rounded text-[10px] bg-blue-500/30 hover:bg-blue-500/50 text-blue-300"
          >
            +
          </button>
        </div>
      )}

      {/* Apply */}
      <button
        onClick={applySchedule}
        className="w-full py-1.5 rounded-lg text-xs bg-emerald-600/60 hover:bg-emerald-600/80 text-white font-medium transition-all"
      >
        ダイヤ適用
      </button>
    </div>
  );
}

export function SchedulePanel() {
  const showSchedulePanel = useGameStore(s => s.showSchedulePanel);
  const toggleSchedulePanel = useGameStore(s => s.toggleSchedulePanel);
  const trains = useGameStore(s => s.trains);
  const selectedTrainId = useGameStore(s => s.selectedTrainId);
  const setSelectedTrainId = useGameStore(s => s.setSelectedTrainId);

  const trainList = useMemo(() => Array.from(trains.values()), [trains]);

  if (!showSchedulePanel) return null;

  const selectedTrain = selectedTrainId ? trains.get(selectedTrainId) : null;

  return (
    <div className="w-72 p-3 rounded-xl bg-black/50 backdrop-blur-md border border-white/10 text-white shadow-lg max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-white/70 uppercase tracking-wider">ダイヤ設定</span>
        <button
          onClick={toggleSchedulePanel}
          className="text-white/40 hover:text-white/80 text-xs"
        >
          &times;
        </button>
      </div>

      {trainList.length === 0 ? (
        <div className="text-white/40 text-xs text-center py-4">列車がありません</div>
      ) : (
        <>
          {/* Train selector */}
          <div className="flex flex-wrap gap-1 mb-3">
            {trainList.map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTrainId(t.id)}
                className={`px-2 py-1 rounded text-[10px] flex items-center gap-1 transition-all ${
                  selectedTrainId === t.id
                    ? 'bg-blue-500/60 text-white border border-blue-400/50'
                    : 'bg-white/10 text-white/60 hover:bg-white/20 border border-transparent'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.name}
              </button>
            ))}
          </div>

          {/* Schedule editor */}
          {selectedTrain ? (
            <TrainScheduleEditor key={selectedTrain.id} train={selectedTrain} />
          ) : (
            <div className="text-white/40 text-xs text-center py-4">列車を選択してください</div>
          )}
        </>
      )}
    </div>
  );
}
