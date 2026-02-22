import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { GRID_SIZE } from '../game/constants.ts';

const dummy = new THREE.Object3D();

// Procedural asphalt texture
let asphaltTexture: THREE.CanvasTexture | null = null;
function getAsphaltTexture(): THREE.CanvasTexture {
  if (asphaltTexture) return asphaltTexture;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Base asphalt
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(0, 0, size, size);

  // Aggregate noise (small pebble/grain texture)
  for (let i = 0; i < 8000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = 40 + Math.random() * 40;
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  // Subtle patches (wear patterns)
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 8 + Math.random() * 20;
    const v = 55 + Math.random() * 25;
    ctx.fillStyle = `rgba(${v},${v},${v},0.3)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine cracks
  ctx.strokeStyle = 'rgba(30,30,30,0.3)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < 8; i++) {
    ctx.beginPath();
    let x = Math.random() * size;
    let y = Math.random() * size;
    ctx.moveTo(x, y);
    for (let j = 0; j < 5; j++) {
      x += (Math.random() - 0.5) * 30;
      y += (Math.random() - 0.5) * 30;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  asphaltTexture = tex;
  return tex;
}

// Procedural asphalt normal map
let asphaltNormalMap: THREE.CanvasTexture | null = null;
function getAsphaltNormalMap(): THREE.CanvasTexture {
  if (asphaltNormalMap) return asphaltNormalMap;
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgb(128,128,255)';
  ctx.fillRect(0, 0, size, size);

  // Gravel bumps
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const nx = 128 + (Math.random() - 0.5) * 30;
    const ny = 128 + (Math.random() - 0.5) * 30;
    ctx.fillStyle = `rgb(${nx},${ny},245)`;
    ctx.fillRect(x, y, 1 + Math.random(), 1 + Math.random());
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  asphaltNormalMap = tex;
  return tex;
}

// Try loading real road textures, fall back to procedural
const BASE = import.meta.env.BASE_URL;
interface RoadTextures { map?: THREE.Texture; normalMap?: THREE.Texture; roughnessMap?: THREE.Texture }
let realRoadTextures: RoadTextures | null = null;
function loadRealRoadTextures(): RoadTextures {
  if (realRoadTextures) return realRoadTextures;
  const loader = new THREE.TextureLoader();
  const textures: RoadTextures = {};

  try {
    const setupTex = (tex: THREE.Texture) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
      return tex;
    };
    textures.map = setupTex(loader.load(BASE + 'textures/road-color.jpg'));
    textures.normalMap = setupTex(loader.load(BASE + 'textures/road-normal.jpg'));
    textures.roughnessMap = setupTex(loader.load(BASE + 'textures/road-roughness.jpg'));
  } catch {
    // Fall back to procedural
  }

  realRoadTextures = textures;
  return textures;
}

// Enhanced road materials with texture
function createRoadMaterial(isMain: boolean): THREE.MeshStandardMaterial {
  const realTex = loadRealRoadTextures();
  const hasTex = realTex.map != null;

  return new THREE.MeshStandardMaterial({
    map: hasTex ? realTex.map : getAsphaltTexture(),
    normalMap: hasTex ? realTex.normalMap : getAsphaltNormalMap(),
    normalScale: new THREE.Vector2(hasTex ? 0.3 : 0.2, hasTex ? 0.3 : 0.2),
    roughnessMap: realTex.roughnessMap,
    color: isMain ? '#999999' : '#777777',
    roughness: isMain ? 0.82 : 0.9,
    metalness: 0.0,
  });
}

const roadGeo = new THREE.PlaneGeometry(0.94, 0.94);
roadGeo.rotateX(-Math.PI / 2);

// Sidewalk geometry (slightly thicker)
const sidewalkGeo = new THREE.BoxGeometry(0.96, 0.04, 0.96);

// Center line marking for main roads
const lineGeo = new THREE.PlaneGeometry(0.6, 0.04);
lineGeo.rotateX(-Math.PI / 2);
const lineMat = new THREE.MeshStandardMaterial({ color: '#dddddd', roughness: 0.7 });

// Edge line markings
const edgeLineGeo = new THREE.PlaneGeometry(0.9, 0.02);
edgeLineGeo.rotateX(-Math.PI / 2);
const edgeLineMat = new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.7 });

// Sidewalk material
const sidewalkMat = new THREE.MeshStandardMaterial({
  color: '#b0a898',
  roughness: 0.85,
  metalness: 0.0,
});

// Street light geometry
const lightPoleGeo = new THREE.CylinderGeometry(0.01, 0.012, 0.4, 4);
const lightArmGeo = new THREE.BoxGeometry(0.12, 0.008, 0.008);
const lightBulbGeo = new THREE.SphereGeometry(0.02, 6, 4);
const lightPoleMat = new THREE.MeshStandardMaterial({ color: '#555555', roughness: 0.4, metalness: 0.5 });

export function Roads() {
  const map = useGameStore(s => s.map);
  const buildings = useGameStore(s => s.buildings);
  const hour = useGameStore(s => s.gameTime.hour);
  const isNight = hour < 6 || hour >= 18;

  const { normalRoads, mainRoads, sidewalks, streetLights } = useMemo(() => {
    const normal: Array<{ x: number; z: number; h: number }> = [];
    const main: Array<{ x: number; z: number; h: number }> = [];
    const sw: Array<{ x: number; z: number; h: number }> = [];
    const lights: Array<{ x: number; y: number; z: number }> = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.roadLevel > 0 && !tile.buildingId && !tile.stationId && tile.trackIds.length === 0 && !tile.subsidiaryId) {
          const w = gridToWorld(x, z);
          const h = getTileWorldHeight(tile);
          if (tile.roadLevel >= 2) {
            main.push({ x: w.x, z: w.z, h: h + 0.015 });
            // Street lights every ~4 tiles on main roads
            if ((x + z) % 4 === 0) {
              lights.push({ x: w.x + 0.4, y: h, z: w.z + 0.4 });
            }
          } else {
            normal.push({ x: w.x, z: w.z, h: h + 0.012 });
          }

          // Check if adjacent tiles need sidewalks
          for (const [dx, dz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx < 0 || nx >= GRID_SIZE || nz < 0 || nz >= GRID_SIZE) continue;
            const adj = map[nx][nz];
            if (adj.buildingId && adj.roadLevel === 0) {
              const aw = gridToWorld(nx, nz);
              const ah = getTileWorldHeight(adj);
              // Avoid duplicate sidewalks
              if (!sw.some(s => s.x === aw.x && s.z === aw.z)) {
                sw.push({ x: aw.x, z: aw.z, h: ah + 0.02 });
              }
            }
          }
        }
      }
    }
    return { normalRoads: normal, mainRoads: main, sidewalks: sw, streetLights: lights };
  }, [map, buildings]);

  const normalRef = useRef<THREE.InstancedMesh>(null);
  const mainRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.InstancedMesh>(null);
  const edgeRef1 = useRef<THREE.InstancedMesh>(null);
  const edgeRef2 = useRef<THREE.InstancedMesh>(null);
  const sidewalkRef = useRef<THREE.InstancedMesh>(null);

  // Lazy material creation
  const roadMat = useMemo(() => createRoadMaterial(false), []);
  const mainRoadMat = useMemo(() => createRoadMaterial(true), []);

  useEffect(() => {
    if (normalRef.current) {
      normalRoads.forEach((r, i) => {
        dummy.position.set(r.x, r.h, r.z);
        dummy.updateMatrix();
        normalRef.current!.setMatrixAt(i, dummy.matrix);
      });
      normalRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [normalRoads]);

  useEffect(() => {
    if (mainRef.current) {
      mainRoads.forEach((r, i) => {
        dummy.position.set(r.x, r.h, r.z);
        dummy.updateMatrix();
        mainRef.current!.setMatrixAt(i, dummy.matrix);
      });
      mainRef.current.instanceMatrix.needsUpdate = true;
    }
    if (lineRef.current) {
      mainRoads.forEach((r, i) => {
        dummy.position.set(r.x, r.h + 0.003, r.z);
        dummy.updateMatrix();
        lineRef.current!.setMatrixAt(i, dummy.matrix);
      });
      lineRef.current.instanceMatrix.needsUpdate = true;
    }
    // Edge lines (white side markings)
    if (edgeRef1.current && edgeRef2.current) {
      mainRoads.forEach((r, i) => {
        dummy.position.set(r.x, r.h + 0.002, r.z + 0.44);
        dummy.updateMatrix();
        edgeRef1.current!.setMatrixAt(i, dummy.matrix);
        dummy.position.set(r.x, r.h + 0.002, r.z - 0.44);
        dummy.updateMatrix();
        edgeRef2.current!.setMatrixAt(i, dummy.matrix);
      });
      edgeRef1.current.instanceMatrix.needsUpdate = true;
      edgeRef2.current.instanceMatrix.needsUpdate = true;
    }
  }, [mainRoads]);

  useEffect(() => {
    if (sidewalkRef.current) {
      sidewalks.forEach((s, i) => {
        dummy.position.set(s.x, s.h, s.z);
        dummy.updateMatrix();
        sidewalkRef.current!.setMatrixAt(i, dummy.matrix);
      });
      sidewalkRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [sidewalks]);

  const totalNormal = normalRoads.length;
  const totalMain = mainRoads.length;
  const totalSidewalk = sidewalks.length;
  if (totalNormal + totalMain === 0) return null;

  return (
    <group>
      {totalNormal > 0 && (
        <instancedMesh ref={normalRef} args={[roadGeo, roadMat, totalNormal]} receiveShadow />
      )}
      {totalMain > 0 && (
        <>
          <instancedMesh ref={mainRef} args={[roadGeo, mainRoadMat, totalMain]} receiveShadow />
          <instancedMesh ref={lineRef} args={[lineGeo, lineMat, totalMain]} />
          <instancedMesh ref={edgeRef1} args={[edgeLineGeo, edgeLineMat, totalMain]} />
          <instancedMesh ref={edgeRef2} args={[edgeLineGeo, edgeLineMat, totalMain]} />
        </>
      )}
      {totalSidewalk > 0 && (
        <instancedMesh ref={sidewalkRef} args={[sidewalkGeo, sidewalkMat, totalSidewalk]} receiveShadow />
      )}
      {/* Street lights on main roads */}
      {streetLights.map((sl, i) => (
        <group key={i} position={[sl.x, sl.y, sl.z]}>
          <mesh geometry={lightPoleGeo} material={lightPoleMat} position={[0, 0.2, 0]} castShadow />
          <mesh geometry={lightArmGeo} material={lightPoleMat} position={[0.06, 0.4, 0]} />
          <mesh geometry={lightBulbGeo} position={[0.12, 0.39, 0]}>
            <meshStandardMaterial
              color={isNight ? '#ffeecc' : '#dddddd'}
              emissive={isNight ? '#ffdd88' : '#000000'}
              emissiveIntensity={isNight ? 2.0 : 0}
            />
          </mesh>
          {isNight && (
            <pointLight
              position={[0.12, 0.38, 0]}
              color="#ffeecc"
              intensity={0.3}
              distance={2.5}
              decay={2}
            />
          )}
        </group>
      ))}
    </group>
  );
}
