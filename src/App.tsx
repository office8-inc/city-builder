import { GameScene } from './components/Scene.tsx';
import { HUD } from './ui/HUD.tsx';

export default function App() {
  return (
    <div className="w-full h-full relative">
      <GameScene />
      <HUD />
    </div>
  );
}
