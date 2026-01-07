import * as THREE from 'three';
import {
  BuildingType,
  BuildingData,
  Socket,
  SocketType,
  SOCKET_COMPATIBILITY,
  UNIT_SIZE,
  TRIANGLE_APOTHEM,
  WALL_HEIGHT,
  HALF_WALL_HEIGHT,
  FOUNDATION_HEIGHT,
} from '../types';

interface LocalSocket {
  position: THREE.Vector3;
  normal: THREE.Vector3;
  socketType: SocketType;
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
    // Looking at the actual rendered mesh from a top-down view, the triangle has:
    //   - One vertex pointing UP (toward +Z in screen space)
    //   - Two vertices at the bottom corners
    //
    // The three edge sockets need outward-pointing normals (perpendicular to edge, away from center):
    //   - Upper-left edge: normal points NW (135°)
    //   - Lower-left edge: normal points SW (225°)
    //   - Lower-right edge: normal points SE (315°)

    const edgeAngles = [
      (3 * Math.PI) / 4,  // 135° - upper-left edge, normal points NW (-X, +Z)
      (5 * Math.PI) / 4,  // 225° - lower-left edge, normal points SW (-X, -Z)
      (7 * Math.PI) / 4,  // 315° - lower-right edge, normal points SE (+X, -Z)
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
 * Enhanced snapping logic with socket type compatibility.
 * Uses a two-phase approach to avoid flickering:
 * 1. Find all possible snap configurations (target socket + ghost socket pairs)
 * 2. Pick the one whose resulting position is closest to cursor
 * 3. Check for socket occupancy to prevent ghost pieces
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

  // Collect all world sockets from existing buildings
  const allSockets: Socket[] = [];
  buildings.forEach(b => {
    allSockets.push(...getWorldSockets(b));
  });

  // Filter to only compatible socket types
  const compatibleTypes = getCompatibleSocketTypes(activeType);
  const compatibleSockets = allSockets.filter(s => compatibleTypes.includes(s.socketType));

  // Get ghost piece's local sockets
  const ghostLocals = getLocalSockets(activeType);

  let finalPos = new THREE.Vector3(rayIntersectionPoint.x, 0, rayIntersectionPoint.z);
  let finalRot = new THREE.Euler(0, currentRotationY, 0);
  let snappedToSocket = false;

  // Find the best snap configuration by evaluating all valid socket pairs
  // This avoids flickering by always choosing the configuration with the
  // resulting position closest to the cursor
  interface SnapCandidate {
    position: THREE.Vector3;
    rotation: THREE.Euler;
    distToCursor: number;
    targetSocket: Socket;
    ghostSocket: LocalSocket;
  }

  let bestCandidate: SnapCandidate | null = null;
  const SNAP_RADIUS = 2.5;
  const SOCKET_OCCUPIED_THRESHOLD = 0.1; // If another building is this close to a socket, it's occupied

  // Debug tracking
  const debugCandidates: any[] = [];

  for (const targetSocket of compatibleSockets) {
    // Only consider sockets within snap radius of cursor
    const distToSocket = targetSocket.position.distanceTo(rayIntersectionPoint);
    if (distToSocket > SNAP_RADIUS) continue;

    // Check if this socket is already occupied by another building
    // A socket is occupied if there's another building very close to it (not the parent building)
    let isOccupied = false;
    for (const building of buildings) {
      if (building.id === targetSocket.id) continue; // Skip the parent building
      const buildingPos = new THREE.Vector3(building.position[0], building.position[1], building.position[2]);

      // Check distance in XZ plane (ignore Y for vertical stacking)
      const socketPosXZ = new THREE.Vector2(targetSocket.position.x, targetSocket.position.z);
      const buildingPosXZ = new THREE.Vector2(buildingPos.x, buildingPos.z);

      if (socketPosXZ.distanceTo(buildingPosXZ) < SOCKET_OCCUPIED_THRESHOLD) {
        isOccupied = true;
        break;
      }
    }

    if (isOccupied) continue; // Skip occupied sockets

    // Find compatible ghost sockets
    const targetCompatible = SOCKET_COMPATIBILITY[targetSocket.socketType] || [];
    const matchingGhostSockets = ghostLocals.filter(gs => targetCompatible.includes(gs.socketType));

    if (matchingGhostSockets.length === 0) continue;

    // Evaluate each ghost socket as a potential snap candidate
    // Calculate the actual rotation needed and pick the best option by distance to cursor
    const targetNormal = targetSocket.normal.clone().negate();
    const targetAngle = Math.atan2(targetNormal.x, targetNormal.z);

    for (const gSocket of matchingGhostSockets) {
      // Calculate rotation needed to align this ghost socket with target
      const localAngle = Math.atan2(gSocket.normal.x, gSocket.normal.z);
      const rotY = targetAngle - localAngle;

      const candidateRot = new THREE.Euler(0, rotY, 0);
      const rotatedLocalPos = gSocket.position.clone().applyEuler(candidateRot);
      const candidatePos = targetSocket.position.clone().sub(rotatedLocalPos);

      // Score by distance from cursor to resulting piece center
      const distToCursor = candidatePos.distanceTo(rayIntersectionPoint);

      // Track this candidate for debugging
      debugCandidates.push({
        targetSocketType: targetSocket.socketType,
        targetSocketPos: [targetSocket.position.x, targetSocket.position.y, targetSocket.position.z],
        targetSocketNormal: [targetSocket.normal.x, targetSocket.normal.y, targetSocket.normal.z],
        ghostSocketType: gSocket.socketType,
        ghostSocketPos: [gSocket.position.x, gSocket.position.y, gSocket.position.z],
        ghostSocketNormal: [gSocket.normal.x, gSocket.normal.y, gSocket.normal.z],
        resultingPosition: [candidatePos.x, candidatePos.y, candidatePos.z],
        resultingRotation: [candidateRot.x, candidateRot.y, candidateRot.z],
        distanceToCursor: distToCursor,
        wasOccupied: false,
      });

      if (!bestCandidate || distToCursor < bestCandidate.distToCursor) {
        bestCandidate = {
          position: candidatePos,
          rotation: candidateRot,
          distToCursor,
          targetSocket,
          ghostSocket: gSocket,
        };
      }
    }
  }

  if (bestCandidate) {
    finalPos = bestCandidate.position;
    finalRot = bestCandidate.rotation;
    snappedToSocket = true;
  } else {
    // Grid snapping when not near any socket
    // Offset by half grid so pieces align at grid lines (not centered on intersections)
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

  // Overlap detection - check if new piece would overlap existing pieces
  // Skip overlap detection if we successfully snapped to a socket (trusted placement)
  let isValid = true;

  if (!snappedToSocket) {
    const isFoundation = [
      BuildingType.SQUARE_FOUNDATION,
      BuildingType.TRIANGLE_FOUNDATION,
      BuildingType.CURVED_FOUNDATION
    ].includes(activeType);

    for (const b of buildings) {
      const bPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
      const dist = bPos.distanceTo(finalPos);

      // For foundations placed on grid (not snapped), check for overlap
      if (isFoundation) {
        const bIsFoundation = [
          BuildingType.SQUARE_FOUNDATION,
          BuildingType.TRIANGLE_FOUNDATION,
          BuildingType.CURVED_FOUNDATION
        ].includes(b.type);

        if (bIsFoundation) {
          // Use a smaller threshold since we're only checking grid placements
          // Two squares edge-to-edge have centers 4 units apart
          // A square and triangle edge-to-edge have centers ~3.15 apart
          // So we check for actual overlap (centers too close)
          if (dist < 2.0) {
            isValid = false;
            break;
          }
        }
      } else {
        // For other pieces, just check for exact overlap
        if (dist < 0.2) {
          isValid = false;
          break;
        }
      }
    }
  }

  // Roofs require snapping to wall tops
  if (!snappedToSocket) {
    if (activeType === BuildingType.SQUARE_ROOF || activeType === BuildingType.TRIANGLE_ROOF) {
      isValid = false;
    }
  }

  // Send debug info if callback provided
  if (debugCallback) {
    const selectedIndex = bestCandidate
      ? debugCandidates.findIndex(c =>
          c.resultingPosition[0] === bestCandidate.position.x &&
          c.resultingPosition[1] === bestCandidate.position.y &&
          c.resultingPosition[2] === bestCandidate.position.z
        )
      : null;

    debugCallback({
      rayPoint: [rayIntersectionPoint.x, rayIntersectionPoint.y, rayIntersectionPoint.z],
      compatibleSocketsFound: compatibleSockets.length,
      candidates: debugCandidates,
      selectedCandidate: selectedIndex,
      finalPosition: [finalPos.x, finalPos.y, finalPos.z],
      finalRotation: [finalRot.x, finalRot.y, finalRot.z],
      isValid,
      snappedToSocket,
    });
  }

  return { position: finalPos, rotation: finalRot, isValid };
};
