import * as THREE from 'three';
import {
    BuildingType,
    SocketType,
    EdgeRole,
    UNIT_SIZE,
    FOUNDATION_HEIGHT,
    WALL_HEIGHT,
    HALF_WALL_HEIGHT,
    TRIANGLE_APOTHEM,
    TRIANGLE_RADIUS,
} from '../types';

// =============================================================================
// Building Category Types
// =============================================================================

export type BuildingCategory = 'foundation' | 'wall' | 'roof' | 'incline';

// =============================================================================
// Socket & Edge Definitions (Local Space)
// =============================================================================

/**
 * Point socket definition in local space.
 * Used for walls, roofs, and legacy foundation point sockets.
 */
export interface SocketDef {
    position: [number, number, number];
    normal: [number, number, number];
    socketType: SocketType;
}

/**
 * Edge socket definition in local space.
 * Used for foundation edge-to-edge snapping.
 */
export interface EdgeDef {
    start: [number, number, number];
    end: [number, number, number];
    edgeRole: EdgeRole;
    socketType: SocketType;
}

// =============================================================================
// Building Definition Interface
// =============================================================================

/**
 * Complete definition for a building type.
 * Contains all data needed for geometry, snapping, and rendering.
 */
export interface BuildingDef {
    type: BuildingType;
    category: BuildingCategory;

    /** Y offset from placement point to center (e.g., WALL_HEIGHT/2 for walls) */
    yOffset: number;

    /** Whether this type uses edge-based snapping (true) vs point-based (false) */
    usesEdgeSockets: boolean;

    /** Rotation increment in radians (PI/2 for 90°, PI/3 for 60°) */
    rotationIncrement: number;

    /** Point sockets for this building type */
    sockets: SocketDef[];

    /** Edge sockets for this building type (primarily foundations) */
    edges: EdgeDef[];

    /** Socket types this building can snap TO on other buildings */
    compatibleWith: SocketType[];
}

// =============================================================================
// Helper Constants
// =============================================================================

const HALF_SIZE = UNIT_SIZE / 2;
const FOUNDATION_TOP_Y = FOUNDATION_HEIGHT;
const STRUCTURE_TOP_Y = WALL_HEIGHT; // Top surface of structure pieces (3.0)

// =============================================================================
// Building Definitions
// =============================================================================

