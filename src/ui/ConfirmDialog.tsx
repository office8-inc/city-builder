import { useGameStore } from '../game/store.ts';

// 汎用の確認ダイアログ。駅・列車・子会社の撤去やロードなど、元に戻せない/
// 進行状況を失う操作の前にstore.confirmDialogへ確認要求をセットすることで表示する。
export function ConfirmDialog() {
  const confirmDialog = useGameStore(s => s.confirmDialog);
  const closeConfirm = useGameStore(s => s.closeConfirm);

  if (!confirmDialog) return null;

  const handleConfirm = () => {
    confirmDialog.onConfirm();
    closeConfirm();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center z-[60]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={closeConfirm} />

      {/* Dialog */}
      <div className="relative bg-gray-900/95 backdrop-blur-xl border border-white/15 rounded-2xl p-5 shadow-2xl max-w-sm w-full mx-4">
        <div className="flex items-start gap-3 mb-5">
          <span className="text-2xl flex-shrink-0">⚠️</span>
          <p className="text-white text-sm leading-relaxed">{confirmDialog.message}</p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={closeConfirm}
            className="px-4 py-1.5 rounded-lg text-sm text-white/60 hover:text-white/90 hover:bg-white/10 transition-all"
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-500/80 hover:bg-red-500 text-white transition-all"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
