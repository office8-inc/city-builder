import { useGameStore } from '../game/store.ts';

export function Notifications() {
  const notifications = useGameStore(s => s.notifications);

  if (notifications.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 pointer-events-auto">
      {notifications.map(n => (
        <div
          key={n.id}
          className="bg-yellow-600/90 text-white px-4 py-1.5 rounded shadow-lg text-sm animate-pulse"
        >
          {n.message}
        </div>
      ))}
    </div>
  );
}
