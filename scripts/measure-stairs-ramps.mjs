// Pivot-relative bounds for stair/ramp GLBs — informs registry anchors/offsets.
// Placement truth stays in v2/registry/parts.ts; this only measures the visuals.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';

const ROOT = process.cwd();
const FILES = [
  'SM_Env_PB_Hark_Level3_Stairs.glb',
  'SM_Env_PB_Hark_Level3_Stairs_Half.glb',
  'SM_Env_PB_Hark_Level3_Ramp.glb',
  'SM_Env_PB_Hark_Level3_Ramp_Half.glb',
];

const parseGlbJson = async (filePath) => {
  const buffer = await readFile(filePath);
  if (buffer.toString('utf8', 0, 4) !== 'glTF') throw new Error(`${filePath} is not GLB`);
  let offset = 12;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString('utf8', offset + 4, offset + 8);
    const chunkStart = offset + 8;
    if (chunkType === 'JSON') return JSON.parse(buffer.toString('utf8', chunkStart, chunkStart + chunkLength).replace(/\0+$/g, ''));
    offset = chunkStart + chunkLength;
  }
  throw new Error('no JSON chunk');
};
const composeNodeMatrix = (node = {}) => {
  if (node.matrix) return new THREE.Matrix4().fromArray(node.matrix);
  const t = new THREE.Vector3(...(node.translation ?? [0, 0, 0]));
  const r = new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1]));
  const s = new THREE.Vector3(...(node.scale ?? [1, 1, 1]));
  return new THREE.Matrix4().compose(t, r, s);
};

for (const file of FILES) {
  const json = await parseGlbJson(path.join(ROOT, 'public/assets/parts/harkonnen', file));
  const box = new THREE.Box3();
  const rootNodes = (json.scenes ?? [])[json.scene ?? 0]?.nodes ?? [];
  const walk = (nodeIndex, parentMatrix) => {
    const node = json.nodes[nodeIndex];
    const matrix = parentMatrix.clone().multiply(composeNodeMatrix(node));
    if (node.mesh !== undefined) {
      for (const prim of json.meshes[node.mesh].primitives ?? []) {
        const accessor = json.accessors[prim.attributes?.POSITION];
        if (!accessor?.min || !accessor?.max) continue;
        const [ax, ay, az] = accessor.min, [bx, by, bz] = accessor.max;
        for (const x of [ax, bx]) for (const y of [ay, by]) for (const z of [az, bz]) box.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
      }
    }
    for (const child of node.children ?? []) walk(child, matrix);
  };
  for (const nodeIndex of rootNodes) walk(nodeIndex, new THREE.Matrix4());
  const f = (v) => v.toArray().map((n) => Number(n.toFixed(3)));
  console.log(file.replace('SM_Env_PB_Hark_Level3_',''), 'min', f(box.min), 'max', f(box.max));
}
