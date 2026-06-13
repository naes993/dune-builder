import { EdgeAnchorDef, MenuCategory, PartDefinition, PartId, PartRegistry, FootprintDef, SnapChannel } from '../types';
import { V2_FLOOR_HEIGHT, V2_FOUNDATION_HEIGHT, V2_UNIT_SIZE } from '../constants';

const UNIT = V2_UNIT_SIZE;
const HALF = UNIT / 2;
const FLOOR_HEIGHT = V2_FLOOR_HEIGHT;
const FOUNDATION_HEIGHT = V2_FOUNDATION_HEIGHT;
const WALL_DEPTH = 0.65;
const WALL_HALF_DEPTH = WALL_DEPTH / 2;
const DOOR_DEPTH = 1.2;
const DOOR_HALF_DEPTH = DOOR_DEPTH / 2;
// The game's vertical module: wall tops align with foundation tops, and the
// tall wall pieces span exactly three modules (measured GLB: 11.644).
const STANDARD_WALL_HEIGHT = V2_FOUNDATION_HEIGHT;
const HALF_WALL_HEIGHT = V2_FOUNDATION_HEIGHT / 2;
const TALL_WALL_HEIGHT = V2_FOUNDATION_HEIGHT * 3;
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

// 2D edge specs (XZ plane, CCW winding) lifted to 3D anchors at a given height.
type EdgeSpec = {
  id: string;
  start: [number, number];
  end: [number, number];
  normal: [number, number];
};

const SQUARE_EDGE_SPECS: EdgeSpec[] = [
  { id: 'edge.north', start: [-HALF, HALF], end: [HALF, HALF], normal: [0, 1] },
  { id: 'edge.east', start: [HALF, HALF], end: [HALF, -HALF], normal: [1, 0] },
  { id: 'edge.south', start: [HALF, -HALF], end: [-HALF, -HALF], normal: [0, -1] },
  { id: 'edge.west', start: [-HALF, -HALF], end: [-HALF, HALF], normal: [-1, 0] },
];

const TRIANGLE_EDGE_SPECS: EdgeSpec[] = [
  { id: 'edge.base', start: [-HALF, TRIANGLE_APOTHEM], end: [HALF, TRIANGLE_APOTHEM], normal: [0, 1] },
  {
    id: 'edge.right',
    start: [HALF, TRIANGLE_APOTHEM],
    end: [0, -TRIANGLE_RADIUS],
    normal: [Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)],
  },
  {
    id: 'edge.left',
    start: [0, -TRIANGLE_RADIUS],
    end: [-HALF, TRIANGLE_APOTHEM],
    normal: [-Math.cos(Math.PI / 6), -Math.sin(Math.PI / 6)],
  },
];

const edgeAnchors = (
  specs: EdgeSpec[],
  y: number,
  options: { idSuffix?: string; channels: SnapChannel[]; source?: boolean }
): EdgeAnchorDef[] =>
  specs.map((spec) => ({
    id: options.idSuffix ? `${spec.id}${options.idSuffix}` : spec.id,
    kind: 'edge',
    role: 'foundation-edge',
    start: [spec.start[0], y, spec.start[1]],
    end: [spec.end[0], y, spec.end[1]],
    normal: [spec.normal[0], 0, spec.normal[1]],
    channels: options.channels,
    source: options.source ?? true,
  }));

const SUPPORT_CHANNELS: SnapChannel[] = ['floor-support', 'wall-support'];

// Foundations: side-snap to each other at the base; their tops are the support
// surface where floors align flush and walls stand.
const FOUNDATION_SQUARE_ANCHORS = [
  ...edgeAnchors(SQUARE_EDGE_SPECS, 0, { channels: ['foundation-structure'] }),
  ...edgeAnchors(SQUARE_EDGE_SPECS, FOUNDATION_HEIGHT, { idSuffix: '.top', channels: SUPPORT_CHANNELS, source: false }),
];
const FOUNDATION_TRIANGLE_ANCHORS = [
  ...edgeAnchors(TRIANGLE_EDGE_SPECS, 0, { channels: ['foundation-structure'] }),
  ...edgeAnchors(TRIANGLE_EDGE_SPECS, FOUNDATION_HEIGHT, { idSuffix: '.top', channels: SUPPORT_CHANNELS, source: false }),
];

