import { useMemo, useRef, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { getTileWorldHeight, getTerrainColor } from '../game/terrain.ts';

// 高品質プロシージャル草カラーテクスチャ（地形頂点カラーに重ねる）
let grassColorMap: THREE.CanvasTexture | null = null;
function getGrassColorMap(): THREE.CanvasTexture {
  if (grassColorMap) return grassColorMap;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // ベース: やや暗い緑
  ctx.fillStyle = '#3a7a35';
  ctx.fillRect(0, 0, size, size);

  // 草のクランプ（濃い緑のパッチ）
  for (let i = 0; i < 200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 25;
    const g = 90 + Math.random() * 50;
    ctx.fillStyle = `rgba(${30 + Math.random() * 30},${g},${20 + Math.random() * 20},0.4)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 草の葉ストローク（明るい方向）
  for (let i = 0; i < 5000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 10;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.8;
    const brightness = 50 + Math.random() * 80;
    ctx.strokeStyle = `rgba(${brightness * 0.4},${brightness},${brightness * 0.3},0.5)`;
    ctx.lineWidth = 0.8 + Math.random() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // 土の露出パッチ
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 3 + Math.random() * 8;
    ctx.fillStyle = `rgba(${100 + Math.random() * 40},${80 + Math.random() * 30},${50 + Math.random() * 20},0.35)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 小さな花（ランダムに点在）
  for (let i = 0; i < 60; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const colors = ['#ffff88', '#ffffff', '#ff88aa', '#aaaaff'];
    ctx.fillStyle = colors[Math.floor(Math.random() * colors.length)];
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GRID_SIZE / 6, GRID_SIZE / 6);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  grassColorMap = tex;
  return tex;
}

// プロシージャル草法線マップ生成（512x512、タイリング可能）
let grassNormalMap: THREE.CanvasTexture | null = null;
function getGrassNormalMap(): THREE.CanvasTexture {
  if (grassNormalMap) return grassNormalMap;

  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // ベース: フラットな法線 (128,128,255)
  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);

  // 草の葉のストロークで凹凸を表現
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const len = 3 + Math.random() * 10;
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
    const nx = 128 + (Math.random() - 0.5) * 50;
    const ny = 128 + (Math.random() - 0.5) * 40;
    ctx.strokeStyle = `rgb(${nx},${ny},238)`;
    ctx.lineWidth = 1 + Math.random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  // 土のパッチ（ランダムな小さい円形エリア）
  for (let i = 0; i < 50; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 4 + Math.random() * 14;
    ctx.fillStyle = `rgb(${124 + Math.random() * 8},${124 + Math.random() * 8},246)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GRID_SIZE / 6, GRID_SIZE / 6);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  grassNormalMap = tex;
  return tex;
}

// プロシージャル草のラフネスマップ
let grassRoughnessMap: THREE.CanvasTexture | null = null;
function getGrassRoughnessMap(): THREE.CanvasTexture {
  if (grassRoughnessMap) return grassRoughnessMap;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // ベースラフネス
  ctx.fillStyle = 'rgb(200,200,200)';
  ctx.fillRect(0, 0, size, size);

  // ランダムバリエーション
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const v = 175 + Math.random() * 55;
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(GRID_SIZE / 6, GRID_SIZE / 6);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  grassRoughnessMap = tex;
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

      if (tile.terrain !== 'water') {
        positions.setY(i, height);
      } else {
        positions.setY(i, -0.05);
      }

      const [r, g, b] = getTerrainColor(tile.terrain, tile.height, gx, gz, season);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    return geo;
  }, [map, season]);

  // Procedural fallback textures
  const procColorMap = useMemo(() => getGrassColorMap(), []);
  const procNormalMap = useMemo(() => getGrassNormalMap(), []);
  const procRoughnessMap = useMemo(() => getGrassRoughnessMap(), []);

  return (
    <Suspense fallback={
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={procColorMap}
          roughness={0.82}
          normalMap={procNormalMap}
          normalScale={new THREE.Vector2(0.35, 0.35)}
          roughnessMap={procRoughnessMap}
        />
      </mesh>
    }>
      <GroundWithRealTextures geometry={geometry} />
    </Suspense>
  );
}

const BASE = import.meta.env.BASE_URL;

function GroundWithRealTextures({ geometry }: { geometry: THREE.PlaneGeometry }) {
  const textures = useTexture({
    map: BASE + 'textures/grass-color.jpg',
    normalMap: BASE + 'textures/grass-normal.jpg',
    roughnessMap: BASE + 'textures/grass-roughness.jpg',
  });

  // Configure tiling
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
      <meshStandardMaterial
        vertexColors
        {...textures}
        roughness={0.82}
        normalScale={new THREE.Vector2(0.4, 0.4)}
      />
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
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vec3 pos = position;
          // 多重波（大波＋小波＋さざ波）
          pos.y += sin(pos.x * 2.0 + uTime * 1.2) * 0.05
                 + cos(pos.z * 1.8 + uTime * 0.9) * 0.035
                 + sin((pos.x + pos.z) * 1.5 + uTime * 0.7) * 0.025
                 + sin(pos.x * 8.0 + uTime * 3.0) * 0.008
                 + cos(pos.z * 7.0 + uTime * 2.5) * 0.006;
          vWorldPos = pos;
          float dx = cos(pos.x * 2.0 + uTime * 1.2) * 2.0 * 0.05
                   + cos((pos.x + pos.z) * 1.5 + uTime * 0.7) * 1.5 * 0.025
                   + cos(pos.x * 8.0 + uTime * 3.0) * 8.0 * 0.008;
          float dz = -sin(pos.z * 1.8 + uTime * 0.9) * 1.8 * 0.035
                   + cos((pos.x + pos.z) * 1.5 + uTime * 0.7) * 1.5 * 0.025
                   - sin(pos.z * 7.0 + uTime * 2.5) * 7.0 * 0.006;
          vNormal = normalize(vec3(-dx, 1.0, -dz));
          vec4 worldPos4 = modelMatrix * vec4(pos, 1.0);
          vViewDir = normalize(cameraPosition - worldPos4.xyz);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uNightFactor;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec3 vViewDir;

        // 簡易コースティクス
        float caustics(vec2 p, float t) {
          float c = 0.0;
          c += sin(p.x * 12.0 + t * 2.0) * cos(p.y * 10.0 + t * 1.5) * 0.5;
          c += sin(p.x * 8.0 - t * 1.2) * cos(p.y * 14.0 + t * 0.8) * 0.3;
          c += sin((p.x + p.y) * 6.0 + t * 1.8) * 0.2;
          return c * c;
        }

        void main() {
          float wave = sin(vWorldPos.x * 4.0 + uTime * 1.5) * cos(vWorldPos.z * 3.0 + uTime * 1.0);
          vec3 color = mix(uColor1, uColor2, wave * 0.5 + 0.5);

          // 夜間は暗い青
          vec3 nightColor = vec3(0.04, 0.08, 0.18);
          color = mix(color, nightColor, uNightFactor * 0.7);

          // フレネル反射
          float fresnel = pow(1.0 - max(dot(vNormal, vViewDir), 0.0), 3.5);
          vec3 skyReflect = mix(vec3(0.5, 0.7, 0.95), vec3(0.1, 0.15, 0.3), uNightFactor);
          color = mix(color, skyReflect, fresnel * 0.55);

          // 太陽スペキュラ反射（ブリンフォン）
          vec3 halfVec = normalize(uSunDir + vViewDir);
          float sunSpec = pow(max(dot(vNormal, halfVec), 0.0), 128.0);
          color += uSunColor * sunSpec * 1.2 * (1.0 - uNightFactor);

          // 小さなスペキュラ（波頭のきらめき）
          float microSpec = pow(max(wave, 0.0), 16.0) * 0.3;
          color += vec3(microSpec) * (1.0 - uNightFactor * 0.7);

          // コースティクス（浅い部分で底面に映る光模様）
          float causticsVal = caustics(vWorldPos.xz * 0.5, uTime);
          float shallowFactor = smoothstep(-0.12, -0.02, vWorldPos.y);
          color += vec3(0.15, 0.25, 0.1) * causticsVal * shallowFactor * (1.0 - uNightFactor);

          // 波頭の泡
          float foam = smoothstep(-0.08, -0.01, vWorldPos.y) * 0.35;
          float foamNoise = sin(vWorldPos.x * 20.0 + uTime * 4.0) * cos(vWorldPos.z * 18.0 + uTime * 3.0);
          foam *= smoothstep(0.2, 0.8, foamNoise * 0.5 + 0.5);
          color = mix(color, vec3(0.88, 0.94, 0.98), foam);

          // 月光反射（夜間）
          if (uNightFactor > 0.3) {
            vec3 moonDir = normalize(vec3(-0.3, 0.8, 0.5));
            vec3 moonHalf = normalize(moonDir + vViewDir);
            float moonSpec = pow(max(dot(vNormal, moonHalf), 0.0), 64.0);
            color += vec3(0.3, 0.35, 0.5) * moonSpec * uNightFactor * 0.6;
          }

          gl_FragColor = vec4(color, 0.82);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  // Update sun direction and night factor based on time of day
  useFrame((_, delta) => {
    const mat = materialRef.current || shaderMaterial;
    mat.uniforms.uTime.value += delta;

    const h = useGameStore.getState().gameTime.hour + useGameStore.getState().gameTime.minute / 60;
    const sunAngle = ((h - 6) / 12) * Math.PI;
    mat.uniforms.uSunDir.value.set(
      Math.cos(sunAngle) * 0.7,
      Math.max(Math.sin(sunAngle), 0.05),
      0.5,
    ).normalize();

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

// Simple tree instancing for forest tiles
function ForestInstances() {
  const map = useGameStore(s => s.map);
  const season = useGameStore(s => s.season);

  const { trunkData, canopyData } = useMemo(() => {
    const trunks: { position: THREE.Vector3; scale: THREE.Vector3 }[] = [];
    const canopies: { position: THREE.Vector3; scale: THREE.Vector3 }[] = [];
    const halfGrid = GRID_SIZE / 2;

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.terrain !== 'forest') continue;

        const worldX = x - halfGrid + 0.5;
        const worldZ = z - halfGrid + 0.5;
        const baseY = getTileWorldHeight(tile);

        // 1-2 trees per forest tile using deterministic seed
        const seed = x * 1000 + z;
        const treeCount = 1 + (seed % 2);

        for (let t = 0; t < treeCount; t++) {
          const offsetX = ((seed * (t + 1) * 7) % 100) / 100 * 0.6 - 0.3;
          const offsetZ = ((seed * (t + 1) * 13) % 100) / 100 * 0.6 - 0.3;
          const heightVar = 0.3 + ((seed * (t + 1) * 31) % 100) / 100 * 0.3;
          const scaleVar = 0.2 + ((seed * (t + 1) * 17) % 100) / 100 * 0.15;

          const tx = worldX + offsetX;
          const tz = worldZ + offsetZ;

          trunks.push({
            position: new THREE.Vector3(tx, baseY + heightVar * 0.5, tz),
            scale: new THREE.Vector3(0.05, heightVar, 0.05),
          });

          canopies.push({
            position: new THREE.Vector3(tx, baseY + heightVar * 0.85, tz),
            scale: new THREE.Vector3(scaleVar, scaleVar * 1.2, scaleVar),
          });
        }
      }
    }

    return { trunkData: trunks, canopyData: canopies };
  }, [map]);

  const trunkMesh = useMemo(() => {
    if (trunkData.length === 0) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.8, 1.2, 1, 6),
      new THREE.MeshStandardMaterial({ color: '#5a3a1a', roughness: 0.9 }),
      trunkData.length,
    );
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    trunkData.forEach((d, i) => {
      // ランダムに少し傾ける
      const tilt = ((d.position.x * 127 + d.position.z * 311) % 100) / 100 * 0.08 - 0.04;
      q.setFromEuler(new THREE.Euler(tilt, 0, tilt * 0.7));
      matrix.compose(d.position, q, d.scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [trunkData]);

  const canopyColor = season === 'autumn' ? '#c85a20' : season === 'winter' ? '#8a8a7a' : season === 'spring' ? '#5aaa4a' : '#2d8a2d';
  const canopyMesh = useMemo(() => {
    if (canopyData.length === 0) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: canopyColor, roughness: 0.75, flatShading: true }),
      canopyData.length,
    );
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    canopyData.forEach((d, i) => {
      // ランダム回転で画一感を消す
      const rot = ((d.position.x * 431 + d.position.z * 173) % 100) / 100 * Math.PI * 2;
      q.setFromEuler(new THREE.Euler(0, rot, 0));
      matrix.compose(d.position, q, d.scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [canopyData, canopyColor]);

  return (
    <group>
      {trunkMesh && <primitive object={trunkMesh} />}
      {canopyMesh && <primitive object={canopyMesh} />}
    </group>
  );
}

// Decorative trees near buildings (cone+cylinder, instanced)
function UrbanTrees() {
  const buildings = useGameStore(s => s.buildings);
  const map = useGameStore(s => s.map);

  const { trunkData, canopyData } = useMemo(() => {
    const trunks: { position: THREE.Vector3; scale: THREE.Vector3 }[] = [];
    const canopies: { position: THREE.Vector3; scale: THREE.Vector3 }[] = [];
    const halfGrid = GRID_SIZE / 2;
    const placed = new Set<string>();

    for (const b of buildings.values()) {
      // Place trees adjacent to building
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
        // Only ~30% of eligible spots get a tree
        if ((seed % 100) > 30) continue;

        placed.add(key);
        const worldX = tx - halfGrid + 0.5;
        const worldZ = tz - halfGrid + 0.5;
        const baseY = getTileWorldHeight(tile);
        const heightVar = 0.25 + (seed % 50) / 100 * 0.2;
        const scaleVar = 0.12 + (seed % 30) / 100 * 0.08;

        trunks.push({
          position: new THREE.Vector3(worldX, baseY + heightVar * 0.5, worldZ),
          scale: new THREE.Vector3(0.03, heightVar, 0.03),
        });
        canopies.push({
          position: new THREE.Vector3(worldX, baseY + heightVar * 0.9, worldZ),
          scale: new THREE.Vector3(scaleVar, scaleVar * 1.5, scaleVar),
        });
      }
    }
    return { trunkData: trunks, canopyData: canopies };
  }, [buildings, map]);

  const trunkMesh = useMemo(() => {
    if (trunkData.length === 0) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.7, 1.1, 1, 6),
      new THREE.MeshStandardMaterial({ color: '#5a3a1a', roughness: 0.9 }),
      trunkData.length,
    );
    const matrix = new THREE.Matrix4();
    trunkData.forEach((d, i) => {
      matrix.compose(d.position, new THREE.Quaternion(), d.scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [trunkData]);

  const canopyMesh = useMemo(() => {
    if (canopyData.length === 0) return null;
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: '#358a35', roughness: 0.75, flatShading: true }),
      canopyData.length,
    );
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    canopyData.forEach((d, i) => {
      const rot = ((d.position.x * 271 + d.position.z * 389) % 100) / 100 * Math.PI * 2;
      q.setFromEuler(new THREE.Euler(0, rot, 0));
      matrix.compose(d.position, q, d.scale);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [canopyData]);

  return (
    <group>
      {trunkMesh && <primitive object={trunkMesh} />}
      {canopyMesh && <primitive object={canopyMesh} />}
    </group>
  );
}

// Road markings near stations - white dashed center lines on nearby roads
function RoadMarkings() {
  const stations = useGameStore(s => s.stations);
  const tracks = useGameStore(s => s.tracks);
  const map = useGameStore(s => s.map);

  const markings = useMemo(() => {
    const result: { pos: [number, number, number]; rotY: number }[] = [];
    const halfGrid = GRID_SIZE / 2;
    const marked = new Set<string>();

    for (const station of stations.values()) {
      // Mark tiles near station that have roads (roadLevel > 0)
      for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
          const tx = station.x + dx;
          const tz = station.z + dz;
          const key = `${tx}_${tz}`;
          if (marked.has(key)) continue;
          if (tx < 0 || tx >= GRID_SIZE || tz < 0 || tz >= GRID_SIZE) continue;

          const tile = map[tx]?.[tz];
          if (!tile || tile.trackIds.length === 0) continue;

          // Add dashed marking alongside tracks near station
          for (const tid of tile.trackIds) {
            const track = tracks.get(tid);
            if (!track) continue;
            const isEW = track.startZ === track.endZ;
            const worldX = tx - halfGrid + 0.5;
            const worldZ = tz - halfGrid + 0.5;
            const h = getTileWorldHeight(tile);
            result.push({
              pos: [worldX, h + 0.04, worldZ + (isEW ? -0.35 : 0)] as [number, number, number],
              rotY: isEW ? 0 : Math.PI / 2,
            });
            marked.add(key);
            break;
          }
        }
      }
    }
    return result;
  }, [stations, tracks, map]);

  if (markings.length === 0) return null;

  return (
    <group>
      {markings.map((m, i) => (
        <group key={i} position={m.pos} rotation={[0, m.rotY, 0]}>
          {/* White dashed center line */}
          <mesh position={[-0.2, 0, 0]}>
            <boxGeometry args={[0.15, 0.002, 0.03]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
          <mesh position={[0.15, 0, 0]}>
            <boxGeometry args={[0.15, 0.002, 0.03]} />
            <meshStandardMaterial color="#ffffff" roughness={0.5} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// Instanced parked cars along main roads for ambient city feel
function ParkedCars() {
  const map = useGameStore(s => s.map);
  const buildings = useGameStore(s => s.buildings);

  const carData = useMemo(() => {
    const cars: { x: number; y: number; z: number; rotY: number; color: string }[] = [];
    const halfGrid = GRID_SIZE / 2;
    const carColors = ['#cc3333', '#3366cc', '#ffffff', '#333333', '#888888', '#ccaa33', '#339933', '#6633aa'];

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.roadLevel < 2) continue;
        if (tile.buildingId || tile.stationId || tile.trackIds.length > 0) continue;

        const seed = x * 997 + z * 1013;
        // Only ~8% of main road tiles get a parked car
        if ((seed % 100) > 8) continue;

        const worldX = x - halfGrid + 0.5;
        const worldZ = z - halfGrid + 0.5;
        const h = getTileWorldHeight(tile);
        const rotY = ((seed * 7) % 4) * (Math.PI / 2);
        const color = carColors[seed % carColors.length];

        // Offset to road edge
        const offset = ((seed * 13) % 2 === 0) ? 0.3 : -0.3;
        cars.push({
          x: worldX + offset * Math.cos(rotY),
          y: h + 0.035,
          z: worldZ + offset * Math.sin(rotY),
          rotY,
          color,
        });
      }
    }
    return cars;
  }, [map, buildings]);

  const carMesh = useMemo(() => {
    if (carData.length === 0) return null;
    const geo = new THREE.BoxGeometry(0.12, 0.05, 0.06);
    const mat = new THREE.MeshStandardMaterial({ color: '#888888', roughness: 0.4, metalness: 0.3 });
    const mesh = new THREE.InstancedMesh(geo, mat, carData.length);
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    const col = new THREE.Color();

    carData.forEach((d, i) => {
      p.set(d.x, d.y, d.z);
      e.set(0, d.rotY, 0);
      q.setFromEuler(e);
      matrix.compose(p, q, s);
      mesh.setMatrixAt(i, matrix);
      col.set(d.color);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [carData]);

  // Car roofs (glass)
  const roofMesh = useMemo(() => {
    if (carData.length === 0) return null;
    const geo = new THREE.BoxGeometry(0.06, 0.03, 0.05);
    const mat = new THREE.MeshStandardMaterial({ color: '#aaccee', roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.7 });
    const mesh = new THREE.InstancedMesh(geo, mat, carData.length);
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();

    carData.forEach((d, i) => {
      p.set(d.x, d.y + 0.035, d.z);
      e.set(0, d.rotY, 0);
      q.setFromEuler(e);
      matrix.compose(p, q, s);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }, [carData]);

  if (!carMesh) return null;

  return (
    <group>
      <primitive object={carMesh} />
      {roofMesh && <primitive object={roofMesh} />}
    </group>
  );
}

export function Terrain() {
  return (
    <group>
      <GroundMesh />
      <WaterPlane />
      <ForestInstances />
      <UrbanTrees />
      <RoadMarkings />
      <ParkedCars />
    </group>
  );
}
