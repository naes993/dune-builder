import { PartDefinition, PartInstance, PartRegistry, Transform2D, Vec2 } from '../types';

const EPSILON = 0.001;

const rotatePoint = ([x, z]: Vec2, rotationY: number): Vec2 => {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return [x * cos + z * sin, -x * sin + z * cos];
};

export const getWorldFootprint = (part: PartDefinition, transform: Transform2D): Vec2[] => {
  return part.footprint.points.map((point) => {
    const [x, z] = rotatePoint(point, transform.rotationY);
    return [x + transform.position[0], z + transform.position[2]];
  });
};

const getAxes = (polygon: Vec2[]): Vec2[] => {
  const axes: Vec2[] = [];

  for (let i = 0; i < polygon.length; i += 1) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];
    const edge: Vec2 = [next[0] - current[0], next[1] - current[1]];
    const normal: Vec2 = [-edge[1], edge[0]];
    const length = Math.hypot(normal[0], normal[1]);
    if (length > 0) {
      axes.push([normal[0] / length, normal[1] / length]);
    }
  }

  return axes;
};

const project = (polygon: Vec2[], axis: Vec2) => {
  let min = Infinity;
  let max = -Infinity;

  for (const point of polygon) {
    const value = point[0] * axis[0] + point[1] * axis[1];
    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  return { min, max };
};

export const polygonsOverlap = (a: Vec2[], b: Vec2[]) => {
  const axes = [...getAxes(a), ...getAxes(b)];

  for (const axis of axes) {
    const projectionA = project(a, axis);
    const projectionB = project(b, axis);

    if (projectionA.max <= projectionB.min + EPSILON || projectionB.max <= projectionA.min + EPSILON) {
      return false;
    }
  }

  return true;
};

const verticalRangesOverlap = (
  aBase: number,
  aHeight: number,
  bBase: number,
  bHeight: number
) => {
  return aBase < bBase + bHeight - EPSILON && bBase < aBase + aHeight - EPSILON;
};

export const getOccupancyConflicts = (
  part: PartDefinition,
  transform: Transform2D,
  instances: PartInstance[],
  registry: PartRegistry
) => {
  const footprint = getWorldFootprint(part, transform);
  const conflicts: PartInstance[] = [];

  for (const instance of instances) {
    const otherPart = registry[instance.partId];
    if (otherPart.occupancyLayer !== part.occupancyLayer) continue;
    if (
      !verticalRangesOverlap(
        transform.position[1],
        part.height,
        instance.transform.position[1],
        otherPart.height
      )
    ) {
      continue;
    }

    const otherFootprint = getWorldFootprint(otherPart, instance.transform);
    if (polygonsOverlap(footprint, otherFootprint)) {
      conflicts.push(instance);
    }
  }

  return conflicts;
};
