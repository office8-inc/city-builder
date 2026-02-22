import { GameScene } from './components/Scene.tsx';
import { HUD } from './ui/HUD.tsx';
import { TitleScreen } from './ui/TitleScreen.tsx';
import { Tutorial } from './ui/Tutorial.tsx';
import { HelpPanel } from './ui/HelpPanel.tsx';
import { useGameStore } from './game/store.ts';

export default function App() {
  const gamePhase = useGameStore(s => s.gamePhase);

  return (
    <div className="w-full h-full relative">
      <GameScene />
      {gamePhase === 'title' && <TitleScreen />}
      {gamePhase === 'tutorial' && (
        <>
          <HUD />
          <Tutorial />
        </>
      )}
      {gamePhase === 'playing' && <HUD />}
      <HelpPanel />
    </div>
  );
}
