import { useRef, useEffect } from 'react';
import { OrbitControls } from '@react-three/drei';
import { GRID_SIZE } from '../game/constants.ts';

export function Camera() {
  const halfGrid = GRID_SIZE / 2;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);

  // Remap mouse buttons: left=disabled (used for tools), middle=pan, right=rotate
  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.mouseButtons = { LEFT: -1, MIDDLE: 2, RIGHT: 0 };
    }
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      minDistance={10}
      maxDistance={120}
      maxPolarAngle={Math.PI / 2.5}
      minPolarAngle={Math.PI / 10}
      target={[0, 0, 0]}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={1.2}
      panSpeed={0.8}
      onChange={(e) => {
        if (e?.target) {
          const ctrl = e.target;
          const t = ctrl.target;
          t.x = Math.max(-halfGrid, Math.min(halfGrid, t.x));
          t.z = Math.max(-halfGrid, Math.min(halfGrid, t.z));
          t.y = Math.max(0, Math.min(5, t.y));
        }
      }}
    />
  );
}
