import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import type { TrainVehicleType } from '../game/types.ts';

// Shared geometries
const carGeo = new THREE.BoxGeometry(0.2, 0.13, 0.17, 1, 1, 1);
const flatCarGeo = new THREE.BoxGeometry(0.2, 0.08, 0.17, 1, 1, 1);

// Shinkansen nose geometry (elongated wedge)
function createShinkansenNose(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.15, 0);
  shape.lineTo(0.15, 0.12);
  shape.lineTo(0.04, 0.12);
  shape.lineTo(0, 0.06);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false });
  geo.translate(-0.075, -0.06, -0.08);
  return geo;
}

// Standard nose geometry (sloped front)
function createStandardNose(): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0.1, 0);
  shape.lineTo(0.1, 0.13);
  shape.lineTo(0.03, 0.13);
  shape.lineTo(0, 0.08);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.17, bevelEnabled: false });
  geo.translate(-0.05, -0.065, -0.085);
  return geo;
}

const shinkansenNoseGeo = createShinkansenNose();
const standardNoseGeo = createStandardNose();

// Vehicle-type specific car component
function VehicleCar({ type, color, stripeColor, isFront, isNight }: {
  type: TrainVehicleType;
  color: string;
  stripeColor: string;
  isFront: boolean;
  isNight: boolean;
}) {
  const windowColor = isNight ? '#ffeedd' : '#aaccee';
  const windowEmissive = isNight ? '#ffeedd' : '#000000';
  const windowIntensity = isNight ? 0.5 : 0;

  switch (type) {
    case 'shinkansen':
      return (
        <group>
          {isFront ? (
            <mesh geometry={shinkansenNoseGeo} castShadow>
              <meshStandardMaterial color={color} roughness={0.2} metalness={0.4} />
            </mesh>
          ) : (
            <mesh geometry={carGeo} castShadow>
              <meshStandardMaterial color={color} roughness={0.2} metalness={0.4} />
            </mesh>
          )}
          {/* Blue stripe */}
          <mesh position={[0.086, 0, 0]}>
            <boxGeometry args={[0.005, 0.04, 0.18]} />
            <meshStandardMaterial color="#0055cc" roughness={0.3} />
          </mesh>
          <mesh position={[-0.086, 0, 0]}>
            <boxGeometry args={[0.005, 0.04, 0.18]} />
            <meshStandardMaterial color="#0055cc" roughness={0.3} />
          </mesh>
          {/* Windows */}
          <mesh position={[0.088, 0.025, 0]}>
            <boxGeometry args={[0.003, 0.03, 0.14]} />
            <meshStandardMaterial color={windowColor} emissive={windowEmissive} emissiveIntensity={windowIntensity} roughness={0.1} />
          </mesh>
          <mesh position={[-0.088, 0.025, 0]}>
            <boxGeometry args={[0.003, 0.03, 0.14]} />
            <meshStandardMaterial color={windowColor} emissive={windowEmissive} emissiveIntensity={windowIntensity} roughness={0.1} />
          </mesh>
        </group>
      );

    case 'steam':
      return (
        <group>
          {isFront ? (
            <>
              {/* Boiler (cylinder) */}
              <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.04, 0]} castShadow>
                <cylinderGeometry args={[0.06, 0.06, 0.2, 8]} />
                <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.5} />
              </mesh>
              {/* Cab */}
              <mesh position={[0, 0.04, -0.06]} castShadow>
                <boxGeometry args={[0.15, 0.14, 0.08]} />
                <meshStandardMaterial color={color} roughness={0.6} metalness={0.3} />
              </mesh>
              {/* Smokestack */}
              <mesh position={[0, 0.12, 0.06]} castShadow>
                <cylinderGeometry args={[0.015, 0.025, 0.08, 6]} />
                <meshStandardMaterial color="#333" roughness={0.7} />
              </mesh>
              {/* Cowcatcher */}
              <mesh position={[0, -0.02, 0.1]}>
                <boxGeometry args={[0.12, 0.03, 0.04]} />
                <meshStandardMaterial color="#444" metalness={0.5} roughness={0.5} />
              </mesh>
            </>
          ) : (
            <mesh geometry={carGeo} castShadow>
              <meshStandardMaterial color="#3a2a1a" roughness={0.7} />
            </mesh>
          )}
          {!isFront && (
            <>
              <mesh position={[0.087, 0.02, 0]}>
                <boxGeometry args={[0.003, 0.035, 0.14]} />
                <meshStandardMaterial color={windowColor} emissive={windowEmissive} emissiveIntensity={windowIntensity} roughness={0.2} />
              </mesh>
              <mesh position={[-0.087, 0.02, 0]}>
                <boxGeometry args={[0.003, 0.035, 0.14]} />
                <meshStandardMaterial color={windowColor} emissive={windowEmissive} emissiveIntensity={windowIntensity} roughness={0.2} />
              </mesh>
            </>
          )}
        </group>
      );

    case 'freight':
      return (
        <group>
          {isFront ? (
            // Locomotive
            <mesh geometry={standardNoseGeo} castShadow>
              <meshStandardMaterial color={color} roughness={0.5} metalness={0.4} />
            </mesh>
          ) : (
            // Flat cargo car
            <>
              <mesh geometry={flatCarGeo} position={[0, -0.02, 0]} castShadow>
                <meshStandardMaterial color="#666" roughness={0.8} />
              </mesh>
              {/* Cargo box */}
              <mesh position={[0, 0.04, 0]} castShadow>
                <boxGeometry args={[0.16, 0.1, 0.14]} />
                <meshStandardMaterial color="#8B6914" roughness={0.8} />
              </mesh>
            </>
          )}
        </group>
      );

    case 'diesel':
      return (
        <group>
          {isFront ? (
            <mesh geometry={standardNoseGeo} castShadow>
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
            </mesh>
          ) : (
            <mesh geometry={carGeo} castShadow>
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.3} />
            </mesh>
          )}
          {/* Side stripe */}
          <mesh position={[0.086, -0.02, 0]}>
            <boxGeometry args={[0.005, 0.03, 0.18]} />
            <meshStandardMaterial color="#884400" roughness={0.4} />
          </mesh>
          <mesh position={[-0.086, -0.02, 0]}>
            <boxGeometry args={[0.005, 0.03, 0.18]} />
            <meshStandardMaterial color="#884400" roughness={0.4} />
          </mesh>
          <mesh position={[0.087, 0.02, 0]}>
            <boxGeometry args={[0.003, 0.035, 0.14]} />
            <meshStandardMaterial color={windowColor} emissive={windowEmissive} emissiveIntensity={windowIntensity} roughness={0.2} />
          </mesh>
          <mesh position={[-0.087, 0.02, 0]}>
            <boxGeometry args={[0.003, 0.035, 0.14]} />
            <meshStandardMaterial color={windowColor} emissive={windowEmissive} emissiveIntensity={windowIntensity} roughness={0.2} />
          </mesh>
        </group>
      );

    default: // local, suburban, express
      return (
        <group>
          {isFront ? (
            <mesh geometry={standardNoseGeo} castShadow>
              <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
            </mesh>
          ) : (
            <mesh geometry={carGeo} castShadow>
              <meshStandardMaterial color={color} roughness={0.35} metalness={0.2} />
            </mesh>
          )}
          {/* Color stripe */}
          <mesh position={[0.086, 0.01, 0]}>
            <boxGeometry args={[0.005, 0.03, 0.18]} />
            <meshStandardMaterial color={stripeColor} roughness={0.4} />
          </mesh>
          <mesh position={[-0.086, 0.01, 0]}>
            <boxGeometry args={[0.005, 0.03, 0.18]} />
            <meshStandardMaterial color={stripeColor} roughness={0.4} />
          </mesh>
          {/* Windows */}
          <mesh position={[0.087, 0.025, 0]}>
            <boxGeometry args={[0.003, 0.04, 0.15]} />
            <meshStandardMaterial color={windowColor} emissive={windowEmissive} emissiveIntensity={windowIntensity} roughness={0.2} metalness={0.1} />
          </mesh>
          <mesh position={[-0.087, 0.025, 0]}>
            <boxGeometry args={[0.003, 0.04, 0.15]} />
            <meshStandardMaterial color={windowColor} emissive={windowEmissive} emissiveIntensity={windowIntensity} roughness={0.2} metalness={0.1} />
          </mesh>
        </group>
      );
  }
}

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

    const dx = w2.x - w1.x;
    const dz = w2.z - w1.z;
    const angle = Math.atan2(dx, dz);
    groupRef.current.rotation.y = t.direction === 1 ? angle : angle + Math.PI;
  });

  if (!train) return null;

  const carSpacing = train.type === 'shinkansen' ? 0.22 : 0.24;
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
            <VehicleCar
              type={train.type}
              color={train.color}
              stripeColor={stripeColor}
              isFront={isFront}
              isNight={isNight}
            />

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
                  <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.6} />
                </mesh>
                <mesh position={[-0.04, 0.01, -0.09]}>
                  <sphereGeometry args={[0.01, 6, 6]} />
                  <meshStandardMaterial color="#ff3333" emissive="#ff2222" emissiveIntensity={0.6} />
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
