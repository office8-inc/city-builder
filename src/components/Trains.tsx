import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';

// Rounded-edge box geometry for train cars
const carGeometry = new THREE.BoxGeometry(0.2, 0.13, 0.17, 1, 1, 1);
// Bevel edges slightly by scaling inner vertices isn't trivial with BoxGeometry,
// so we use a standard box and rely on materials for visual quality.

// Wedge geometry for front car nose (sloped front)
function createNoseGeometry(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // Side profile: rectangle with sloped front
  shape.moveTo(0, 0);
  shape.lineTo(0.1, 0);
  shape.lineTo(0.1, 0.13);
  shape.lineTo(0.03, 0.13);
  shape.lineTo(0, 0.08);
  shape.closePath();

  const extrudeSettings = {
    depth: 0.17,
    bevelEnabled: false,
  };
  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.translate(-0.05, -0.065, -0.085);
  return geo;
}

const noseGeometry = createNoseGeometry();

function TrainMesh({ trainId }: { trainId: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const headlightRef1 = useRef<THREE.PointLight>(null);

  const train = useGameStore(s => s.trains.get(trainId));
  const hour = useGameStore(s => s.gameTime.hour);
  const isNight = hour < 6 || hour >= 18;

  useFrame(() => {
    const { trains, tracks, map } = useGameStore.getState();
    const t = trains.get(trainId);
    if (!t || !groupRef.current) return;

    const segment = tracks.get(t.currentSegmentId);
    if (!segment) return;

    const w1 = gridToWorld(segment.startX, segment.startZ);
    const w2 = gridToWorld(segment.endX, segment.endZ);
    const tile1 = map[segment.startX]?.[segment.startZ];
    const tile2 = map[segment.endX]?.[segment.endZ];
    const h1 = tile1 ? getTileWorldHeight(tile1) : 0;
    const h2 = tile2 ? getTileWorldHeight(tile2) : 0;

    const p = t.positionOnSegment;
    groupRef.current.position.set(
      w1.x + (w2.x - w1.x) * p,
      h1 + (h2 - h1) * p + 0.15,
      w1.z + (w2.z - w1.z) * p
    );

    // Orient train along track direction
    const dx = w2.x - w1.x;
    const dz = w2.z - w1.z;
    const angle = Math.atan2(dx, dz);
    groupRef.current.rotation.y = t.direction === 1 ? angle : angle + Math.PI;
  });

  if (!train) return null;

  const carSpacing = 0.24;
  const cars = train.cars;
  const stripeColor = new THREE.Color(train.color).offsetHSL(0, 0, -0.15).getStyle();

  return (
    <group ref={groupRef}>
      {Array.from({ length: cars }, (_, i) => {
        const isFront = i === 0;
        const isBack = i === cars - 1;
        const zPos = (i - (cars - 1) / 2) * carSpacing;

        return (
          <group key={i} position={[0, 0, zPos]}>
            {/* Car body */}
            {isFront ? (
              // Front car with wedge nose
              <mesh geometry={noseGeometry} castShadow>
                <meshStandardMaterial
                  color={train.color}
                  roughness={0.35}
                  metalness={0.2}
                />
              </mesh>
            ) : (
              // Regular car body
              <mesh geometry={carGeometry} castShadow>
                <meshStandardMaterial
                  color={train.color}
                  roughness={0.35}
                  metalness={0.2}
                />
              </mesh>
            )}

            {/* Color stripe along the side */}
            <mesh position={[0.086, 0.01, 0]}>
              <boxGeometry args={[0.005, 0.03, 0.18]} />
              <meshStandardMaterial color={stripeColor} roughness={0.4} />
            </mesh>
            <mesh position={[-0.086, 0.01, 0]}>
              <boxGeometry args={[0.005, 0.03, 0.18]} />
              <meshStandardMaterial color={stripeColor} roughness={0.4} />
            </mesh>

            {/* Windows band */}
            <mesh position={[0.087, 0.025, 0]}>
              <boxGeometry args={[0.003, 0.04, 0.15]} />
              <meshStandardMaterial
                color={isNight ? '#ffeedd' : '#aaccee'}
                emissive={isNight ? '#ffeedd' : '#000000'}
                emissiveIntensity={isNight ? 0.5 : 0}
                roughness={0.2}
                metalness={0.1}
              />
            </mesh>
            <mesh position={[-0.087, 0.025, 0]}>
              <boxGeometry args={[0.003, 0.04, 0.15]} />
              <meshStandardMaterial
                color={isNight ? '#ffeedd' : '#aaccee'}
                emissive={isNight ? '#ffeedd' : '#000000'}
                emissiveIntensity={isNight ? 0.5 : 0}
                roughness={0.2}
                metalness={0.1}
              />
            </mesh>

            {/* Headlights on front car */}
            {isFront && (
              <>
                <mesh position={[0.04, 0.01, 0.09]}>
                  <sphereGeometry args={[0.012, 6, 6]} />
                  <meshStandardMaterial
                    color="#ffffee"
                    emissive={isNight ? '#ffffaa' : '#444400'}
                    emissiveIntensity={isNight ? 1.0 : 0.2}
                  />
                </mesh>
                <mesh position={[-0.04, 0.01, 0.09]}>
                  <sphereGeometry args={[0.012, 6, 6]} />
                  <meshStandardMaterial
                    color="#ffffee"
                    emissive={isNight ? '#ffffaa' : '#444400'}
                    emissiveIntensity={isNight ? 1.0 : 0.2}
                  />
                </mesh>
                {isNight && (
                  <pointLight
                    ref={headlightRef1}
                    position={[0, 0.02, 0.15]}
                    color="#ffffcc"
                    intensity={0.5}
                    distance={3}
                    decay={2}
                  />
                )}
              </>
            )}

            {/* Tail lights on back car */}
            {isBack && (
              <>
                <mesh position={[0.04, 0.01, -0.09]}>
                  <sphereGeometry args={[0.01, 6, 6]} />
                  <meshStandardMaterial
                    color="#ff3333"
                    emissive="#ff2222"
                    emissiveIntensity={0.6}
                  />
                </mesh>
                <mesh position={[-0.04, 0.01, -0.09]}>
                  <sphereGeometry args={[0.01, 6, 6]} />
                  <meshStandardMaterial
                    color="#ff3333"
                    emissive="#ff2222"
                    emissiveIntensity={0.6}
                  />
                </mesh>
              </>
            )}
          </group>
        );
      })}
    </group>
  );
}

export function Trains() {
  const trains = useGameStore(s => s.trains);
  const trainIds = useMemo(() => Array.from(trains.keys()), [trains]);

  if (trainIds.length === 0) return null;

  return (
    <group>
      {trainIds.map(id => (
        <TrainMesh key={id} trainId={id} />
      ))}
    </group>
  );
}
