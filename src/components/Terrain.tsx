import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';

function seededColor(x: number, z: number): string {
  const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  const v = (n - Math.floor(n)) * 0.08;
  const r = Math.floor((90 + v * 20) * 1);
  const g = Math.floor((158 + v * 40) * 1);
  const b = Math.floor((62 + v * 15) * 1);
  return `rgb(${r},${g},${b})`;
}

function GrassTerrain() {
  const grid = useGameStore(s => s.grid);

  const mesh = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];
    const indices: number[] = [];
    const halfGrid = GRID_SIZE / 2;
    let vertIdx = 0;

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (grid[x][z].terrain === 'water') continue;

        const wx = x - halfGrid;
        const wz = z - halfGrid;
        const color = new THREE.Color(seededColor(x, z));

        // Small height variation for natural feel
        const h = Math.sin(x * 0.3) * Math.cos(z * 0.3) * 0.02;

        // Quad (2 triangles)
        positions.push(wx, h, wz, wx + 1, h, wz, wx + 1, h, wz + 1, wx, h, wz + 1);
        for (let i = 0; i < 4; i++) {
          colors.push(color.r, color.g, color.b);
          normals.push(0, 1, 0);
        }
        indices.push(vertIdx, vertIdx + 1, vertIdx + 2, vertIdx, vertIdx + 2, vertIdx + 3);
        vertIdx += 4;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex(indices);

    return geometry;
  }, [grid]);

  return (
    <mesh geometry={mesh} receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.92} />
    </mesh>
  );
}

function WaterTerrain() {
  const grid = useGameStore(s => s.grid);
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const indices: number[] = [];
    const uvs: number[] = [];
    const halfGrid = GRID_SIZE / 2;
    let vertIdx = 0;

    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        if (grid[x][z].terrain !== 'water') continue;

        const wx = x - halfGrid;
        const wz = z - halfGrid;
        const h = -0.12;

        positions.push(wx, h, wz, wx + 1, h, wz, wx + 1, h, wz + 1, wx, h, wz + 1);
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
        indices.push(vertIdx, vertIdx + 1, vertIdx + 2, vertIdx, vertIdx + 2, vertIdx + 3);
        vertIdx += 4;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [grid]);

  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color('#3a7bd5') },
        uColor2: { value: new THREE.Color('#2563a8') },
      },
      vertexShader: `
        uniform float uTime;
        varying vec2 vUv;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vec3 pos = position;
          pos.y += sin(pos.x * 3.0 + uTime * 1.5) * 0.015 + cos(pos.z * 2.5 + uTime * 1.2) * 0.01;
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
          float wave = sin(vWorldPos.x * 8.0 + uTime * 2.0) * cos(vWorldPos.z * 6.0 + uTime * 1.5);
          float spec = pow(max(wave, 0.0), 8.0) * 0.3;
          vec3 color = mix(uColor1, uColor2, wave * 0.5 + 0.5);
          color += vec3(spec);
          gl_FragColor = vec4(color, 0.85);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
    });
  }, []);

  useFrame((_, delta) => {
    shaderMaterial.uniforms.uTime.value += delta;
  });

  return <mesh geometry={geometry} material={shaderMaterial} />;
}

export function Terrain() {
  return (
    <group>
      <GrassTerrain />
      <WaterTerrain />
    </group>
  );
}