const SQUARE_FOUNDATION_DEF: BuildingDef = {
    type: BuildingType.SQUARE_FOUNDATION,
    category: 'foundation',
    yOffset: FOUNDATION_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        // Edge center sockets (for point-based legacy snapping)
        { position: [0, 0, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_EDGE },
        { position: [HALF_SIZE, 0, 0], normal: [1, 0, 0], socketType: SocketType.FOUNDATION_EDGE },
        { position: [0, 0, -HALF_SIZE], normal: [0, 0, -1], socketType: SocketType.FOUNDATION_EDGE },
        { position: [-HALF_SIZE, 0, 0], normal: [-1, 0, 0], socketType: SocketType.FOUNDATION_EDGE },
        // Top sockets for walls
        { position: [0, FOUNDATION_TOP_Y, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_TOP },
        { position: [HALF_SIZE, FOUNDATION_TOP_Y, 0], normal: [1, 0, 0], socketType: SocketType.FOUNDATION_TOP },
        { position: [0, FOUNDATION_TOP_Y, -HALF_SIZE], normal: [0, 0, -1], socketType: SocketType.FOUNDATION_TOP },
        { position: [-HALF_SIZE, FOUNDATION_TOP_Y, 0], normal: [-1, 0, 0], socketType: SocketType.FOUNDATION_TOP },
    ],
    edges: [
        // +Z edge (North)
        { start: [-HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        // +X edge (East)
        { start: [HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        // -Z edge (South)
        { start: [HALF_SIZE, 0, -HALF_SIZE], end: [-HALF_SIZE, 0, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        // -X edge (West)
        { start: [-HALF_SIZE, 0, -HALF_SIZE], end: [-HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
    ],
    compatibleWith: [SocketType.FOUNDATION_EDGE],
};

const TRIANGLE_FOUNDATION_DEF: BuildingDef = {
    type: BuildingType.TRIANGLE_FOUNDATION,
    category: 'foundation',
    yOffset: FOUNDATION_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 3,
    sockets: (() => {
        const sockets: SocketDef[] = [];
        const edgeAngles = [
            (5 * Math.PI) / 6,  // 150° - upper-left edge
            (3 * Math.PI) / 2,  // 270° - bottom edge
            Math.PI / 6,        // 30°  - upper-right edge
        ];
        for (const angle of edgeAngles) {
            const nx = Math.cos(angle);
            const nz = Math.sin(angle);
            const px = nx * TRIANGLE_APOTHEM;
            const pz = nz * TRIANGLE_APOTHEM;
            sockets.push({ position: [px, 0, pz], normal: [nx, 0, nz], socketType: SocketType.FOUNDATION_EDGE });
            sockets.push({ position: [px, FOUNDATION_TOP_Y, pz], normal: [nx, 0, nz], socketType: SocketType.FOUNDATION_TOP });
        }
        return sockets;
    })(),
    edges: (() => {
        const apexZ = -TRIANGLE_RADIUS;
        const baseZ = TRIANGLE_APOTHEM;
        return [
            // BASE edge (bottom, parallel to X)
            { start: [-HALF_SIZE, 0, baseZ], end: [HALF_SIZE, 0, baseZ], edgeRole: EdgeRole.BASE, socketType: SocketType.FOUNDATION_EDGE },
            // RIGHT edge (base right to apex)
            { start: [HALF_SIZE, 0, baseZ], end: [0, 0, apexZ], edgeRole: EdgeRole.RIGHT, socketType: SocketType.FOUNDATION_EDGE },
            // LEFT edge (apex to base left)
            { start: [0, 0, apexZ], end: [-HALF_SIZE, 0, baseZ], edgeRole: EdgeRole.LEFT, socketType: SocketType.FOUNDATION_EDGE },
        ];
    })(),
    compatibleWith: [SocketType.FOUNDATION_EDGE],
};

const TRIANGLE_FOUNDATION_2_DEF: BuildingDef = {
    type: BuildingType.TRIANGLE_FOUNDATION_2,
    category: 'foundation',
    yOffset: FOUNDATION_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 3,
    sockets: [
        // BASE Edge (+Z)
        { position: [0, 0, TRIANGLE_APOTHEM], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_EDGE },
        { position: [0, FOUNDATION_TOP_Y, TRIANGLE_APOTHEM], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_TOP },
        // RIGHT Edge
        {
            position: [TRIANGLE_APOTHEM * Math.cos(Math.PI / 6), 0, -TRIANGLE_APOTHEM * Math.sin(Math.PI / 6)],
            normal: [Math.cos(-Math.PI / 6), 0, Math.sin(-Math.PI / 6)], socketType: SocketType.FOUNDATION_EDGE
        },
        {
            position: [TRIANGLE_APOTHEM * Math.cos(Math.PI / 6), FOUNDATION_TOP_Y, -TRIANGLE_APOTHEM * Math.sin(Math.PI / 6)],
            normal: [Math.cos(-Math.PI / 6), 0, Math.sin(-Math.PI / 6)], socketType: SocketType.FOUNDATION_TOP
        },
        // LEFT Edge
        {
            position: [-TRIANGLE_APOTHEM * Math.cos(Math.PI / 6), 0, -TRIANGLE_APOTHEM * Math.sin(Math.PI / 6)],
            normal: [-Math.cos(-Math.PI / 6), 0, Math.sin(-Math.PI / 6)], socketType: SocketType.FOUNDATION_EDGE
        },
        {
            position: [-TRIANGLE_APOTHEM * Math.cos(Math.PI / 6), FOUNDATION_TOP_Y, -TRIANGLE_APOTHEM * Math.sin(Math.PI / 6)],
            normal: [-Math.cos(-Math.PI / 6), 0, Math.sin(-Math.PI / 6)], socketType: SocketType.FOUNDATION_TOP
        },
    ],
    edges: (() => {
        const apexZ = -TRIANGLE_RADIUS;
        const baseZ = TRIANGLE_APOTHEM;
        return [
            { start: [-HALF_SIZE, 0, baseZ], end: [HALF_SIZE, 0, baseZ], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
            { start: [HALF_SIZE, 0, baseZ], end: [0, 0, apexZ], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
            { start: [0, 0, apexZ], end: [-HALF_SIZE, 0, baseZ], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        ];
    })(),
    compatibleWith: [SocketType.FOUNDATION_EDGE],
};

const CURVED_FOUNDATION_DEF: BuildingDef = {
    type: BuildingType.CURVED_FOUNDATION,
    category: 'foundation',
    yOffset: FOUNDATION_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        // Two straight edges + curved edge center
        { position: [0, 0, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_EDGE },
        { position: [HALF_SIZE, 0, 0], normal: [1, 0, 0], socketType: SocketType.FOUNDATION_EDGE },
        // Curve center point (approximate)
        { position: [-UNIT_SIZE * 0.35, 0, -UNIT_SIZE * 0.35], normal: [-0.707, 0, -0.707], socketType: SocketType.FOUNDATION_EDGE },
        // Top sockets
        { position: [0, FOUNDATION_TOP_Y, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_TOP },
        { position: [HALF_SIZE, FOUNDATION_TOP_Y, 0], normal: [1, 0, 0], socketType: SocketType.FOUNDATION_TOP },
    ],
    edges: [
        // +Z edge
        { start: [-HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        // +X edge
        { start: [HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
    ],
    compatibleWith: [SocketType.FOUNDATION_EDGE],
};

// =============================================================================
// Structure Definitions (Raised Platform Foundations - WALL_HEIGHT tall)
// =============================================================================

const SQUARE_STRUCTURE_DEF: BuildingDef = {
    type: BuildingType.SQUARE_STRUCTURE,
    category: 'foundation',
    yOffset: WALL_HEIGHT / 2, // 1.5 - centers the 3-unit tall geometry
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        // Edge center sockets at GROUND LEVEL (y=0) for snapping to other foundations/structures
        { position: [0, 0, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_EDGE },
        { position: [HALF_SIZE, 0, 0], normal: [1, 0, 0], socketType: SocketType.FOUNDATION_EDGE },
        { position: [0, 0, -HALF_SIZE], normal: [0, 0, -1], socketType: SocketType.FOUNDATION_EDGE },
        { position: [-HALF_SIZE, 0, 0], normal: [-1, 0, 0], socketType: SocketType.FOUNDATION_EDGE },
        // Top sockets at STRUCTURE HEIGHT for walls
        { position: [0, STRUCTURE_TOP_Y, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_TOP },
        { position: [HALF_SIZE, STRUCTURE_TOP_Y, 0], normal: [1, 0, 0], socketType: SocketType.FOUNDATION_TOP },
        { position: [0, STRUCTURE_TOP_Y, -HALF_SIZE], normal: [0, 0, -1], socketType: SocketType.FOUNDATION_TOP },
        { position: [-HALF_SIZE, STRUCTURE_TOP_Y, 0], normal: [-1, 0, 0], socketType: SocketType.FOUNDATION_TOP },
    ],
    edges: [
        // Edges at GROUND LEVEL (y=0) for snapping to regular foundations
        { start: [-HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        { start: [HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        { start: [HALF_SIZE, 0, -HALF_SIZE], end: [-HALF_SIZE, 0, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        { start: [-HALF_SIZE, 0, -HALF_SIZE], end: [-HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
    ],
    compatibleWith: [SocketType.FOUNDATION_EDGE],
};

const TRIANGLE_STRUCTURE_DEF: BuildingDef = {
    type: BuildingType.TRIANGLE_STRUCTURE,
    category: 'foundation',
    yOffset: WALL_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 3,
    sockets: (() => {
        const sockets: SocketDef[] = [];
        const edgeAngles = [
            (5 * Math.PI) / 6,  // 150° - upper-left edge
            (3 * Math.PI) / 2,  // 270° - bottom edge
            Math.PI / 6,        // 30°  - upper-right edge
        ];
        for (const angle of edgeAngles) {
            const nx = Math.cos(angle);
            const nz = Math.sin(angle);
            const px = nx * TRIANGLE_APOTHEM;
            const pz = nz * TRIANGLE_APOTHEM;
            // Edge socket at ground level
            sockets.push({ position: [px, 0, pz], normal: [nx, 0, nz], socketType: SocketType.FOUNDATION_EDGE });
            // Top socket at structure height
            sockets.push({ position: [px, STRUCTURE_TOP_Y, pz], normal: [nx, 0, nz], socketType: SocketType.FOUNDATION_TOP });
        }
        return sockets;
    })(),
    edges: (() => {
        const apexZ = -TRIANGLE_RADIUS;
        const baseZ = TRIANGLE_APOTHEM;
        return [
            // Edges at ground level (y=0)
            { start: [-HALF_SIZE, 0, baseZ], end: [HALF_SIZE, 0, baseZ], edgeRole: EdgeRole.BASE, socketType: SocketType.FOUNDATION_EDGE },
            { start: [HALF_SIZE, 0, baseZ], end: [0, 0, apexZ], edgeRole: EdgeRole.RIGHT, socketType: SocketType.FOUNDATION_EDGE },
            { start: [0, 0, apexZ], end: [-HALF_SIZE, 0, baseZ], edgeRole: EdgeRole.LEFT, socketType: SocketType.FOUNDATION_EDGE },
        ];
    })(),
    compatibleWith: [SocketType.FOUNDATION_EDGE],
};

const CURVED_STRUCTURE_DEF: BuildingDef = {
    type: BuildingType.CURVED_STRUCTURE,
    category: 'foundation',
    yOffset: WALL_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        // Edge sockets at ground level (straight edges only)
        { position: [0, 0, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_EDGE },
        { position: [HALF_SIZE, 0, 0], normal: [1, 0, 0], socketType: SocketType.FOUNDATION_EDGE },
        // Curve center point (approximate)
        { position: [-UNIT_SIZE * 0.35, 0, -UNIT_SIZE * 0.35], normal: [-0.707, 0, -0.707], socketType: SocketType.FOUNDATION_EDGE },
        // Top sockets at structure height (straight edges only)
        { position: [0, STRUCTURE_TOP_Y, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.FOUNDATION_TOP },
        { position: [HALF_SIZE, STRUCTURE_TOP_Y, 0], normal: [1, 0, 0], socketType: SocketType.FOUNDATION_TOP },
    ],
    edges: [
        // Edges at ground level (y=0) - straight edges only
        { start: [-HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
        { start: [HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.FOUNDATION_EDGE },
    ],
    compatibleWith: [SocketType.FOUNDATION_EDGE],
};

const WALL_DEF: BuildingDef = {
    type: BuildingType.WALL,
    category: 'wall',
    yOffset: WALL_HEIGHT / 2,
    usesEdgeSockets: true,  // Now uses edge sockets for top
    rotationIncrement: Math.PI / 2,
    sockets: [
        // Bottom (snaps to foundation top)
        { position: [0, 0, 0], normal: [0, -1, 0], socketType: SocketType.WALL_BOTTOM },
        // Top (for upper floors/roofs)
        { position: [0, WALL_HEIGHT, 0], normal: [0, 1, 0], socketType: SocketType.WALL_TOP },
        // Sides (for connecting walls)
        { position: [-HALF_SIZE, WALL_HEIGHT / 2, 0], normal: [-1, 0, 0], socketType: SocketType.WALL_SIDE },
        { position: [HALF_SIZE, WALL_HEIGHT / 2, 0], normal: [1, 0, 0], socketType: SocketType.WALL_SIDE },
    ],
    edges: [
        // Top edge (bidirectional for ramp snapping)
        { start: [-HALF_SIZE, WALL_HEIGHT, 0], end: [HALF_SIZE, WALL_HEIGHT, 0], edgeRole: EdgeRole.SIDE, socketType: SocketType.WALL_TOP },
        { start: [HALF_SIZE, WALL_HEIGHT, 0], end: [-HALF_SIZE, WALL_HEIGHT, 0], edgeRole: EdgeRole.SIDE, socketType: SocketType.WALL_TOP },
    ],
    compatibleWith: [SocketType.FOUNDATION_TOP, SocketType.WALL_TOP, SocketType.INCLINE_TOP],
};

const HALF_WALL_DEF: BuildingDef = {
    type: BuildingType.HALF_WALL,
    category: 'wall',
    yOffset: HALF_WALL_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        { position: [0, 0, 0], normal: [0, -1, 0], socketType: SocketType.WALL_BOTTOM },
        { position: [0, HALF_WALL_HEIGHT, 0], normal: [0, 1, 0], socketType: SocketType.WALL_TOP },
        { position: [-HALF_SIZE, HALF_WALL_HEIGHT / 2, 0], normal: [-1, 0, 0], socketType: SocketType.WALL_SIDE },
        { position: [HALF_SIZE, HALF_WALL_HEIGHT / 2, 0], normal: [1, 0, 0], socketType: SocketType.WALL_SIDE },
    ],
    edges: [
        { start: [-HALF_SIZE, HALF_WALL_HEIGHT, 0], end: [HALF_SIZE, HALF_WALL_HEIGHT, 0], edgeRole: EdgeRole.SIDE, socketType: SocketType.WALL_TOP },
        { start: [HALF_SIZE, HALF_WALL_HEIGHT, 0], end: [-HALF_SIZE, HALF_WALL_HEIGHT, 0], edgeRole: EdgeRole.SIDE, socketType: SocketType.WALL_TOP },
    ],
    compatibleWith: [SocketType.FOUNDATION_TOP, SocketType.WALL_TOP, SocketType.INCLINE_TOP],
};

const WINDOW_WALL_DEF: BuildingDef = {
    type: BuildingType.WINDOW_WALL,
    category: 'wall',
    yOffset: WALL_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        { position: [0, 0, 0], normal: [0, -1, 0], socketType: SocketType.WALL_BOTTOM },
        { position: [0, WALL_HEIGHT, 0], normal: [0, 1, 0], socketType: SocketType.WALL_TOP },
        { position: [-HALF_SIZE, WALL_HEIGHT / 2, 0], normal: [-1, 0, 0], socketType: SocketType.WALL_SIDE },
        { position: [HALF_SIZE, WALL_HEIGHT / 2, 0], normal: [1, 0, 0], socketType: SocketType.WALL_SIDE },
    ],
    edges: [
        { start: [-HALF_SIZE, WALL_HEIGHT, 0], end: [HALF_SIZE, WALL_HEIGHT, 0], edgeRole: EdgeRole.SIDE, socketType: SocketType.WALL_TOP },
        { start: [HALF_SIZE, WALL_HEIGHT, 0], end: [-HALF_SIZE, WALL_HEIGHT, 0], edgeRole: EdgeRole.SIDE, socketType: SocketType.WALL_TOP },
    ],
    compatibleWith: [SocketType.FOUNDATION_TOP, SocketType.WALL_TOP, SocketType.INCLINE_TOP],
};

const DOORWAY_DEF: BuildingDef = {
    type: BuildingType.DOORWAY,
    category: 'wall',
    yOffset: WALL_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        { position: [0, 0, 0], normal: [0, -1, 0], socketType: SocketType.WALL_BOTTOM },
        { position: [0, WALL_HEIGHT, 0], normal: [0, 1, 0], socketType: SocketType.WALL_TOP },
        { position: [-HALF_SIZE, WALL_HEIGHT / 2, 0], normal: [-1, 0, 0], socketType: SocketType.WALL_SIDE },
        { position: [HALF_SIZE, WALL_HEIGHT / 2, 0], normal: [1, 0, 0], socketType: SocketType.WALL_SIDE },
    ],
    edges: [
        { start: [-HALF_SIZE, WALL_HEIGHT, 0], end: [HALF_SIZE, WALL_HEIGHT, 0], edgeRole: EdgeRole.SIDE, socketType: SocketType.WALL_TOP },
        { start: [HALF_SIZE, WALL_HEIGHT, 0], end: [-HALF_SIZE, WALL_HEIGHT, 0], edgeRole: EdgeRole.SIDE, socketType: SocketType.WALL_TOP },
    ],
    compatibleWith: [SocketType.FOUNDATION_TOP, SocketType.WALL_TOP, SocketType.INCLINE_TOP],
};

const SQUARE_ROOF_DEF: BuildingDef = {
    type: BuildingType.SQUARE_ROOF,
    category: 'roof',
    yOffset: 0.25,  // ROOF_HEIGHT / 2 approximately
    usesEdgeSockets: false,
    rotationIncrement: Math.PI / 2,
    sockets: [
        { position: [0, 0, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.ROOF_EDGE },
        { position: [HALF_SIZE, 0, 0], normal: [1, 0, 0], socketType: SocketType.ROOF_EDGE },
        { position: [0, 0, -HALF_SIZE], normal: [0, 0, -1], socketType: SocketType.ROOF_EDGE },
        { position: [-HALF_SIZE, 0, 0], normal: [-1, 0, 0], socketType: SocketType.ROOF_EDGE },
    ],
    edges: [],
    compatibleWith: [SocketType.WALL_TOP, SocketType.ROOF_EDGE],
};

const TRIANGLE_ROOF_DEF: BuildingDef = {
    type: BuildingType.TRIANGLE_ROOF,
    category: 'roof',
    yOffset: 0.25,
    usesEdgeSockets: false,
    rotationIncrement: Math.PI / 3,
    sockets: (() => {
        const edgeAngles = [(5 * Math.PI) / 6, (3 * Math.PI) / 2, Math.PI / 6];
        return edgeAngles.map(angle => ({
            position: [Math.cos(angle) * TRIANGLE_APOTHEM, 0, Math.sin(angle) * TRIANGLE_APOTHEM] as [number, number, number],
            normal: [Math.cos(angle), 0, Math.sin(angle)] as [number, number, number],
            socketType: SocketType.ROOF_EDGE,
        }));
    })(),
    edges: [],
    compatibleWith: [SocketType.WALL_TOP, SocketType.ROOF_EDGE],
};

const STAIRS_DEF: BuildingDef = {
    type: BuildingType.STAIRS,
    category: 'incline',
    yOffset: WALL_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        { position: [0, 0, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.INCLINE_BOTTOM },
        { position: [0, WALL_HEIGHT, -HALF_SIZE], normal: [0, 0, -1], socketType: SocketType.INCLINE_TOP },
    ],
    edges: [
        // Low edge (at y=0)
        { start: [-HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.INCLINE_BOTTOM },
        { start: [HALF_SIZE, 0, HALF_SIZE], end: [-HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.INCLINE_BOTTOM },
        // High edge (at y=WALL_HEIGHT)
        { start: [-HALF_SIZE, WALL_HEIGHT, -HALF_SIZE], end: [HALF_SIZE, WALL_HEIGHT, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.INCLINE_TOP },
        { start: [HALF_SIZE, WALL_HEIGHT, -HALF_SIZE], end: [-HALF_SIZE, WALL_HEIGHT, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.INCLINE_TOP },
    ],
    compatibleWith: [SocketType.FOUNDATION_TOP, SocketType.WALL_TOP],
};

const RAMP_DEF: BuildingDef = {
    type: BuildingType.RAMP,
    category: 'incline',
    yOffset: WALL_HEIGHT / 2,
    usesEdgeSockets: true,
    rotationIncrement: Math.PI / 2,
    sockets: [
        { position: [0, 0, HALF_SIZE], normal: [0, 0, 1], socketType: SocketType.INCLINE_BOTTOM },
        { position: [0, WALL_HEIGHT, -HALF_SIZE], normal: [0, 0, -1], socketType: SocketType.INCLINE_TOP },
    ],
    edges: [
        // Low edge (at y=0)
        { start: [-HALF_SIZE, 0, HALF_SIZE], end: [HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.INCLINE_BOTTOM },
        { start: [HALF_SIZE, 0, HALF_SIZE], end: [-HALF_SIZE, 0, HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.INCLINE_BOTTOM },
        // High edge (at y=WALL_HEIGHT)
        { start: [-HALF_SIZE, WALL_HEIGHT, -HALF_SIZE], end: [HALF_SIZE, WALL_HEIGHT, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.INCLINE_TOP },
        { start: [HALF_SIZE, WALL_HEIGHT, -HALF_SIZE], end: [-HALF_SIZE, WALL_HEIGHT, -HALF_SIZE], edgeRole: EdgeRole.SIDE, socketType: SocketType.INCLINE_TOP },
    ],
    compatibleWith: [SocketType.FOUNDATION_TOP, SocketType.WALL_TOP],
};

// =============================================================================
// Building Registry
// =============================================================================

export const BuildingRegistry: Record<BuildingType, BuildingDef> = {
    [BuildingType.SQUARE_FOUNDATION]: SQUARE_FOUNDATION_DEF,
    [BuildingType.TRIANGLE_FOUNDATION]: TRIANGLE_FOUNDATION_DEF,
    [BuildingType.TRIANGLE_FOUNDATION_2]: TRIANGLE_FOUNDATION_2_DEF,
    [BuildingType.CURVED_FOUNDATION]: CURVED_FOUNDATION_DEF,
    [BuildingType.SQUARE_STRUCTURE]: SQUARE_STRUCTURE_DEF,
    [BuildingType.TRIANGLE_STRUCTURE]: TRIANGLE_STRUCTURE_DEF,
    [BuildingType.CURVED_STRUCTURE]: CURVED_STRUCTURE_DEF,
    [BuildingType.WALL]: WALL_DEF,
    [BuildingType.HALF_WALL]: HALF_WALL_DEF,
    [BuildingType.WINDOW_WALL]: WINDOW_WALL_DEF,
    [BuildingType.DOORWAY]: DOORWAY_DEF,
    [BuildingType.SQUARE_ROOF]: SQUARE_ROOF_DEF,
    [BuildingType.TRIANGLE_ROOF]: TRIANGLE_ROOF_DEF,
    [BuildingType.STAIRS]: STAIRS_DEF,
    [BuildingType.RAMP]: RAMP_DEF,
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the building definition for a given type.
 */
export const getBuildingDef = (type: BuildingType): BuildingDef => {
    const def = BuildingRegistry[type];
    if (!def) {
        throw new Error(`No building definition found for type: ${type}`);
    }
    return def;
};

/**
 * Get all building definitions for a given category.
 */
export const getBuildingsByCategory = (category: BuildingCategory): BuildingDef[] => {
    return Object.values(BuildingRegistry).filter(def => def.category === category);
};

/**
 * Check if a building type uses edge sockets.
 */
export const usesEdgeSocketsFromRegistry = (type: BuildingType): boolean => {
    return getBuildingDef(type).usesEdgeSockets;
};

/**
 * Get the Y offset for a building type.
 */
export const getYOffsetFromRegistry = (type: BuildingType): number => {
    return getBuildingDef(type).yOffset;
};

/**
 * Get the rotation increment for a building type.
 */
export const getRotationIncrement = (type: BuildingType): number => {
    return getBuildingDef(type).rotationIncrement;
};
