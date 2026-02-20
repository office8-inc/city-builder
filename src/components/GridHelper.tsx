import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE, BUILDING_COSTS } from '../game/constants.ts';
import type { BuildingType } from '../game/types.ts';

export function GridOverlay() {
  const hoveredTile = useGameStore(s => s.hoveredTile);
  const selectedTool = useGameStore(s => s.selectedTool);
  const grid = useGameStore(s => s.grid);
  const money = useGameStore(s => s.money);

  const gridLines = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const half = GRID_SIZE / 2;

    // Horizontal lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      points.push(new THREE.Vector3(-half, 0.01, i - half));
      points.push(new THREE.Vector3(half, 0.01, i - half));
    }
    // Vertical lines
    for (let i = 0; i <= GRID_SIZE; i++) {
      points.push(new THREE.Vector3(i - half, 0.01, -half));
      points.push(new THREE.Vector3(i - half, 0.01, half));
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, []);

  const highlightMesh = useMemo(() => {
    if (!hoveredTile || selectedTool === 'none') return null;

    const { x, z } = hoveredTile;
    const worldX = x - GRID_SIZE / 2 + 0.5;
    const worldZ = z - GRID_SIZE / 2 + 0.5;

    const tile = grid[x][z];
    let isValid: boolean;

    if (selectedTool === 'bulldoze') {
      isValid = tile.building !== null;
    } else {
      const cost = BUILDING_COSTS[selectedTool as BuildingType];
      isValid = tile.terrain !== 'water' && tile.building === null && money >= cost;
    }

    return { worldX, worldZ, isValid };
  }, [hoveredTile, selectedTool, grid, money]);

  return (
    <group>
      <lineSegments geometry={gridLines}>
        <lineBasicMaterial color="#00000022" transparent opacity={0.15} />
      </lineSegments>
      {highlightMesh && (
        <mesh position={[highlightMesh.worldX, 0.02, highlightMesh.worldZ]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={highlightMesh.isValid ? '#00ff00' : '#ff0000'}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
