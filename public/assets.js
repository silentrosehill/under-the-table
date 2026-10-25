// Shared loaders for the compressed game assets in /assets (see tools/build-assets.mjs, CREDITS.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const textures = new THREE.TextureLoader();
const cache = new Map();

// Everything still downloading, so a scene can wait for its assets before it compiles shaders and shows itself (see warm.js).
// Failures count as done: a missing file must never hold the loading screen.
const pending = new Set();
export const track = p => { const q = p.then(() => {}, () => {}).then(() => pending.delete(q)); pending.add(q); return p; };
export async function whenIdle(timeout = 20000) {
  const end = performance.now() + timeout;
  while (pending.size && performance.now() < end) await Promise.race([Promise.all([...pending]), new Promise(r => setTimeout(r, 100))]);
}

export function loadModel(name) {
  if (!cache.has(name)) cache.set(name, track(gltf.loadAsync(`/assets/models/${name}.glb`).then(g => g.scene)));
  return cache.get(name).then(scene => scene.clone(true));
}

// decode the image now (off the main thread) so the first upload to the GPU doesn't have to: a 2k wood texture is ~80 ms of decoding
export function decoded(img, done) { (img && img.decode ? img.decode() : Promise.resolve()).catch(() => {}).then(done); }

// color maps are sRGB; normal/roughness/AO data stays linear
export function loadTexture(name, { srgb = false, repeat = null, anisotropy = 8 } = {}) {
  let done; track(new Promise(r => { done = r; }));
  const t = textures.load(`/assets/textures/${name}.webp`, img => decoded(img, done), undefined, done);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function loadHDR(name) {
  return track(new RGBELoader().loadAsync(`/assets/hdri/${name}.hdr`));
}
