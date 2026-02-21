import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { getTileWorldHeight } from '../game/terrain.ts';

export function GridOverlay() {
  const hoveredTile = useGameStore(s => s.hoveredTile);
  const selectedTool = useGameStore(s => s.selectedTool);
  const map = useGameStore(s => s.map);

  const highlight = useMemo(() => {
    if (!hoveredTile || selectedTool === 'none') return null;

    const tile = map[hoveredTile.x]?.[hoveredTile.z];
    if (!tile) return null;

    let canPlace = false;
    switch (selectedTool) {
      case 'track_straight':
      case 'track_curve':
        canPlace = tile.terrain !== 'water' && tile.terrain !== 'mountain';
        break;
      case 'station_build':
        canPlace = tile.trackIds.length > 0 && !tile.stationId;
        break;
      case 'train_place':
        canPlace = tile.stationId !== null;
        break;
      default:
        canPlace = tile.terrain === 'flat' || tile.terrain === 'hill';
    }

    const worldX = hoveredTile.x - GRID_SIZE / 2 + 0.5;
    const worldZ = hoveredTile.z - GRID_SIZE / 2 + 0.5;
    const worldY = getTileWorldHeight(tile) + 0.05;

    return { x: worldX, z: worldZ, y: worldY, valid: canPlace };
  }, [hoveredTile, selectedTool, map]);

  return (
    <group>
      {highlight && (
        <mesh position={[highlight.x, highlight.y, highlight.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={highlight.valid ? '#00ff88' : '#ff3333'}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
