import type { TrackSegment, Train, Station, Signal } from './types.ts';
import { isDiagonal } from './constants.ts';

/**
 * Find all segments that share an endpoint with the given segment.
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

  // Default: use switchState if it's a switch segment, or pick first
  const currentSeg = tracks.get(currentId);
  if (currentSeg?.type === 'switch') {
    const mainIdx = currentSeg.switchState === 'diverge' ? 1 : 0;
    return candidates[Math.min(mainIdx, candidates.length - 1)];
  }

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
 * Get the next target station ID from the train's schedule.
 */
function getNextTargetStationId(train: Train): string | undefined {
  if (train.schedule.stops.length === 0) return undefined;
  const nextIdx = (train.schedule.currentStopIndex + 1) % train.schedule.stops.length;
  return train.schedule.stops[nextIdx]?.stationId;
}

/**
 * Get signal speed multiplier for a train based on signals ahead.
 */
function getSignalMultiplier(
  train: Train,
  tracks: Map<string, TrackSegment>,
  signals: Map<string, Signal>,
): number {
  if (signals.size === 0) return 1.0;

  const seg = tracks.get(train.currentSegmentId);
  if (!seg) return 1.0;

  const exitX = train.direction === 1 ? seg.endX : seg.startX;
  const exitZ = train.direction === 1 ? seg.endZ : seg.startZ;

  for (const signal of signals.values()) {
    if (signal.x === exitX && signal.z === exitZ) {
      switch (signal.state) {
        case 'red': return 0;
        case 'yellow': return 0.5;
        case 'green': return 1.0;
      }
    }
  }
  return 1.0;
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
  const signalMult = signals ? getSignalMultiplier(train, tracks, signals) : 1.0;
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
