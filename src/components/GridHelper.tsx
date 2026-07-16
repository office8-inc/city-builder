import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameStore } from '../game/store.ts';
import { GRID_SIZE } from '../game/constants.ts';
import { getTileWorldHeight } from '../game/terrain.ts';
import { findTrainAtTile } from '../game/trackUtils.ts';

export function GridOverlay() {
  const hoveredTile = useGameStore(s => s.hoveredTile);
  const selectedTool = useGameStore(s => s.selectedTool);
  const map = useGameStore(s => s.map);
  const ownedLand = useGameStore(s => s.ownedLand);
  const trains = useGameStore(s => s.trains);
  const tracks = useGameStore(s => s.tracks);

  const highlight = useMemo(() => {
    if (!hoveredTile || selectedTool === 'none') return null;

    const tile = map[hoveredTile.x]?.[hoveredTile.z];
    if (!tile) return null;

    // 各ツールの実際の設置条件は src/game/actions.ts の対応するcreateXxx関数と一致させる
    let canPlace = false;
    switch (selectedTool) {
      case 'track_straight':
      case 'track_diagonal':
      case 'track_elevated':
      case 'track_underground':
        // createPlaceTrack: 水上にはどの高度の線路も敷設不可
        canPlace = tile.terrain !== 'water';
        break;
      case 'track_remove':
        // createRemoveTrack: 線路があり、駅が無いタイルのみ撤去可
        canPlace = tile.trackIds.length > 0 && !tile.stationId;
        break;
      case 'station_ground_small':
      case 'station_ground_large':
      case 'station_elevated':
      case 'station_terminal':
      case 'station_underground':
      case 'station_depot': {
        // createBuildStation: 線路があり、駅が無く、線路の高度と駅種別が整合するタイルのみ建設可
        if (tile.trackIds.length === 0 || tile.stationId) { canPlace = false; break; }
        const elevations = new Set(tile.trackIds.map(tid => tracks.get(tid)?.elevation ?? 0));
        const onlyUnderground = elevations.size === 1 && elevations.has(-1);
        const onlyElevated = elevations.size > 0 && ![...elevations].some(e => e <= 0);
        if (onlyUnderground) canPlace = selectedTool === 'station_underground';
        else if (onlyElevated) canPlace = selectedTool === 'station_elevated';
        else canPlace = selectedTool !== 'station_underground' && selectedTool !== 'station_elevated';
        break;
      }
      case 'train_place':
        // createPlaceTrain: 駅があるタイルのみ配置可（Scene.tsx側の実装に準拠）
        canPlace = tile.stationId !== null;
        break;
      case 'subsidiary_build':
        // createBuildSubsidiary: 平地/丘陵かつ何も無いタイルのみ建設可
        canPlace = (tile.terrain === 'flat' || tile.terrain === 'hill') &&
          tile.trackIds.length === 0 && !tile.stationId && !tile.buildingId && !tile.subsidiaryId;
        break;
      case 'signal_place':
        // createPlaceSignal: 線路があるタイルのみ設置可
        canPlace = tile.trackIds.length > 0;
        break;
      case 'bulldoze':
        // createBulldoze: 建物・子会社・駅があるタイル、またはこのタイルの線路区間上に
        // 列車がいる場合のみ撤去可
        canPlace = tile.buildingId !== null || tile.subsidiaryId !== null || tile.stationId !== null ||
          findTrainAtTile(trains, tracks, hoveredTile.x, hoveredTile.z) !== null;
        break;
      case 'land_buy': {
        // createBuyLand: まだ所有していない土地のみ購入可
        const key = `${hoveredTile.x},${hoveredTile.z}`;
        canPlace = !ownedLand.has(key);
        break;
      }
      case 'land_sell': {
        // createSellLand: 所有している土地のみ売却可
        const key = `${hoveredTile.x},${hoveredTile.z}`;
        canPlace = ownedLand.has(key);
        break;
      }
      default:
        canPlace = false;
    }

    const worldX = hoveredTile.x - GRID_SIZE / 2 + 0.5;
    const worldZ = hoveredTile.z - GRID_SIZE / 2 + 0.5;
    const worldY = getTileWorldHeight(tile) + 0.05;

    return { x: worldX, z: worldZ, y: worldY, valid: canPlace };
  }, [hoveredTile, selectedTool, map, ownedLand, trains, tracks]);

  return (
    <group>
      {highlight && (
        <mesh position={[highlight.x, highlight.y, highlight.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            color={highlight.valid ? '#00ff88' : '#ff3333'}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
