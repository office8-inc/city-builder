import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { GRID_SIZE } from '../game/constants.ts';

const roadMat1 = new THREE.MeshStandardMaterial({
  color: '#888888',
  roughness: 0.9,
  metalness: 0.0,
});
const roadMat2 = new THREE.MeshStandardMaterial({
  color: '#999999',
  roughness: 0.85,
  metalness: 0.0,
});
const roadGeo = new THREE.PlaneGeometry(0.9, 0.9);

export function Roads() {
  const map = useGameStore(s => s.map);
  const buildings = useGameStore(s => s.buildings); // triggers re-render on building changes

  const roadTiles = useMemo(() => {
    const tiles: Array<{ x: number; z: number; level: number }> = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.roadLevel > 0 && !tile.buildingId && !tile.stationId && tile.trackIds.length === 0) {
          tiles.push({ x, z, level: tile.roadLevel });
        }
      }
    }
    return tiles;
  }, [map, buildings]);

  if (roadTiles.length === 0) return null;

  return (
    <group>
      {roadTiles.map(({ x, z, level }) => {
        const w = gridToWorld(x, z);
        const tile = map[x][z];
        const h = getTileWorldHeight(tile);
        return (
          <mesh
            key={`road_${x}_${z}`}
            geometry={roadGeo}
            material={level >= 2 ? roadMat2 : roadMat1}
            position={[w.x, h + 0.01, w.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          />
        );
      })}
    </group>
  );
}
