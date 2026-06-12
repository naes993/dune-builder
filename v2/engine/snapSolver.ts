import {
  PartInstance,
  PlacementCandidate,
  PlacementMode,
  SnapSolverInput,
  Transform2D,
  Vec3,
  WorldEdgeAnchor,
} from '../types';
import { PARTS } from '../registry/parts';
import {
  calculateEdgeSnapTransform,
  getEdgeLength,
  getWorldEdgeAnchors,
  nearestAllowedRotation,
  transformPoint,
} from './anchors';
import {
  getOccupiedPlacementKeys,
  getSupportEdgeSlotKey,
  getWallSegmentKey,
  isWallEdgePart,
  validatePlacement,
} from './rules';
import { getAnchorSnapChannel } from './snapRelationships';

const DEFAULT_SNAP_RADIUS = 3.5;
const WALL_ENDPOINT_SNAP_RADIUS = 1.35;
// Small enough that the cursor still chooses the target edge; large enough that
// the requested rotation breaks ties between orientations on the same edge.
const ROTATION_PREFERENCE_WEIGHT = 0.3;
// The cursor tracks the surface under the mouse, so its height disambiguates
// stacked candidates: point high to build up, point low to build down.
const VERTICAL_AFFINITY_WEIGHT = 0.35;
// Tie-break in favor of building upward when the cursor height is ambiguous.
const DOWNWARD_TIE_BREAK = 0.01;

// The cursor lives on the ground plane, but snap targets can be elevated
// (foundation tops, wall tops). All proximity tests are therefore done in XZ.
const distanceXZ = (a: [number, number, number], b: [number, number, number]) => {
  return Math.hypot(a[0] - b[0], a[2] - b[2]);
};

const getTargetAnchors = (instances: PartInstance[]): WorldEdgeAnchor[] => {
  return instances.flatMap((instance) => {
    const part = PARTS[instance.partId];
    if (part.snapTargetChannels.length === 0) return [];
    return getWorldEdgeAnchors(part, instance.transform, instance.id);
  });
};

type WallEndpointTarget = {
  instanceId: string;
  anchorId: string;
  endpointId: string;
  point: Vec3;
};

const getWallEndpointTargets = (instances: PartInstance[]): WallEndpointTarget[] => {
  return instances.flatMap((instance) => {
    const part = PARTS[instance.partId];
    if (!isWallEdgePart(part)) return [];

    return getWorldEdgeAnchors(part, instance.transform, instance.id)
      .filter((anchor) => anchor.source !== false)
      .flatMap((anchor) => [
        {
          instanceId: instance.id,
          anchorId: anchor.id,
          endpointId: `${anchor.id}.start`,
          point: anchor.startWorld,
        },
        {
          instanceId: instance.id,
          anchorId: anchor.id,
          endpointId: `${anchor.id}.end`,
          point: anchor.endWorld,
        },
      ]);
  });
};

const rotationDistance = (a: number, b: number) => {
  const twoPi = Math.PI * 2;
  const delta = Math.abs((((a - b) % twoPi) + twoPi) % twoPi);
  return Math.min(delta, twoPi - delta);
};

const validateCandidate = (
  activePartId: SnapSolverInput['activePartId'],
  transform: Transform2D,
  instances: PartInstance[],
  snapped: boolean,
  placementMode: PlacementMode,
  binding?: PlacementCandidate['binding']
): PlacementCandidate => {
  const occupiedPlacementKeys = getOccupiedPlacementKeys(instances, PARTS);
  const slotAwareBinding = binding?.occupancyKeys?.length || binding?.occupancyKey
    ? {
        ...binding,
        targetOccupied: (binding.occupancyKeys ?? [binding.occupancyKey]).some((key) => {
          return key ? occupiedPlacementKeys.has(key) : false;
        }),
      }
    : binding;
  const validation = validatePlacement(PARTS[activePartId], transform, instances, PARTS, slotAwareBinding);
  return {
    transform,
    isValid: validation.isValid,
    reasons: validation.reasons,
    snapped,
    placementMode,
    binding: slotAwareBinding,
  };
};

const rankCandidate = (candidate: PlacementCandidate, score: number) => ({
  candidate,
  score: candidate.isValid ? score : score + 1000,
});

