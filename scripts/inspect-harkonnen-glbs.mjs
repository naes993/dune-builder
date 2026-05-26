import { readdir, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';

const ROOT = process.cwd();
const PARTS_DIR = path.join(ROOT, 'public/assets/parts/harkonnen');
const REFERENCE_DIR = path.join(ROOT, 'public/assets/reference');
const REPORT_PATH = path.join(ROOT, 'v2/registry/HARKONNEN_ASSET_AUDIT.md');
const MANIFEST_PATH = path.join(ROOT, 'v2/registry/harkonnenAssetManifest.json');

const round = (value) => Number(value.toFixed(4));

const listGlbs = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.glb'))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
};

const parseGlbJson = async (filePath) => {
  const buffer = await readFile(filePath);
  if (buffer.toString('utf8', 0, 4) !== 'glTF') {
    throw new Error(`${filePath} is not a binary GLB file`);
  }

  let offset = 12;
  while (offset < buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.toString('utf8', offset + 4, offset + 8);
    const chunkStart = offset + 8;

    if (chunkType === 'JSON') {
      const jsonText = buffer.toString('utf8', chunkStart, chunkStart + chunkLength).replace(/\0+$/g, '');
      return JSON.parse(jsonText);
    }

    offset = chunkStart + chunkLength;
  }

  throw new Error(`${filePath} does not contain a JSON chunk`);
};

const composeNodeMatrix = (node = {}) => {
  if (node.matrix) {
    return new THREE.Matrix4().fromArray(node.matrix);
  }

  const translation = new THREE.Vector3(...(node.translation ?? [0, 0, 0]));
  const rotation = new THREE.Quaternion(...(node.rotation ?? [0, 0, 0, 1]));
  const scale = new THREE.Vector3(...(node.scale ?? [1, 1, 1]));
  return new THREE.Matrix4().compose(translation, rotation, scale);
};

const expandBoxByAccessorBounds = (box, accessor, worldMatrix) => {
  if (!accessor?.min || !accessor?.max) return;

  const [minX, minY, minZ] = accessor.min;
  const [maxX, maxY, maxZ] = accessor.max;
  const corners = [
    [minX, minY, minZ],
    [minX, minY, maxZ],
    [minX, maxY, minZ],
    [minX, maxY, maxZ],
    [maxX, minY, minZ],
    [maxX, minY, maxZ],
    [maxX, maxY, minZ],
    [maxX, maxY, maxZ],
  ];

  for (const corner of corners) {
    box.expandByPoint(new THREE.Vector3(...corner).applyMatrix4(worldMatrix));
  }
};

const visitNode = (json, nodeIndex, parentMatrix, box, meshIndices) => {
  const node = json.nodes?.[nodeIndex];
  if (!node) return;

  const worldMatrix = parentMatrix.clone().multiply(composeNodeMatrix(node));

  if (typeof node.mesh === 'number') {
    meshIndices.add(node.mesh);
    const mesh = json.meshes?.[node.mesh];
    for (const primitive of mesh?.primitives ?? []) {
      const positionAccessorIndex = primitive.attributes?.POSITION;
      expandBoxByAccessorBounds(box, json.accessors?.[positionAccessorIndex], worldMatrix);
    }
  }

  for (const childIndex of node.children ?? []) {
    visitNode(json, childIndex, worldMatrix, box, meshIndices);
  }
};

const computeBounds = (json) => {
  const box = new THREE.Box3();
  const meshIndices = new Set();
  const sceneIndices = json.scenes?.[json.scene ?? 0]?.nodes ?? json.nodes?.map((_, index) => index) ?? [];

  for (const nodeIndex of sceneIndices) {
    visitNode(json, nodeIndex, new THREE.Matrix4(), box, meshIndices);
  }

  if (box.isEmpty()) {
    return {
      min: null,
      max: null,
      size: null,
    };
  }

  const size = new THREE.Vector3();
  box.getSize(size);

  return {
    min: [round(box.min.x), round(box.min.y), round(box.min.z)],
    max: [round(box.max.x), round(box.max.y), round(box.max.z)],
    size: [round(size.x), round(size.y), round(size.z)],
  };
};

