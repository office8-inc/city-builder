import { useGameStore } from '../game/store.ts';

export function Notifications() {
  const notifications = useGameStore(s => s.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 pointer-events-auto">
      {notifications.map(n => (
        <div
          key={n.id}
          className="px-4 py-2 rounded-lg bg-black/50 backdrop-blur-md border border-white/10 text-white text-sm font-medium shadow-lg animate-pulse"
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
