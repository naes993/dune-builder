import * as THREE from 'three';
import {
  BuildingType,
  UNIT_SIZE,
  FOUNDATION_HEIGHT,
  TRIANGLE_RADIUS,
  WALL_HEIGHT,
  HALF_WALL_HEIGHT,
} from '../types';

// Door dimensions
const DOOR_WIDTH = 1.2;
const DOOR_HEIGHT = 2.4;

// Window dimensions
const WINDOW_WIDTH_RATIO = 0.6;
const WINDOW_HEIGHT = 1.5;

// Stair dimensions
const STAIR_COUNT = 8;
const STAIR_HEIGHT = WALL_HEIGHT / STAIR_COUNT;
const STAIR_DEPTH = UNIT_SIZE / STAIR_COUNT;

// Ramp dimensions
const RAMP_THICKNESS = 0.2;
const RAIL_WIDTH = 0.2;
const RAIL_HEIGHT = 0.5;

// Roof dimensions
const ROOF_HEIGHT = 3;
const ROOF_THICKNESS = 0.2;

export interface GeometryConfig {
  type: BuildingType;
  wireframe?: boolean;
  isGhost?: boolean;
  isValid?: boolean;
  materials: {
    ghost: THREE.MeshBasicMaterial;
    error: THREE.MeshBasicMaterial;
  };
}

/**
 * Returns the Y offset for placing a building mesh.
 * This is how far above the placement point the mesh center should be.
 */
export function getYOffset(type: BuildingType): number {
  switch (type) {
    case BuildingType.SQUARE_FOUNDATION:
    case BuildingType.TRIANGLE_FOUNDATION:
    case BuildingType.CURVED_FOUNDATION:
      return FOUNDATION_HEIGHT / 2;
    case BuildingType.WALL:
    case BuildingType.WINDOW_WALL:
    case BuildingType.DOORWAY:
      return WALL_HEIGHT / 2;
    case BuildingType.HALF_WALL:
      return HALF_WALL_HEIGHT / 2;
    case BuildingType.SQUARE_ROOF:
    case BuildingType.TRIANGLE_ROOF:
    case BuildingType.STAIRS:
    case BuildingType.RAMP:
      return 0;
    default:
      return 0;
  }
}

/**
 * Creates the curved foundation shape (quarter circle).
 * Centered at origin with corner at (-halfSize, -halfSize).
 */
export function createCurvedFoundationShape(): THREE.Shape {
  const halfSize = UNIT_SIZE / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfSize, -halfSize);
  shape.lineTo(halfSize, -halfSize);
  shape.absarc(-halfSize, -halfSize, UNIT_SIZE, 0, Math.PI / 2, false);
  shape.lineTo(-halfSize, -halfSize);
  return shape;
}

/**
 * Creates a curved wall shape (quarter ring) with thickness.
 */
export function createCurvedWallShape(thickness: number): THREE.Shape {
  const halfSize = UNIT_SIZE / 2;
  const outerRadius = UNIT_SIZE;
  const innerRadius = Math.max(UNIT_SIZE - thickness, UNIT_SIZE * 0.2);
  const cx = -halfSize;
  const cy = -halfSize;

  const shape = new THREE.Shape();
  shape.moveTo(cx + outerRadius, cy);
  shape.absarc(cx, cy, outerRadius, 0, Math.PI / 2, false);
  shape.lineTo(cx, cy + innerRadius);
  shape.absarc(cx, cy, innerRadius, Math.PI / 2, 0, true);
  shape.lineTo(cx + outerRadius, cy);
  return shape;
}

/**
 * Creates the doorway wall shape with door hole cutout.
 */
export function createDoorwayShape(): THREE.Shape {
  const halfW = UNIT_SIZE / 2;
  const halfH = WALL_HEIGHT / 2;

  const wallShape = new THREE.Shape();
  wallShape.moveTo(-halfW, -halfH);
  wallShape.lineTo(halfW, -halfH);
  wallShape.lineTo(halfW, halfH);
  wallShape.lineTo(-halfW, halfH);
  wallShape.lineTo(-halfW, -halfH);

  const doorHole = new THREE.Path();
  doorHole.moveTo(-DOOR_WIDTH / 2, -halfH);
  doorHole.lineTo(DOOR_WIDTH / 2, -halfH);
  doorHole.lineTo(DOOR_WIDTH / 2, -halfH + DOOR_HEIGHT);
  doorHole.lineTo(-DOOR_WIDTH / 2, -halfH + DOOR_HEIGHT);
  doorHole.lineTo(-DOOR_WIDTH / 2, -halfH);
  wallShape.holes.push(doorHole);

  return wallShape;
}

/**
 * Configuration for stair step positions.
 */
export function getStairSteps(): Array<{ y: number; z: number }> {
  const steps: Array<{ y: number; z: number }> = [];
  for (let i = 0; i < STAIR_COUNT; i++) {
    steps.push({
      y: (i * STAIR_HEIGHT) + (STAIR_HEIGHT / 2),
      z: -UNIT_SIZE / 2 + (i * STAIR_DEPTH) + (STAIR_DEPTH / 2),
    });
  }
  return steps;
}

/**
 * Ramp geometry parameters.
 */
export function getRampParams(): { length: number; angle: number } {
  const length = Math.sqrt(UNIT_SIZE * UNIT_SIZE + WALL_HEIGHT * WALL_HEIGHT);
  const angle = Math.atan2(WALL_HEIGHT, UNIT_SIZE);
  return { length, angle };
}

// Re-export constants for use in components
export {
  DOOR_WIDTH,
  DOOR_HEIGHT,
  WINDOW_WIDTH_RATIO,
  WINDOW_HEIGHT,
  STAIR_COUNT,
  STAIR_HEIGHT,
  STAIR_DEPTH,
  RAMP_THICKNESS,
  RAIL_WIDTH,
  RAIL_HEIGHT,
  ROOF_HEIGHT,
  ROOF_THICKNESS,
};