// Floors: all snapping happens at the walking surface, so floor tops stay flush
// with whatever supports them (foundation tops, other floors, wall tops).
const FLOOR_SQUARE_ANCHORS = edgeAnchors(SQUARE_EDGE_SPECS, FLOOR_HEIGHT, {
  idSuffix: '.top',
  channels: SUPPORT_CHANNELS,
});
const FLOOR_TRIANGLE_ANCHORS = edgeAnchors(TRIANGLE_EDGE_SPECS, FLOOR_HEIGHT, {
  idSuffix: '.top',
  channels: SUPPORT_CHANNELS,
});

const wallAnchors = (height: number): EdgeAnchorDef[] => [
  {
    id: 'edge.wall-bottom',
    kind: 'edge',
    role: 'foundation-edge',
    start: [-HALF, 0, 0],
    end: [HALF, 0, 0],
    normal: [0, 0, 1],
    // Floors can snap flush with a wall's base plane (e.g. under an overhang).
    channels: ['floor-support'],
  },
  {
    id: 'edge.wall-top',
    kind: 'edge',
    role: 'foundation-edge',
    start: [-HALF, height, 0],
    end: [HALF, height, 0],
    normal: [0, 0, 1],
    channels: SUPPORT_CHANNELS,
    source: false,
  },
];

// Triangle-bottom (sloped-top) walls expose no flat top edge to build on.
const wallAnchorsSlopedTop = (height: number): EdgeAnchorDef[] =>
  wallAnchors(height).filter((anchor) => anchor.id !== 'edge.wall-top');

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

const WALL_FOOTPRINT: FootprintDef = {
  type: 'polygon',
  points: [
    [-HALF, -WALL_HALF_DEPTH],
    [HALF, -WALL_HALF_DEPTH],
    [HALF, WALL_HALF_DEPTH],
    [-HALF, WALL_HALF_DEPTH],
  ],
};

