import { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { gridToWorld } from '../utils/grid.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { GRID_SIZE } from '../game/constants.ts';

const dummy = new THREE.Object3D();

const roadMat = new THREE.MeshStandardMaterial({
  color: '#707070',
  roughness: 0.95,
  metalness: 0.0,
});
const mainRoadMat = new THREE.MeshStandardMaterial({
  color: '#808080',
  roughness: 0.9,
  metalness: 0.0,
});
const roadGeo = new THREE.PlaneGeometry(0.92, 0.92);
roadGeo.rotateX(-Math.PI / 2);

// Center line marking for main roads
const lineGeo = new THREE.PlaneGeometry(0.6, 0.04);
lineGeo.rotateX(-Math.PI / 2);
const lineMat = new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.8 });

export function Roads() {
  const map = useGameStore(s => s.map);
  const buildings = useGameStore(s => s.buildings);

  const { normalRoads, mainRoads } = useMemo(() => {
    const normal: Array<{ x: number; z: number; h: number }> = [];
    const main: Array<{ x: number; z: number; h: number }> = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let z = 0; z < GRID_SIZE; z++) {
        const tile = map[x][z];
        if (tile.roadLevel > 0 && !tile.buildingId && !tile.stationId && tile.trackIds.length === 0 && !tile.subsidiaryId) {
          const w = gridToWorld(x, z);
          const h = getTileWorldHeight(tile);
          if (tile.roadLevel >= 2) {
            main.push({ x: w.x, z: w.z, h: h + 0.015 });
          } else {
            normal.push({ x: w.x, z: w.z, h: h + 0.012 });
          }
        }
      }
    }
    return { normalRoads: normal, mainRoads: main };
  }, [map, buildings]);

  const normalRef = useRef<THREE.InstancedMesh>(null);
  const mainRef = useRef<THREE.InstancedMesh>(null);
  const lineRef = useRef<THREE.InstancedMesh>(null);

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
  }, [mainRoads]);

  const totalNormal = normalRoads.length;
  const totalMain = mainRoads.length;
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
        </>
      )}
    </group>
  );
}