export const solvePlacement = (input: SnapSolverInput): PlacementCandidate => {
  const activePart = PARTS[input.activePartId];
  const snapRadius = input.snapRadius ?? DEFAULT_SNAP_RADIUS;
  const targetAnchors = getTargetAnchors(input.instances);
  const wallEndpointTargets = getWallEndpointTargets(input.instances);
  const sourceAnchors = activePart.anchors.filter((anchor) => anchor.source !== false);
  const preferredRotation = nearestAllowedRotation(input.rotationY, activePart.allowedRotations);

  if (isWallEdgePart(activePart)) {
    let bestWallRun:
      | {
          candidate: PlacementCandidate;
          score: number;
        }
      | null = null;
    const rotationY = preferredRotation;

    for (const target of wallEndpointTargets) {
      const targetDistance = distanceXZ(target.point, input.cursor);
      if (targetDistance > WALL_ENDPOINT_SNAP_RADIUS) continue;

      for (const sourceAnchor of sourceAnchors) {
        for (const sourceEndpoint of [
          { id: `${sourceAnchor.id}.start`, point: sourceAnchor.start },
          { id: `${sourceAnchor.id}.end`, point: sourceAnchor.end },
        ]) {
          const sourceWorld = transformPoint(sourceEndpoint.point, { position: [0, 0, 0], rotationY });
          const transform: Transform2D = {
            position: [
              target.point[0] - sourceWorld[0],
              target.point[1] - sourceWorld[1],
              target.point[2] - sourceWorld[2],
            ],
            rotationY,
          };
          const wallSegmentKey = getWallSegmentKey(activePart, transform, sourceAnchor.id);
          if (!wallSegmentKey) continue;

          const candidate = validateCandidate(
            input.activePartId,
            transform,
            input.instances,
            true,
            'wall-run',
            {
              placementMode: 'wall-run',
              snapChannel: 'wall-support',
              sourceAnchorId: sourceAnchor.id,
              sourceEndpointId: sourceEndpoint.id,
              targetWallInstanceId: target.instanceId,
              targetWallEndpointId: target.endpointId,
              occupancyKey: wallSegmentKey,
              occupancyKeys: [wallSegmentKey],
            }
          );
          const ranked = rankCandidate(candidate, targetDistance);
          if (!bestWallRun || ranked.score < bestWallRun.score) {
            bestWallRun = ranked;
          }
        }
      }
    }

    if (bestWallRun) {
      return bestWallRun.candidate;
    }
  }

  let bestSnap:
    | {
        candidate: PlacementCandidate;
        score: number;
      }
    | null = null;

  for (const target of targetAnchors) {
    if (!target.instanceId) continue;
    const targetPart = PARTS[target.partId];
    const snapChannel = getAnchorSnapChannel(activePart, targetPart, target);
    if (!snapChannel) continue;
    if (distanceXZ(target.centerWorld, input.cursor) > snapRadius) continue;

    for (const source of sourceAnchors) {
      if (Math.abs(getEdgeLength(source) - target.length) > 0.01) continue;

      // Both alignments are always generated: walls/doors face either way on a
      // segment (R picks the facing), and floors attach on either side of a
      // wall's top/bottom edge (the cursor side picks). Where the flipped
      // alignment would overlap the support (floor onto its own supporting
      // floor/foundation), occupancy validation rejects it.
      const transforms = [
        calculateEdgeSnapTransform(target, source),
        calculateEdgeSnapTransform(target, source, true),
      ];

      // Walls can also hang below the support edge (e.g. under a floor
      // overhang). The downward variant occupies its own edge slot.
      const variants = transforms
        .filter((transform): transform is Transform2D => Boolean(transform))
        .flatMap((transform) => {
          const upward = { transform, slotSuffix: '' };
          if (snapChannel !== 'wall-support' || !isWallEdgePart(activePart)) return [upward];
          const downwardTransform: Transform2D = {
            position: [transform.position[0], transform.position[1] - activePart.height, transform.position[2]],
            rotationY: transform.rotationY,
          };
          return [upward, { transform: downwardTransform, slotSuffix: ':down' }];
        });

      for (const { transform, slotSuffix } of variants) {
        const supportEdgeSlotKey = getSupportEdgeSlotKey(target.instanceId, target.id) + slotSuffix;
        const wallSegmentKey = getWallSegmentKey(activePart, transform, source.id);
        const occupancyKeys = wallSegmentKey ? [supportEdgeSlotKey, wallSegmentKey] : [supportEdgeSlotKey];

        const candidateMidY = transform.position[1] + activePart.height / 2;
        const score =
          distanceXZ(transform.position, input.cursor) +
          ROTATION_PREFERENCE_WEIGHT * rotationDistance(transform.rotationY, preferredRotation) +
          VERTICAL_AFFINITY_WEIGHT * Math.abs(input.cursor[1] - candidateMidY) +
          (slotSuffix ? DOWNWARD_TIE_BREAK : 0);
        const candidate = validateCandidate(
          input.activePartId,
          transform,
          input.instances,
          true,
          'support-edge',
          {
            placementMode: 'support-edge',
            snapChannel,
            sourceAnchorId: source.id,
            targetInstanceId: target.instanceId,
            targetAnchorId: target.id,
            occupancyKey: supportEdgeSlotKey,
            occupancyKeys,
          }
        );
        const ranked = rankCandidate(candidate, score);
        if (!bestSnap || ranked.score < bestSnap.score) {
          bestSnap = ranked;
        }
      }
    }
  }

  if (bestSnap) {
    return bestSnap.candidate;
  }

  // No connection target nearby: place freely at the cursor. There is no world
  // grid — the first placed piece establishes the build grid, like the game.
  const placementMode: PlacementMode = 'free-ground';
  const transform: Transform2D = {
    position: [input.cursor[0], 0, input.cursor[2]],
    rotationY: preferredRotation,
  };

  const wallSegmentKey = isWallEdgePart(activePart)
    ? getWallSegmentKey(activePart, transform)
    : undefined;
  const binding = wallSegmentKey
    ? {
        placementMode,
        occupancyKey: wallSegmentKey,
        occupancyKeys: [wallSegmentKey],
      }
    : undefined;

  return validateCandidate(input.activePartId, transform, input.instances, false, placementMode, binding);
};