const DOOR_FOOTPRINT: FootprintDef = {
  type: 'polygon',
  points: [
    [-HALF, -DOOR_HALF_DEPTH],
    [HALF, -DOOR_HALF_DEPTH],
    [HALF, DOOR_HALF_DEPTH],
    [-HALF, DOOR_HALF_DEPTH],
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
const FOUNDATION_SOURCE_CHANNELS: SnapChannel[] = ['foundation-structure'];
const FOUNDATION_TARGET_CHANNELS: SnapChannel[] = ['foundation-structure', ...SUPPORT_CHANNELS];
const FLOOR_SOURCE_CHANNELS: SnapChannel[] = ['floor-support'];
const WALL_SOURCE_CHANNELS: SnapChannel[] = ['wall-support'];

// Straight-wall variants share Wall_01's placement data exactly; only the GLB,
// height, and (for triangle pieces) the top anchor differ. All wall-family
// pivots sit at the base center (measured by scripts/measure-wall-variants.mjs),
// and decorative protrusions (Wall_02-04, Window) stay visual-only — the
// logical footprint remains the standard wall slab.
const wallVariant = (options: {
  id: PartId;
  name: string;
  glbs: string[];
  height?: number;
  menuCategory?: MenuCategory;
  slopedTop?: boolean;
}): PartDefinition => {
  const height = options.height ?? STANDARD_WALL_HEIGHT;
  const visuals = options.glbs.map((glb) => ({
    url: `/assets/parts/harkonnen/${glb}`,
    scale: [1, 1, 1] as [number, number, number],
    offset: [0, -height / 2, 0] as [number, number, number],
    rotation: [0, 0, 0] as [number, number, number],
    materialOverride: HARKONNEN_FALLBACK_MATERIAL,
  }));
  return {
    id: options.id,
    name: options.name,
    category: 'wall',
    menuCategory: options.menuCategory ?? 'walls',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...SUPPORT_CHANNELS],
    height,
    yOffset: height / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: options.slopedTop ? wallAnchorsSlopedTop(height) : wallAnchors(height),
    footprint: WALL_FOOTPRINT,
    placeholderMesh: {
      type: 'box',
      size: [UNIT, height, WALL_DEPTH],
    },
    ...(visuals.length === 1 ? { mesh: visuals[0] } : { meshes: visuals }),
  };
};

export const PARTS: PartRegistry = {
  // GLB pivot conventions (measured by scripts/measure-core-parts.mjs):
  // floor pivots sit at the walking surface, foundation pivots at the base.
  'floor.harkonnen.level3.square': {
    id: 'floor.harkonnen.level3.square',
    name: 'Harkonnen Floor',
    category: 'floor',
    menuCategory: 'structural',
    occupancyLayer: 'foundation',
    snapProfile: 'floor',
    snapSourceChannels: [...FLOOR_SOURCE_CHANNELS],
    snapTargetChannels: [...SUPPORT_CHANNELS],
    height: FLOOR_HEIGHT,
    yOffset: FLOOR_HEIGHT / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: FLOOR_SQUARE_ANCHORS,
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
    menuCategory: 'structural',
    occupancyLayer: 'foundation',
    snapProfile: 'floor',
    snapSourceChannels: [...FLOOR_SOURCE_CHANNELS],
    snapTargetChannels: [...SUPPORT_CHANNELS],
    height: FLOOR_HEIGHT,
    yOffset: FLOOR_HEIGHT / 2,
    allowedRotations: TRIANGLE_ROTATIONS,
    anchors: FLOOR_TRIANGLE_ANCHORS,
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
    menuCategory: 'structural',
    occupancyLayer: 'foundation',
    snapProfile: 'foundation',
    snapSourceChannels: [...FOUNDATION_SOURCE_CHANNELS],
    snapTargetChannels: [...FOUNDATION_TARGET_CHANNELS],
    height: FOUNDATION_HEIGHT,
    yOffset: FOUNDATION_HEIGHT / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: FOUNDATION_SQUARE_ANCHORS,
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
    menuCategory: 'structural',
    occupancyLayer: 'foundation',
    snapProfile: 'foundation',
    snapSourceChannels: [...FOUNDATION_SOURCE_CHANNELS],
    snapTargetChannels: [...FOUNDATION_TARGET_CHANNELS],
    height: FOUNDATION_HEIGHT,
    yOffset: FOUNDATION_HEIGHT / 2,
    allowedRotations: TRIANGLE_ROTATIONS,
    anchors: FOUNDATION_TRIANGLE_ANCHORS,
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
    menuCategory: 'walls',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...SUPPORT_CHANNELS],
    height: STANDARD_WALL_HEIGHT,
    yOffset: STANDARD_WALL_HEIGHT / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: wallAnchors(STANDARD_WALL_HEIGHT),
    footprint: WALL_FOOTPRINT,
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
  'wall.harkonnen.level3.straight.02': wallVariant({
    id: 'wall.harkonnen.level3.straight.02',
    name: 'Harkonnen Level 3 Wall Style 2',
    glbs: ['SM_Env_PB_Hark_Level3_Wall_02.glb'],
  }),
  'wall.harkonnen.level3.straight.03': wallVariant({
    id: 'wall.harkonnen.level3.straight.03',
    name: 'Harkonnen Level 3 Wall Style 3',
    glbs: ['SM_Env_PB_Hark_Level3_Wall_03.glb'],
  }),
  'wall.harkonnen.level3.straight.04': wallVariant({
    id: 'wall.harkonnen.level3.straight.04',
    name: 'Harkonnen Level 3 Wall Style 4',
    glbs: ['SM_Env_PB_Hark_Level3_Wall_04.glb'],
  }),
  'wall.harkonnen.level3.straight.05': wallVariant({
    id: 'wall.harkonnen.level3.straight.05',
    name: 'Harkonnen Level 3 Wall Style 5',
    glbs: ['SM_Env_PB_Hark_Level3_Wall_05.glb'],
  }),
  'wall.harkonnen.level3.half': wallVariant({
    id: 'wall.harkonnen.level3.half',
    name: 'Harkonnen Level 3 Half Wall',
    glbs: ['SM_Env_PB_Hark_Level3_Wall_Half.glb'],
    height: HALF_WALL_HEIGHT,
  }),
  'wall.harkonnen.level3.window': wallVariant({
    id: 'wall.harkonnen.level3.window',
    name: 'Harkonnen Level 3 Window Wall',
    glbs: ['SM_Env_PB_Hark_Level3_Window.glb'],
  }),
  'wall.harkonnen.level3.window.glazed': wallVariant({
    id: 'wall.harkonnen.level3.window.glazed',
    name: 'Harkonnen Level 3 Window Wall (Glazed)',
    glbs: ['SM_Env_PB_Hark_Level3_Window.glb', 'SM_Env_PB_Hark_Level3_WindowGlass.glb'],
  }),
  'wall.harkonnen.level3.triangle.bottom.left': wallVariant({
    id: 'wall.harkonnen.level3.triangle.bottom.left',
    name: 'Harkonnen Level 3 Wedge Wall Bottom (Left)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleBottom_L.glb'],
    menuCategory: 'wedge-walls',
    slopedTop: true,
  }),
  'wall.harkonnen.level3.triangle.bottom.right': wallVariant({
    id: 'wall.harkonnen.level3.triangle.bottom.right',
    name: 'Harkonnen Level 3 Wedge Wall Bottom (Right)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleBottom_R.glb'],
    menuCategory: 'wedge-walls',
    slopedTop: true,
  }),
  'wall.harkonnen.level3.triangle.top.left': wallVariant({
    id: 'wall.harkonnen.level3.triangle.top.left',
    name: 'Harkonnen Level 3 Wedge Wall Top (Left)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleTop_L.glb'],
    menuCategory: 'wedge-walls',
  }),
  'wall.harkonnen.level3.triangle.top.right': wallVariant({
    id: 'wall.harkonnen.level3.triangle.top.right',
    name: 'Harkonnen Level 3 Wedge Wall Top (Right)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleTop_R.glb'],
    menuCategory: 'wedge-walls',
  }),
  'wall.harkonnen.level3.triangle.bottom.half.left': wallVariant({
    id: 'wall.harkonnen.level3.triangle.bottom.half.left',
    name: 'Harkonnen Level 3 Half Wedge Wall Bottom (Left)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleBottom_Half_L.glb'],
    height: HALF_WALL_HEIGHT,
    menuCategory: 'wedge-walls',
    slopedTop: true,
  }),
  'wall.harkonnen.level3.triangle.bottom.half.right': wallVariant({
    id: 'wall.harkonnen.level3.triangle.bottom.half.right',
    name: 'Harkonnen Level 3 Half Wedge Wall Bottom (Right)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleBottom_Half_R.glb'],
    height: HALF_WALL_HEIGHT,
    menuCategory: 'wedge-walls',
    slopedTop: true,
  }),
  'wall.harkonnen.level3.triangle.top.half.left': wallVariant({
    id: 'wall.harkonnen.level3.triangle.top.half.left',
    name: 'Harkonnen Level 3 Half Wedge Wall Top (Left)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleTop_Half_L.glb'],
    height: HALF_WALL_HEIGHT,
    menuCategory: 'wedge-walls',
  }),
  'wall.harkonnen.level3.triangle.top.half.right': wallVariant({
    id: 'wall.harkonnen.level3.triangle.top.half.right',
    name: 'Harkonnen Level 3 Half Wedge Wall Top (Right)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleTop_Half_R.glb'],
    height: HALF_WALL_HEIGHT,
    menuCategory: 'wedge-walls',
  }),
  'wall.harkonnen.level3.triangle.bottom.tall.left': wallVariant({
    id: 'wall.harkonnen.level3.triangle.bottom.tall.left',
    name: 'Harkonnen Level 3 Tall Wedge Wall Bottom (Left)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleBottom_Tall_L.glb'],
    height: TALL_WALL_HEIGHT,
    menuCategory: 'wedge-walls',
    slopedTop: true,
  }),
  'wall.harkonnen.level3.triangle.bottom.tall.right': wallVariant({
    id: 'wall.harkonnen.level3.triangle.bottom.tall.right',
    name: 'Harkonnen Level 3 Tall Wedge Wall Bottom (Right)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleBottom_Tall_R.glb'],
    height: TALL_WALL_HEIGHT,
    menuCategory: 'wedge-walls',
    slopedTop: true,
  }),
  'wall.harkonnen.level3.triangle.top.tall.left': wallVariant({
    id: 'wall.harkonnen.level3.triangle.top.tall.left',
    name: 'Harkonnen Level 3 Tall Wedge Wall Top (Left)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleTop_Tall_L.glb'],
    height: TALL_WALL_HEIGHT,
    menuCategory: 'wedge-walls',
  }),
  'wall.harkonnen.level3.triangle.top.tall.right': wallVariant({
    id: 'wall.harkonnen.level3.triangle.top.tall.right',
    name: 'Harkonnen Level 3 Tall Wedge Wall Top (Right)',
    glbs: ['SM_Env_PB_Hark_Level3_WallTriangleTop_Tall_R.glb'],
    height: TALL_WALL_HEIGHT,
    menuCategory: 'wedge-walls',
  }),
  'wall.harkonnen.level3.corner.tall': {
    id: 'wall.harkonnen.level3.corner.tall',
    name: 'Harkonnen Level 3 Tall Wall Corner',
    category: 'wall-corner',
    menuCategory: 'walls',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...SUPPORT_CHANNELS],
    height: TALL_WALL_HEIGHT,
    yOffset: TALL_WALL_HEIGHT / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: [
      {
        id: 'edge.corner-front',
        kind: 'edge',
        role: 'foundation-edge',
        start: [-HALF, 0, -HALF],
        end: [HALF, 0, -HALF],
        normal: [0, 0, 1],
        channels: ['floor-support'],
      },
      {
        id: 'edge.corner-side',
        kind: 'edge',
        role: 'foundation-edge',
        start: [HALF, 0, HALF],
        end: [HALF, 0, -HALF],
        normal: [1, 0, 0],
        channels: ['floor-support'],
      },
      {
        id: 'edge.corner-front.top',
        kind: 'edge',
        role: 'foundation-edge',
        start: [-HALF, TALL_WALL_HEIGHT, -HALF],
        end: [HALF, TALL_WALL_HEIGHT, -HALF],
        normal: [0, 0, 1],
        channels: SUPPORT_CHANNELS,
        source: false,
      },
      {
        id: 'edge.corner-side.top',
        kind: 'edge',
        role: 'foundation-edge',
        start: [HALF, TALL_WALL_HEIGHT, HALF],
        end: [HALF, TALL_WALL_HEIGHT, -HALF],
        normal: [1, 0, 0],
        channels: SUPPORT_CHANNELS,
        source: false,
      },
    ],
    footprint: SQUARE_FOOTPRINT,
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
    menuCategory: 'walls',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...SUPPORT_CHANNELS],
    height: TALL_WALL_HEIGHT,
    yOffset: TALL_WALL_HEIGHT / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: wallAnchors(TALL_WALL_HEIGHT),
    footprint: DOOR_FOOTPRINT,
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
    menuCategory: 'walls',
    occupancyLayer: 'wall-edge',
    snapProfile: 'wall',
    snapSourceChannels: [...WALL_SOURCE_CHANNELS],
    snapTargetChannels: [...SUPPORT_CHANNELS],
    height: STANDARD_WALL_HEIGHT,
    yOffset: STANDARD_WALL_HEIGHT / 2,
    allowedRotations: STANDARD_ROTATIONS,
    anchors: wallAnchors(STANDARD_WALL_HEIGHT),
    footprint: DOOR_FOOTPRINT,
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