const stripExtension = (fileName) => fileName.replace(/\.glb$/i, '');
const baseForCollisionPair = (fileName) => stripExtension(fileName).replace(/_COL$/i, '');

const inferFamily = (fileName) => {
  const baseName = stripExtension(fileName);
  return baseName
    .replace(/^S[MK]_/, '')
    .replace(/_(Half|Tall|In|Inv|L|R|MD|Wide|Village|Glass|Translucent|\d{2})$/g, '')
    .replace(/_(Top|Bottom|Corner|RoundCorner|Wedge|Frame|Door|Gate|Panes)$/g, '');
};

const isScaleCalibrationCandidate = (asset) => {
  return /Floor|Foundation|Ceiling|Tile|RoofTop/i.test(asset.fileName);
};

const inferPlanShape = (asset) => {
  const name = asset.fileName;
  if (/Wedge/i.test(name)) return 'triangular/wedge';
  if (/RoundCorner|Corner/i.test(name)) return 'corner';
  if (/Floor|Foundation|RoofTop/i.test(name)) return 'square';
  return 'unknown';
};

const isCanonicalScaleCandidate = (asset) => {
  return [
    'SM_Env_PB_Hark_Level3_Floor.glb',
    'SM_Env_PB_Hark_Level3_Foundation.glb',
    'SM_Env_PB_Hark_Level3_RoofTop_02.glb',
  ].includes(asset.fileName);
};

const classify = (fileName, relativePath) => {
  const containsCollisionSuffix = /_COL(?:\.glb)?$/i.test(fileName);
  const isReferencePath = relativePath.includes('/reference/');
  return containsCollisionSuffix || isReferencePath ? 'collision-reference' : 'visual';
};

const inspectFile = async (filePath, collisionBases) => {
  const json = await parseGlbJson(filePath);
  const fileName = path.basename(filePath);
  const relativePath = path.relative(ROOT, filePath).replaceAll(path.sep, '/');
  const materialNames = (json.materials ?? []).map((material) => material.name ?? '(unnamed)');
  const meshCount = json.meshes?.length ?? 0;
  const childCount = json.nodes?.length ?? 0;
  const containsCollisionSuffix = /_COL(?:\.glb)?$/i.test(fileName);
  const pairBase = baseForCollisionPair(fileName);
  const likelyCollisionPair = containsCollisionSuffix
    ? null
    : collisionBases.get(pairBase) ?? null;

  const asset = {
    fileName,
    path: relativePath,
    classification: classify(fileName, relativePath),
    containsCOL: containsCollisionSuffix,
    likelyBaseAssetName: pairBase,
    likelyCollisionPair,
    bounds: computeBounds(json),
    materialNames,
    hasExtMaterial: materialNames.some((name) => name.includes('_Ext')),
    hasIntMaterial: materialNames.some((name) => name.includes('_Int')),
    meshCount,
    childCount,
    family: inferFamily(fileName),
    scaleCalibrationCandidate: false,
    apparentPlanShape: 'unknown',
    goodCanonicalSizeCandidate: false,
  };

  return {
    ...asset,
    scaleCalibrationCandidate: isScaleCalibrationCandidate(asset),
    apparentPlanShape: inferPlanShape(asset),
    goodCanonicalSizeCandidate: isCanonicalScaleCandidate(asset),
  };
};

const formatSize = (size) => size ? size.map((value) => value.toFixed(3)).join(' x ') : 'n/a';
const formatList = (values) => values.length ? values.join(', ') : 'none';

