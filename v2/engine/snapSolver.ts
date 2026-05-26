import * as THREE from 'three';
import {
  PartInstance,
  PlacementCandidate,
  SnapSolverInput,
  Transform2D,
  WorldEdgeAnchor,
} from '../types';
import { PARTS } from '../registry/parts';
import {
  calculateEdgeSnapTransform,
  getEdgeLength,
  getWorldEdgeAnchors,
  nearestAllowedRotation,
} from './anchors';
import { validatePlacement } from './rules';
import { V2_UNIT_SIZE } from '../constants';

const DEFAULT_SNAP_RADIUS = 3.5;
const GRID_SIZE = V2_UNIT_SIZE;

const distance = (a: [number, number, number], b: [number, number, number]) => {
  return new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b));
};

const getTargetAnchors = (instances: PartInstance[]): WorldEdgeAnchor[] => {
  return instances.flatMap((instance) => {
    const part = PARTS[instance.partId];
    if (part.category !== 'foundation' && part.category !== 'calibration-foundation') return [];
    return getWorldEdgeAnchors(part, instance.transform, instance.id);
  });
};

const snapToGrid = (value: number) => {
  const offset = GRID_SIZE / 2;
  return Math.round((value - offset) / GRID_SIZE) * GRID_SIZE + offset;
};

const validateCandidate = (
  activePartId: SnapSolverInput['activePartId'],
  transform: Transform2D,
  instances: PartInstance[],
  snapped: boolean,
  binding?: PlacementCandidate['binding']
): PlacementCandidate => {
  const validation = validatePlacement(PARTS[activePartId], transform, instances, PARTS);
  return {
    transform,
    isValid: validation.isValid,
    reasons: validation.reasons,
    snapped,
    binding,
  };
};

export const solvePlacement = (input: SnapSolverInput): PlacementCandidate => {
  const activePart = PARTS[input.activePartId];
  const snapRadius = input.snapRadius ?? DEFAULT_SNAP_RADIUS;
  const targetAnchors = getTargetAnchors(input.instances);

  let bestSnap:
    | {
        transform: Transform2D;
        score: number;
        binding: NonNullable<PlacementCandidate['binding']>;
      }
    | null = null;

  for (const target of targetAnchors) {
    if (!target.instanceId) continue;
    if (distance(target.centerWorld, input.cursor) > snapRadius) continue;

    for (const source of activePart.anchors) {
      if (Math.abs(getEdgeLength(source) - target.length) > 0.01) continue;

      const transform = calculateEdgeSnapTransform(target, source);
      if (!transform) continue;

      const score = distance(transform.position, input.cursor);
      if (!bestSnap || score < bestSnap.score) {
        bestSnap = {
          transform,
          score,
          binding: {
            sourceAnchorId: source.id,
            targetInstanceId: target.instanceId,
            targetAnchorId: target.id,
          },
        };
      }
    }
  }

  if (bestSnap) {
    return validateCandidate(input.activePartId, bestSnap.transform, input.instances, true, bestSnap.binding);
  }

  const rotationY = nearestAllowedRotation(input.rotationY, activePart.allowedRotations);
  const transform: Transform2D = {
    position: [snapToGrid(input.cursor[0]), 0, snapToGrid(input.cursor[2])],
    rotationY,
  };

  return validateCandidate(input.activePartId, transform, input.instances, false);
};
