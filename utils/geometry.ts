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
  CURVE_RADIUS
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
    // Three edge sockets at 120° intervals
    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3;
      const pos = new THREE.Vector3(0, 0, TRIANGLE_APOTHEM).applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
      const norm = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
      sockets.push({ position: pos, normal: norm, socketType: SocketType.FOUNDATION_EDGE });
      
      // Top socket for each edge
      const topPos = pos.clone();
      topPos.y = FOUNDATION_HEIGHT;
      sockets.push({ position: topPos, normal: norm.clone(), socketType: SocketType.FOUNDATION_TOP });
    }
  }
  
  else if (type === BuildingType.INNER_CURVED_CORNER) {
    // Quarter circle - two straight edges + one curved edge
    // The piece sits in the positive X/Z quadrant with the curved arc at radius CURVE_RADIUS
    // Straight edges run along X axis (from origin to +X) and Z axis (from origin to +Z)
    // Socket positions are at the CENTER of each straight edge, with normals pointing OUTWARD

    // Straight edge along Z axis (at x=0, from z=0 to z=CURVE_RADIUS) - normal points -X
    sockets.push({ position: new THREE.Vector3(0, 0, halfSize), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_EDGE });
    // Straight edge along X axis (at z=0, from x=0 to x=CURVE_RADIUS) - normal points -Z
    sockets.push({ position: new THREE.Vector3(halfSize, 0, 0), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_EDGE });

    // Top sockets for walls along the straight edges
    sockets.push({ position: new THREE.Vector3(0, FOUNDATION_HEIGHT, halfSize), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(halfSize, FOUNDATION_HEIGHT, 0), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_TOP });

    // Curved edge sockets (at intervals along the arc) - normals point outward from center
    for (let i = 1; i < 4; i++) {
      const angle = (i * Math.PI) / 4; // 22.5°, 45°, 67.5°
      const x = Math.cos(angle) * CURVE_RADIUS;
      const z = Math.sin(angle) * CURVE_RADIUS;
      const normal = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      sockets.push({ position: new THREE.Vector3(x, 0, z), normal: normal, socketType: SocketType.FOUNDATION_EDGE });
      sockets.push({ position: new THREE.Vector3(x, FOUNDATION_HEIGHT, z), normal: normal.clone(), socketType: SocketType.FOUNDATION_TOP });
    }
  }
  
  else if (type === BuildingType.OUTER_CURVED_CORNER) {
    // Concave corner piece - fills gap around circular structures
    // Two straight edges
    sockets.push({ position: new THREE.Vector3(-halfSize, 0, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_EDGE });
    sockets.push({ position: new THREE.Vector3(0, 0, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_EDGE });
    
    // Top sockets for walls
    sockets.push({ position: new THREE.Vector3(-halfSize, FOUNDATION_HEIGHT, 0), normal: new THREE.Vector3(-1, 0, 0), socketType: SocketType.FOUNDATION_TOP });
    sockets.push({ position: new THREE.Vector3(0, FOUNDATION_HEIGHT, -halfSize), normal: new THREE.Vector3(0, 0, -1), socketType: SocketType.FOUNDATION_TOP });
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
    BuildingType.INNER_CURVED_CORNER,
    BuildingType.OUTER_CURVED_CORNER
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
 */
export const calculateSnap = (
  rayIntersectionPoint: THREE.Vector3,
  buildings: BuildingData[],
  activeType: BuildingType,
  currentRotationY: number
): { position: THREE.Vector3, rotation: THREE.Euler, isValid: boolean } => {
  if (!rayIntersectionPoint) {
    return { position: new THREE.Vector3(), rotation: new THREE.Euler(), isValid: false };
  }

  // Collect all world sockets from existing buildings
  let allSockets: Socket[] = [];
  buildings.forEach(b => {
    allSockets.push(...getWorldSockets(b));
  });

  // Filter to only compatible socket types
  const compatibleTypes = getCompatibleSocketTypes(activeType);
  const compatibleSockets = allSockets.filter(s => compatibleTypes.includes(s.socketType));

  // Find closest compatible socket
  let closestSocket: Socket | null = null;
  let minDist = 2.5; // Snap radius

  for (const s of compatibleSockets) {
    const dist = s.position.distanceTo(rayIntersectionPoint);
    if (dist < minDist) {
      minDist = dist;
      closestSocket = s;
    }
  }

  let finalPos = new THREE.Vector3(rayIntersectionPoint.x, 0, rayIntersectionPoint.z);
  let finalRot = new THREE.Euler(0, currentRotationY, 0);
  let snappedToSocket = false;

  if (closestSocket) {
    const ghostLocals = getLocalSockets(activeType);
    
    // Filter ghost sockets to those compatible with the target socket
    const targetCompatible = SOCKET_COMPATIBILITY[closestSocket.socketType] || [];
    const matchingGhostSockets = ghostLocals.filter(gs => targetCompatible.includes(gs.socketType));
    
    if (matchingGhostSockets.length === 0) {
      // Fallback to all sockets if no type match
      matchingGhostSockets.push(...ghostLocals);
    }
    
    let bestDist = Infinity;
    
    const snapStep = Math.PI / 4; // 45° rotation snapping
    const rotationOffset = Math.round(currentRotationY / snapStep) * snapStep;

    for (const gSocket of matchingGhostSockets) {
      const targetNormal = closestSocket.normal.clone().negate();
      const targetAngle = Math.atan2(targetNormal.x, targetNormal.z);
      const localAngle = Math.atan2(gSocket.normal.x, gSocket.normal.z);
      
      let angleDiff = targetAngle - localAngle;
      const finalRotY = angleDiff + rotationOffset;
      const candidateRot = new THREE.Euler(0, finalRotY, 0);
      
      const rotatedLocalPos = gSocket.position.clone().applyEuler(candidateRot);
      const candidatePos = closestSocket.position.clone().sub(rotatedLocalPos);
      
      const distToCursor = candidatePos.distanceTo(rayIntersectionPoint);
      if (distToCursor < bestDist) {
        bestDist = distToCursor;
        finalPos = candidatePos;
        finalRot = candidateRot;
      }
    }
    snappedToSocket = true;
  } else {
    // Grid snapping when not near any socket
    const gridSnap = 1;
    finalPos.x = Math.round(rayIntersectionPoint.x / gridSnap) * gridSnap;
    finalPos.z = Math.round(rayIntersectionPoint.z / gridSnap) * gridSnap;
    finalPos.y = 0;
    finalRot = new THREE.Euler(0, currentRotationY, 0);
  }

  // Overlap detection
  let isValid = true;
  const overlapThreshold = 0.2; 
  for (const b of buildings) {
    const bPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
    if (bPos.distanceTo(finalPos) < overlapThreshold) {
      isValid = false;
      break;
    }
  }

  // Roofs require snapping to wall tops
  if (!snappedToSocket) {
    if (activeType === BuildingType.SQUARE_ROOF || activeType === BuildingType.TRIANGLE_ROOF) {
      isValid = false;
    }
  }

  return { position: finalPos, rotation: finalRot, isValid };
};
