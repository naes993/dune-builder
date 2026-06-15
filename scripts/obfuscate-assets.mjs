// Build-time asset obfuscation.
//
// The Harkonnen GLBs are served publicly (Sean's decision) but we make casual
// extraction hard: each model is XOR-transformed with an app secret + a per-file
// salt and written under an opaque sha256 name with a non-model extension. A
// downloaded `.pak` is not a valid GLB (even the "glTF" magic is gone); only the
// in-app loader (v2/scene/obfuscatedGltf.ts) reverses it in memory. The transform
// here MUST stay byte-for-byte identical to that loader's `decode`.
import { readdir, readFile, writeFile, rm, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

// KEEP IN SYNC with OBF_SECRET in v2/scene/obfuscatedGltf.ts.
const SECRET = 'arx-studio::harkonnen::v2::keystream::do-not-share::8f3a';

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'public/assets/parts/harkonnen');
const OUT_DIR = path.join(ROOT, 'public/assets/m');
const URL_PREFIX = '/assets/parts/harkonnen'; // must match the urls in v2/registry/parts.ts

const sha256hex = (str) => createHash('sha256').update(str, 'utf8').digest('hex');

const transform = (data, saltBytes) => {
  const secret = Buffer.from(SECRET, 'utf8');
  const out = Buffer.allocUnsafe(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = data[i] ^ secret[i % secret.length] ^ saltBytes[i % saltBytes.length];
  }
  return out;
};

const files = (await readdir(SRC_DIR)).filter((f) => f.toLowerCase().endsWith('.glb'));
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

let count = 0;
for (const file of files) {
  const logicalUrl = `${URL_PREFIX}/${file}`;
  const hash = sha256hex(logicalUrl).slice(0, 32);
  const salt = Buffer.from(hash, 'utf8');
  const data = await readFile(path.join(SRC_DIR, file));
  await writeFile(path.join(OUT_DIR, `${hash}.pak`), transform(data, salt));
  count += 1;
}

console.log(`Obfuscated ${count} GLB(s) → public/assets/m/*.pak`);
