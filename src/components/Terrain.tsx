import { useMemo, useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTexture, useGLTF, Clone } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { getTileWorldHeight, getTerrainColor } from '../game/terrain.ts';

const BASE = import.meta.env.BASE_URL;

// Kenney車両モデル（駐車車両用）
const CAR_MODELS = [
  BASE + 'models/kenney-vehicles/sedan.glb',
  BASE + 'models/kenney-vehicles/hatchback-sports.glb',
  BASE + 'models/kenney-vehicles/taxi.glb',
  BASE + 'models/kenney-vehicles/police.glb',
  BASE + 'models/kenney-vehicles/suv.glb',
];
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
      // 水タイルは地面を水面より下に下げて水シェーダーが見えるようにする
      positions.setY(i, tile.terrain !== 'water' ? height : -0.35);
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
  const map = useGameStore(s => s.map);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // 水タイルのみをカバーするカスタムジオメトリを生成
  const waterGeometry = useMemo(() => {
    const halfGrid = GRID_SIZE / 2;
    const positions: number[] = [];
    const indices: number[] = [];
    const vertexMap = new Map<string, number>();

    function getOrCreateVertex(gx: number, gz: number): number {
      const key = `${gx},${gz}`;
      if (vertexMap.has(key)) return vertexMap.get(key)!;
      const idx = vertexMap.size;
      // ワールド座標に変換
      positions.push(gx - halfGrid, 0, gz - halfGrid);
      vertexMap.set(key, idx);
      return idx;
    }

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (map[x][z].terrain !== 'water') continue;
        // タイルの4頂点
        const v0 = getOrCreateVertex(x, z);
        const v1 = getOrCreateVertex(x + 1, z);
        const v2 = getOrCreateVertex(x + 1, z + 1);
        const v3 = getOrCreateVertex(x, z + 1);
        // 2つの三角形
        indices.push(v0, v1, v2);
        indices.push(v0, v2, v3);
      }
    }

    if (positions.length === 0) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [map]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uDeepColor: { value: new THREE.Color('#0a3d5c') },
        uShallowColor: { value: new THREE.Color('#1a8fbc') },
        uSunDir: { value: new THREE.Vector3(0.5, 0.7, 0.3).normalize() },
        uSunColor: { value: new THREE.Vector3(1.0, 0.95, 0.85) },
        uNightFactor: { value: 0 },
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        // 多層波形で自然な水面を生成
        float wave(vec2 p, float freq, float speed, vec2 dir) {
          return sin(dot(p, dir) * freq + uTime * speed);
        }

        void main() {
          vec3 pos = position;

          // 大きなうねり
          float w1 = wave(pos.xz, 1.2, 0.8, vec2(1.0, 0.3)) * 0.06;
          float w2 = wave(pos.xz, 0.8, 0.6, vec2(0.3, 1.0)) * 0.04;
          // 中程度の波
          float w3 = wave(pos.xz, 3.5, 1.5, vec2(0.7, 0.7)) * 0.02;
          float w4 = wave(pos.xz, 2.8, 1.2, vec2(-0.5, 0.8)) * 0.015;
          // 細かいさざ波
          float w5 = wave(pos.xz, 8.0, 2.5, vec2(1.0, 0.0)) * 0.006;
          float w6 = wave(pos.xz, 7.0, 2.2, vec2(0.0, 1.0)) * 0.005;
          float w7 = wave(pos.xz, 12.0, 3.5, vec2(0.6, -0.8)) * 0.003;

          pos.y += w1 + w2 + w3 + w4 + w5 + w6 + w7;
          vWorldPos = pos;

          // 法線の解析的計算
          float dx = 0.0, dz = 0.0;
          dx += cos(dot(pos.xz, vec2(1.0,0.3))*1.2+uTime*0.8)*1.2*1.0*0.06;
          dz += cos(dot(pos.xz, vec2(1.0,0.3))*1.2+uTime*0.8)*1.2*0.3*0.06;
          dx += cos(dot(pos.xz, vec2(0.3,1.0))*0.8+uTime*0.6)*0.8*0.3*0.04;
          dz += cos(dot(pos.xz, vec2(0.3,1.0))*0.8+uTime*0.6)*0.8*1.0*0.04;
          dx += cos(dot(pos.xz, vec2(0.7,0.7))*3.5+uTime*1.5)*3.5*0.7*0.02;
          dz += cos(dot(pos.xz, vec2(0.7,0.7))*3.5+uTime*1.5)*3.5*0.7*0.02;
          dx += cos(dot(pos.xz, vec2(-0.5,0.8))*2.8+uTime*1.2)*2.8*(-0.5)*0.015;
          dz += cos(dot(pos.xz, vec2(-0.5,0.8))*2.8+uTime*1.2)*2.8*0.8*0.015;
          dx += cos(dot(pos.xz, vec2(1.0,0.0))*8.0+uTime*2.5)*8.0*1.0*0.006;
          dz += cos(dot(pos.xz, vec2(0.0,1.0))*7.0+uTime*2.2)*7.0*1.0*0.005;

          vNormal = normalize(vec3(-dx, 1.0, -dz));

          vec4 worldPos4 = modelMatrix * vec4(pos, 1.0);
          vViewDir = normalize(cameraPosition - worldPos4.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uDeepColor;
        uniform vec3 uShallowColor;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uNightFactor;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          float a = hash(i);
          float b = hash(i + vec2(1.0, 0.0));
          float c = hash(i + vec2(0.0, 1.0));
          float d = hash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
        }

        float caustics(vec2 p, float t) {
          float n1 = noise(p * 6.0 + vec2(t * 0.8, t * 0.6));
          float n2 = noise(p * 8.0 - vec2(t * 0.5, t * 0.9));
          float n3 = noise(p * 12.0 + vec2(t * 1.2, -t * 0.4));
          float c = n1 * n2 + n3 * 0.3;
          return pow(c, 1.5) * 1.5;
        }

        void main() {
          // 深度による色の変化
          float depthFactor = smoothstep(-0.15, 0.05, vWorldPos.y);
          vec3 baseColor = mix(uDeepColor, uShallowColor, depthFactor);

          // 波の色変化
          float waveTint = sin(vWorldPos.x * 3.0 + uTime * 0.8) * cos(vWorldPos.z * 2.5 + uTime * 0.6) * 0.5 + 0.5;
          baseColor = mix(baseColor, baseColor * 1.15, waveTint * 0.3);

          // 夜間の暗さ
          baseColor = mix(baseColor, vec3(0.02, 0.05, 0.12), uNightFactor * 0.75);

          // フレネル反射
          float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 4.0);
          vec3 skyColor = mix(vec3(0.4, 0.6, 0.9), vec3(0.05, 0.08, 0.15), uNightFactor);
          baseColor = mix(baseColor, skyColor, fresnel * 0.6);

          // 太陽スペキュラ
          vec3 halfVec = normalize(uSunDir + vViewDir);
          float spec = pow(max(dot(vNormal, halfVec), 0.0), 256.0);
          baseColor += uSunColor * spec * 2.0 * (1.0 - uNightFactor);

          // 水面のキラキラ
          float sparkle = pow(max(dot(vNormal, halfVec), 0.0), 32.0);
          baseColor += uSunColor * sparkle * 0.3 * (1.0 - uNightFactor * 0.8);

          // コースティクス
          float causticsVal = caustics(vWorldPos.xz * 0.3, uTime);
          float causticsDepth = smoothstep(-0.15, 0.0, vWorldPos.y);
          baseColor += vec3(0.1, 0.18, 0.08) * causticsVal * causticsDepth * (1.0 - uNightFactor);

          // 岸辺の泡
          float shoreFoam = smoothstep(-0.06, 0.02, vWorldPos.y) * 0.4;
          float foamPattern = noise(vWorldPos.xz * 15.0 + vec2(uTime * 1.5, uTime * 1.2));
          float foamDetail = noise(vWorldPos.xz * 30.0 - vec2(uTime * 2.0, uTime * 0.8));
          shoreFoam *= smoothstep(0.35, 0.65, foamPattern * 0.7 + foamDetail * 0.3);
          baseColor = mix(baseColor, vec3(0.85, 0.92, 0.96), shoreFoam);

          // 月光反射（夜間）
          if (uNightFactor > 0.3) {
            vec3 moonDir = normalize(vec3(-0.3, 0.8, 0.5));
            vec3 moonHalf = normalize(moonDir + vViewDir);
            float moonSpec = pow(max(dot(vNormal, moonHalf), 0.0), 96.0);
            baseColor += vec3(0.25, 0.3, 0.45) * moonSpec * uNightFactor * 0.8;
            float moonTrail = pow(max(dot(vNormal, moonHalf), 0.0), 8.0);
            baseColor += vec3(0.08, 0.1, 0.18) * moonTrail * uNightFactor * 0.4;
          }

          gl_FragColor = vec4(baseColor, 0.85);
        }
      `,
      transparent: true, depthWrite: false, side: THREE.FrontSide,
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

  if (!waterGeometry) return null;

  return (
    <mesh geometry={waterGeometry} position={[0, -0.05, 0]}>
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}

// GLB car models for parked cars
function ParkedCar({ modelIndex, position, rotY }: { modelIndex: number; position: [number, number, number]; rotY: number }) {
  const { scene } = useGLTF(CAR_MODELS[modelIndex]);
  return (
    <Clone
      object={scene}
      position={position}
      scale={0.35}
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
      <ParkedCars />
    </group>
  );
}
