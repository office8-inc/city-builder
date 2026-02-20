import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { PALETTE } from '../utils/colors.ts';

export function Terrain() {
  const grid = useGameStore(s => s.grid);

  const { grassGeometry, waterGeometry, waterPositions, grassPositions } = useMemo(() => {
    const gPositions: THREE.Vector3[] = [];
    const wPositions: THREE.Vector3[] = [];

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const worldX = x - GRID_SIZE / 2 + 0.5;
        const worldZ = z - GRID_SIZE / 2 + 0.5;
        if (grid[x][z].terrain === 'water') {
          wPositions.push(new THREE.Vector3(worldX, -0.15, worldZ));
        } else {
          gPositions.push(new THREE.Vector3(worldX, 0, worldZ));
        }
      }
    }

    const gGeom = new THREE.PlaneGeometry(1, 1);
    gGeom.rotateX(-Math.PI / 2);
    const wGeom = new THREE.PlaneGeometry(1, 1);
    wGeom.rotateX(-Math.PI / 2);

    return {
      grassGeometry: gGeom,
      waterGeometry: wGeom,
      grassPositions: gPositions,
      waterPositions: wPositions,
    };
  }, [grid]);

  const grassMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      grassGeometry,
      new THREE.MeshStandardMaterial({ color: PALETTE.grass }),
      grassPositions.length,
    );
    const matrix = new THREE.Matrix4();
    grassPositions.forEach((pos, i) => {
      matrix.setPosition(pos);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [grassGeometry, grassPositions]);

  const waterMesh = useMemo(() => {
    const mesh = new THREE.InstancedMesh(
      waterGeometry,
      new THREE.MeshStandardMaterial({ color: PALETTE.water, transparent: true, opacity: 0.8 }),
      waterPositions.length,
    );
    const matrix = new THREE.Matrix4();
    waterPositions.forEach((pos, i) => {
      matrix.setPosition(pos);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [waterGeometry, waterPositions]);

  return (
    <group>
      <primitive object={grassMesh} />
      <primitive object={waterMesh} />
    </group>
  );
}
