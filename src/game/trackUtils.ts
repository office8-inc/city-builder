import type { TrackSegment, Train } from './types.ts';

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
 * Direction 1 = moving from start to end; -1 = from end to start.
 * Returns the next segment and whether the train enters from its start endpoint.
 */
export function getNextSegment(
  currentId: string,
  direction: 1 | -1,
  tracks: Map<string, TrackSegment>
): { segment: TrackSegment; enterFromStart: boolean } | null {
  const current = tracks.get(currentId);
  if (!current) return null;

  // Exit point depends on travel direction
  const exitX = direction === 1 ? current.endX : current.startX;
  const exitZ = direction === 1 ? current.endZ : current.startZ;

  for (const [id, other] of tracks) {
    if (id === currentId) continue;
    if (other.startX === exitX && other.startZ === exitZ) {
      return { segment: other, enterFromStart: true };
    }
    if (other.endX === exitX && other.endZ === exitZ) {
      return { segment: other, enterFromStart: false };
    }
  }

  return null; // Dead end
}

/**
 * Advance a train's position along connected track segments.
 * Handles transitions between segments and bouncing at dead ends.
 */
export function advanceTrainPosition(
  train: Train,
  tracks: Map<string, TrackSegment>,
  moveAmount: number
): Pick<Train, 'positionOnSegment' | 'currentSegmentId' | 'direction'> {
  let pos = train.positionOnSegment + moveAmount * train.direction;
  let segId = train.currentSegmentId;
  let dir = train.direction;

  if (pos > 1.0) {
    const next = getNextSegment(segId, dir, tracks);
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
      // Dead end: bounce
      dir = -1 as const;
      pos = 2.0 - pos;
    }
  } else if (pos < 0.0) {
    const next = getNextSegment(segId, dir, tracks);
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
      // Dead end: bounce
      dir = 1 as const;
      pos = -pos;
    }
  }

  // Safety clamp
  pos = Math.max(0, Math.min(1, pos));

  return { positionOnSegment: pos, currentSegmentId: segId, direction: dir };
}
