import * as THREE from 'three';
import {
  EdgeAnchorDef,
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
import { getSnapRelationship } from './snapRelationships';

const DEFAULT_SNAP_RADIUS = 3.5;
const WALL_ENDPOINT_SNAP_RADIUS = 1.35;
// Small enough that the cursor still chooses the target edge; large enough that
// the requested rotation breaks ties between orientations on the same edge.
const ROTATION_PREFERENCE_WEIGHT = 0.3;

const distance = (a: [number, number, number], b: [number, number, number]) => {
  return new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
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

    return getWorldEdgeAnchors(part, instance.transform, instance.id).flatMap((anchor) => [
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

const angleFromDirection = ([x, , z]: Vec3) => Math.atan2(x, z);

const rotationDistance = (a: number, b: number) => {
  const twoPi = Math.PI * 2;
  const delta = Math.abs((((a - b) % twoPi) + twoPi) % twoPi);
  return Math.min(delta, twoPi - delta);
};

const calculateWallSupportTransform = (
  target: WorldEdgeAnchor,
  source: EdgeAnchorDef,
  targetEndpoint: 'start' | 'end',
  sourceEndpoint: 'start' | 'end',
  allowedRotations: number[]
): Transform2D => {
  const sourceDirection = new THREE.Vector3(...source.end)
    .sub(new THREE.Vector3(...source.start))
    .normalize();
  const desiredDirection = new THREE.Vector3(...target.normalWorld).normalize();
  if (sourceEndpoint === 'end') {
    desiredDirection.negate();
  }

  const rotationY = nearestAllowedRotation(
    angleFromDirection([desiredDirection.x, desiredDirection.y, desiredDirection.z]) -
      angleFromDirection([sourceDirection.x, sourceDirection.y, sourceDirection.z]),
    allowedRotations
  );
  const localEndpoint = sourceEndpoint === 'start' ? source.start : source.end;
  const targetPoint = targetEndpoint === 'start' ? target.startWorld : target.endWorld;
  const rotatedEndpoint = transformPoint(localEndpoint, { position: [0, 0, 0], rotationY });

  return {
    position: [
      targetPoint[0] - rotatedEndpoint[0],
      0,
      targetPoint[2] - rotatedEndpoint[2],
    ],
    rotationY,
  };
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

  if (isWallEdgePart(activePart)) {
    let bestWallRun:
      | {
          candidate: PlacementCandidate;
          score: number;
        }
      | null = null;
    const rotationY = nearestAllowedRotation(input.rotationY, activePart.allowedRotations);

    for (const target of wallEndpointTargets) {
      const targetDistance = distance(target.point, input.cursor);
      if (targetDistance > WALL_ENDPOINT_SNAP_RADIUS) continue;

      for (const sourceAnchor of activePart.anchors) {
        for (const sourceEndpoint of [
          { id: `${sourceAnchor.id}.start`, point: sourceAnchor.start },
          { id: `${sourceAnchor.id}.end`, point: sourceAnchor.end },
        ]) {
          const sourceWorld = transformPoint(sourceEndpoint.point, { position: [0, 0, 0], rotationY });
          const transform: Transform2D = {
            position: [
              target.point[0] - sourceWorld[0],
              0,
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
    const snapChannel = getSnapRelationship(activePart, targetPart);
    if (!snapChannel) continue;
    if (distance(target.centerWorld, input.cursor) > snapRadius) continue;

    for (const source of activePart.anchors) {
      if (Math.abs(getEdgeLength(source) - target.length) > 0.01) continue;

      const transforms =
        snapChannel === 'wall-support' && isWallEdgePart(activePart) && targetPart.snapProfile === 'foundation'
          ? [
              calculateWallSupportTransform(target, source, 'start', 'start', activePart.allowedRotations),
              calculateWallSupportTransform(target, source, 'start', 'end', activePart.allowedRotations),
              calculateWallSupportTransform(target, source, 'end', 'start', activePart.allowedRotations),
              calculateWallSupportTransform(target, source, 'end', 'end', activePart.allowedRotations),
            ]
          : [calculateEdgeSnapTransform(target, source)].filter((transform): transform is Transform2D => Boolean(transform));

      for (const transform of transforms) {
        const supportEdgeSlotKey = getSupportEdgeSlotKey(target.instanceId, target.id);
        const wallSegmentKey = getWallSegmentKey(activePart, transform, source.id);
        const occupancyKeys = wallSegmentKey ? [supportEdgeSlotKey, wallSegmentKey] : [supportEdgeSlotKey];

        const preferredRotation = nearestAllowedRotation(input.rotationY, activePart.allowedRotations);
        const score =
          distance(transform.position, input.cursor) +
          ROTATION_PREFERENCE_WEIGHT * rotationDistance(transform.rotationY, preferredRotation);
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
  const rotationY = nearestAllowedRotation(input.rotationY, activePart.allowedRotations);
  const placementMode: PlacementMode = 'free-ground';
  const transform: Transform2D = {
    position: [input.cursor[0], 0, input.cursor[2]],
    rotationY,
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
