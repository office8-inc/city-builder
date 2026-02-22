import { useGameStore } from '../game/store.ts';
import type { GameNotification } from '../game/types.ts';

const SEVERITY_STYLES: Record<GameNotification['severity'], string> = {
  info: 'border-white/10',
  success: 'border-emerald-500/30',
  warning: 'border-yellow-500/30',
  error: 'border-red-500/30',
};

export function Notifications() {
  const notifications = useGameStore(s => s.notifications);
  const dismissNotification = useGameStore(s => s.dismissNotification);

  if (notifications.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 pointer-events-auto">
      {notifications.map(n => (
        <div
          key={n.id}
          onClick={() => dismissNotification(n.id)}
          className={`px-4 py-2 rounded-lg bg-black/50 backdrop-blur-md border text-white text-sm font-medium shadow-lg cursor-pointer hover:bg-black/60 transition-all animate-fade-in ${SEVERITY_STYLES[n.severity]}`}
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
