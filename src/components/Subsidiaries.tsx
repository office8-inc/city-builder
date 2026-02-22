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

function useSubPosition(sub: Subsidiary): [number, number, number] {
  const map = useGameStore(s => s.map);
  return useMemo(() => {
    const w = gridToWorld(sub.x, sub.z);
    const tile = map[sub.x]?.[sub.z];
    const h = tile ? getTileWorldHeight(tile) : 0;
    return [w.x, h, w.z] as [number, number, number];
  }, [sub, map]);
}

function DepotMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.85, 0.3, 0.65]} />
        <meshStandardMaterial color="#6a6560" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.32, 0]} castShadow>
        <boxGeometry args={[0.9, 0.03, 0.7]} />
        <meshStandardMaterial color="#505550" roughness={0.5} metalness={0.3} />
      </mesh>
      {[-0.2, 0.2].map(xp => (
        <mesh key={xp} position={[xp, 0.1, 0.33]}>
          <boxGeometry args={[0.25, 0.2, 0.02]} />
          <meshStandardMaterial color="#3a4040" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function MaterialYardMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[0.9, 0.04, 0.8]} />
        <meshStandardMaterial color="#888075" roughness={0.95} />
      </mesh>
      {[[-0.2, 0.15], [0.15, -0.1], [-0.1, -0.25]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.1, z]} castShadow>
          <boxGeometry args={[0.2, 0.15, 0.2]} />
          <meshStandardMaterial color="#a08050" roughness={0.9} />
        </mesh>
      ))}
      <mesh position={[0.3, 0.06, 0.2]} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 0.1, 6]} />
        <meshStandardMaterial color="#666666" roughness={0.7} metalness={0.3} />
      </mesh>
    </group>
  );
}

function WarehouseMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.85, 0.4, 0.7]} />
        <meshStandardMaterial color="#8a8580" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.88, 0.02, 0.74]} />
        <meshStandardMaterial color="#5a5855" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.15, 0.36]}>
        <boxGeometry args={[0.4, 0.3, 0.02]} />
        <meshStandardMaterial color="#4a4845" roughness={0.5} />
      </mesh>
    </group>
  );
}

function ResortHotelMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 1.0, 0.55]} />
        <meshStandardMaterial color="#f0e8d0" roughness={0.4} />
      </mesh>
      <mesh position={[-0.3, 0.25, 0]} castShadow>
        <boxGeometry args={[0.3, 0.5, 0.55]} />
        <meshStandardMaterial color="#e8d8c0" roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.02, 0]} castShadow>
        <boxGeometry args={[0.53, 0.04, 0.58]} />
        <meshStandardMaterial color="#a09880" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Pool */}
      <mesh position={[0.15, 0.05, 0.32]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
        <meshStandardMaterial color="#4488cc" roughness={0.1} metalness={0.2} />
      </mesh>
    </group>
  );
}

function ConvenienceStoreMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.5, 0.2, 0.4]} />
        <meshStandardMaterial color="#f8f8f0" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.18, 0.2]} castShadow>
        <boxGeometry args={[0.48, 0.04, 0.08]} />
        <meshStandardMaterial color="#0066cc" emissive="#0066cc" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[0, 0.08, 0.21]}>
        <boxGeometry args={[0.2, 0.15, 0.02]} />
        <meshStandardMaterial color="#aaddee" roughness={0.1} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function AmusementParkMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[0.9, 0.03, 0.9]} />
        <meshStandardMaterial color="#55aa55" roughness={0.9} />
      </mesh>
      {/* Ferris wheel */}
      <mesh position={[0.2, 0.35, 0]} castShadow>
        <torusGeometry args={[0.2, 0.015, 8, 16]} />
        <meshStandardMaterial color="#ff4444" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0.2, 0.35, 0]} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.7, 4]} />
        <meshStandardMaterial color="#888888" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Tent */}
      <mesh position={[-0.2, 0.15, 0.15]} castShadow>
        <coneGeometry args={[0.12, 0.3, 6]} />
        <meshStandardMaterial color="#ffcc33" roughness={0.5} />
      </mesh>
      {/* Attraction building */}
      <mesh position={[-0.15, 0.1, -0.2]} castShadow>
        <boxGeometry args={[0.2, 0.18, 0.15]} />
        <meshStandardMaterial color="#4488dd" roughness={0.4} />
      </mesh>
    </group>
  );
}

function StadiumMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      {/* Stadium walls */}
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.4, 0.45, 0.3, 12, 1, true]} />
        <meshStandardMaterial color="#cccccc" roughness={0.5} metalness={0.2} side={THREE.DoubleSide} />
      </mesh>
      {/* Field */}
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <cylinderGeometry args={[0.38, 0.38, 0.02, 12]} />
        <meshStandardMaterial color="#44aa44" roughness={0.8} />
      </mesh>
      {/* Scoreboard */}
      <mesh position={[0, 0.25, 0.35]} castShadow>
        <boxGeometry args={[0.3, 0.2, 0.05]} />
        <meshStandardMaterial color="#dddddd" roughness={0.5} />
      </mesh>
    </group>
  );
}

function BroadcastTowerMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      {/* Base building */}
      <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.3, 0.12, 0.3]} />
        <meshStandardMaterial color="#888888" roughness={0.6} metalness={0.3} />
      </mesh>
      {/* Tower */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.008, 0.04, 1.0, 4]} />
        <meshStandardMaterial color="#cc3333" roughness={0.4} metalness={0.5} />
      </mesh>
      {/* Beacon */}
      <mesh position={[0, 1.12, 0]}>
        <sphereGeometry args={[0.015, 6, 6]} />
        <meshStandardMaterial color="#ff0000" emissive="#ff0000" emissiveIntensity={1.5} />
      </mesh>
      {/* Cross-beams */}
      {[0.3, 0.6].map((h, i) => (
        <mesh key={i} position={[0, h, 0]}>
          <boxGeometry args={[0.15 - i * 0.04, 0.005, 0.005]} />
          <meshStandardMaterial color="#aaaaaa" roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function GenericSubMesh({ sub }: { sub: Subsidiary }) {
  const pos = useSubPosition(sub);
  return (
    <group position={pos}>
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.6, 0.4, 0.5]} />
        <meshStandardMaterial color="#d0c8b8" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[0.64, 0.03, 0.54]} />
        <meshStandardMaterial color="#907060" roughness={0.7} />
      </mesh>
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
          case 'depot': return <DepotMesh key={sub.id} sub={sub} />;
          case 'hotel': return <HotelMesh key={sub.id} sub={sub} />;
          case 'department_store': return <DepartmentStoreMesh key={sub.id} sub={sub} />;
          case 'power_plant': return <PowerPlantMesh key={sub.id} sub={sub} />;
          case 'material_yard': return <MaterialYardMesh key={sub.id} sub={sub} />;
          case 'warehouse': return <WarehouseMesh key={sub.id} sub={sub} />;
          case 'resort_hotel': return <ResortHotelMesh key={sub.id} sub={sub} />;
          case 'convenience_store': return <ConvenienceStoreMesh key={sub.id} sub={sub} />;
          case 'amusement_park': return <AmusementParkMesh key={sub.id} sub={sub} />;
          case 'stadium': return <StadiumMesh key={sub.id} sub={sub} />;
          case 'broadcast_tower': return <BroadcastTowerMesh key={sub.id} sub={sub} />;
          default: return <GenericSubMesh key={sub.id} sub={sub} />;
        }
      })}
    </group>
  );
}
