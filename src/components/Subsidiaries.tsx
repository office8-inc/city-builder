import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { Subsidiary } from '../game/types.ts';

function SmokeParticles({ position }: { position: [number, number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = 8;
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      offset: i * 0.4,
      x: (Math.random() - 0.5) * 0.05,
      z: (Math.random() - 0.5) * 0.05,
      speed: 0.1 + Math.random() * 0.05,
    })),
  []);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const p = particles[i];
      const age = ((t * p.speed + p.offset) % 1.6);
      dummy.position.set(
        position[0] + p.x * age,
        position[1] + age * 0.5,
        position[2] + p.z * age,
      );
      const scale = 0.02 + age * 0.03;
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]}>
      <sphereGeometry args={[1, 6, 6]} />
      <meshStandardMaterial color="#aaaaaa" transparent opacity={0.35} />
    </instancedMesh>
  );
}

function FactoryMesh({ sub }: { sub: Subsidiary }) {
  const map = useGameStore(s => s.map);
  const pos = useMemo(() => {
    const w = gridToWorld(sub.x, sub.z);
    const tile = map[sub.x]?.[sub.z];
    const h = tile ? getTileWorldHeight(tile) : 0;
    return [w.x, h, w.z] as [number, number, number];
  }, [sub, map]);

  return (
    <group position={pos}>
      {/* Main building */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.5, 0.7]} />
        <meshStandardMaterial color="#707070" roughness={0.8} />
      </mesh>
      {/* Chimney */}
      <mesh position={[0.3, 0.65, 0.15]} castShadow>
        <cylinderGeometry args={[0.04, 0.06, 0.5, 6]} />
        <meshStandardMaterial color="#555555" roughness={0.6} metalness={0.4} />
      </mesh>
      <SmokeParticles position={[pos[0] + 0.3, pos[1] + 0.9, pos[2] + 0.15]} />
      {/* Secondary structure */}
      <mesh position={[-0.2, 0.15, 0.2]} castShadow>
        <boxGeometry args={[0.35, 0.3, 0.25]} />
        <meshStandardMaterial color="#808080" roughness={0.7} />
      </mesh>
    </group>
  );
}

function HotelMesh({ sub }: { sub: Subsidiary }) {
  const map = useGameStore(s => s.map);
  const pos = useMemo(() => {
    const w = gridToWorld(sub.x, sub.z);
    const tile = map[sub.x]?.[sub.z];
    const h = tile ? getTileWorldHeight(tile) : 0;
    return [w.x, h, w.z] as [number, number, number];
  }, [sub, map]);

  return (
    <group position={pos}>
      {/* Main tower */}
      <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.45, 1.2, 0.5]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.5} />
      </mesh>
      {/* Floor lines */}
      {Array.from({ length: 8 }, (_, i) => (
        <mesh key={i} position={[0, 0.1 + i * 0.14, 0.251]} castShadow>
          <boxGeometry args={[0.42, 0.01, 0.01]} />
          <meshStandardMaterial color="#a09080" />
        </mesh>
      ))}
      {/* Entrance canopy */}
      <mesh position={[0, 0.12, 0.3]} castShadow>
        <boxGeometry args={[0.3, 0.02, 0.12]} />
        <meshStandardMaterial color="#cc8844" roughness={0.4} />
      </mesh>
      {/* Roof top */}
      <mesh position={[0, 1.22, 0]} castShadow>
        <boxGeometry args={[0.48, 0.04, 0.53]} />
        <meshStandardMaterial color="#a09880" roughness={0.4} metalness={0.2} />
      </mesh>
    </group>
  );
}

function DepartmentStoreMesh({ sub }: { sub: Subsidiary }) {
  const map = useGameStore(s => s.map);
  const pos = useMemo(() => {
    const w = gridToWorld(sub.x, sub.z);
    const tile = map[sub.x]?.[sub.z];
    const h = tile ? getTileWorldHeight(tile) : 0;
    return [w.x, h, w.z] as [number, number, number];
  }, [sub, map]);

  return (
    <group position={pos}>
      {/* Wide main building */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.5, 0.75]} />
        <meshStandardMaterial color="#f0e8d8" roughness={0.5} />
      </mesh>
      {/* Colorful facade band */}
      <mesh position={[0, 0.35, 0.376]}>
        <boxGeometry args={[0.88, 0.12, 0.01]} />
        <meshStandardMaterial color="#cc3366" roughness={0.4} />
      </mesh>
      {/* Entrance */}
      <mesh position={[0, 0.08, 0.376]}>
        <boxGeometry args={[0.3, 0.14, 0.01]} />
        <meshStandardMaterial color="#333333" roughness={0.9} />
      </mesh>
      {/* Awning */}
      <mesh position={[0, 0.16, 0.42]} castShadow>
        <boxGeometry args={[0.5, 0.02, 0.1]} />
        <meshStandardMaterial color="#3366aa" roughness={0.5} />
      </mesh>
      {/* Rooftop sign */}
      <mesh position={[0, 0.55, 0.1]} castShadow>
        <boxGeometry args={[0.35, 0.08, 0.02]} />
        <meshStandardMaterial color="#ff6644" emissive="#ff6644" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
}

function PowerPlantMesh({ sub }: { sub: Subsidiary }) {
  const map = useGameStore(s => s.map);
  const pos = useMemo(() => {
    const w = gridToWorld(sub.x, sub.z);
    const tile = map[sub.x]?.[sub.z];
    const h = tile ? getTileWorldHeight(tile) : 0;
    return [w.x, h, w.z] as [number, number, number];
  }, [sub, map]);

  return (
    <group position={pos}>
      {/* Main building */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.8, 0.4, 0.7]} />
        <meshStandardMaterial color="#606060" roughness={0.7} metalness={0.3} />
      </mesh>
      {/* Cooling tower */}
      <mesh position={[0.25, 0.5, -0.1]} castShadow>
        <cylinderGeometry args={[0.18, 0.22, 0.6, 8]} />
        <meshStandardMaterial color="#888888" roughness={0.6} />
      </mesh>
      {/* Cooling tower top rim */}
      <mesh position={[0.25, 0.8, -0.1]}>
        <torusGeometry args={[0.18, 0.02, 6, 8]} />
        <meshStandardMaterial color="#777777" roughness={0.5} />
      </mesh>
      {/* Secondary stack */}
      <mesh position={[-0.25, 0.45, 0.1]} castShadow>
        <cylinderGeometry args={[0.05, 0.07, 0.5, 6]} />
        <meshStandardMaterial color="#555555" roughness={0.6} metalness={0.4} />
      </mesh>
      <SmokeParticles position={[pos[0] - 0.25, pos[1] + 0.7, pos[2] + 0.1]} />
    </group>
  );
}

export function Subsidiaries() {
  const subsidiaries = useGameStore(s => s.subsidiaries);
  const subArray = useMemo(() => Array.from(subsidiaries.values()), [subsidiaries]);

  if (subArray.length === 0) return null;

  return (
    <group>
      {subArray.map(sub => {
        switch (sub.type) {
          case 'factory': return <FactoryMesh key={sub.id} sub={sub} />;
          case 'hotel': return <HotelMesh key={sub.id} sub={sub} />;
          case 'department_store': return <DepartmentStoreMesh key={sub.id} sub={sub} />;
          case 'power_plant': return <PowerPlantMesh key={sub.id} sub={sub} />;
          default: return <FactoryMesh key={sub.id} sub={sub} />;
        }
      })}
    </group>
  );
}
