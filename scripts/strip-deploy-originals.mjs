// Post-build: remove the plain GLBs from dist so only the obfuscated `.pak`
// blobs (public/assets/m → dist/assets/m) are deployed. Vite copies all of
// public/ into dist, including the original models, so they must be stripped
// here or they'd be served at their predictable named paths.
import { rm, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const ORIGINALS = path.join(ROOT, 'dist/assets/parts/harkonnen');
const OBF_DIR = path.join(ROOT, 'dist/assets/m');

await rm(ORIGINALS, { recursive: true, force: true });

let pak = 0;
try {
  pak = (await readdir(OBF_DIR)).filter((f) => f.endsWith('.pak')).length;
} catch {
  pak = 0;
}

if (pak === 0) {
  console.error('ERROR: no obfuscated models in dist/assets/m — deploy would have no models.');
  process.exit(1);
}
console.log(`Stripped plain GLBs from dist; ${pak} obfuscated .pak remain.`);
