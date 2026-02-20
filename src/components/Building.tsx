import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
// BuildingType used in switch cases via grid data

// Seeded random for consistent building variation
function seededRandom(x: number, z: number, salt: number = 0): number {
  const n = Math.sin(x * 127.1 + z * 311.7 + salt * 73.1) * 43758.5453;
  return n - Math.floor(n);
}

// Create a procedural window texture
function createWindowTexture(width: number, height: number, color: string, litRatio: number = 0.6): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Base wall color
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);

  // Windows
  const windowCols = Math.floor(width / 16);
  const windowRows = Math.floor(height / 20);
  const ww = 8, wh = 10;

  for (let r = 0; r < windowRows; r++) {
    for (let c = 0; c < windowCols; c++) {
      const wx = c * 16 + 4;
      const wy = r * 20 + 6;
      const isLit = Math.random() < litRatio;
      ctx.fillStyle = isLit ? '#ffeebb' : '#445566';
      ctx.fillRect(wx, wy, ww, wh);
      // Window frame
      ctx.strokeStyle = '#33333366';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(wx, wy, ww, wh);
      // Cross bar
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.moveTo(wx, wy + wh / 2);
      ctx.lineTo(wx + ww, wy + wh / 2);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// Create a roof texture
function createRoofTexture(color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 64, 64);
  // Tile pattern
  for (let y = 0; y < 64; y += 8) {
    const offset = (Math.floor(y / 8) % 2) * 8;
    for (let x = offset; x < 64; x += 16) {
      ctx.fillStyle = '#00000015';
      ctx.fillRect(x, y, 16, 1);
      ctx.fillRect(x, y, 1, 8);
    }
  }
  return new THREE.CanvasTexture(canvas);
}

// Build a residential house geometry (with pitched roof)
function createResidentialGeometry(level: number, seed: number): THREE.Group {
  const group = new THREE.Group();
  const variant = Math.floor(seed * 3);

  if (level === 1) {
    // Small house with pitched roof
    const bodyH = 0.6 + seed * 0.2;
    const bodyW = 0.6 + (variant * 0.1);
    const bodyD = 0.5 + (variant * 0.05);

    // House body
    const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
    const wallTex = createWindowTexture(64, 48, '#d4c4a8', 0.3);
    const bodyMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = bodyH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Pitched roof
    const roofGeo = new THREE.ConeGeometry(bodyW * 0.55, 0.35, 4);
    roofGeo.rotateY(Math.PI / 4);
    const roofTex = createRoofTexture(variant === 0 ? '#8B4513' : variant === 1 ? '#A0522D' : '#6B3410');
    const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, roughness: 0.8 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = bodyH + 0.15;
    roof.castShadow = true;
    group.add(roof);

  } else if (level === 2) {
    // Two-story apartment
    const bodyH = 1.2;
    const bodyGeo = new THREE.BoxGeometry(0.7, bodyH, 0.6);
    const wallTex = createWindowTexture(80, 80, '#c8b898', 0.5);
    const bodyMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.8 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = bodyH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Flat roof with edge
    const roofGeo = new THREE.BoxGeometry(0.75, 0.05, 0.65);
    const roofMat = new THREE.MeshStandardMaterial({ color: '#666', roughness: 0.7 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = bodyH + 0.025;
    roof.castShadow = true;
    group.add(roof);

  } else {
    // Apartment building / mansion
    const bodyH = 1.8 + seed * 0.4;
    const bodyGeo = new THREE.BoxGeometry(0.8, bodyH, 0.7);
    const wallTex = createWindowTexture(96, 128, '#b8a888', 0.6);
    const bodyMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = bodyH / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Rooftop structure
    const topGeo = new THREE.BoxGeometry(0.3, 0.2, 0.3);
    const topMat = new THREE.MeshStandardMaterial({ color: '#888', roughness: 0.6 });
    const top = new THREE.Mesh(topGeo, topMat);
    top.position.y = bodyH + 0.1;
    top.castShadow = true;
    group.add(top);

    // Roof edge
    const edgeGeo = new THREE.BoxGeometry(0.85, 0.06, 0.75);
    const edgeMat = new THREE.MeshStandardMaterial({ color: '#999', roughness: 0.5 });
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.y = bodyH + 0.03;
    group.add(edge);
  }

  return group;
}

// Build a commercial building geometry (glass office style)
function createCommercialGeometry(level: number, seed: number): THREE.Group {
  const group = new THREE.Group();

  const height = 1.0 + level * 0.9 + seed * 0.3;
  const width = 0.5 + Math.min(level * 0.05, 0.2);
  const depth = 0.5 + Math.min(level * 0.05, 0.2);

  // Main tower
  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const glassTex = createWindowTexture(96, Math.floor(height * 80), '#3a5f8a', 0.7);
  const bodyMat = new THREE.MeshStandardMaterial({
    map: glassTex,
    roughness: 0.2,
    metalness: 0.6,
    envMapIntensity: 1.5,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Glass facade accent strips
  for (let i = 0; i < level; i++) {
    const stripGeo = new THREE.BoxGeometry(width + 0.04, 0.02, depth + 0.04);
    const stripMat = new THREE.MeshStandardMaterial({ color: '#ccc', metalness: 0.8, roughness: 0.2 });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.position.y = (i + 1) * (height / (level + 1));
    group.add(strip);
  }

  // Rooftop
  if (level >= 3) {
    // Antenna/spire
    const spireGeo = new THREE.CylinderGeometry(0.01, 0.03, 0.5, 6);
    const spireMat = new THREE.MeshStandardMaterial({ color: '#ccc', metalness: 0.9, roughness: 0.1 });
    const spire = new THREE.Mesh(spireGeo, spireMat);
    spire.position.y = height + 0.25;
    group.add(spire);
  }

  // Entrance canopy at base
  const canopyGeo = new THREE.BoxGeometry(width + 0.1, 0.03, 0.15);
  const canopyMat = new THREE.MeshStandardMaterial({ color: '#555', metalness: 0.3 });
  const canopy = new THREE.Mesh(canopyGeo, canopyMat);
  canopy.position.set(0, 0.3, depth / 2 + 0.05);
  group.add(canopy);

  return group;
}

// Build an industrial building geometry
function createIndustrialGeometry(level: number, seed: number): THREE.Group {
  const group = new THREE.Group();

  const height = 0.8 + level * 0.3;
  const width = 0.85;
  const depth = 0.75;

  // Main warehouse body
  const bodyGeo = new THREE.BoxGeometry(width, height, depth);
  const bodyMat = new THREE.MeshStandardMaterial({ color: '#8a8070', roughness: 0.95, metalness: 0.1 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = height / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Corrugated roof (half cylinder)
  const roofGeo = new THREE.CylinderGeometry(width / 2, width / 2, depth, 12, 1, false, 0, Math.PI);
  const roofMat = new THREE.MeshStandardMaterial({ color: '#6a7a6a', roughness: 0.7, metalness: 0.3, side: THREE.DoubleSide });
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.rotation.z = Math.PI / 2;
  roof.rotation.y = Math.PI / 2;
  roof.position.y = height;
  roof.castShadow = true;
  group.add(roof);

  // Chimney / smokestack
  const chimneyH = 1.0 + seed * 0.5;
  const chimneyGeo = new THREE.CylinderGeometry(0.06, 0.08, chimneyH, 8);
  const chimneyMat = new THREE.MeshStandardMaterial({ color: '#555', roughness: 0.8 });
  const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
  chimney.position.set(width * 0.3, height + chimneyH / 2 - 0.1, -depth * 0.2);
  chimney.castShadow = true;
  group.add(chimney);

  // Storage tank
  if (level >= 2) {
    const tankGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12);
    const tankMat = new THREE.MeshStandardMaterial({ color: '#aaa', metalness: 0.5, roughness: 0.4 });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(-width * 0.25, 0.2, depth * 0.2);
    tank.castShadow = true;
    group.add(tank);
  }

  return group;
}

// Road with markings
function createRoadGeometry(): THREE.Group {
  const group = new THREE.Group();

  // Road surface
  const roadGeo = new THREE.BoxGeometry(1, 0.05, 1);
  const roadMat = new THREE.MeshStandardMaterial({ color: '#3a3a3a', roughness: 0.95 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.position.y = 0.025;
  road.receiveShadow = true;
  group.add(road);

  // Center line
  const lineGeo = new THREE.BoxGeometry(0.06, 0.052, 0.3);
  const lineMat = new THREE.MeshStandardMaterial({ color: '#dddd88' });
  const line = new THREE.Mesh(lineGeo, lineMat);
  line.position.y = 0.026;
  group.add(line);

  // Sidewalk edges
  const edgeGeo = new THREE.BoxGeometry(0.08, 0.08, 1);
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#999', roughness: 0.8 });
  const edgeL = new THREE.Mesh(edgeGeo, edgeMat);
  edgeL.position.set(-0.46, 0.04, 0);
  edgeL.receiveShadow = true;
  group.add(edgeL);
  const edgeR = edgeL.clone();
  edgeR.position.set(0.46, 0.04, 0);
  group.add(edgeR);

  return group;
}

// Park with trees, bench, path
function createParkGeometry(seed: number): THREE.Group {
  const group = new THREE.Group();

  // Grass base
  const baseGeo = new THREE.BoxGeometry(0.95, 0.06, 0.95);
  const baseMat = new THREE.MeshStandardMaterial({ color: '#4a9e30', roughness: 0.95 });
  const base = new THREE.Mesh(baseGeo, baseMat);
  base.position.y = 0.03;
  base.receiveShadow = true;
  group.add(base);

  // Trees (trunk + canopy)
  const treePositions = [
    [-0.25, -0.25], [0.2, 0.15], [-0.1, 0.3], [0.3, -0.2],
  ];
  treePositions.forEach(([tx, tz], i) => {
    const h = 0.3 + seededRandom(seed, i, 99) * 0.3;
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.02, 0.03, h, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: '#5a3a1a', roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(tx, h / 2, tz);
    trunk.castShadow = true;
    group.add(trunk);

    // Canopy (cone or sphere variation)
    const canopySize = 0.12 + seededRandom(seed, i, 50) * 0.08;
    const canopyGeo = i % 2 === 0
      ? new THREE.SphereGeometry(canopySize, 8, 6)
      : new THREE.ConeGeometry(canopySize, canopySize * 2, 6);
    const canopyMat = new THREE.MeshStandardMaterial({
      color: i % 3 === 0 ? '#2d8a1a' : i % 3 === 1 ? '#3a9e28' : '#228a22',
      roughness: 0.85,
    });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(tx, h + canopySize * 0.6, tz);
    canopy.castShadow = true;
    group.add(canopy);
  });

  // Small path
  const pathGeo = new THREE.BoxGeometry(0.12, 0.065, 0.6);
  const pathMat = new THREE.MeshStandardMaterial({ color: '#c8b088', roughness: 0.9 });
  const path = new THREE.Mesh(pathGeo, pathMat);
  path.position.set(0.05, 0.032, 0);
  group.add(path);

  return group;
}

// Power plant with cooling tower
function createPowerPlantGeometry(): THREE.Group {
  const group = new THREE.Group();

  // Main building
  const buildGeo = new THREE.BoxGeometry(0.7, 0.6, 0.6);
  const buildMat = new THREE.MeshStandardMaterial({ color: '#777', roughness: 0.8, metalness: 0.2 });
  const building = new THREE.Mesh(buildGeo, buildMat);
  building.position.y = 0.3;
  building.castShadow = true;
  building.receiveShadow = true;
  group.add(building);

  // Cooling tower (hyperboloid shape approximation)
  const points: THREE.Vector2[] = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    const r = 0.2 - 0.08 * Math.sin(t * Math.PI * 0.8) + t * 0.05;
    points.push(new THREE.Vector2(r, t * 1.5));
  }
  const towerGeo = new THREE.LatheGeometry(points, 16);
  const towerMat = new THREE.MeshStandardMaterial({ color: '#bbb', roughness: 0.6, side: THREE.DoubleSide });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.set(0.1, 0, 0.05);
  tower.castShadow = true;
  group.add(tower);

  // Red warning light on top
  const lightGeo = new THREE.SphereGeometry(0.03, 6, 6);
  const lightMat = new THREE.MeshStandardMaterial({ color: '#ff2222', emissive: '#ff0000', emissiveIntensity: 2 });
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(0.1, 1.55, 0.05);
  group.add(light);

  return group;
}

// Water tower
function createWaterTowerGeometry(): THREE.Group {
  const group = new THREE.Group();

  // Legs (4 thin cylinders)
  const legGeo = new THREE.CylinderGeometry(0.02, 0.025, 1.0, 6);
  const legMat = new THREE.MeshStandardMaterial({ color: '#777', metalness: 0.5 });
  const offsets = [[-0.1, -0.1], [0.1, -0.1], [-0.1, 0.1], [0.1, 0.1]];
  offsets.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, legMat);
    leg.position.set(lx, 0.5, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  // Tank
  const tankGeo = new THREE.CylinderGeometry(0.22, 0.18, 0.4, 12);
  const tankMat = new THREE.MeshStandardMaterial({ color: '#4a90d9', roughness: 0.3, metalness: 0.4 });
  const tank = new THREE.Mesh(tankGeo, tankMat);
  tank.position.y = 1.2;
  tank.castShadow = true;
  group.add(tank);

  // Cap
  const capGeo = new THREE.ConeGeometry(0.23, 0.15, 12);
  const capMat = new THREE.MeshStandardMaterial({ color: '#3a7ab5', roughness: 0.3 });
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.y = 1.47;
  group.add(cap);

  return group;
}

// Smoke particle system for factories
function SmokeParticles({ positions }: { positions: THREE.Vector3[] }) {
  const particlesRef = useRef<THREE.Points>(null);
  const particleData = useRef<{ offsets: Float32Array; speeds: Float32Array }>({ offsets: new Float32Array(0), speeds: new Float32Array(0) });

  const { geometry, count } = useMemo(() => {
    const perSource = 12;
    const total = positions.length * perSource;
    const posArr = new Float32Array(total * 3);
    const offsets = new Float32Array(total);
    const speeds = new Float32Array(total);

    positions.forEach((src, si) => {
      for (let i = 0; i < perSource; i++) {
        const idx = si * perSource + i;
        posArr[idx * 3] = src.x + (Math.random() - 0.5) * 0.1;
        posArr[idx * 3 + 1] = src.y + Math.random() * 1.5;
        posArr[idx * 3 + 2] = src.z + (Math.random() - 0.5) * 0.1;
        offsets[idx] = Math.random() * Math.PI * 2;
        speeds[idx] = 0.3 + Math.random() * 0.4;
      }
    });

    particleData.current = { offsets, speeds };

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    return { geometry: geo, count: total };
  }, [positions]);

  useFrame((_, delta) => {
    if (!particlesRef.current || count === 0) return;
    const posAttr = particlesRef.current.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;
    const { offsets, speeds } = particleData.current;
    const perSource = 12;

    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * delta;
      arr[i * 3] += Math.sin(offsets[i] + arr[i * 3 + 1] * 2) * delta * 0.1;

      // Reset particle when too high
      const srcIdx = Math.floor(i / perSource);
      const src = positions[srcIdx];
      if (arr[i * 3 + 1] > src.y + 2.5) {
        arr[i * 3] = src.x + (Math.random() - 0.5) * 0.1;
        arr[i * 3 + 1] = src.y;
        arr[i * 3 + 2] = src.z + (Math.random() - 0.5) * 0.1;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <points ref={particlesRef} geometry={geometry}>
      <pointsMaterial color="#aaaaaa" size={0.08} transparent opacity={0.4} sizeAttenuation depthWrite={false} />
    </points>
  );
}

export function Buildings() {
  const grid = useGameStore(s => s.grid);

  const { sceneGroup, smokePositions } = useMemo(() => {
    const mainGroup = new THREE.Group();
    const smokePos: THREE.Vector3[] = [];
    const halfGrid = GRID_SIZE / 2;

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const building = grid[x][z].building;
        if (!building) continue;

        const worldX = x - halfGrid + 0.5;
        const worldZ = z - halfGrid + 0.5;
        const seed = seededRandom(x, z);
        let obj: THREE.Group | null = null;

        switch (building.type) {
          case 'residential':
            obj = createResidentialGeometry(building.level, seed);
            break;
          case 'commercial':
            obj = createCommercialGeometry(building.level, seed);
            break;
          case 'industrial':
            obj = createIndustrialGeometry(building.level, seed);
            smokePos.push(new THREE.Vector3(worldX + 0.3 * 0.85 * 0.3, 0.8 + building.level * 0.3 + 1.0 + seed * 0.5 - 0.1, worldZ - 0.75 * 0.2));
            break;
          case 'road':
            obj = createRoadGeometry();
            break;
          case 'park':
            obj = createParkGeometry(x * 100 + z);
            break;
          case 'power_plant':
            obj = createPowerPlantGeometry();
            smokePos.push(new THREE.Vector3(worldX + 0.1, 1.55, worldZ + 0.05));
            break;
          case 'water_tower':
            obj = createWaterTowerGeometry();
            break;
        }

        if (obj) {
          obj.position.set(worldX, 0, worldZ);
          // Slight random rotation for variety (not roads)
          if (building.type !== 'road') {
            obj.rotation.y = Math.floor(seed * 4) * (Math.PI / 2);
          }
          mainGroup.add(obj);
        }
      }
    }

    return { sceneGroup: mainGroup, smokePositions: smokePos };
  }, [grid]);

  return (
    <group>
      <primitive object={sceneGroup} />
      <SmokeParticles positions={smokePositions} />
    </group>
  );
}