const makeMarkdown = (manifest) => {
  const visualAssets = manifest.assets.filter((asset) => asset.classification === 'visual');
  const referenceAssets = manifest.referenceAssets;
  const extAssets = visualAssets.filter((asset) => asset.hasExtMaterial);
  const intAssets = visualAssets.filter((asset) => asset.hasIntMaterial);
  const pairedAssets = visualAssets.filter((asset) => asset.likelyCollisionPair);
  const calibrationCandidates = visualAssets.filter(isScaleCalibrationCandidate);
  const families = Map.groupBy(visualAssets, (asset) => asset.family);

  const familyLines = [...families.entries()]
    .filter(([, assets]) => assets.length > 1)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([family, assets]) => `- ${family}: ${assets.map((asset) => asset.fileName).join(', ')}`)
    .join('\n');

  const tableRows = visualAssets.map((asset) => [
    asset.fileName,
    asset.classification,
    asset.containsCOL ? 'yes' : 'no',
    formatSize(asset.bounds.size),
    asset.meshCount,
    asset.childCount,
    asset.hasExtMaterial ? 'yes' : 'no',
    asset.hasIntMaterial ? 'yes' : 'no',
    asset.likelyCollisionPair ?? '',
    asset.materialNames.join('<br>'),
  ]);

  const referenceRows = referenceAssets.map((asset) => [
    asset.fileName,
    asset.containsCOL ? 'yes' : 'no',
    formatSize(asset.bounds.size),
    asset.meshCount,
    asset.childCount,
    asset.materialNames.join('<br>'),
  ]);

  const calibrationRows = calibrationCandidates.map((asset) => [
    asset.fileName,
    formatSize(asset.bounds.size),
    asset.materialNames.join('<br>'),
    asset.hasExtMaterial ? 'yes' : 'no',
    asset.hasIntMaterial ? 'yes' : 'no',
    inferPlanShape(asset),
    isCanonicalScaleCandidate(asset) ? 'yes' : 'maybe',
  ]);

  return `# Harkonnen GLB Asset Audit

Generated by \`node scripts/inspect-harkonnen-glbs.mjs\`.

This audit is inventory only. V2 placement truth still comes from logical part data: registry bounds, footprints, anchors, placement rules, and occupancy. GLB bounds, pivots, mesh centers, and \`_COL\` files must not drive snapping, placement, occupancy, or collision.

## Summary

- Visual GLBs scanned: ${visualAssets.length}
- Reference/collision GLBs detected: ${referenceAssets.length}
- Visual GLBs with \`_Ext\` materials: ${extAssets.length}
- Visual GLBs with \`_Int\` materials: ${intAssets.length}
- Visual GLBs with likely \`_COL\` reference pairs: ${pairedAssets.length}

## Reference / Collision Assets

\`_COL\` files are reference only for now and should not be registered as placeable visual parts.

| File | Contains \`_COL\` | Approx size X/Y/Z | Meshes | Nodes | Materials |
| --- | --- | --- | ---: | ---: | --- |
${referenceRows.map((row) => `| ${row.join(' | ')} |`).join('\n')}

## Likely Asset Families

${familyLines || '- No multi-file families detected.'}

## Foundation/Floor Scale Calibration Candidates

These are inventory candidates for calibrating V2 scale from real game floor/foundation assets. They are not registered here, and their GLB bounds should not become placement truth by themselves.

| File | Approx size X/Y/Z | Materials | Has \`_Ext\` | Has \`_Int\` | Apparent plan shape | Good canonical size candidate |
| --- | --- | --- | --- | --- | --- | --- |
${calibrationRows.map((row) => `| ${row.join(' | ')} |`).join('\n')}

### Scale Recommendation

- Likely real square floor/foundation visual span: about 5.3 to 5.6 units on X/Z.
- Best square calibration candidates: \`SM_Env_PB_Hark_Level3_Floor.glb\` at 5.317 x 5.317, \`SM_Env_PB_Hark_Level3_Foundation.glb\` at 5.570 x 5.590, and \`SM_Env_PB_Hark_Level3_RoofTop_02.glb\` at 5.318 x 5.318.
- Likely triangular/wedge family span: about 5.4 units wide by 4.7 to 4.9 units deep from \`FloorWedge\`, \`FoundationWedge\`, and \`RoofTopWedge\`; this is not enough evidence to define the final triangle anchor geometry without visual inspection.
- Current V2 placeholder \`UNIT\` is 4, so it is likely too small compared with real Harkonnen floor/foundation visuals by roughly 25 to 40 percent depending on whether the canonical target is the floor tile or the thicker foundation piece.
- Walls should be aligned to real foundation/floor logical edges after the canonical floor size is chosen, not scaled or offset to fit the temporary placeholder edge.
- Current wall overhang against placeholder foundations is more likely a placeholder scale mismatch than proof that the wall visual offsets are wrong. Manual transform tuning may still be needed after real foundation visuals are installed.

## Visual Asset Inventory

| File | Class | Contains \`_COL\` | Approx size X/Y/Z | Meshes | Nodes | Has \`_Ext\` | Has \`_Int\` | Likely \`_COL\` pair | Materials |
| --- | --- | --- | --- | ---: | ---: | --- | --- | --- | --- |
${tableRows.map((row) => `| ${row.join(' | ')} |`).join('\n')}

## Recommended Next Registration Batch

Register these as a small controlled batch after defining logical footprints and anchors manually:

1. Straight wall: \`SM_Env_PB_Hark_Level3_Wall_01.glb\`
   - Good first straight wall candidate. It has both \`_Ext\` and \`_Int\` materials.
2. Wall corner: \`SM_Env_PB_Hark_Level3_WallCorner_Tall.glb\`
   - Clear corner/wall role and includes both \`_Ext\` and \`_Int\` materials.
3. Inclined wall: \`SM_Env_PB_Hark_Level3_WallInclined_Tall.glb\`
   - Has a matching reference file: \`SM_Env_PB_Hark_Level3_WallInclined_Tall_COL.glb\`. Treat that reference file as inspection context only.
4. Door assembly: \`SM_Env_PB_Hark_Level3_DoorFrame.glb\` + existing \`SM_Env_PB_Hark_Level3_Door.glb\`
   - The frame/door naming is clear enough for a minimal assembly test. Keep logical wall-edge occupancy separate from mesh bounds.

## Material Notes

- Exterior mapping candidate files: ${formatList(extAssets.map((asset) => asset.fileName))}
- Interior mapping candidate files: ${formatList(intAssets.map((asset) => asset.fileName))}
- Visual assets without \`_Ext\` or \`_Int\` should fall back to part-level overrides if registered later.
`;
};

