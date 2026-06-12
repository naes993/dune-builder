// Repro: floor snapping around a wall standing on a foundation's north top edge.
import { solvePlacement } from '../v2/engine/snapSolver';
import { V2_FOUNDATION_HEIGHT, V2_UNIT_SIZE } from '../v2/constants';
import { PartInstance } from '../v2/types';

const HALF = V2_UNIT_SIZE / 2;

const instances: PartInstance[] = [
  {
    id: 'foundation-1',
    partId: 'foundation.harkonnen.level3.square',
    transform: { position: [0, 0, 0], rotationY: 0 },
  },
  {
    id: 'wall-1',
    partId: 'wall.harkonnen.level3.straight',
    // standing on the foundation's north top edge
    transform: { position: [0, V2_FOUNDATION_HEIGHT, HALF], rotationY: 0 },
  },
];

const probe = (label: string, cursor: [number, number, number]) => {
  const result = solvePlacement({
    cursor,
    activePartId: 'floor.harkonnen.level3.square',
    rotationY: 0,
    instances,
  });
  console.log(label, {
    mode: result.placementMode,
    valid: result.isValid,
    reasons: result.reasons,
    target: result.binding?.targetAnchorId,
    y: Number(result.transform.position[1].toFixed(3)),
  });
};

probe('high on wall   ', [0, 6.5, HALF]);
probe('low on wall    ', [0, 4.2, HALF]);
probe('on foundation  ', [0, V2_FOUNDATION_HEIGHT, 1.0]);
probe('ground nearby  ', [0, 0, HALF + 1]);

// Add the overhang floor at the wall top, then probe wall placement below its
// outer edge — expect the downward variant hanging from the overhang.
instances.push({
  id: 'overhang-1',
  partId: 'floor.harkonnen.level3.square',
  transform: { position: [0, 7.4201, V2_UNIT_SIZE], rotationY: 0 },
});

const probeWall = (label: string, cursor: [number, number, number]) => {
  const result = solvePlacement({
    cursor,
    activePartId: 'wall.harkonnen.level3.straight',
    rotationY: 0,
    instances,
  });
  console.log(label, {
    mode: result.placementMode,
    valid: result.isValid,
    reasons: result.reasons,
    target: result.binding?.targetAnchorId,
    slot: result.binding?.occupancyKey,
    y: Number(result.transform.position[1].toFixed(3)),
  });
};

probeWall('under overhang edge (low cursor) ', [0, 1.0, V2_UNIT_SIZE + HALF]);
probeWall('on overhang surface (high cursor)', [0, 7.8, V2_UNIT_SIZE + HALF]);

// A lone wall on open ground: floors must attach to its base on BOTH sides.
const loneWall: PartInstance[] = [
  {
    id: 'wall-lone',
    partId: 'wall.harkonnen.level3.straight',
    transform: { position: [50, 0, 50], rotationY: 0 },
  },
];

const probeSide = (label: string, cursor: [number, number, number]) => {
  const result = solvePlacement({
    cursor,
    activePartId: 'floor.harkonnen.level3.square',
    rotationY: 0,
    instances: loneWall,
  });
  console.log(label, {
    mode: result.placementMode,
    valid: result.isValid,
    target: result.binding?.targetAnchorId,
    z: Number(result.transform.position[2].toFixed(3)),
    y: Number(result.transform.position[1].toFixed(3)),
  });
};

probeSide('floor north of lone wall base', [50, 0.4, 51.5]);
probeSide('floor south of lone wall base', [50, 0.4, 48.5]);
