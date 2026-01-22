import * as THREE from 'three';

// Building Sets (cosmetic styles)
export enum BuildingSet {
  DUNE_MAN = 'DUNE_MAN',
  HARKONNEN = 'HARKONNEN',
}

// Color palette for a building set
export interface BuildingPalette {
  foundation: string;
  wallExterior: string;
  wallInterior: string;
  windowWall: string;
  windowGlass: string;
  roof: string;
  roofTrim: string;
  incline: string;
}

export enum BuildingType {
  // Foundations
  SQUARE_FOUNDATION = 'SQUARE_FOUNDATION',
  TRIANGLE_FOUNDATION = 'TRIANGLE_FOUNDATION',
  TRIANGLE_FOUNDATION_2 = 'TRIANGLE_FOUNDATION_2',
  CURVED_FOUNDATION = 'CURVED_FOUNDATION',

  // Structures (raised platform foundations - WALL_HEIGHT tall)
  SQUARE_STRUCTURE = 'SQUARE_STRUCTURE',
  TRIANGLE_STRUCTURE = 'TRIANGLE_STRUCTURE',
  CURVED_STRUCTURE = 'CURVED_STRUCTURE',

  // Walls
  WALL = 'WALL',
  HALF_WALL = 'HALF_WALL',
  WINDOW_WALL = 'WINDOW_WALL',
  DOORWAY = 'DOORWAY',
  CURVED_WALL = 'CURVED_WALL',
  CURVED_HALF_WALL = 'CURVED_HALF_WALL',

  // Roofs
  SQUARE_ROOF = 'SQUARE_ROOF',
  TRIANGLE_ROOF = 'TRIANGLE_ROOF',

  // Inclines
  STAIRS = 'STAIRS',
  STAIRS_2 = 'STAIRS_2',
  RAMP = 'RAMP',
}

export interface BuildingData {
  id: string;
  type: BuildingType;
  position: [number, number, number];
  rotation: [number, number, number];
}

export interface SavedBlueprint {
  version: number;
  name: string;
  createdAt: number;
  lastModified: number;
  buildings: BuildingData[];
}

// Legacy single-point socket (kept for walls/roofs)
export interface Socket {
  position: THREE.Vector3; // World position of the connection point
  normal: THREE.Vector3;   // Outward facing normal
  id: string;              // parent building id
  socketType: SocketType;  // Type of socket for compatibility checking
}

// Edge roles for triangles (for visualization and validation)
export enum EdgeRole {
  BASE = 'BASE',     // Red - bottom edge, grid-aligned on initial placement
  RIGHT = 'RIGHT',   // Blue - right edge
  LEFT = 'LEFT',     // Gray - left edge
  SIDE = 'SIDE',     // For squares/curves - all edges are equivalent
}

// Edge socket with THREE points for precise alignment validation
// All three points (start, center, end) must align for a valid snap
export interface EdgeSocket {
  start: THREE.Vector3;    // Start point of edge (world space)
  center: THREE.Vector3;   // Center point of edge (world space)
  end: THREE.Vector3;      // End point of edge (world space)
  id: string;              // parent building id
  socketType: SocketType;  // Type of socket for compatibility checking
  edgeLength: number;      // Length of edge (for compatibility checking)
  edgeRole: EdgeRole;      // Role of this edge (for triangles: base/right/left)
}

// Dimensions
export const UNIT_SIZE = 4;
export const WALL_HEIGHT = 3;
export const HALF_WALL_HEIGHT = 1.5;
export const FOUNDATION_HEIGHT = 0.2;

// Triangle math
// Side = 4.
// Apothem (center to midpoint of side) = s / (2 * tan(60deg)) = 4 / (2 * sqrt(3)) = 2/sqrt(3) approx 1.1547
// Radius (center to vertex) = s / (2 * sin(60deg)) = 4 / sqrt(3) approx 2.3094
export const TRIANGLE_APOTHEM = UNIT_SIZE / (2 * Math.sqrt(3));
export const TRIANGLE_RADIUS = UNIT_SIZE / Math.sqrt(3);

// Curved piece math - quarter circle that fits in a UNIT_SIZE square
export const CURVE_RADIUS = UNIT_SIZE;

// Socket types for smarter snapping
export enum SocketType {
  FOUNDATION_EDGE = 'FOUNDATION_EDGE',      // Side of foundation - connects to other foundations
  FOUNDATION_TOP = 'FOUNDATION_TOP',         // Top surface - walls snap here
  WALL_BOTTOM = 'WALL_BOTTOM',               // Bottom of wall - snaps to foundation top
  WALL_SIDE = 'WALL_SIDE',                   // Side of wall - connects to other walls
  WALL_TOP = 'WALL_TOP',                     // Top of wall - roofs/upper floors snap here
  ROOF_EDGE = 'ROOF_EDGE',                   // Edge of roof piece
  INCLINE_BOTTOM = 'INCLINE_BOTTOM',         // Bottom of stairs/ramp
  INCLINE_TOP = 'INCLINE_TOP',               // Top of stairs/ramp
}

// Socket compatibility rules
// Each entry defines what socket types can connect to this socket type
export const SOCKET_COMPATIBILITY: Record<SocketType, SocketType[]> = {
  [SocketType.FOUNDATION_EDGE]: [SocketType.FOUNDATION_EDGE],
  [SocketType.FOUNDATION_TOP]: [
    SocketType.WALL_BOTTOM,
    SocketType.INCLINE_BOTTOM,
    SocketType.INCLINE_TOP,
  ],
  [SocketType.WALL_BOTTOM]: [
    SocketType.FOUNDATION_TOP,
    SocketType.WALL_TOP,
    SocketType.INCLINE_TOP,
  ],
  [SocketType.WALL_SIDE]: [SocketType.WALL_SIDE],
  [SocketType.WALL_TOP]: [
    SocketType.WALL_BOTTOM,
    SocketType.ROOF_EDGE,
    SocketType.INCLINE_BOTTOM,
    SocketType.INCLINE_TOP,
  ],
  [SocketType.ROOF_EDGE]: [SocketType.ROOF_EDGE, SocketType.WALL_TOP],
  [SocketType.INCLINE_BOTTOM]: [
    SocketType.FOUNDATION_TOP,
    SocketType.WALL_TOP,
    SocketType.INCLINE_TOP,
  ],
  [SocketType.INCLINE_TOP]: [
    SocketType.FOUNDATION_TOP,
    SocketType.WALL_TOP,
    SocketType.WALL_BOTTOM,
    SocketType.INCLINE_BOTTOM,
  ],
};
