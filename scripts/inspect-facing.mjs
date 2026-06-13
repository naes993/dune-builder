// Throwaway probe: for wall/door GLBs, report each primitive's material name
// and its POSITION accessor z-range, to learn which local Z side the _Ext
// (exterior) and _Int (interior) faces sit on.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const FILES = [
  'public/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_Wall_01.glb',
  'public/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_DoorFrame.glb',
  'public/assets/parts/harkonnen/SM_Env_PB_Hark_Level3_WallInclined_Tall.glb',
];

const parseGlb = async (filePath) => {
  const buffer = await readFile(filePath);
  let offset = 12;
  let json = null;
  let bin = null;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString('utf8', offset + 4, offset + 8);
    const chunkStart = offset + 8;
    if (chunkType === 'JSON') {
      json = JSON.parse(buffer.toString('utf8', chunkStart, chunkStart + chunkLength).replace(/\0+$/g, ''));
    } else if (chunkType.startsWith('BIN')) {
      bin = buffer.subarray(chunkStart, chunkStart + chunkLength);
    }
    offset = chunkStart + chunkLength;
  }
  return { json, bin };
};

const meanZ = (json, bin, accessorIndex) => {
  const accessor = json.accessors[accessorIndex];
  const view = json.bufferViews[accessor.bufferView];
  const byteOffset = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const stride = view.byteStride ?? 12;
  let sum = 0;
  for (let i = 0; i < accessor.count; i += 1) {
    sum += bin.readFloatLE(byteOffset + i * stride + 8);
  }
  return sum / accessor.count;
};

for (const file of FILES) {
  const { json, bin } = await parseGlb(file);
  console.log(`\n${path.basename(file)}`);
  for (const mesh of json.meshes ?? []) {
    for (const primitive of mesh.primitives ?? []) {
      const material = json.materials?.[primitive.material]?.name ?? '(none)';
      const accessor = json.accessors[primitive.attributes.POSITION];
      const avg = meanZ(json, bin, primitive.attributes.POSITION);
      console.log(
        `  ${material.padEnd(48)} zRange [${accessor.min[2].toFixed(3)}, ${accessor.max[2].toFixed(3)}] meanZ ${avg.toFixed(3)}`
      );
    }
  }
}
