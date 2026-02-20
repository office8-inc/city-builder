import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE, BUILDING_COLORS } from '../game/constants.ts';
import type { BuildingType } from '../game/types.ts';

interface BuildingGroupProps {
  type: BuildingType;
}

function BuildingGroup({ type }: BuildingGroupProps) {
  const grid = useGameStore(s => s.grid);

  const instances = useMemo(() => {
    const items: Array<{ x: number; z: number; level: number }> = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const building = grid[x][z].building;
        if (building && building.type === type) {
          items.push({ x, z, level: building.level });
        }
      }
    }
    return items;
  }, [grid, type]);

  const meshRef = useMemo(() => {
    if (instances.length === 0) return null;

    let geometry: THREE.BufferGeometry;
    const color = BUILDING_COLORS[type];
    const material = new THREE.MeshStandardMaterial({ color });

    switch (type) {
      case 'road': {
        geometry = new THREE.BoxGeometry(1, 0.05, 1);
        break;
      }
      case 'residential': {
        geometry = new THREE.BoxGeometry(0.7, 1, 0.7);
        break;
      }
      case 'commercial': {
        geometry = new THREE.BoxGeometry(0.6, 1, 0.6);
        break;
      }
      case 'industrial': {
        geometry = new THREE.BoxGeometry(0.9, 1, 0.9);
        break;
      }
      case 'park': {
        geometry = new THREE.BoxGeometry(0.9, 0.1, 0.9);
        break;
      }
      case 'power_plant': {
        geometry = new THREE.CylinderGeometry(0.3, 0.4, 1, 8);
        break;
      }
      case 'water_tower': {
        geometry = new THREE.CylinderGeometry(0.25, 0.15, 1, 8);
        break;
      }
    }

    const mesh = new THREE.InstancedMesh(geometry, material, instances.length);
    const matrix = new THREE.Matrix4();

    instances.forEach((inst, i) => {
      const worldX = inst.x - GRID_SIZE / 2 + 0.5;
      const worldZ = inst.z - GRID_SIZE / 2 + 0.5;

      let height: number;
      let yPos: number;
      const scale = new THREE.Vector3(1, 1, 1);

      switch (type) {
        case 'road':
          height = 0.05;
          yPos = height / 2;
          break;
        case 'residential':
          height = 0.8 * inst.level;
          scale.set(1, inst.level, 1);
          yPos = height / 2;
          break;
        case 'commercial':
          height = 1.0 * inst.level;
          scale.set(1, inst.level, 1);
          yPos = height / 2;
          break;
        case 'industrial':
          height = 0.8 * inst.level;
          scale.set(1, inst.level, 1);
          yPos = height / 2;
          break;
        case 'park':
          height = 0.1;
          yPos = height / 2;
          break;
        case 'power_plant':
          height = 2.5;
          scale.set(1, 2.5, 1);
          yPos = height / 2;
          break;
        case 'water_tower':
          height = 2.0;
          scale.set(1, 2.0, 1);
          yPos = height / 2;
          break;
      }

      matrix.compose(
        new THREE.Vector3(worldX, yPos, worldZ),
        new THREE.Quaternion(),
        scale,
      );
      mesh.setMatrixAt(i, matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [instances, type]);

  if (!meshRef) return null;

  return <primitive object={meshRef} />;
}

// Park trees as separate group
function ParkTrees() {
  const grid = useGameStore(s => s.grid);

  const treePositions = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const building = grid[x][z].building;
        if (building && building.type === 'park') {
          const worldX = x - GRID_SIZE / 2 + 0.5;
          const worldZ = z - GRID_SIZE / 2 + 0.5;
          // 3 small trees per park
          positions.push(new THREE.Vector3(worldX - 0.2, 0.4, worldZ - 0.2));
          positions.push(new THREE.Vector3(worldX + 0.2, 0.5, worldZ));
          positions.push(new THREE.Vector3(worldX, 0.35, worldZ + 0.2));
        }
      }
    }
    return positions;
  }, [grid]);

  const treeMesh = useMemo(() => {
    if (treePositions.length === 0) return null;
    const geometry = new THREE.SphereGeometry(0.15, 6, 6);
    const material = new THREE.MeshStandardMaterial({ color: '#15803d' });
    const mesh = new THREE.InstancedMesh(geometry, material, treePositions.length);
    const matrix = new THREE.Matrix4();
    treePositions.forEach((pos, i) => {
      matrix.setPosition(pos);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [treePositions]);

  if (!treeMesh) return null;
  return <primitive object={treeMesh} />;
}

export function Buildings() {
  const buildingTypes: BuildingType[] = [
    'road', 'residential', 'commercial', 'industrial',
    'park', 'power_plant', 'water_tower',
  ];

  return (
    <group>
      {buildingTypes.map(type => (
        <BuildingGroup key={type} type={type} />
      ))}
      <ParkTrees />
    </group>
  );
}
