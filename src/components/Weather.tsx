import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';

// 雨粒の初期状態はモジュール読み込み時に一度だけ乱数生成する（レンダー内でのMath.random()呼び出しを避けるため）。
// useFrame内で各粒子のy座標等を直接ミューテートして降下させる（Three.jsパーティクル更新の定石パターン）。
const RAIN_PARTICLE_COUNT = 2000;
const rainParticles = Array.from({ length: RAIN_PARTICLE_COUNT }, () => ({
  x: (Math.random() - 0.5) * 120,
  y: Math.random() * 30,
  z: (Math.random() - 0.5) * 120,
  speed: 15 + Math.random() * 10,
}));

function RainEffect() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    for (let i = 0; i < RAIN_PARTICLE_COUNT; i++) {
      const p = rainParticles[i];
      p.y -= p.speed * delta;
      if (p.y < -1) {
        p.y = 25 + Math.random() * 5;
        p.x = (Math.random() - 0.5) * 120;
        p.z = (Math.random() - 0.5) * 120;
      }
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(0.01, 0.15, 0.01);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, RAIN_PARTICLE_COUNT]}>
      <cylinderGeometry args={[1, 1, 1, 3]} />
      <meshBasicMaterial color="#aaccee" transparent opacity={0.3} />
    </instancedMesh>
  );
}

// 雲の初期配置もモジュール読み込み時に一度だけ乱数生成する
const CLOUD_COUNT = 5;
const clouds = Array.from({ length: CLOUD_COUNT }, (_, i) => ({
  x: -40 + i * 20 + (Math.random() - 0.5) * 10,
  y: 20 + Math.random() * 5,
  z: (Math.random() - 0.5) * 60,
  scaleX: 8 + Math.random() * 6,
  scaleY: 2 + Math.random() * 1.5,
  scaleZ: 5 + Math.random() * 4,
  speed: 0.3 + Math.random() * 0.2,
}));

function CloudEffect() {
  const cloudsRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!cloudsRef.current) return;
    cloudsRef.current.children.forEach((child, i) => {
      const c = clouds[i];
      child.position.x += c.speed * delta;
      if (child.position.x > 80) child.position.x = -80;
    });
  });

  return (
    <group ref={cloudsRef}>
      {clouds.map((c, i) => (
        <mesh key={i} position={[c.x, c.y, c.z]} scale={[c.scaleX, c.scaleY, c.scaleZ]}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            color="#cccccc"
            transparent
            opacity={0.6}
            roughness={1}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function Weather() {
  const weatherType = useGameStore(s => s.weatherType);

  if (weatherType === 'clear') return null;

  return (
    <group>
      {(weatherType === 'cloudy' || weatherType === 'rain') && <CloudEffect />}
      {weatherType === 'rain' && <RainEffect />}
    </group>
  );
}
