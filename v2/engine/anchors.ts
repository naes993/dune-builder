import * as THREE from 'three';
import {
  EdgeAnchorDef,
  PartDefinition,
  PartId,
  Transform2D,
  Vec3,
  WorldEdgeAnchor,
} from '../types';

const toVector3 = (value: Vec3) => new THREE.Vector3(value[0], value[1], value[2]);
const toTuple = (value: THREE.Vector3): Vec3 => [value.x, value.y, value.z];

export const normalizeAngle = (angle: number) => {
  const twoPi = Math.PI * 2;
  return ((angle % twoPi) + twoPi) % twoPi;
};

export const nearestAllowedRotation = (rotationY: number, allowedRotations: number[]) => {
  const normalized = normalizeAngle(rotationY);
  let best = allowedRotations[0] ?? 0;
  let bestDistance = Infinity;

  for (const rotation of allowedRotations) {
    const candidate = normalizeAngle(rotation);
    const direct = Math.abs(candidate - normalized);
    const wrapped = Math.PI * 2 - direct;
    const distance = Math.min(direct, wrapped);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
};

export const transformPoint = (point: Vec3, transform: Transform2D): Vec3 => {
  const vector = toVector3(point);
  vector.applyAxisAngle(new THREE.Vector3(0, 1, 0), transform.rotationY);
  vector.add(toVector3(transform.position));
  return toTuple(vector);
};

export const transformDirection = (direction: Vec3, rotationY: number): Vec3 => {
  const vector = toVector3(direction);
  vector.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  vector.normalize();
  return toTuple(vector);
};

export const getEdgeLength = (anchor: Pick<EdgeAnchorDef, 'start' | 'end'>) => {
  return toVector3(anchor.start).distanceTo(toVector3(anchor.end));
};

export const getWorldEdgeAnchors = (
  part: PartDefinition,
  transform: Transform2D,
  instanceId?: string
): WorldEdgeAnchor[] => {
  return part.anchors.map((anchor) => {
    const start = transformPoint(anchor.start, transform);
    const end = transformPoint(anchor.end, transform);
    const startVector = toVector3(start);
    const endVector = toVector3(end);
    const center = startVector.clone().add(endVector).multiplyScalar(0.5);

    return {
      ...anchor,
      partId: part.id as PartId,
      instanceId,
      startWorld: start,
      endWorld: end,
      centerWorld: toTuple(center),
      normalWorld: transformDirection(anchor.normal, transform.rotationY),
      length: startVector.distanceTo(endVector),
    };
  });
};

/**
 * Align a source edge onto a target edge. Default alignment is antiparallel
 * (the part sits on the outside of the target edge). `flip` aligns parallel
 * instead: same segment, part rotated 180° — used to flip wall/door facing.
 */
export const calculateEdgeSnapTransform = (
  target: WorldEdgeAnchor,
  source: EdgeAnchorDef,
  flip = false
): Transform2D | null => {
  const targetStart = toVector3(target.startWorld);
  const targetEnd = toVector3(target.endWorld);
  const targetDirection = targetEnd.clone().sub(targetStart).normalize();
  const sourceDirection = toVector3(source.end).sub(toVector3(source.start)).normalize();
  const desiredSourceDirection = flip ? targetDirection.clone() : targetDirection.clone().negate();

  const sourceAngle = Math.atan2(sourceDirection.x, sourceDirection.z);
  const targetAngle = Math.atan2(desiredSourceDirection.x, desiredSourceDirection.z);
  const rotationY = normalizeAngle(targetAngle - sourceAngle);

  const expectedStart = flip ? targetStart : targetEnd;
  const expectedEnd = flip ? targetEnd : targetStart;
  const rotatedSourceStart = toVector3(source.start).applyAxisAngle(new THREE.Vector3(0, 1, 0), rotationY);
  const position = expectedStart.clone().sub(rotatedSourceStart);
  const transform = { position: toTuple(position), rotationY };

  const startWorld = toVector3(transformPoint(source.start, transform));
  const endWorld = toVector3(transformPoint(source.end, transform));
  const sourceCenter = startWorld.clone().add(endWorld).multiplyScalar(0.5);
  const targetCenter = toVector3(target.centerWorld);

  if (startWorld.distanceTo(expectedStart) > 0.01) return null;
  if (endWorld.distanceTo(expectedEnd) > 0.01) return null;
  if (sourceCenter.distanceTo(targetCenter) > 0.01) return null;

  return transform;
};
