import type { TrackSegment, Train, Station, Signal, TrainSchedule } from './types.ts';
import { isDiagonal } from './constants.ts';
import { getSignalSpeedMultiplier } from './signals.ts';

/**
 * Find all segments that share an endpoint with the given segment.
 * 地上(0)・高架(1+)・地下(-1)は同一タイル座標を共有しうるが、レイヤーが異なる
 * 線路同士は物理的に接続しないため、同じelevationの区間のみを接続対象とする。
 */
export function getConnectedSegments(
  trackId: string,
  tracks: Map<string, TrackSegment>
): TrackSegment[] {
  const segment = tracks.get(trackId);
  if (!segment) return [];

  const connected: TrackSegment[] = [];
  for (const [id, other] of tracks) {
    if (id === trackId) continue;
    if (other.elevation !== segment.elevation) continue;
    if (
      (other.startX === segment.startX && other.startZ === segment.startZ) ||
      (other.startX === segment.endX && other.startZ === segment.endZ) ||
      (other.endX === segment.startX && other.endZ === segment.startZ) ||
      (other.endX === segment.endX && other.endZ === segment.endZ)
    ) {
      connected.push(other);
    }
  }
  return connected;
}

/**
 * Given a train's current segment and direction, find the next connected segment.
 * If the train has a schedule with a next target station, prefer the segment
 * that leads toward that station (junction routing).
 */
export function getNextSegment(
  currentId: string,
  direction: 1 | -1,
  tracks: Map<string, TrackSegment>,
  targetStationId?: string,
  stations?: Map<string, Station>,
): { segment: TrackSegment; enterFromStart: boolean } | null {
  const current = tracks.get(currentId);
  if (!current) return null;

  const exitX = direction === 1 ? current.endX : current.startX;
  const exitZ = direction === 1 ? current.endZ : current.startZ;

  const candidates: Array<{ segment: TrackSegment; enterFromStart: boolean }> = [];

  for (const [id, other] of tracks) {
    if (id === currentId) continue;
    // 同じ座標でも地上/高架/地下でレイヤーが異なる区間には乗り入れない
    if (other.elevation !== current.elevation) continue;
    if (other.startX === exitX && other.startZ === exitZ) {
      candidates.push({ segment: other, enterFromStart: true });
    } else if (other.endX === exitX && other.endZ === exitZ) {
      candidates.push({ segment: other, enterFromStart: false });
    }
  }

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  // Junction: multiple candidates. If we have a target station, pick the one closest to it.
  if (targetStationId && stations) {
    const targetStation = stations.get(targetStationId);
    if (targetStation) {
      let bestDist = Infinity;
      let bestCandidate = candidates[0];
      for (const c of candidates) {
        // Use the far endpoint of the candidate as an approximation
        const farX = c.enterFromStart ? c.segment.endX : c.segment.startX;
        const farZ = c.enterFromStart ? c.segment.endZ : c.segment.startZ;
        const dist = Math.abs(farX - targetStation.x) + Math.abs(farZ - targetStation.z);
        if (dist < bestDist) {
          bestDist = dist;
          bestCandidate = c;
        }
      }
      return bestCandidate;
    }
  }

  // Default: pick the first candidate
  return candidates[0];
}

/**
 * Get the effective length of a segment (diagonal = sqrt(2), straight = 1).
 */
function getSegmentLength(segment: TrackSegment): number {
  if (isDiagonal(segment.direction)) return Math.SQRT2;
  return 1.0;
}

/**
 * Check if a train is at a station.
 */
export function getStationAtPosition(
  train: Train,
  tracks: Map<string, TrackSegment>,
  stations: Map<string, Station>,
): Station | null {
  const seg = tracks.get(train.currentSegmentId);
  if (!seg) return null;

  // Check if near start or end of segment
  const nearStart = train.positionOnSegment < 0.15;
  const nearEnd = train.positionOnSegment > 0.85;

  if (nearStart || nearEnd) {
    const checkX = nearStart ? seg.startX : seg.endX;
    const checkZ = nearStart ? seg.startZ : seg.endZ;
    for (const station of stations.values()) {
      if (station.x === checkX && station.z === checkZ) {
        return station;
      }
    }
  }
  return null;
}

