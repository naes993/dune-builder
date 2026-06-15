import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Loads the obfuscated model blobs produced by scripts/obfuscate-assets.mjs.
// Models ship as XOR-transformed `.pak` files under opaque sha256 names; this
// reverses the transform in memory and hands the real GLB buffer to Three.js, so
// the plain models never touch the network or disk cache as valid GLBs. The
// secret/transform MUST stay byte-for-byte identical to the build script.
//
// This is deliberate friction, not DRM: a determined reverse-engineer can still
// reconstruct this from the bundle. The secret is stored base64-encoded (not as a
// plain string literal) so it can't be found by grepping the minified bundle for
// recognizable text; the build script keeps the matching plain value.
const secretBytes = new TextEncoder().encode(
  atob('YXJ4LXN0dWRpbzo6aGFya29ubmVuOjp2Mjo6a2V5c3RyZWFtOjpkby1ub3Qtc2hhcmU6OjhmM2E=')
);
const loader = new GLTFLoader();

const toHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

const sha256Hex = async (text: string) =>
  toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));

const decode = (data: Uint8Array, salt: Uint8Array): Uint8Array => {
  const out = new Uint8Array(data.length);
  for (let i = 0; i < data.length; i += 1) {
    out[i] = data[i] ^ secretBytes[i % secretBytes.length] ^ salt[i % salt.length];
  }
  return out;
};

const loadGltf = async (logicalUrl: string): Promise<GLTF> => {
  const hash = (await sha256Hex(logicalUrl)).slice(0, 32);
  const response = await fetch(`/assets/m/${hash}.pak`);
  if (!response.ok) throw new Error(`Failed to load model (${response.status})`);
  const encoded = new Uint8Array(await response.arrayBuffer());
  const decoded = decode(encoded, new TextEncoder().encode(hash));
  return new Promise<GLTF>((resolve, reject) => loader.parse(decoded.buffer, '', resolve, reject));
};

type CacheEntry = {
  status: 'pending' | 'done' | 'error';
  promise: Promise<void>;
  gltf?: GLTF;
  error?: unknown;
};

const cache = new Map<string, CacheEntry>();

const startLoad = (url: string): CacheEntry => {
  const entry: CacheEntry = { status: 'pending', promise: Promise.resolve() };
  entry.promise = loadGltf(url)
    .then((gltf) => {
      entry.status = 'done';
      entry.gltf = gltf;
    })
    .catch((error) => {
      entry.status = 'error';
      entry.error = error;
    });
  cache.set(url, entry);
  return entry;
};

/** Suspense-compatible: throws a promise while loading, throws on error, else returns the GLTF. */
export const useObfuscatedGltf = (url: string): GLTF => {
  const entry = cache.get(url) ?? startLoad(url);
  if (entry.status === 'pending') throw entry.promise;
  if (entry.status === 'error') throw entry.error;
  return entry.gltf as GLTF;
};

/** Kick off a load ahead of time so first selection never blocks rendering. */
export const preloadObfuscatedGltf = (url: string): void => {
  if (!cache.has(url)) startLoad(url);
};
