import { useMemo, useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTexture, useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { getTileWorldHeight, getTerrainColor } from '../game/terrain.ts';

const BASE = import.meta.env.BASE_URL;

// Preload tree + car models
const TREE_MODEL = BASE + 'models/kenney-nature/detail_forestA.gltf.glb';
const CAR_MODELS = [
  BASE + 'models/kaykit-city/car_sedan.gltf',
  BASE + 'models/kaykit-city/car_hatchback.gltf',
  BASE + 'models/kaykit-city/car_taxi.gltf',
  BASE + 'models/kaykit-city/car_police.gltf',
  BASE + 'models/kaykit-city/car_stationwagon.gltf',
];
useGLTF.preload(TREE_MODEL);
CAR_MODELS.forEach(p => useGLTF.preload(p));

// Procedural grass textures (fallback)
let grassColorMap: THREE.CanvasTexture | null = null;
function getGrassColorMap(): THREE.CanvasTexture {
  if (grassColorMap) return grassColorMap;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#3a7a35';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size, y = Math.random() * size, r = 8 + Math.random() * 25;
    ctx.fillStyle = `rgba(${30 + Math.random() * 30},${90 + Math.random() * 50},${20 + Math.random() * 20},0.4)`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size, y = Math.random() * size, len = 3 + Math.random() * 10;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const brightness = 50 + Math.random() * 80;
    ctx.strokeStyle = `rgba(${brightness * 0.4},${brightness},${brightness * 0.3},0.5)`;
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GRID_SIZE / 6, GRID_SIZE / 6);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  grassColorMap = tex;
  return tex;
}

let grassNormalMap: THREE.CanvasTexture | null = null;
function getGrassNormalMap(): THREE.CanvasTexture {
  if (grassNormalMap) return grassNormalMap;
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size, y = Math.random() * size, len = 3 + Math.random() * 10;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    ctx.strokeStyle = `rgb(${128 + (Math.random() - 0.5) * 50},${128 + (Math.random() - 0.5) * 40},238)`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GRID_SIZE / 6, GRID_SIZE / 6);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  grassNormalMap = tex;
  return tex;
}

function GroundMesh() {
  const map = useGameStore(s => s.map);
  const season = useGameStore(s => s.season);

  const geometry = useMemo(() => {
    const halfGrid = GRID_SIZE / 2;
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE, GRID_SIZE);
    geo.rotateX(-Math.PI / 2);
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);
      const gx = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(vx + halfGrid)));
      const gz = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(vz + halfGrid)));
      const tile = map[gx][gz];
      const height = getTileWorldHeight(tile);
      positions.setY(i, tile.terrain !== 'water' ? height : -0.05);
      const [r, g, b] = getTerrainColor(tile.terrain, tile.height, gx, gz, season);
      colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [map, season]);

  const procColorMap = useMemo(() => getGrassColorMap(), []);
  const procNormalMap = useMemo(() => getGrassNormalMap(), []);

  return (
    <Suspense fallback={
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial vertexColors map={procColorMap} roughness={0.82} normalMap={procNormalMap} normalScale={new THREE.Vector2(0.35, 0.35)} />
      </mesh>
    }>
      <GroundWithRealTextures geometry={geometry} />
    </Suspense>
  );
}

function GroundWithRealTextures({ geometry }: { geometry: THREE.PlaneGeometry }) {
  const textures = useTexture({
    map: BASE + 'textures/grass-color.jpg',
    normalMap: BASE + 'textures/grass-normal.jpg',
    roughnessMap: BASE + 'textures/grass-roughness.jpg',
  });
  useMemo(() => {
    const repeat = GRID_SIZE / 8;
    for (const tex of Object.values(textures)) {
      if (tex instanceof THREE.Texture) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(repeat, repeat);
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.anisotropy = 4;
      }
    }
  }, [textures]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors {...textures} roughness={0.82} normalScale={new THREE.Vector2(0.4, 0.4)} />
    </mesh>
  );
}

function WaterPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color('#1a7fcc') },
        uColor2: { value: new THREE.Color('#0e5fa8') },
        uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
        uSunColor: { value: new THREE.Vector3(1.0, 0.95, 0.85) },
        uNightFactor: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv; varying vec3 vWorldPos; varying vec3 vNormal; varying vec3 vViewDir;
        void main() {
          vUv = uv; vec3 pos = position;
          pos.y += sin(pos.x*2.0+uTime*1.2)*0.05+cos(pos.z*1.8+uTime*0.9)*0.035
                 +sin((pos.x+pos.z)*1.5+uTime*0.7)*0.025+sin(pos.x*8.0+uTime*3.0)*0.008+cos(pos.z*7.0+uTime*2.5)*0.006;
          vWorldPos = pos;
          float dx = cos(pos.x*2.0+uTime*1.2)*2.0*0.05+cos((pos.x+pos.z)*1.5+uTime*0.7)*1.5*0.025+cos(pos.x*8.0+uTime*3.0)*8.0*0.008;
          float dz = -sin(pos.z*1.8+uTime*0.9)*1.8*0.035+cos((pos.x+pos.z)*1.5+uTime*0.7)*1.5*0.025-sin(pos.z*7.0+uTime*2.5)*7.0*0.006;
          vNormal = normalize(vec3(-dx, 1.0, -dz));
          vec4 worldPos4 = modelMatrix * vec4(pos, 1.0);
          vViewDir = normalize(cameraPosition - worldPos4.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime; uniform vec3 uColor1; uniform vec3 uColor2;
        uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uNightFactor;
        varying vec2 vUv; varying vec3 vWorldPos; varying vec3 vNormal; varying vec3 vViewDir;
        float caustics(vec2 p, float t) {
          float c = sin(p.x*12.0+t*2.0)*cos(p.y*10.0+t*1.5)*0.5+sin(p.x*8.0-t*1.2)*cos(p.y*14.0+t*0.8)*0.3+sin((p.x+p.y)*6.0+t*1.8)*0.2;
          return c*c;
        }
        void main() {
          float wave = sin(vWorldPos.x*4.0+uTime*1.5)*cos(vWorldPos.z*3.0+uTime*1.0);
          vec3 color = mix(uColor1, uColor2, wave*0.5+0.5);
          color = mix(color, vec3(0.04,0.08,0.18), uNightFactor*0.7);
          float fresnel = pow(1.0-max(dot(vNormal, vViewDir),0.0),3.5);
          color = mix(color, mix(vec3(0.5,0.7,0.95),vec3(0.1,0.15,0.3),uNightFactor), fresnel*0.55);
          vec3 halfVec = normalize(uSunDir+vViewDir);
          color += uSunColor*pow(max(dot(vNormal,halfVec),0.0),128.0)*1.2*(1.0-uNightFactor);
          color += vec3(pow(max(wave,0.0),16.0)*0.3)*(1.0-uNightFactor*0.7);
          color += vec3(0.15,0.25,0.1)*caustics(vWorldPos.xz*0.5,uTime)*smoothstep(-0.12,-0.02,vWorldPos.y)*(1.0-uNightFactor);
          float foam = smoothstep(-0.08,-0.01,vWorldPos.y)*0.35;
          foam *= smoothstep(0.2,0.8,sin(vWorldPos.x*20.0+uTime*4.0)*cos(vWorldPos.z*18.0+uTime*3.0)*0.5+0.5);
          color = mix(color, vec3(0.88,0.94,0.98), foam);
          if (uNightFactor > 0.3) {
            vec3 moonHalf = normalize(normalize(vec3(-0.3,0.8,0.5))+vViewDir);
            color += vec3(0.3,0.35,0.5)*pow(max(dot(vNormal,moonHalf),0.0),64.0)*uNightFactor*0.6;
          }
          gl_FragColor = vec4(color, 0.82);
        }
      `,
      transparent: true, side: THREE.DoubleSide,
    });
  }, []);

  useFrame((_, delta) => {
    const mat = materialRef.current || shaderMaterial;
    mat.uniforms.uTime.value += delta;
    const h = useGameStore.getState().gameTime.hour + useGameStore.getState().gameTime.minute / 60;
    const sunAngle = ((h - 6) / 12) * Math.PI;
    mat.uniforms.uSunDir.value.set(Math.cos(sunAngle) * 0.7, Math.max(Math.sin(sunAngle), 0.05), 0.5).normalize();
    const isDaytime = h >= 6 && h < 18;
    const isTwilight = (h >= 5 && h < 6) || (h >= 18 && h < 19.5);
    mat.uniforms.uNightFactor.value = isDaytime ? 0 : isTwilight ? 0.5 : 1.0;
    if (isDaytime) {
      const midday = 1 - Math.abs(h - 12) / 6;
      mat.uniforms.uSunColor.value.set(1.0, 0.95 + midday * 0.05, 0.85 + midday * 0.1);
    } else {
      mat.uniforms.uSunColor.value.set(0.2, 0.2, 0.3);
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[GRID_SIZE, GRID_SIZE, 96, 96]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}

// GLB tree instances for forest tiles
function ForestInstances() {
  const map = useGameStore(s => s.map);
  const { scene } = useGLTF(TREE_MODEL);

  const treeData = useMemo(() => {
    const trees: { pos: [number, number, number]; scale: number; rotY: number }[] = [];
    const halfGrid = GRID_SIZE / 2;
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.terrain !== 'forest') continue;
        const worldX = x - halfGrid + 0.5;
        const worldZ = z - halfGrid + 0.5;
        const baseY = getTileWorldHeight(tile);
        const seed = x * 1000 + z;
        const treeCount = 1 + (seed % 2);
        for (let t = 0; t < treeCount; t++) {
          const offsetX = ((seed * (t + 1) * 7) % 100) / 100 * 0.6 - 0.3;
          const offsetZ = ((seed * (t + 1) * 13) % 100) / 100 * 0.6 - 0.3;
          const scaleVar = 0.5 + ((seed * (t + 1) * 17) % 100) / 100 * 0.5;
          const rotY = ((seed * (t + 1) * 31) % 100) / 100 * Math.PI * 2;
          trees.push({
            pos: [worldX + offsetX, baseY, worldZ + offsetZ],
            scale: scaleVar,
            rotY,
          });
        }
      }
    }
    return trees;
  }, [map]);

  if (treeData.length === 0) return null;

  return (
    <group>
      {treeData.map((t, i) => (
        <Clone
          key={i}
          object={scene}
          position={t.pos}
          scale={t.scale}
          rotation={[0, t.rotY, 0]}
          castShadow
        />
      ))}
    </group>
  );
}

// GLB trees near buildings
function UrbanTrees() {
  const buildings = useGameStore(s => s.buildings);
  const map = useGameStore(s => s.map);
  const { scene } = useGLTF(TREE_MODEL);

  const treeData = useMemo(() => {
    const trees: { pos: [number, number, number]; scale: number; rotY: number }[] = [];
    const halfGrid = GRID_SIZE / 2;
    const placed = new Set<string>();
    for (const b of buildings.values()) {
      const offsets = [[-1, 0], [b.width, 0], [0, -1], [0, b.depth]];
      for (const [dx, dz] of offsets) {
        const tx = b.x + dx;
        const tz = b.z + dz;
        const key = `${tx}_${tz}`;
        if (placed.has(key)) continue;
        if (tx < 0 || tx >= GRID_SIZE || tz < 0 || tz >= GRID_SIZE) continue;
        const tile = map[tx]?.[tz];
        if (!tile || tile.terrain === 'water' || tile.buildingId || tile.stationId || tile.trackIds.length > 0) continue;
        const seed = tx * 997 + tz * 1013;
        if ((seed % 100) > 30) continue;
        placed.add(key);
        const worldX = tx - halfGrid + 0.5;
        const worldZ = tz - halfGrid + 0.5;
        const baseY = getTileWorldHeight(tile);
        trees.push({
          pos: [worldX, baseY, worldZ],
          scale: 0.3 + (seed % 30) / 100 * 0.2,
          rotY: (seed % 100) / 100 * Math.PI * 2,
        });
      }
    }
    return trees;
  }, [buildings, map]);

  if (treeData.length === 0) return null;

  return (
    <group>
      {treeData.map((t, i) => (
        <Clone
          key={i}
          object={scene}
          position={t.pos}
          scale={t.scale}
          rotation={[0, t.rotY, 0]}
          castShadow
        />
      ))}
    </group>
  );
}

// GLB car models for parked cars
function ParkedCar({ modelIndex, position, rotY }: { modelIndex: number; position: [number, number, number]; rotY: number }) {
  const { scene } = useGLTF(CAR_MODELS[modelIndex]);
  return (
    <Clone
      object={scene}
      position={position}
      scale={0.08}
      rotation={[0, rotY, 0]}
      castShadow
    />
  );
}

function ParkedCars() {
  const map = useGameStore(s => s.map);

  const carData = useMemo(() => {
    const cars: { x: number; y: number; z: number; rotY: number; modelIndex: number }[] = [];
    const halfGrid = GRID_SIZE / 2;
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.roadLevel < 2) continue;
        if (tile.buildingId || tile.stationId || tile.trackIds.length > 0) continue;
        const seed = x * 997 + z * 1013;
        if ((seed % 100) > 8) continue;
        const worldX = x - halfGrid + 0.5;
        const worldZ = z - halfGrid + 0.5;
        const h = getTileWorldHeight(tile);
        const rotY = ((seed * 7) % 4) * (Math.PI / 2);
        const offset = ((seed * 13) % 2 === 0) ? 0.3 : -0.3;
        cars.push({
          x: worldX + offset * Math.cos(rotY),
          y: h + 0.01,
          z: worldZ + offset * Math.sin(rotY),
          rotY,
          modelIndex: seed % CAR_MODELS.length,
        });
      }
    }
    return cars;
  }, [map]);

  if (carData.length === 0) return null;

  return (
    <Suspense fallback={null}>
      <group>
        {carData.map((d, i) => (
          <ParkedCar key={i} modelIndex={d.modelIndex} position={[d.x, d.y, d.z]} rotY={d.rotY} />
        ))}
      </group>
    </Suspense>
  );
}

export function Terrain() {
  return (
    <group>
      <GroundMesh />
      <WaterPlane />
      <Suspense fallback={null}>
        <ForestInstances />
        <UrbanTrees />
      </Suspense>
      <ParkedCars />
    </group>
  );
}
