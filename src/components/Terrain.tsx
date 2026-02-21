import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { getTileWorldHeight, getTerrainColor } from '../game/terrain.ts';

function GroundMesh() {
  const map = useGameStore(s => s.map);

  const geometry = useMemo(() => {
    const halfGrid = GRID_SIZE / 2;

    // Create a plane geometry with (GRID_SIZE+1) x (GRID_SIZE+1) vertices
    const geo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE, GRID_SIZE);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);

    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);

      // Map vertex to grid coordinates
      const gx = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(vx + halfGrid)));
      const gz = Math.min(GRID_SIZE - 1, Math.max(0, Math.floor(vz + halfGrid)));

      const tile = map[gx][gz];
      const height = getTileWorldHeight(tile);

      // Don't raise water tiles
      if (tile.terrain !== 'water') {
        positions.setY(i, height);
      } else {
        positions.setY(i, -0.05);
      }

      // Vertex color
      const [r, g, b] = getTerrainColor(tile.terrain, tile.height);
      colors[i * 3] = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    return geo;
  }, [map]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

function WaterPlane() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color('#2a6fbd') },
        uColor2: { value: new THREE.Color('#1a4f8d') },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.y += sin(pos.x * 2.0 + uTime * 1.2) * 0.02
                 + cos(pos.z * 1.8 + uTime * 0.9) * 0.015
                 + sin((pos.x + pos.z) * 1.5 + uTime * 0.7) * 0.01;
          vWorldPos = pos;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          float wave = sin(vWorldPos.x * 4.0 + uTime * 1.5) * cos(vWorldPos.z * 3.0 + uTime * 1.0);
          float spec = pow(max(wave, 0.0), 12.0) * 0.4;
          vec3 color = mix(uColor1, uColor2, wave * 0.5 + 0.5);
          color += vec3(spec);
          gl_FragColor = vec4(color, 0.82);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame((_, delta) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value += delta;
    } else {
      shaderMaterial.uniforms.uTime.value += delta;
    }
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
      <planeGeometry args={[GRID_SIZE, GRID_SIZE, 64, 64]} />
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </mesh>
  );
}

// Simple tree instancing for forest tiles
function ForestInstances() {
  const map = useGameStore(s => s.map);

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
      new THREE.CylinderGeometry(1, 1, 1, 4),
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
      new THREE.SphereGeometry(1, 6, 4),
      new THREE.MeshStandardMaterial({ color: '#1a6a1a', roughness: 0.8 }),
      canopyData.length,
    );
    const matrix = new THREE.Matrix4();
    canopyData.forEach((d, i) => {
      matrix.compose(d.position, new THREE.Quaternion(), d.scale);
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

export function Terrain() {
  return (
    <group>
      <GroundMesh />
      <WaterPlane />
      <ForestInstances />
    </group>
  );
}
