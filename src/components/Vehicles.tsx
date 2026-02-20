import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';

interface VehiclePath {
  points: THREE.Vector3[];
  color: string;
  speed: number;
  offset: number;
}

const CAR_COLORS = ['#cc3333', '#3366cc', '#ffffff', '#333333', '#cc9933', '#33aa55'];

export function Vehicles() {
  const grid = useGameStore(s => s.grid);
  const speed = useGameStore(s => s.speed);
  const timeRef = useRef(0);

  const paths = useMemo(() => {
    const result: VehiclePath[] = [];
    const halfGrid = GRID_SIZE / 2;

    // Find road segments and create paths along them
    const visited = new Set<string>();

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const b = grid[x][z].building;
        if (!b || b.type !== 'road') continue;

        const key = `${x},${z}`;
        if (visited.has(key)) continue;

        // Try to build a path in x direction
        let endX = x;
        while (endX < GRID_SIZE - 1 && grid[endX + 1][z].building?.type === 'road') {
          endX++;
        }

        if (endX - x >= 2) {
          const points: THREE.Vector3[] = [];
          for (let px = x; px <= endX; px++) {
            visited.add(`${px},${z}`);
            points.push(new THREE.Vector3(px - halfGrid + 0.5, 0.1, z - halfGrid + 0.5 + 0.15));
          }
          result.push({
            points,
            color: CAR_COLORS[result.length % CAR_COLORS.length],
            speed: 1.5 + Math.random() * 1.5,
            offset: Math.random(),
          });

          // Reverse direction car
          if (endX - x >= 4) {
            const revPoints = points.map(p => new THREE.Vector3(p.x, p.y, p.z - 0.3)).reverse();
            result.push({
              points: revPoints,
              color: CAR_COLORS[(result.length + 3) % CAR_COLORS.length],
              speed: 1.2 + Math.random() * 1.3,
              offset: Math.random(),
            });
          }
        }

        // Try z direction
        let endZ = z;
        while (endZ < GRID_SIZE - 1 && grid[x][endZ + 1].building?.type === 'road') {
          endZ++;
        }

        if (endZ - z >= 2) {
          const points: THREE.Vector3[] = [];
          for (let pz = z; pz <= endZ; pz++) {
            points.push(new THREE.Vector3(x - halfGrid + 0.5 + 0.15, 0.1, pz - halfGrid + 0.5));
          }
          result.push({
            points,
            color: CAR_COLORS[result.length % CAR_COLORS.length],
            speed: 1.5 + Math.random() * 1.5,
            offset: Math.random(),
          });
        }
      }
    }

    // Limit vehicles for performance
    return result.slice(0, 60);
  }, [grid]);

  const carGeometry = useMemo(() => new THREE.BoxGeometry(0.18, 0.08, 0.1), []);
  const carMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.6 }), []);

  const instancedMesh = useMemo(() => {
    if (paths.length === 0) return null;
    const mesh = new THREE.InstancedMesh(carGeometry, carMaterial, paths.length);
    // Set colors
    paths.forEach((p, i) => {
      mesh.setColorAt(i, new THREE.Color(p.color));
    });
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [paths, carGeometry, carMaterial]);

  useFrame((_, delta) => {
    if (!instancedMesh || paths.length === 0 || speed === 0) return;
    timeRef.current += delta * speed;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    paths.forEach((path, i) => {
      if (path.points.length < 2) return;

      const totalLength = path.points.length - 1;
      const t = ((timeRef.current * path.speed * 0.3 + path.offset * totalLength) % totalLength);
      const idx = Math.floor(t);
      const frac = t - idx;

      const p0 = path.points[Math.min(idx, path.points.length - 1)];
      const p1 = path.points[Math.min(idx + 1, path.points.length - 1)];

      position.lerpVectors(p0, p1, frac);

      // Face direction of travel
      const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
      if (dir.length() > 0.001) {
        quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir);
      }

      matrix.compose(position, quaternion, scale);
      instancedMesh.setMatrixAt(i, matrix);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
  });

  if (!instancedMesh) return null;

  return <primitive object={instancedMesh} />;
}
