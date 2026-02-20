import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';

export function GridOverlay() {
  const hoveredTile = useGameStore(s => s.hoveredTile);
  const selectedTool = useGameStore(s => s.selectedTool);
  const grid = useGameStore(s => s.grid);

  const gridLines = useMemo(() => {
    const halfGrid = GRID_SIZE / 2;
    const points: THREE.Vector3[] = [];

    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i - halfGrid;
      // X lines
      points.push(new THREE.Vector3(pos, 0.01, -halfGrid));
      points.push(new THREE.Vector3(pos, 0.01, halfGrid));
      // Z lines
      points.push(new THREE.Vector3(-halfGrid, 0.01, pos));
      points.push(new THREE.Vector3(halfGrid, 0.01, pos));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, []);

  // Highlight tile
  const highlight = useMemo(() => {
    if (!hoveredTile || selectedTool === 'none') return null;

    const tile = grid[hoveredTile.x]?.[hoveredTile.z];
    if (!tile) return null;

    const canPlace = selectedTool === 'bulldoze'
      ? tile.building !== null
      : tile.terrain !== 'water' && tile.building === null;

    const worldX = hoveredTile.x - GRID_SIZE / 2 + 0.5;
    const worldZ = hoveredTile.z - GRID_SIZE / 2 + 0.5;

    return { x: worldX, z: worldZ, valid: canPlace };
  }, [hoveredTile, selectedTool, grid]);

  return (
    <group>
      <lineSegments geometry={gridLines}>
        <lineBasicMaterial color="#00000010" transparent opacity={0.06} />
      </lineSegments>
      {highlight && (
        <mesh position={[highlight.x, 0.02, highlight.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={highlight.valid ? '#00ff88' : '#ff3333'}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
