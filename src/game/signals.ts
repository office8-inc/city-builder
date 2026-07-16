import type { Signal, TrackSegment, Train } from './types.ts';

/**
 * Block signal system.
 * Each signal monitors the segment ahead. If a train occupies the next block, signal turns red.
 * Yellow = train within 2 segments. Green = clear.
 */
export function updateSignals(
  signals: Map<string, Signal>,
  tracks: Map<string, TrackSegment>,
  trains: Map<string, Train>,
): Map<string, Signal> {
  // Build occupancy map: segmentId -> true
  const occupied = new Set<string>();
  for (const train of trains.values()) {
    occupied.add(train.currentSegmentId);
  }

  let changed = false;
  const updated = new Map(signals);

  for (const [id, signal] of updated) {
    const seg = tracks.get(signal.segmentId);
    if (!seg) continue;

    // Check segments ahead (from signal position)
    let newState: Signal['state'] = 'green';

    // Find connected segments from this signal's position
    const adjacentIds = getAdjacentSegmentIds(signal.x, signal.z, signal.segmentId, tracks);

    // Red if any adjacent segment is occupied
    for (const adjId of adjacentIds) {
      if (occupied.has(adjId)) {
        newState = 'red';
        break;
      }
    }

    // Yellow if 2 segments ahead is occupied (and not already red)
    if (newState === 'green') {
      for (const adjId of adjacentIds) {
        const adjSeg = tracks.get(adjId);
        if (!adjSeg) continue;
        const nextAdj = getAdjacentSegmentIds(adjSeg.endX, adjSeg.endZ, adjId, tracks);
        for (const nextId of nextAdj) {
          if (occupied.has(nextId)) {
            newState = 'yellow';
            break;
          }
        }
        if (newState === 'yellow') break;
      }
    }

    if (newState !== signal.state) {
      updated.set(id, { ...signal, state: newState });
      changed = true;
    }
  }

  return changed ? updated : signals;
}

function getAdjacentSegmentIds(
  x: number, z: number, excludeId: string,
  tracks: Map<string, TrackSegment>
): string[] {
  // 地上・高架・地下は同じ座標を共有しうるが物理的に繋がっていないため、
  // 基準区間(excludeId)と同じelevationの区間のみ隣接扱いにする
  const excludeElevation = tracks.get(excludeId)?.elevation ?? 0;
  const result: string[] = [];
  for (const [id, seg] of tracks) {
    if (id === excludeId) continue;
    if (seg.elevation !== excludeElevation) continue;
    if ((seg.startX === x && seg.startZ === z) ||
        (seg.endX === x && seg.endZ === z)) {
      result.push(id);
    }
  }
  return result;
}

/**
 * Check if a train should slow down or stop based on signals ahead.
 * Returns a speed multiplier: 1.0 = full speed, 0.5 = yellow caution, 0 = red stop.
 */
export function getSignalSpeedMultiplier(
  train: Train,
  tracks: Map<string, TrackSegment>,
  signals: Map<string, Signal>,
): number {
  const seg = tracks.get(train.currentSegmentId);
  if (!seg) return 1.0;

  // Check if there's a signal at the exit point of the current segment
  const exitX = train.direction === 1 ? seg.endX : seg.startX;
  const exitZ = train.direction === 1 ? seg.endZ : seg.startZ;

  for (const signal of signals.values()) {
    if (signal.x === exitX && signal.z === exitZ) {
      // 同一座標でも地上/高架/地下でレイヤーが異なる信号は無関係なので無視する
      const signalSeg = tracks.get(signal.segmentId);
      if (signalSeg && signalSeg.elevation !== seg.elevation) continue;
      switch (signal.state) {
        case 'red': return 0;
        case 'yellow': return 0.5;
        case 'green': return 1.0;
      }
    }
  }

  return 1.0; // No signal = full speed
}
