import * as THREE from 'three';
import {
  BuildingType,
  BuildingData,
  Socket,
  EdgeSocket,
  EdgeRole,
  SocketType,
  SOCKET_COMPATIBILITY,
  UNIT_SIZE,
  TRIANGLE_APOTHEM,
  TRIANGLE_RADIUS,
  WALL_HEIGHT,
  HALF_WALL_HEIGHT,
  FOUNDATION_HEIGHT,
} from '../types';

interface LocalSocket {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  socketType: SocketType;
}

// Local edge socket with THREE points (before world transform)
// All three points must align for a valid snap
interface LocalEdgeSocket {
  start: THREE.Vector3;
  center: THREE.Vector3;
  end: THREE.Vector3;
  socketType: SocketType;
  edgeLength: number;
  edgeRole: EdgeRole;
}

/**
 * Calculates the local sockets (connection points) for a given building type.
 * Now includes socket types for smarter snapping.
 */
export const getLocalSockets = (type: BuildingType): LocalSocket[] => {
  const sockets: LocalSocket[] = [];
  const halfSize = UNIT_SIZE / 2;

  // ===================
  // FOUNDATIONS
  // ===================

  if (type === BuildingType.SQUARE_FOUNDATION) {
    // Edge sockets (for connecting to other foundations)
    sockets.push({ position: new THREE.Vector3(0, 0, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.FOUNDATION_EDGE });
    sockets.push({ position: new THREE.Vector3(halfSize, 0, 0), normal: new THREE.Vector3(1, 0, 0), socketType: SocketType.FOUNDATION_EDGE });
    sockets.push({ position: new THREE.Vector3(0, 0, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_EDGE });
    sockets.push({ position: new THREE.Vector3(-halfSize, 0, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_EDGE });

    // Top sockets for walls (at each edge center, on top of foundation)
    const topY = FOUNDATION_HEIGHT;
    sockets.push({ position: new THREE.Vector3(0, topY, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(halfSize, topY, 0), normal: new THREE.Vector3(1, 0, 0), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(0, topY, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(-halfSize, topY, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_TOP });
  }

  else if (type === BuildingType.TRIANGLE_FOUNDATION) {
    // THREE.CylinderGeometry with radialSegments=3 creates a triangular prism.
    // Vertices are at angles 90°, 210°, 330° from +X axis (first vertex at +Z).
    //
    // For an equilateral triangle with one vertex pointing UP (+Z):
    //   - V0 at 90° (top, +Z direction)
    //   - V1 at 210° (bottom-left)
    //   - V2 at 330° (bottom-right)
    //
    // Edge midpoints (and outward normal directions):
    //   - Edge V0→V1: midpoint at 150°, normal points 150° (upper-left, NW-ish)
    //   - Edge V1→V2: midpoint at 270°, normal points 270° (down, -Z)
    //   - Edge V2→V0: midpoint at 30°, normal points 30° (upper-right, NE-ish)

    const apexZ = -TRIANGLE_RADIUS;
    const baseZ = TRIANGLE_APOTHEM;
    const vApex = new THREE.Vector3(0, 0, apexZ);
    const vLeft = new THREE.Vector3(-halfSize, 0, baseZ);
    const vRight = new THREE.Vector3(halfSize, 0, baseZ);
    const edges: Array<[THREE.Vector3, THREE.Vector3]> = [
      [vLeft, vRight],
      [vRight, vApex],
      [vApex, vLeft],
    ];

    for (const [start, end] of edges) {
      const position = start.clone().add(end).multiplyScalar(0.5);
      const normal = new THREE.Vector3(position.x, 0, position.z).normalize();

      sockets.push({
        position: position.clone(),
        normal: normal.clone(),
        socketType: SocketType.FOUNDATION_EDGE
      });

      sockets.push({
        position: new THREE.Vector3(position.x, FOUNDATION_HEIGHT, position.z),
        normal: normal.clone(),
        socketType: SocketType.FOUNDATION_TOP
      });
    }
  }

  else if (type === BuildingType.TRIANGLE_FOUNDATION_2) {
    // New Triangle 2 logic with CORRECTED normals (pointing OUTWARD) and uniform roles.

    // 1. BASE Edge (Bottom, +Z)
    sockets.push({
      position: new THREE.Vector3(0, 0, TRIANGLE_APOTHEM),
      normal: new THREE.Vector3(0, 0, 1),
      socketType: SocketType.FOUNDATION_EDGE
    });
    sockets.push({
      position: new THREE.Vector3(0, FOUNDATION_HEIGHT, TRIANGLE_APOTHEM),
      normal: new THREE.Vector3(0, 0, 1),
      socketType: SocketType.FOUNDATION_TOP
    });

    // 2. RIGHT Edge (Top-Right)
    // Normal points 30 degrees (pi/6)
    const normRight = new THREE.Vector3(Math.cos(Math.PI / 6), 0, -Math.sin(Math.PI / 6));
    const posRight = normRight.clone().multiplyScalar(TRIANGLE_APOTHEM);
    sockets.push({
      position: posRight,
      normal: normRight,
      socketType: SocketType.FOUNDATION_EDGE
    });
    sockets.push({
      position: new THREE.Vector3(posRight.x, FOUNDATION_HEIGHT, posRight.z),
      normal: normRight,
      socketType: SocketType.FOUNDATION_TOP
    });

    // 3. LEFT Edge (Top-Left)
    // Normal points 150 degrees (5pi/6)
    const normLeft = new THREE.Vector3(Math.cos(5 * Math.PI / 6), 0, -Math.sin(5 * Math.PI / 6));
    const posLeft = normLeft.clone().multiplyScalar(TRIANGLE_APOTHEM);
    sockets.push({
      position: posLeft,
      normal: normLeft,
      socketType: SocketType.FOUNDATION_EDGE
    });
    sockets.push({
      position: new THREE.Vector3(posLeft.x, FOUNDATION_HEIGHT, posLeft.z),
      normal: normLeft,
      socketType: SocketType.FOUNDATION_TOP
    });
  }

  else if (type === BuildingType.CURVED_FOUNDATION) {
    // Quarter circle foundation - only the two STRAIGHT edges have sockets
    // The curved edge does not snap to other pieces
    // - Edge along X axis at z = -halfSize, normal points -Z
    // - Edge along Z axis at x = -halfSize, normal points -X

    // Straight edge along X (at z = -halfSize) - matches square's -Z edge
    sockets.push({ position: new THREE.Vector3(0, 0, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_EDGE });
    // Straight edge along Z (at x = -halfSize) - matches square's -X edge
    sockets.push({ position: new THREE.Vector3(-halfSize, 0, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_EDGE });

    // Top sockets for walls along the straight edges
    sockets.push({ position: new THREE.Vector3(0, FOUNDATION_HEIGHT, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(-halfSize, FOUNDATION_HEIGHT, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_TOP });
  }

  // ===================
  // STRUCTURES (Raised platform foundations - WALL_HEIGHT tall)
  // ===================

  else if (type === BuildingType.SQUARE_STRUCTURE) {
    // Edge sockets at GROUND LEVEL (y=0) for snapping to other foundations/structures
    sockets.push({ position: new THREE.Vector3(0, 0, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.FOUNDATION_EDGE });
    sockets.push({ position: new THREE.Vector3(halfSize, 0, 0), normal: new THREE.Vector3(1, 0, 0), socketType: SocketType.FOUNDATION_EDGE });
    sockets.push({ position: new THREE.Vector3(0, 0, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_EDGE });
    sockets.push({ position: new THREE.Vector3(-halfSize, 0, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_EDGE });

    // Top sockets at WALL_HEIGHT for walls to snap on top
    const structureTopY = WALL_HEIGHT;
    sockets.push({ position: new THREE.Vector3(0, structureTopY, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(halfSize, structureTopY, 0), normal: new THREE.Vector3(1, 0, 0), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(0, structureTopY, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(-halfSize, structureTopY, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_TOP });
  }

  else if (type === BuildingType.TRIANGLE_STRUCTURE) {
    const apexZ = -TRIANGLE_RADIUS;
    const baseZ = TRIANGLE_APOTHEM;
    const vApex = new THREE.Vector3(0, 0, apexZ);
    const vLeft = new THREE.Vector3(-halfSize, 0, baseZ);
    const vRight = new THREE.Vector3(halfSize, 0, baseZ);
    const edges: Array<[THREE.Vector3, THREE.Vector3]> = [
      [vLeft, vRight],
      [vRight, vApex],
      [vApex, vLeft],
    ];

    for (const [start, end] of edges) {
      const position = start.clone().add(end).multiplyScalar(0.5);
      const normal = new THREE.Vector3(position.x, 0, position.z).normalize();

      sockets.push({
        position: position.clone(),
        normal: normal.clone(),
        socketType: SocketType.FOUNDATION_EDGE
      });

      sockets.push({
        position: new THREE.Vector3(position.x, WALL_HEIGHT, position.z),
        normal: normal.clone(),
        socketType: SocketType.FOUNDATION_TOP
      });
    }
  }

  else if (type === BuildingType.CURVED_STRUCTURE) {
    // Straight edges only (same as CURVED_FOUNDATION but with WALL_HEIGHT for top sockets)
    sockets.push({ position: new THREE.Vector3(0, 0, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_EDGE });
    sockets.push({ position: new THREE.Vector3(-halfSize, 0, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_EDGE });

    // Top sockets at WALL_HEIGHT
    sockets.push({ position: new THREE.Vector3(0, WALL_HEIGHT, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(-halfSize, WALL_HEIGHT, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_TOP });
  }

  // ===================
  // WALLS
  // ===================

  else if (type === BuildingType.WALL || type === BuildingType.WINDOW_WALL || type === BuildingType.DOORWAY) {
    const wallHeight = WALL_HEIGHT;

    // Bottom socket (snaps to foundation top)
    sockets.push({ position: new THREE.Vector3(0, 0, 0), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.WALL_BOTTOM });
    sockets.push({ position: new THREE.Vector3(0, 0, 0), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.WALL_BOTTOM });

    // Side sockets (connect to adjacent walls)
    sockets.push({ position: new THREE.Vector3(-halfSize, wallHeight / 2, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.WALL_SIDE });
    sockets.push({ position: new THREE.Vector3(halfSize, wallHeight / 2, 0), normal: new THREE.Vector3(1, 0, 0), socketType: SocketType.WALL_SIDE });

    // Top sockets (for roofs or stacking)
    sockets.push({ position: new THREE.Vector3(0, wallHeight, 0), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.WALL_TOP });
    sockets.push({ position: new THREE.Vector3(0, wallHeight, 0), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.WALL_TOP });
  }

  else if (type === BuildingType.HALF_WALL) {
    const wallHeight = HALF_WALL_HEIGHT;

    sockets.push({ position: new THREE.Vector3(0, 0, 0), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.WALL_BOTTOM });
    sockets.push({ position: new THREE.Vector3(0, 0, 0), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.WALL_BOTTOM });
    sockets.push({ position: new THREE.Vector3(-halfSize, wallHeight / 2, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.WALL_SIDE });
    sockets.push({ position: new THREE.Vector3(halfSize, wallHeight / 2, 0), normal: new THREE.Vector3(1, 0, 0), socketType: SocketType.WALL_SIDE });
    sockets.push({ position: new THREE.Vector3(0, wallHeight, 0), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.WALL_TOP });
    sockets.push({ position: new THREE.Vector3(0, wallHeight, 0), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.WALL_TOP });
  }

  // ===================
  // ROOFS
  // ===================

  else if (type === BuildingType.SQUARE_ROOF) {
    sockets.push({ position: new THREE.Vector3(0, 0, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.ROOF_EDGE });
    sockets.push({ position: new THREE.Vector3(halfSize, 0, 0), normal: new THREE.Vector3(1, 0, 0), socketType: SocketType.ROOF_EDGE });
    sockets.push({ position: new THREE.Vector3(0, 0, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.ROOF_EDGE });
    sockets.push({ position: new THREE.Vector3(-halfSize, 0, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.ROOF_EDGE });
  }

  else if (type === BuildingType.TRIANGLE_ROOF) {
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const pos = new THREE.Vector3(0, 0, TRIANGLE_APOTHEM).applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
      const norm = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
      sockets.push({ position: pos, normal: norm, socketType: SocketType.ROOF_EDGE });
    }
  }

  // ===================
  // INCLINES
  // ===================

  else if (type === BuildingType.STAIRS) {
    sockets.push({ position: new THREE.Vector3(0, 0, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.INCLINE_BOTTOM });
    sockets.push({ position: new THREE.Vector3(0, 0, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.INCLINE_BOTTOM });
    sockets.push({ position: new THREE.Vector3(0, WALL_HEIGHT, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.INCLINE_TOP });
  }

  else if (type === BuildingType.RAMP) {
    sockets.push({ position: new THREE.Vector3(0, 0, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.INCLINE_BOTTOM });
    sockets.push({ position: new THREE.Vector3(0, 0, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.INCLINE_BOTTOM });
    sockets.push({ position: new THREE.Vector3(0, WALL_HEIGHT, halfSize), normal: new THREE.Vector3(0, 0, 1), socketType: SocketType.INCLINE_TOP });
  }

  return sockets;
};

/**
 * Transforms local sockets to world space.
 */
export const getWorldSockets = (building: BuildingData): Socket[] => {
  if (!building) return [];
  const local = getLocalSockets(building.type);
  const worldSockets: Socket[] = [];

  const rotEuler = new THREE.Euler(building.rotation[0], building.rotation[1], building.rotation[2]);
  const pos = new THREE.Vector3(building.position[0], building.position[1], building.position[2]);

  local.forEach(s => {
    const wPos = s.position.clone().applyEuler(rotEuler).add(pos);
    const wNorm = s.normal.clone().applyEuler(rotEuler);
    worldSockets.push({
      position: wPos,
      normal: wNorm,
      id: building.id,
      socketType: s.socketType
    });
  });

  return worldSockets;
};

// =============================================================================
// EDGE SOCKET SYSTEM - THREE points per edge for rotation-locked snapping
// All three points (start, center, end) must align for a valid snap
// =============================================================================

/**
 * Helper to create an edge with start, center, end points
 */
const createEdge = (
  start: THREE.Vector3,
  end: THREE.Vector3,
  edgeRole: EdgeRole
): LocalEdgeSocket => {
  const center = start.clone().add(end).multiplyScalar(0.5);
  return {
    start: start.clone(),
    center,
    end: end.clone(),
    socketType: SocketType.FOUNDATION_EDGE,
    edgeLength: start.distanceTo(end),
    edgeRole
  };
};

/**
 * Get local edge sockets for foundation types.
 * Each edge has THREE points (start, center, end) for precise alignment.
 *
 * Triangle edges are labeled:
 * - BASE (red): The bottom edge, parallel to grid on initial placement
 * - RIGHT (blue): The right edge going up from base
 * - LEFT (gray): The left edge going up from base
 */
export const getLocalEdgeSockets = (type: BuildingType): LocalEdgeSocket[] => {
  const edges: LocalEdgeSocket[] = [];
  const halfSize = UNIT_SIZE / 2;

  if (type === BuildingType.SQUARE_FOUNDATION) {
    // Four edges - all are equivalent (SIDE role)
    // +Z edge (North)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, halfSize),
      new THREE.Vector3(halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));
    // +X edge (East)
    edges.push(createEdge(
      new THREE.Vector3(halfSize, 0, halfSize),
      new THREE.Vector3(halfSize, 0, -halfSize),
      EdgeRole.SIDE
    ));
    // -Z edge (South)
    edges.push(createEdge(
      new THREE.Vector3(halfSize, 0, -halfSize),
      new THREE.Vector3(-halfSize, 0, -halfSize),
      EdgeRole.SIDE
    ));
    // -X edge (West)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, -halfSize),
      new THREE.Vector3(-halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));
  }

  else if (type === BuildingType.TRIANGLE_FOUNDATION) {
    // Triangle with FLAT BASE at +Z (bottom of screen), apex at -Z (top of screen)
    //
    // In 2D mode with camera looking down:
    // - +Z is BOTTOM of screen (where red North arrow points)
    // - -Z is TOP of screen
    // - The triangle "sits" on the grid with flat base at bottom
    //
    // Vertices (with center at origin):
    // - vApex:  (0, 0, -TRIANGLE_RADIUS)           = apex at -Z (top of screen)
    // - vLeft:  (-UNIT_SIZE/2, 0, +TRIANGLE_APOTHEM) = base left corner (+Z, bottom-left)
    // - vRight: (+UNIT_SIZE/2, 0, +TRIANGLE_APOTHEM) = base right corner (+Z, bottom-right)

    const apexZ = -TRIANGLE_RADIUS;   // -2.31 = top of screen
    const baseZ = TRIANGLE_APOTHEM;   // +1.15 = bottom of screen (where base sits)

    // Vertices
    const vApex = new THREE.Vector3(0, 0, apexZ);                    // Apex (top of screen)
    const vLeft = new THREE.Vector3(-halfSize, 0, baseZ);            // Base left (bottom-left)
    const vRight = new THREE.Vector3(halfSize, 0, baseZ);            // Base right (bottom-right)

    // BASE edge (red): flat bottom, from left to right (parallel to X axis)
    edges.push(createEdge(vLeft, vRight, EdgeRole.BASE));

    // RIGHT edge (blue): from base-right up to apex
    edges.push(createEdge(vRight, vApex, EdgeRole.RIGHT));

    // LEFT edge (gray): from apex down to base-left
    edges.push(createEdge(vApex, vLeft, EdgeRole.LEFT));
  }

  else if (type === BuildingType.TRIANGLE_FOUNDATION_2) {
    // Same geometry as Triangle 1, but uniform edge roles (SIDE)
    const halfSize = UNIT_SIZE / 2;
    const apexZ = -TRIANGLE_RADIUS;
    const baseZ = TRIANGLE_APOTHEM;

    const vApex = new THREE.Vector3(0, 0, apexZ);
    const vLeft = new THREE.Vector3(-halfSize, 0, baseZ);
    const vRight = new THREE.Vector3(halfSize, 0, baseZ);

    // BASE edge: Left to Right
    edges.push(createEdge(vLeft, vRight, EdgeRole.SIDE));

    // RIGHT edge: Right to Apex
    edges.push(createEdge(vRight, vApex, EdgeRole.SIDE));

    // LEFT edge: Apex to Left
    edges.push(createEdge(vApex, vLeft, EdgeRole.SIDE));
  }

  else if (type === BuildingType.CURVED_FOUNDATION) {
    // Only the two STRAIGHT edges have sockets (curved arc has NONE)
    // The geometry has corner at (-halfSize, 0, +halfSize), with:
    // - Bottom edge at Z=+halfSize from corner to (+halfSize, 0, +halfSize)
    // - Left edge at X=-halfSize from corner to (-halfSize, 0, -halfSize)
    // The curved arc connects (+halfSize, 0, +halfSize) to (-halfSize, 0, -halfSize)

    // Bottom edge (at Z=+halfSize): from left corner to right
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, halfSize),
      new THREE.Vector3(halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));
    // Left edge (at X=-halfSize): from top to bottom corner (CCW winding)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, -halfSize),
      new THREE.Vector3(-halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));
  }

  // ===================
  // STRUCTURES (Raised platform foundations - edge sockets at y=0)
  // ===================

  else if (type === BuildingType.SQUARE_STRUCTURE) {
    // Same edge layout as SQUARE_FOUNDATION (at y=0 for ground-level snapping)
    // +Z edge (North)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, halfSize),
      new THREE.Vector3(halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));
    // +X edge (East)
    edges.push(createEdge(
      new THREE.Vector3(halfSize, 0, halfSize),
      new THREE.Vector3(halfSize, 0, -halfSize),
      EdgeRole.SIDE
    ));
    // -Z edge (South)
    edges.push(createEdge(
      new THREE.Vector3(halfSize, 0, -halfSize),
      new THREE.Vector3(-halfSize, 0, -halfSize),
      EdgeRole.SIDE
    ));
    // -X edge (West)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, -halfSize),
      new THREE.Vector3(-halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));
  }

  else if (type === BuildingType.TRIANGLE_STRUCTURE) {
    // Same edge layout as TRIANGLE_FOUNDATION (at y=0)
    const apexZ = -TRIANGLE_RADIUS;
    const baseZ = TRIANGLE_APOTHEM;

    const vApex = new THREE.Vector3(0, 0, apexZ);
    const vLeft = new THREE.Vector3(-halfSize, 0, baseZ);
    const vRight = new THREE.Vector3(halfSize, 0, baseZ);

    edges.push(createEdge(vLeft, vRight, EdgeRole.BASE));
    edges.push(createEdge(vRight, vApex, EdgeRole.RIGHT));
    edges.push(createEdge(vApex, vLeft, EdgeRole.LEFT));
  }

  else if (type === BuildingType.CURVED_STRUCTURE) {
    // Same edge layout as CURVED_FOUNDATION (at y=0, straight edges only)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, halfSize),
      new THREE.Vector3(halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, -halfSize),
      new THREE.Vector3(-halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));
  }

  else if (type === BuildingType.WALL || type === BuildingType.WINDOW_WALL || type === BuildingType.DOORWAY || type === BuildingType.HALF_WALL) {
    // Wall Top Edges (Bidirectional at center)
    // Allows snapping to both sides of the wall top
    const h = (type === BuildingType.HALF_WALL) ? HALF_WALL_HEIGHT : WALL_HEIGHT;

    // Left-to-Right Edge
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, h, 0),
      new THREE.Vector3(halfSize, h, 0),
      EdgeRole.SIDE
    ));
    // Right-to-Left Edge (allows reverse orientation snap)
    edges.push(createEdge(
      new THREE.Vector3(halfSize, h, 0),
      new THREE.Vector3(-halfSize, h, 0),
      EdgeRole.SIDE
    ));
  }

  else if (type === BuildingType.RAMP || type === BuildingType.STAIRS) {
    // Ramps/Stairs have two main edges for connection:
    // 1. Low Edge (Bottom) - connects to Foundation Edges or Wall Top Edges
    // 2. High Edge (Top) - connects to Wall Top Edges or upper floors

    // Geometry parameters based on getRampParams logic
    // Low End is at +Z (z = halfSize)
    // High End is at -Z (z = -halfSize), and raised by WALL_HEIGHT (y = WALL_HEIGHT)

    // Low Edge (at y=0, z=halfSize)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, halfSize),
      new THREE.Vector3(halfSize, 0, halfSize),
      EdgeRole.SIDE
    ));

    // High Edge (at y=WALL_HEIGHT, z=-halfSize)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, WALL_HEIGHT, -halfSize),
      new THREE.Vector3(halfSize, WALL_HEIGHT, -halfSize),
      EdgeRole.SIDE
    ));
  }

  return edges;
};

/**
 * Transform local edge sockets to world space.
 * Includes start, center, and end points for 3-point alignment validation.
 */
export const getWorldEdgeSockets = (building: BuildingData): EdgeSocket[] => {
  if (!building) return [];
  const localEdges = getLocalEdgeSockets(building.type);
  const worldEdges: EdgeSocket[] = [];

  const rotEuler = new THREE.Euler(building.rotation[0], building.rotation[1], building.rotation[2]);
  const pos = new THREE.Vector3(building.position[0], building.position[1], building.position[2]);

  localEdges.forEach(edge => {
    const wStart = edge.start.clone().applyEuler(rotEuler).add(pos);
    const wCenter = edge.center.clone().applyEuler(rotEuler).add(pos);
    const wEnd = edge.end.clone().applyEuler(rotEuler).add(pos);
    worldEdges.push({
      start: wStart,
      center: wCenter,
      end: wEnd,
      id: building.id,
      socketType: edge.socketType,
      edgeLength: edge.edgeLength,
      edgeRole: edge.edgeRole
    });
  });

  return worldEdges;
};

import { getBuildingDef } from '../data/BuildingRegistry';

/**
 * Check if a building type uses edge sockets (foundations) vs point sockets (walls/roofs)
 */
export const usesEdgeSockets = (type: BuildingType): boolean => {
  return getBuildingDef(type).usesEdgeSockets;
};

/**
 * Calculate the transform needed to align a ghost edge to a target edge.
 * Returns the position and rotation that would make the ghost edge coincide with the target.
 *
 * For two edges to connect (THREE-POINT VALIDATION):
 * - Ghost edge's START must align with target edge's END
 * - Ghost edge's CENTER must align with target edge's CENTER
 * - Ghost edge's END must align with target edge's START
 * ALL THREE points must align for a valid snap!
 * (They connect in opposite directions, like puzzle pieces)
 */
const calculateEdgeSnapTransform = (
  targetEdge: EdgeSocket,
  ghostEdge: LocalEdgeSocket
): { position: THREE.Vector3; rotation: THREE.Euler } | null => {
  // Target edge direction (world space)
  const targetDir = targetEdge.end.clone().sub(targetEdge.start).normalize();

  // Ghost edge direction (local space) - we want it to face OPPOSITE to connect
  const ghostDir = ghostEdge.end.clone().sub(ghostEdge.start).normalize();

  // Calculate rotation needed to align ghost edge opposite to target edge
  // Ghost should point in -targetDir direction for edges to meet flush
  const desiredGhostDir = targetDir.clone().negate();

  // Calculate Y rotation from ghostDir to desiredGhostDir
  const ghostAngle = Math.atan2(ghostDir.x, ghostDir.z);
  const targetAngle = Math.atan2(desiredGhostDir.x, desiredGhostDir.z);
  const rotY = targetAngle - ghostAngle;

  const rotation = new THREE.Euler(0, rotY, 0);

  // After rotation, calculate where the ghost piece center needs to be
  // so that ghost's START aligns with target's END
  const rotatedGhostStart = ghostEdge.start.clone().applyEuler(rotation);

  // Position = targetEnd - rotatedGhostStart
  const position = targetEdge.end.clone().sub(rotatedGhostStart);

  // THREE-POINT VALIDATION: All three points must align
  const rotatedGhostCenter = ghostEdge.center.clone().applyEuler(rotation).add(position);
  const rotatedGhostEnd = ghostEdge.end.clone().applyEuler(rotation).add(position);

  const startError = rotatedGhostStart.clone().add(position).distanceTo(targetEdge.end);
  const centerError = rotatedGhostCenter.distanceTo(targetEdge.center);
  const endError = rotatedGhostEnd.distanceTo(targetEdge.start);

  // All three points must be within tolerance
  const tolerance = 0.05; // Slightly relaxed for floating point
  if (startError > tolerance || centerError > tolerance || endError > tolerance) {
    return null; // Edges don't align properly - prevents wrong corner-to-corner matching
  }

  return { position, rotation };
};

/**
 * Get the socket types that the active building type can snap to
 */
export const getCompatibleSocketTypes = (activeType: BuildingType): SocketType[] => {
  return getBuildingDef(activeType).compatibleWith;
};

/**
 * Enhanced snapping logic using EDGE SEGMENTS for foundations.
 *
 * For foundations: Uses edge-to-edge matching (two points per edge).
 * This eliminates rotational ambiguity - there's only ONE way to align two edges.
 *
 * For walls/roofs: Still uses point-based sockets (legacy system).
 *
 * Returns socketWorldY for height auto-snapping (null for grid fallback).
 */
export const calculateSnap = (
  rayIntersectionPoint: THREE.Vector3,
  buildings: BuildingData[],
  activeType: BuildingType,
  currentRotationY: number,
  debugCallback?: (debugInfo: any) => void
): { position: THREE.Vector3, rotation: THREE.Euler, isValid: boolean, socketWorldY: number | null } => {
  if (!rayIntersectionPoint) {
    return { position: new THREE.Vector3(), rotation: new THREE.Euler(), isValid: false, socketWorldY: null };
  }

  let finalPos = new THREE.Vector3(rayIntersectionPoint.x, 0, rayIntersectionPoint.z);
  let finalRot = new THREE.Euler(0, currentRotationY, 0);
  let snappedToSocket = false;
  let socketWorldY: number | null = null;

  const debugCandidates: any[] = [];
  const SNAP_RADIUS = 3.5; // Slightly larger to catch edges

  const isWallLike =
    activeType === BuildingType.WALL ||
    activeType === BuildingType.HALF_WALL ||
    activeType === BuildingType.WINDOW_WALL ||
    activeType === BuildingType.DOORWAY;

  // ==========================================================================
  // FOUNDATION SNAPPING - Edge-based system
  // ==========================================================================
  if (usesEdgeSockets(activeType) && !isWallLike) {
    // Collect all world edge sockets from existing foundations
    const allEdges: EdgeSocket[] = [];
    buildings.forEach(b => {
      if (usesEdgeSockets(b.type)) {
        allEdges.push(...getWorldEdgeSockets(b));
      }
    });

    // Get ghost piece's local edge sockets
    const ghostEdges = getLocalEdgeSockets(activeType);

    interface EdgeSnapCandidate {
      position: THREE.Vector3;
      rotation: THREE.Euler;
      distToCursor: number;
      targetEdge: EdgeSocket;
      ghostEdge: LocalEdgeSocket;
    }

    let bestCandidate: EdgeSnapCandidate | null = null;

    for (const targetEdge of allEdges) {
      // Check if edge midpoint is within snap radius
      const edgeMidpoint = targetEdge.start.clone().add(targetEdge.end).multiplyScalar(0.5);
      const distToEdge = edgeMidpoint.distanceTo(rayIntersectionPoint);
      if (distToEdge > SNAP_RADIUS) continue;

      // Check if this edge is already occupied
      let isOccupied = false;
      for (const building of buildings) {
        if (building.id === targetEdge.id) continue;

        // Check if any other building's edges overlap with this target edge
        const otherEdges = getWorldEdgeSockets(building);
        for (const otherEdge of otherEdges) {
          const otherMidpoint = otherEdge.start.clone().add(otherEdge.end).multiplyScalar(0.5);
          if (edgeMidpoint.distanceTo(otherMidpoint) < 0.5) {
            isOccupied = true;
            break;
          }
        }
        if (isOccupied) break;
      }
      if (isOccupied) continue;

      // Try to snap each ghost edge to this target edge
      for (const ghostEdge of ghostEdges) {
        // Only snap edges of same length
        if (Math.abs(ghostEdge.edgeLength - targetEdge.edgeLength) > 0.01) continue;

        const transform = calculateEdgeSnapTransform(targetEdge, ghostEdge);
        if (!transform) continue;

        // Score by distance from cursor to resulting piece center
        const distToCursor = transform.position.distanceTo(rayIntersectionPoint);

        debugCandidates.push({
          targetEdgeStart: [targetEdge.start.x, targetEdge.start.y, targetEdge.start.z],
          targetEdgeEnd: [targetEdge.end.x, targetEdge.end.y, targetEdge.end.z],
          ghostEdgeStart: [ghostEdge.start.x, ghostEdge.start.y, ghostEdge.start.z],
          ghostEdgeEnd: [ghostEdge.end.x, ghostEdge.end.y, ghostEdge.end.z],
          resultingPosition: [transform.position.x, transform.position.y, transform.position.z],
          resultingRotation: [transform.rotation.x, transform.rotation.y, transform.rotation.z],
          distanceToCursor: distToCursor,
        });

        if (!bestCandidate || distToCursor < bestCandidate.distToCursor) {
          bestCandidate = {
            position: transform.position,
            rotation: transform.rotation,
            distToCursor,
            targetEdge,
            ghostEdge,
          };
        }
      }
    }

    if (bestCandidate) {
      finalPos = bestCandidate.position;
      finalRot = bestCandidate.rotation;
      snappedToSocket = true;
      // For edge snapping, use the edge center's Y as the socket height
      socketWorldY = bestCandidate.targetEdge.center.y;
    }
  }

  // ==========================================================================
  // WALL/ROOF/FOUNDATION FALLBACK - Point-based system
  // ==========================================================================
  // If we haven't snapped yet (e.g. Foundation didn't find an edge), try point snapping
  if (!snappedToSocket) {
    const allSockets: Socket[] = [];
    buildings.forEach(b => {
      allSockets.push(...getWorldSockets(b));
    });

    const compatibleTypes = getCompatibleSocketTypes(activeType);
    const compatibleSockets = allSockets.filter(s => compatibleTypes.includes(s.socketType));
    const ghostLocals = getLocalSockets(activeType);

    interface PointSnapCandidate {
      position: THREE.Vector3;
      rotation: THREE.Euler;
      distToCursor: number;
      score: number;
      targetSocketY: number;
    }

    let bestCandidate: PointSnapCandidate | null = null;

    for (const targetSocket of compatibleSockets) {
      const distToSocket = targetSocket.position.distanceTo(rayIntersectionPoint);
      if (distToSocket > SNAP_RADIUS) continue;

      const targetCompatible = SOCKET_COMPATIBILITY[targetSocket.socketType] || [];
      const matchingGhostSockets = ghostLocals.filter(gs => targetCompatible.includes(gs.socketType));

      if (matchingGhostSockets.length === 0) continue;

      for (const gSocket of matchingGhostSockets) {
        const isWallStack =
          targetSocket.socketType === SocketType.WALL_TOP &&
          gSocket.socketType === SocketType.WALL_BOTTOM;
        let rotY: number;
        if (isWallStack) {
          // Align stacked walls to the existing wall's facing direction.
          const targetNormal = targetSocket.normal.clone();
          const targetAngle = Math.atan2(targetNormal.x, targetNormal.z);
          const localAngle = Math.atan2(gSocket.normal.x, gSocket.normal.z);
          rotY = targetAngle - localAngle;
        } else {
          const shouldAlignOutward =
            targetSocket.socketType === SocketType.FOUNDATION_TOP &&
            gSocket.socketType === SocketType.WALL_BOTTOM;
          // Align wall outward on foundation edges; keep opposite-facing for other snaps.
          const targetNormal = shouldAlignOutward
            ? targetSocket.normal.clone()
            : targetSocket.normal.clone().negate();
          const targetAngle = Math.atan2(targetNormal.x, targetNormal.z);
          const localAngle = Math.atan2(gSocket.normal.x, gSocket.normal.z);
          rotY = targetAngle - localAngle;
        }

        const candidateRot = new THREE.Euler(0, rotY, 0);
        const rotatedLocalPos = gSocket.position.clone().applyEuler(candidateRot);
        const candidatePos = targetSocket.position.clone().sub(rotatedLocalPos);
        const distToCursor = candidatePos.distanceTo(rayIntersectionPoint);

        // Preference for rotation matching the current manual rotation (allows 'R' to cycle options)
        // If rotations are different, add a small penalty to distance score.
        // This makes the "closest" socket that matches the user's desired rotation win.
        let rotationPenalty = 0;

        // Normalize angles to 0..2PI
        const normCandidateRot = (candidateRot.y % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const normCurrentRot = (currentRotationY % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);

        const rotDiff = Math.abs(normCandidateRot - normCurrentRot);
        // Small tolerance for float comparison, treat 2PI as 0
        const isMatch = rotDiff < 0.1 || Math.abs(rotDiff - 2 * Math.PI) < 0.1;

        if (!isWallStack && !isMatch) {
          rotationPenalty = 0.5; // Penalty equivalent to 0.5 units of distance
        }

        let score = distToCursor + rotationPenalty;
        if (isWallLike && rayIntersectionPoint.y > 0.25 && targetSocket.socketType === SocketType.WALL_TOP) {
          score -= 1.0; // Prefer stacking when the cursor is above ground.
        }

        if (!bestCandidate || score < bestCandidate.score) {
          bestCandidate = {
            position: candidatePos,
            rotation: candidateRot,
            distToCursor,
            score,
            targetSocketY: targetSocket.position.y,
          };
        }
      }
    }

    if (bestCandidate) {
      finalPos = bestCandidate.position;
      finalRot = bestCandidate.rotation;
      snappedToSocket = true;
      socketWorldY = bestCandidate.targetSocketY;
    }
  }

  // ==========================================================================
  // GRID FALLBACK - When no snap target found
  // ==========================================================================
  if (!snappedToSocket) {
    const gridSnap = UNIT_SIZE;
    const offset = gridSnap / 2;
    finalPos.x = Math.round((rayIntersectionPoint.x - offset) / gridSnap) * gridSnap + offset;
    finalPos.z = Math.round((rayIntersectionPoint.z - offset) / gridSnap) * gridSnap + offset;
    finalPos.y = 0;

    // Use rotation increment from registry
    const rotSnap = getBuildingDef(activeType).rotationIncrement;
    const snappedRot = Math.round(currentRotationY / rotSnap) * rotSnap;
    finalRot = new THREE.Euler(0, snappedRot, 0);
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================
  const isFoundationLike = getBuildingDef(activeType).category === 'foundation';
  let isValid = true;

  // Global collision check (even if snapped)
  // Prevent foundations from overlapping other foundations
  if (usesEdgeSockets(activeType) && isFoundationLike) {
    for (const b of buildings) {
      // Only check against other foundation-like pieces
      if (!usesEdgeSockets(b.type) || getBuildingDef(b.type).category !== 'foundation') continue;

      const bPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
      const dist = bPos.distanceTo(finalPos);

      // If distance is too small, they are overlapping
      // Unit size is 4. Standard adjacent distance is 4.
      // Diagonal adjacent is sqrt(32) ~ 5.6
      // Overlapping is dist ~ 0.
      // We use 2.0 as a safe threshold (half a unit).
      if (dist < 2.0) {
        isValid = false;
        break;
      }
    }
  }

  // Legacy distance check for non-snapped items (prevents placing inside others when free-placing)
  if (!snappedToSocket && isValid) {
    const isFoundation = usesEdgeSockets(activeType);

    for (const b of buildings) {
      const bPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
      const dist = bPos.distanceTo(finalPos);

    if (isFoundation && usesEdgeSockets(b.type) && getBuildingDef(b.type).category === 'foundation') {
      if (dist < 2.0) {
        isValid = false;
        break;
      }
      } else if (dist < 0.2) {
        isValid = false;
        break;
      }
    }
  }

  // Roofs require snapping (use category from registry)
  if (!snappedToSocket && getBuildingDef(activeType).category === 'roof') {
    isValid = false;
  }

  // Prevent exact overlap for non-foundation stacking and snapped placements.
  if (isValid) {
    for (const b of buildings) {
      const bPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
      const dist = bPos.distanceTo(finalPos);
      if (dist < 0.2) {
        isValid = false;
        break;
      }
    }
  }

  // Debug callback
  if (debugCallback) {
    debugCallback({
      rayPoint: [rayIntersectionPoint.x, rayIntersectionPoint.y, rayIntersectionPoint.z],
      candidates: debugCandidates,
      finalPosition: [finalPos.x, finalPos.y, finalPos.z],
      finalRotation: [finalRot.x, finalRot.y, finalRot.z],
      isValid,
      snappedToSocket,
      socketWorldY,
    });
  }

  return { position: finalPos, rotation: finalRot, isValid, socketWorldY };
};
