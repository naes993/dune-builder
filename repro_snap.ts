import * as THREE from 'three';

// --- MOCK TYPES ---
enum BuildingType {
    SQUARE_FOUNDATION = 'SQUARE_FOUNDATION',
    TRIANGLE_FOUNDATION = 'TRIANGLE_FOUNDATION',
    CURVED_FOUNDATION = 'CURVED_FOUNDATION',
}

interface BuildingData {
    id: string;
    type: BuildingType;
    position: [number, number, number];
    rotation: [number, number, number];
}

const UNIT_SIZE = 4;
const TRIANGLE_RADIUS = UNIT_SIZE / Math.sqrt(3); // ~2.309
const TRIANGLE_APOTHEM = UNIT_SIZE / (2 * Math.sqrt(3)); // ~1.1547
const FOUNDATION_HEIGHT = 0.2;

// --- GEOMETRY LOGIC (Copied & Adapted) ---

enum EdgeRole { BASE = 'BASE', RIGHT = 'RIGHT', LEFT = 'LEFT', SIDE = 'SIDE' }
enum SocketType { FOUNDATION_EDGE = 'FOUNDATION_EDGE' }

interface LocalEdgeSocket {
    start: THREE.Vector3;
    center: THREE.Vector3;
    end: THREE.Vector3;
    socketType: SocketType;
    edgeLength: number;
    edgeRole: EdgeRole;
}

interface EdgeSocket extends LocalEdgeSocket {
    id: string;
}

