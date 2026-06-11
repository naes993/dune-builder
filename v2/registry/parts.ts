import { EdgeAnchorDef, FootprintDef, PartRegistry } from '../types';
import { V2_FLOOR_HEIGHT, V2_FOUNDATION_HEIGHT, V2_UNIT_SIZE } from '../constants';
import { FOUNDATION_TARGET_CHANNELS } from '../engine/snapRelationships';

const UNIT = V2_UNIT_SIZE;
const HALF = UNIT / 2;
const FLOOR_HEIGHT = V2_FLOOR_HEIGHT;
const FOUNDATION_HEIGHT = V2_FOUNDATION_HEIGHT;
const WALL_DEPTH = 0.65;
const WALL_HALF_DEPTH = WALL_DEPTH / 2;
const DOOR_DEPTH = 1.2;
const DOOR_HALF_DEPTH = DOOR_DEPTH / 2;
const STANDARD_WALL_HEIGHT = 3.9;
const TALL_WALL_HEIGHT = 11.7;
const TRIANGLE_APOTHEM = UNIT / (2 * Math.sqrt(3));
const TRIANGLE_RADIUS = UNIT / Math.sqrt(3);

const HARKONNEN_FALLBACK_MATERIAL = {
  color: '#2b2b2b',
  metalness: 0.35,
  roughness: 0.7,
};

const HARKONNEN_SURFACE_MATERIAL = {
  color: '#4b5563',
  metalness: 0.2,
  roughness: 0.75,
};

const SQUARE_FOUNDATION_ANCHORS: EdgeAnchorDef[] = [
  {
    id: 'edge.north',
    kind: 'edge',
    role: 'foundation-edge',
    start: [-HALF, 0, HALF],
    end: [HALF, 0, HALF],
    normal: [0, 0, 1],
  },
  {
    id: 'edge.east',
    kind: 'edge',
    role: 'foundation-edge',
    start: [HALF, 0, HALF],
    end: [HALF, 0, -HALF],
    normal: [1, 0, 0],
  },
  {
    id: 'edge.south',
    kind: 'edge',
    role: 'foundation-edge',
    start: [HALF, 0, -HALF],
    end: [-HALF, 0, -HALF],
    normal: [0, 0, -1],
  },
  {
    id: 'edge.west',
    kind: 'edge',
    role: 'foundation-edge',
    start: [-HALF, 0, -HALF],
    end: [-HALF, 0, HALF],
    normal: [-1, 0, 0],
  },
];

const TRIANGLE_FOUNDATION_ANCHORS: EdgeAnchorDef[] = [
  {
    id: 'edge.base',
    kind: 'edge',
    role: 'foundation-edge',
    start: [-HALF, 0, TRIANGLE_APOTHEM],
    end: [HALF, 0, TRIANGLE_APOTHEM],
    normal: [0, 0, 1],
  },
  {
    id: 'edge.right',
    kind: 'edge',
    role: 'foundation-edge',
    start: [HALF, 0, TRIANGLE_APOTHEM],
    end: [0, 0, -TRIANGLE_RADIUS],
    normal: [Math.cos(Math.PI / 6), 0, -Math.sin(Math.PI / 6)],
  },
  {
    id: 'edge.left',
    kind: 'edge',
    role: 'foundation-edge',
    start: [0, 0, -TRIANGLE_RADIUS],
    end: [-HALF, 0, TRIANGLE_APOTHEM],
    normal: [-Math.cos(Math.PI / 6), 0, -Math.sin(Math.PI / 6)],
  },
];

const SQUARE_FOOTPRINT: FootprintDef = {
  type: 'polygon',
  points: [
    [-HALF, -HALF],
    [HALF, -HALF],
    [HALF, HALF],
    [-HALF, HALF],
  ],
};

const TRIANGLE_FOOTPRINT: FootprintDef = {
  type: 'polygon',
  points: [
    [0, -TRIANGLE_RADIUS],
    [HALF, TRIANGLE_APOTHEM],
    [-HALF, TRIANGLE_APOTHEM],
  ],
};

const STANDARD_ROTATIONS = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const TRIANGLE_ROTATIONS = [
  0,
  Math.PI / 3,
  (2 * Math.PI) / 3,
  Math.PI,
  (4 * Math.PI) / 3,
  (5 * Math.PI) / 3,
];
const FOUNDATION_SOURCE_CHANNELS = ['foundation-structure'] as const;
const FLOOR_SOURCE_CHANNELS = ['floor-support'] as const;
const FLOOR_TARGET_CHANNELS = ['floor-support', 'wall-support'] as const;
const WALL_SOURCE_CHANNELS = ['wall-support'] as const;
const NO_TARGET_CHANNELS = [] as const;

