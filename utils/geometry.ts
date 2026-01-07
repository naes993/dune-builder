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

    const edgeAngles = [
      (5 * Math.PI) / 6,  // 150° - upper-left edge
      (3 * Math.PI) / 2,  // 270° - bottom edge (points down toward -Z)
      Math.PI / 6,        // 30°  - upper-right edge
    ];

    for (const angle of edgeAngles) {
      // Normal vector pointing outward from edge
      const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));

      // Edge midpoint position at TRIANGLE_APOTHEM distance from center
      const position = normal.clone().multiplyScalar(TRIANGLE_APOTHEM);

      // Foundation edge socket (for connecting to other foundations)
      sockets.push({
        position: position.clone(),
        normal: normal.clone(),
        socketType: SocketType.FOUNDATION_EDGE
      });

      // Foundation top socket (for walls to snap onto)
      sockets.push({
        position: new THREE.Vector3(position.x, FOUNDATION_HEIGHT, position.z),
        normal: normal.clone(),
        socketType: SocketType.FOUNDATION_TOP
      });
    }
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
    // Triangle with BASE at -Z (south), pointing up toward +Z
    // This means:
    // - BASE edge is horizontal at the bottom (parallel to X axis)
    // - Apex vertex is at +Z (north)
    //
    // Vertices:
    // - V_apex: top vertex at (0, 0, +TRIANGLE_APOTHEM) - actually at +Z
    // - V_left: bottom-left at (-halfSize, 0, -TRIANGLE_APOTHEM)
    // - V_right: bottom-right at (+halfSize, 0, -TRIANGLE_APOTHEM)
    //
    // Wait, let me recalculate for equilateral triangle with side = UNIT_SIZE
    // Height of equilateral triangle = side * sqrt(3)/2 = 4 * sqrt(3)/2 = 2*sqrt(3) ≈ 3.46
    //
    // For center at origin:
    // - Base edge at z = -TRIANGLE_APOTHEM (distance from center to edge midpoint)
    // - Apex at z = +TRIANGLE_RADIUS (distance from center to vertex)

    const apexZ = TRIANGLE_RADIUS;  // ~2.31 (center to vertex)
    const baseZ = -TRIANGLE_APOTHEM; // ~-1.15 (center to edge midpoint, negative = south)

    // Vertices
    const vApex = new THREE.Vector3(0, 0, apexZ);                    // Top (north)
    const vLeft = new THREE.Vector3(-halfSize, 0, baseZ);            // Bottom-left
    const vRight = new THREE.Vector3(halfSize, 0, baseZ);            // Bottom-right

    // BASE edge (red): bottom, from left to right (parallel to X axis)
    edges.push(createEdge(vLeft, vRight, EdgeRole.BASE));

    // RIGHT edge (blue): from bottom-right up to apex
    edges.push(createEdge(vRight, vApex, EdgeRole.RIGHT));

    // LEFT edge (gray): from apex down to bottom-left
    edges.push(createEdge(vApex, vLeft, EdgeRole.LEFT));
  }

  else if (type === BuildingType.CURVED_FOUNDATION) {
    // Only the two straight edges have sockets (no curved edge)
    // -Z edge (South)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, -halfSize),
      new THREE.Vector3(halfSize, 0, -halfSize),
      EdgeRole.SIDE
    ));
    // -X edge (West)
    edges.push(createEdge(
      new THREE.Vector3(-halfSize, 0, halfSize),
      new THREE.Vector3(-halfSize, 0, -halfSize),
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

/**
 * Check if a building type uses edge sockets (foundations) vs point sockets (walls/roofs)
 */
const usesEdgeSockets = (type: BuildingType): boolean => {
  return [
    BuildingType.SQUARE_FOUNDATION,
    BuildingType.TRIANGLE_FOUNDATION,
    BuildingType.CURVED_FOUNDATION
  ].includes(type);
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
const getCompatibleSocketTypes = (activeType: BuildingType): SocketType[] => {
  // Determine what socket types this piece provides
  const isFoundation = [
    BuildingType.SQUARE_FOUNDATION,
    BuildingType.TRIANGLE_FOUNDATION,
    BuildingType.CURVED_FOUNDATION
  ].includes(activeType);
  
  const isWall = [
    BuildingType.WALL,
    BuildingType.HALF_WALL,
    BuildingType.WINDOW_WALL,
    BuildingType.DOORWAY
  ].includes(activeType);
  
  const isRoof = [
    BuildingType.SQUARE_ROOF,
    BuildingType.TRIANGLE_ROOF
  ].includes(activeType);
  
  const isIncline = [
    BuildingType.STAIRS,
    BuildingType.RAMP
  ].includes(activeType);

  if (isFoundation) {
    return [SocketType.FOUNDATION_EDGE];
  } else if (isWall) {
    return [SocketType.FOUNDATION_TOP, SocketType.WALL_TOP, SocketType.WALL_SIDE];
  } else if (isRoof) {
    return [SocketType.WALL_TOP, SocketType.ROOF_EDGE];
  } else if (isIncline) {
    return [SocketType.FOUNDATION_TOP, SocketType.FOUNDATION_EDGE];
  }
  
  return [];
};

/**
 * Enhanced snapping logic using EDGE SEGMENTS for foundations.
 *
 * For foundations: Uses edge-to-edge matching (two points per edge).
 * This eliminates rotational ambiguity - there's only ONE way to align two edges.
 *
 * For walls/roofs: Still uses point-based sockets (legacy system).
 */
export const calculateSnap = (
  rayIntersectionPoint: THREE.Vector3,
  buildings: BuildingData[],
  activeType: BuildingType,
  currentRotationY: number,
  debugCallback?: (debugInfo: any) => void
): { position: THREE.Vector3, rotation: THREE.Euler, isValid: boolean } => {
  if (!rayIntersectionPoint) {
    return { position: new THREE.Vector3(), rotation: new THREE.Euler(), isValid: false };
  }

  let finalPos = new THREE.Vector3(rayIntersectionPoint.x, 0, rayIntersectionPoint.z);
  let finalRot = new THREE.Euler(0, currentRotationY, 0);
  let snappedToSocket = false;

  const debugCandidates: any[] = [];
  const SNAP_RADIUS = 3.5; // Slightly larger to catch edges

  // ==========================================================================
  // FOUNDATION SNAPPING - Edge-based system
  // ==========================================================================
  if (usesEdgeSockets(activeType)) {
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
    }
  }

  // ==========================================================================
  // WALL/ROOF SNAPPING - Point-based system (legacy)
  // ==========================================================================
  else {
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
    }

    let bestCandidate: PointSnapCandidate | null = null;

    for (const targetSocket of compatibleSockets) {
      const distToSocket = targetSocket.position.distanceTo(rayIntersectionPoint);
      if (distToSocket > SNAP_RADIUS) continue;

      const targetCompatible = SOCKET_COMPATIBILITY[targetSocket.socketType] || [];
      const matchingGhostSockets = ghostLocals.filter(gs => targetCompatible.includes(gs.socketType));

      if (matchingGhostSockets.length === 0) continue;

      const targetNormal = targetSocket.normal.clone().negate();
      const targetAngle = Math.atan2(targetNormal.x, targetNormal.z);

      for (const gSocket of matchingGhostSockets) {
        const localAngle = Math.atan2(gSocket.normal.x, gSocket.normal.z);
        const rotY = targetAngle - localAngle;

        const candidateRot = new THREE.Euler(0, rotY, 0);
        const rotatedLocalPos = gSocket.position.clone().applyEuler(candidateRot);
        const candidatePos = targetSocket.position.clone().sub(rotatedLocalPos);
        const distToCursor = candidatePos.distanceTo(rayIntersectionPoint);

        if (!bestCandidate || distToCursor < bestCandidate.distToCursor) {
          bestCandidate = {
            position: candidatePos,
            rotation: candidateRot,
            distToCursor,
          };
        }
      }
    }

    if (bestCandidate) {
      finalPos = bestCandidate.position;
      finalRot = bestCandidate.rotation;
      snappedToSocket = true;
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

    // Snap rotation: 60° for triangles, 90° for everything else
    const isTriangle = activeType === BuildingType.TRIANGLE_FOUNDATION ||
                      activeType === BuildingType.TRIANGLE_ROOF;
    const rotSnap = isTriangle ? Math.PI / 3 : Math.PI / 2;
    const snappedRot = Math.round(currentRotationY / rotSnap) * rotSnap;
    finalRot = new THREE.Euler(0, snappedRot, 0);
  }

  // ==========================================================================
  // VALIDATION
  // ==========================================================================
  let isValid = true;

  if (!snappedToSocket) {
    const isFoundation = usesEdgeSockets(activeType);

    for (const b of buildings) {
      const bPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
      const dist = bPos.distanceTo(finalPos);

      if (isFoundation && usesEdgeSockets(b.type)) {
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

  // Roofs require snapping
  if (!snappedToSocket) {
    if (activeType === BuildingType.SQUARE_ROOF || activeType === BuildingType.TRIANGLE_ROOF) {
      isValid = false;
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
    });
  }

  return { position: finalPos, rotation: finalRot, isValid };
};
