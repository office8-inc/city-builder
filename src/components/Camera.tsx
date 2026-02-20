import { OrbitControls } from '@react-three/drei';
import { GRID_SIZE } from '../game/constants.ts';

export function Camera() {
  const halfGrid = GRID_SIZE / 2;

  return (
    <OrbitControls
      makeDefault
      minDistance={10}
      maxDistance={100}
      maxPolarAngle={Math.PI / 3}
      minPolarAngle={Math.PI / 8}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.1}
      // Limit pan to roughly the grid area
      onChange={(e) => {
        if (e?.target) {
          const ctrl = e.target;
          const t = ctrl.target;
          t.x = Math.max(-halfGrid, Math.min(halfGrid, t.x));
          t.z = Math.max(-halfGrid, Math.min(halfGrid, t.z));
          t.y = 0;
        }
      }}
    />
  );
}
