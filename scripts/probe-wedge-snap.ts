import { solvePlacement } from '../v2/engine/snapSolver';
import { V2_FOUNDATION_HEIGHT, V2_UNIT_SIZE } from '../v2/constants';
import { PartId, PartInstance } from '../v2/types';

const HALF = V2_UNIT_SIZE / 2;
const instances: PartInstance[] = [
  { id: 'f1', partId: 'foundation.harkonnen.level3.square', transform: { position: [0,0,0], rotationY: 0 } },
];

// Cursor hovering just over the north top edge of the foundation.
const cursor: [number, number, number] = [0, V2_FOUNDATION_HEIGHT, HALF];

const parts: PartId[] = [
  'wall.harkonnen.level3.straight',
  'wall.harkonnen.level3.half',
  'wall.harkonnen.level3.triangle.bottom.left',
  'wall.harkonnen.level3.triangle.top.left',
  'wall.harkonnen.level3.triangle.bottom.half.left',
  'wall.harkonnen.level3.triangle.top.half.left',
  'wall.harkonnen.level3.triangle.bottom.tall.left',
  'wall.harkonnen.level3.triangle.top.tall.left',
];

for (const partId of parts) {
  const res = solvePlacement({ cursor, activePartId: partId, rotationY: 0, instances });
  console.log(
    partId.replace('wall.harkonnen.level3.', '').padEnd(26),
    'mode=' + res.placementMode.padEnd(13),
    'y=' + res.transform.position[1].toFixed(3).padStart(8),
    'tgt=' + (res.binding?.targetAnchorId ?? '-'),
    'valid=' + res.isValid
  );
}