const main = async () => {
  const [partFiles, referenceFiles] = await Promise.all([
    listGlbs(PARTS_DIR),
    listGlbs(REFERENCE_DIR).catch(() => []),
  ]);

  const collisionBases = new Map(
    referenceFiles
      .filter((filePath) => /_COL\.glb$/i.test(path.basename(filePath)))
      .map((filePath) => [baseForCollisionPair(path.basename(filePath)), path.basename(filePath)])
  );

  const assets = await Promise.all(partFiles.map((filePath) => inspectFile(filePath, collisionBases)));
  const referenceAssets = await Promise.all(
    referenceFiles
      .filter((filePath) => /_COL\.glb$/i.test(path.basename(filePath)))
      .map((filePath) => inspectFile(filePath, collisionBases))
  );

  const manifest = {
    generatedAt: new Date().toISOString(),
    sourceDirectory: path.relative(ROOT, PARTS_DIR).replaceAll(path.sep, '/'),
    referenceDirectory: path.relative(ROOT, REFERENCE_DIR).replaceAll(path.sep, '/'),
    notes: [
      'Inventory only. Do not use GLB bounds, pivots, centers, or _COL files as placement truth.',
      '_COL files are collision/reference assets only and must not be registered as selectable visual parts.',
    ],
    assets,
    referenceAssets,
  };

  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(REPORT_PATH, makeMarkdown(manifest));

  console.log(`Scanned ${assets.length} Harkonnen visual GLBs.`);
  console.log(`Detected ${referenceAssets.length} _COL reference GLBs.`);
  console.log(`Wrote ${path.relative(ROOT, MANIFEST_PATH)}`);
  console.log(`Wrote ${path.relative(ROOT, REPORT_PATH)}`);
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
