// Probe: new wall variants snap onto a foundation's top edges like Wall_01.
import { solvePlacement } from '../v2/engine/snapSolver';
import { V2_FOUNDATION_HEIGHT, V2_UNIT_SIZE } from '../v2/constants';
import { PartId, PartInstance } from '../v2/types';

const HALF = V2_UNIT_SIZE / 2;

const instances: PartInstance[] = [
  {
    id: 'foundation-1',
    partId: 'foundation.harkonnen.level3.square',
    transform: { position: [0, 0, 0], rotationY: 0 },
  },
];

const probe = (partId: PartId) => {
  const result = solvePlacement({
    cursor: [0, V2_FOUNDATION_HEIGHT, HALF],
    activePartId: partId,
    rotationY: 0,
    instances,
  });
  console.log(partId.padEnd(52), {
    mode: result.placementMode,
    valid: result.isValid,
    y: Number(result.transform.position[1].toFixed(3)),
    z: Number(result.transform.position[2].toFixed(3)),
  });
};

([
  'wall.harkonnen.level3.straight',
  'wall.harkonnen.level3.straight.02',
  'wall.harkonnen.level3.straight.05',
  'wall.harkonnen.level3.half',
  'wall.harkonnen.level3.window.glazed',
  'wall.harkonnen.level3.triangle.bottom.left',
  'wall.harkonnen.level3.triangle.top.tall.right',
] as PartId[]).forEach(probe);