/**
 * Find a train currently occupying the track segment touching the given tile
 * (BuildingInfo/GridHelper/bulldoze で共通利用する、タイル上の列車検出ロジック)。
 */
export function findTrainAtTile(
  trains: Map<string, Train>,
  tracks: Map<string, TrackSegment>,
  x: number,
  z: number,
): Train | null {
  for (const train of trains.values()) {
    const segment = tracks.get(train.currentSegmentId);
    if (!segment) continue;
    if (
      (segment.startX === x && segment.startZ === z) ||
      (segment.endX === x && segment.endZ === z)
    ) {
      return train;
    }
  }
  return null;
}

/**
 * Get the next target station ID from the train's schedule.
 */
function getNextTargetStationId(train: Train): string | undefined {
  if (train.schedule.stops.length === 0) return undefined;
  const nextIdx = (train.schedule.currentStopIndex + 1) % train.schedule.stops.length;
  return train.schedule.stops[nextIdx]?.stationId;
}

/**
 * 停車駅リストを逆順にし、現在位置(currentStopIndex)を反転後の配列の先頭(0)へ
 * 巻き戻す。「往復(bounce)」モードで終端駅に到達した際の折り返しと、
 * 「片道(one-way)」モードで終着した列車を手動で再出発させる際、両方から共通利用する。
 * 例: [A,B,C,D] で D(末尾)に到達 → [D,C,B,A], currentStopIndex=0（=現在地D）
 *     以降 (currentStopIndex+1)%length の通常ルーティングが自然にCへ向かう。
 */
export function reverseTrainSchedule(schedule: TrainSchedule): TrainSchedule {
  return {
    ...schedule,
    stops: [...schedule.stops].reverse(),
    currentStopIndex: 0,
  };
}

/**
 * Advance a train's position along connected track segments.
 * Handles transitions between segments and bouncing at dead ends.
 * Supports signal system and schedule-based junction routing.
 */
export function advanceTrainPosition(
  train: Train,
  tracks: Map<string, TrackSegment>,
  moveAmount: number,
  signals?: Map<string, Signal>,
  stations?: Map<string, Station>,
): Pick<Train, 'positionOnSegment' | 'currentSegmentId' | 'direction'> {
  // Apply signal multiplier
  const signalMult = signals ? getSignalSpeedMultiplier(train, tracks, signals) : 1.0;
  if (signalMult === 0) {
    // Red signal: don't move
    return {
      positionOnSegment: train.positionOnSegment,
      currentSegmentId: train.currentSegmentId,
      direction: train.direction,
    };
  }

  const currentSeg = tracks.get(train.currentSegmentId);
  const segLen = currentSeg ? getSegmentLength(currentSeg) : 1.0;
  const normalizedMove = (moveAmount * signalMult) / segLen;

  let pos = train.positionOnSegment + normalizedMove * train.direction;
  let segId = train.currentSegmentId;
  let dir = train.direction;

  const targetStationId = getNextTargetStationId(train);

  if (pos > 1.0) {
    const next = getNextSegment(segId, dir, tracks, targetStationId, stations);
    if (next) {
      segId = next.segment.id;
      if (next.enterFromStart) {
        pos = pos - 1.0;
        dir = 1;
      } else {
        pos = 1.0 - (pos - 1.0);
        dir = -1;
      }
    } else {
      dir = -1 as const;
      pos = 2.0 - pos;
    }
  } else if (pos < 0.0) {
    const next = getNextSegment(segId, dir, tracks, targetStationId, stations);
    if (next) {
      segId = next.segment.id;
      if (next.enterFromStart) {
        pos = -pos;
        dir = 1;
      } else {
        pos = 1.0 + pos;
        dir = -1;
      }
    } else {
      dir = 1 as const;
      pos = -pos;
    }
  }

  pos = Math.max(0, Math.min(1, pos));

  return { positionOnSegment: pos, currentSegmentId: segId, direction: dir };
}