const createEdge = (start: THREE.Vector3, end: THREE.Vector3, edgeRole: EdgeRole): LocalEdgeSocket => {
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

const getLocalEdgeSockets = (type: BuildingType): LocalEdgeSocket[] => {
    const edges: LocalEdgeSocket[] = [];
    const halfSize = UNIT_SIZE / 2;

    if (type === BuildingType.TRIANGLE_FOUNDATION) {
        const apexZ = -TRIANGLE_RADIUS;
        const baseZ = TRIANGLE_APOTHEM;
        const vApex = new THREE.Vector3(0, 0, apexZ);
        const vLeft = new THREE.Vector3(-halfSize, 0, baseZ);
        const vRight = new THREE.Vector3(halfSize, 0, baseZ);

        edges.push(createEdge(vLeft, vRight, EdgeRole.BASE));
        edges.push(createEdge(vRight, vApex, EdgeRole.RIGHT));
        edges.push(createEdge(vApex, vLeft, EdgeRole.LEFT));
    } else if (type === BuildingType.CURVED_FOUNDATION) {
        // Bottom edge
        edges.push(createEdge(
            new THREE.Vector3(-halfSize, 0, halfSize),
            new THREE.Vector3(halfSize, 0, halfSize),
            EdgeRole.SIDE
        ));
        // Left edge (flipped winding)
        edges.push(createEdge(
            new THREE.Vector3(-halfSize, 0, -halfSize),
            new THREE.Vector3(-halfSize, 0, halfSize),
            EdgeRole.SIDE
        ));
    }
    return edges;
};

const getWorldEdgeSockets = (building: BuildingData): EdgeSocket[] => {
    const localEdges = getLocalEdgeSockets(building.type);
    const worldEdges: EdgeSocket[] = [];
    const rotEuler = new THREE.Euler(building.rotation[0], building.rotation[1], building.rotation[2]);
    const pos = new THREE.Vector3(building.position[0], building.position[1], building.position[2]);

    localEdges.forEach(edge => {
        const wStart = edge.start.clone().applyEuler(rotEuler).add(pos);
        const wCenter = edge.center.clone().applyEuler(rotEuler).add(pos);
        const wEnd = edge.end.clone().applyEuler(rotEuler).add(pos);
        worldEdges.push({
            ...edge,
            start: wStart,
            center: wCenter,
            end: wEnd,
            id: building.id,
        });
    });
    return worldEdges;
};

const calculateEdgeSnapTransform = (
    targetEdge: EdgeSocket,
    ghostEdge: LocalEdgeSocket
): { position: THREE.Vector3; rotation: THREE.Euler } | null => {
    const targetDir = targetEdge.end.clone().sub(targetEdge.start).normalize();
    const ghostDir = ghostEdge.end.clone().sub(ghostEdge.start).normalize();
    const desiredGhostDir = targetDir.clone().negate();

    const ghostAngle = Math.atan2(ghostDir.x, ghostDir.z);
    const targetAngle = Math.atan2(desiredGhostDir.x, desiredGhostDir.z);
    const rotY = targetAngle - ghostAngle;

    const rotation = new THREE.Euler(0, rotY, 0);

    const rotatedGhostStart = ghostEdge.start.clone().applyEuler(rotation);
    const position = targetEdge.end.clone().sub(rotatedGhostStart);

    const rotatedGhostCenter = ghostEdge.center.clone().applyEuler(rotation).add(position);
    const rotatedGhostEnd = ghostEdge.end.clone().applyEuler(rotation).add(position);

    const startError = rotatedGhostStart.clone().add(position).distanceTo(targetEdge.end);
    const centerError = rotatedGhostCenter.distanceTo(targetEdge.center);
    const endError = rotatedGhostEnd.distanceTo(targetEdge.start);

    const tolerance = 0.05;

    if (startError > tolerance || centerError > tolerance || endError > tolerance) {
        return null;
    }

    return { position, rotation };
};

// --- SIMULATION ---

// 1. Place a Triangle at origin
const triangle: BuildingData = {
    id: 't1',
    type: BuildingType.TRIANGLE_FOUNDATION,
    position: [0, 0, 0],
    rotation: [0, 0, 0]
};

const buildings = [triangle];
const targetEdges = getWorldEdgeSockets(triangle);

console.log("Target Edges (Triangle):");
targetEdges.forEach((e, i) => {
    console.log(`Edge ${i} [${e.edgeRole}]: Start=(${e.start.x.toFixed(2)},${e.start.z.toFixed(2)}) End=(${e.end.x.toFixed(2)},${e.end.z.toFixed(2)}) Center=(${e.center.x.toFixed(2)},${e.center.z.toFixed(2)}) Len=${e.edgeLength.toFixed(2)}`);
});

// 2. Try to snap a Curved Foundation to the "Right" edge of the Triangle
const targetEdge = targetEdges[1]; // RIGHT edge
console.log(`\nAttemping to snap Curved Foundation to Triangle Edge 1 (RIGHT)...`);

const ghostEdges = getLocalEdgeSockets(BuildingType.CURVED_FOUNDATION);
console.log(`Ghost Edges (Curved):`);
ghostEdges.forEach((e, i) => {
    console.log(`Edge ${i}: Start=(${e.start.x.toFixed(2)},${e.start.z.toFixed(2)}) End=(${e.end.x.toFixed(2)},${e.end.z.toFixed(2)})`);
});

let bestMatch = null;
for (const ghostEdge of ghostEdges) {
    console.log(`\nChecking Ghost Edge...`);
    if (Math.abs(ghostEdge.edgeLength - targetEdge.edgeLength) > 0.01) {
        console.log("Length mismatch");
        continue;
    }

    const transform = calculateEdgeSnapTransform(targetEdge, ghostEdge);
    if (transform) {
        console.log("SUCCESS: Transform found!");
        bestMatch = transform;
    } else {
        console.log("FAILED: Transform rejected.");
    }
}

if (bestMatch) {
    console.log("Valid snap found!");
    const finalPos = bestMatch.position;
    const bPos = new THREE.Vector3(triangle.position[0], triangle.position[1], triangle.position[2]);
    const dist = bPos.distanceTo(finalPos);
    console.log(`Distance between centers: ${dist.toFixed(4)}`);
    if (dist < 2.0) {
        console.log("COLLISION DETECTED (dist < 2.0)");
    } else {
        console.log("Collision check passed.");
    }
} else {
    console.log("No valid snap found.");
}
