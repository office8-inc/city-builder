import { GRID_SIZE } from '../game/constants.ts';

export function isValidGridPosition(x: number, z: number): boolean {
  return x >= 0 && x < GRID_SIZE && z >= 0 && z < GRID_SIZE;
}

export function worldToGrid(worldX: number, worldZ: number): { x: number; z: number } {
  const x = Math.floor(worldX + GRID_SIZE / 2);
  const z = Math.floor(worldZ + GRID_SIZE / 2);
  return { x, z };
}

export function gridToWorld(gridX: number, gridZ: number): { x: number; z: number } {
  const x = gridX - GRID_SIZE / 2 + 0.5;
  const z = gridZ - GRID_SIZE / 2 + 0.5;
  return { x, z };
}

export function getNeighbors(x: number, z: number): Array<{ x: number; z: number }> {
  const neighbors: Array<{ x: number; z: number }> = [];
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const [dx, dz] of dirs) {
    const nx = x + dx;
    const nz = z + dz;
    if (isValidGridPosition(nx, nz)) {
      neighbors.push({ x: nx, z: nz });
    }
  }
  return neighbors;
}