export const PARTS: PartRegistry = {
  // GLB pivot conventions (measured by scripts/measure-core-parts.mjs):
  // floor pivots sit at the walking surface, foundation pivots at the base.
  'floor.harkonnen.level3.square': {
    id: 'floor.harkonnen.level3.square',
    name: 'Harkonnen Floor',
    category: 'floor',
    occupancyLayer: 'foundation',
    snapProfile: 'floor',
    snapSourceChannels: [...FLOOR_SOURCE_CHANNELS],
    snapTargetChannels: [...FLOOR_TARGET_CHANNELS],
    height: FLOOR_HEIGHT,
    yOffset: FLOOR_HEIGHT / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: SQUARE_FOUNDATION_ANCHORS,
    footprint: SQUARE_FOOTPRINT,
    placeholderMesh: {
      type: 'box',
      size: [UNIT, FLOOR_HEIGHT, UNIT],
    },
    mesh: {
      url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Floor.glb',
      scale: [1, 1, 1],
      offset: [0, FLOOR_HEIGHT / 2, 0],
      rotation: [0, 0, 0],
      materialOverride: HARKONNEN_SURFACE_MATERIAL,
    },
  },
  'floor.harkonnen.level3.wedge': {
    id: 'floor.harkonnen.level3.wedge',
    name: 'Harkonnen Floor Wedge',
    category: 'floor',
    occupancyLayer: 'foundation',
    snapProfile: 'floor',
    snapSourceChannels: [...FLOOR_SOURCE_CHANNELS],
    snapTargetChannels: [...FLOOR_TARGET_CHANNELS],
    height: FLOOR_HEIGHT,
    yOffset: FLOOR_HEIGHT / 2,
    allowedRotations: TRIANGLE_ROTATIONS,
    anchors: TRIANGLE_FOUNDATION_ANCHORS,
    footprint: TRIANGLE_FOOTPRINT,
    placeholderMesh: {
      type: 'triangle-prism',
      size: [UNIT, FLOOR_HEIGHT, UNIT],
    },
    mesh: {
      url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_FloorWedge.glb',
      scale: [1, 1, 1],
      offset: [0, FLOOR_HEIGHT / 2, 0],
      rotation: [0, 0, 0],
      materialOverride: HARKONNEN_SURFACE_MATERIAL,
    },
  },
  'foundation.harkonnen.level3.square': {
    id: 'foundation.harkonnen.level3.square',
    name: 'Harkonnen Foundation',
    category: 'foundation',
    occupancyLayer: 'foundation',
    snapProfile: 'foundation',
    snapSourceChannels: [...FOUNDATION_SOURCE_CHANNELS],
    snapTargetChannels: [...FOUNDATION_TARGET_CHANNELS],
    height: FOUNDATION_HEIGHT,
    yOffset: FOUNDATION_HEIGHT / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: SQUARE_FOUNDATION_ANCHORS,
    footprint: SQUARE_FOOTPRINT,
    placeholderMesh: {
      type: 'box',
      size: [UNIT, FOUNDATION_HEIGHT, UNIT],
    },
    mesh: {
      url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Foundation.glb',
      scale: [1, 1, 1],
      offset: [0, -FOUNDATION_HEIGHT / 2, 0],
      rotation: [0, 0, 0],
      materialOverride: HARKONNEN_SURFACE_MATERIAL,
    },
  },
  'foundation.harkonnen.level3.wedge': {
    id: 'foundation.harkonnen.level3.wedge',
    name: 'Harkonnen Foundation Wedge',
    category: 'foundation',
    occupancyLayer: 'foundation',
    snapProfile: 'foundation',
    snapSourceChannels: [...FOUNDATION_SOURCE_CHANNELS],
    snapTargetChannels: [...FOUNDATION_TARGET_CHANNELS],
    height: FOUNDATION_HEIGHT,
    yOffset: FOUNDATION_HEIGHT / 2,
    allowedRotations: TRIANGLE_ROTATIONS,
    anchors: TRIANGLE_FOUNDATION_ANCHORS,
    footprint: TRIANGLE_FOOTPRINT,
    placeholderMesh: {
      type: 'triangle-prism',
      size: [UNIT, FOUNDATION_HEIGHT, UNIT],
    },
    mesh: {
      url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_FoundationWedge.glb',
      scale: [1, 1, 1],
      offset: [0, -FOUNDATION_HEIGHT / 2, 0],
      rotation: [0, 0, 0],
      materialOverride: HARKONNEN_SURFACE_MATERIAL,
    },
  },
  'wall.harkonnen.level3.straight': {
    id: 'wall.harkonnen.level3.straight',
    name: 'Harkonnen Level 3 Straight Wall',
    category: 'wall',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...NO_TARGET_CHANNELS],
    height: STANDARD_WALL_HEIGHT,
    yOffset: STANDARD_WALL_HEIGHT / 2,
    allowedRotations: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
    anchors: [
      {
        id: 'edge.wall-bottom',
        kind: 'edge',
        role: 'foundation-edge',
        start: [-HALF, 0, 0],
        end: [HALF, 0, 0],
        normal: [0, 0, 1],
      },
    ],
    footprint: {
      type: 'polygon',
      points: [
        [-HALF, -WALL_HALF_DEPTH],
        [HALF, -WALL_HALF_DEPTH],
        [HALF, WALL_HALF_DEPTH],
        [-HALF, WALL_HALF_DEPTH],
      ],
    },
    placeholderMesh: {
      type: 'box',
      size: [UNIT, STANDARD_WALL_HEIGHT, WALL_DEPTH],
    },
    mesh: {
      url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Wall_01.glb',
      scale: [1, 1, 1],
      offset: [0, -STANDARD_WALL_HEIGHT / 2, 0],
      rotation: [0, 0, 0],
      materialOverride: HARKONNEN_FALLBACK_MATERIAL,
    },
  },
  'wall.harkonnen.level3.corner.tall': {
    id: 'wall.harkonnen.level3.corner.tall',
    name: 'Harkonnen Level 3 Tall Wall Corner',
    category: 'wall-corner',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...NO_TARGET_CHANNELS],
    height: TALL_WALL_HEIGHT,
    yOffset: TALL_WALL_HEIGHT / 2,
    allowedRotations: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
    anchors: [
      {
        id: 'edge.corner-front',
        kind: 'edge',
        role: 'foundation-edge',
        start: [-HALF, 0, -HALF],
        end: [HALF, 0, -HALF],
        normal: [0, 0, 1],
      },
      {
        id: 'edge.corner-side',
        kind: 'edge',
        role: 'foundation-edge',
        start: [HALF, 0, HALF],
        end: [HALF, 0, -HALF],
        normal: [1, 0, 0],
      },
    ],
    footprint: {
      type: 'polygon',
      points: [
        [-HALF, -HALF],
        [HALF, -HALF],
        [HALF, HALF],
        [-HALF, HALF],
      ],
    },
    placeholderMesh: {
      type: 'box',
      size: [UNIT, TALL_WALL_HEIGHT, UNIT],
    },
    mesh: {
      url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_WallCorner_Tall.glb',
      scale: [1, 1, 1],
      offset: [0, -TALL_WALL_HEIGHT / 2, 0],
      rotation: [0, 0, 0],
      materialOverride: HARKONNEN_FALLBACK_MATERIAL,
    },
  },
  'wall.harkonnen.level3.inclined.tall': {
    id: 'wall.harkonnen.level3.inclined.tall',
    name: 'Harkonnen Level 3 Inclined Tall Wall',
    category: 'wall',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...NO_TARGET_CHANNELS],
    height: TALL_WALL_HEIGHT,
    yOffset: TALL_WALL_HEIGHT / 2,
    allowedRotations: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
    anchors: [
      {
        id: 'edge.wall-bottom',
        kind: 'edge',
        role: 'foundation-edge',
        start: [-HALF, 0, 0],
        end: [HALF, 0, 0],
        normal: [0, 0, 1],
      },
    ],
    footprint: {
      type: 'polygon',
      points: [
        [-HALF, -DOOR_HALF_DEPTH],
        [HALF, -DOOR_HALF_DEPTH],
        [HALF, DOOR_HALF_DEPTH],
        [-HALF, DOOR_HALF_DEPTH],
      ],
    },
    placeholderMesh: {
      type: 'box',
      size: [UNIT, TALL_WALL_HEIGHT, DOOR_DEPTH],
    },
    mesh: {
      url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_WallInclined_Tall.glb',
      scale: [1, 1, 1],
      offset: [0, -TALL_WALL_HEIGHT / 2, 0],
      rotation: [0, 0, 0],
      materialOverride: HARKONNEN_FALLBACK_MATERIAL,
    },
  },
  'wall.harkonnen.level3.door': {
    id: 'wall.harkonnen.level3.door',
    name: 'Harkonnen Level 3 Door Assembly',
    category: 'wall-door',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...NO_TARGET_CHANNELS],
    height: STANDARD_WALL_HEIGHT,
    yOffset: STANDARD_WALL_HEIGHT / 2,
    allowedRotations: [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2],
    anchors: [
      {
        id: 'edge.wall-bottom',
        kind: 'edge',
        role: 'foundation-edge',
        start: [-HALF, 0, 0],
        end: [HALF, 0, 0],
        normal: [0, 0, 1],
      },
    ],
    footprint: {
      type: 'polygon',
      points: [
        [-HALF, -DOOR_HALF_DEPTH],
        [HALF, -DOOR_HALF_DEPTH],
        [HALF, DOOR_HALF_DEPTH],
        [-HALF, DOOR_HALF_DEPTH],
      ],
    },
    placeholderMesh: {
      type: 'box',
      size: [UNIT, STANDARD_WALL_HEIGHT, DOOR_DEPTH],
    },
    meshes: [
      {
        url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_DoorFrame.glb',
        scale: [1, 1, 1],
        offset: [0, -STANDARD_WALL_HEIGHT / 2, 0],
        rotation: [0, 0, 0],
        materialOverride: HARKONNEN_FALLBACK_MATERIAL,
      },
      {
        url: '/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Door.glb',
        scale: [1, 1, 1],
        offset: [0, -STANDARD_WALL_HEIGHT / 2, 0],
        rotation: [0, 0, 0],
        materialOverride: HARKONNEN_FALLBACK_MATERIAL,
      },
    ],
  },
};

export const getPart = (partId: keyof typeof PARTS) => PARTS[partId];
