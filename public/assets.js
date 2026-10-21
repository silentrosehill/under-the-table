// Shared loaders for the compressed game assets in /assets (see tools/build-assets.mjs, CREDITS.md).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const textures = new THREE.TextureLoader();
const cache = new Map();

export function loadModel(name) {
  if (!cache.has(name)) cache.set(name, gltf.loadAsync(`/assets/models/${name}.glb`).then(g => g.scene));
  return cache.get(name).then(scene => scene.clone(true));
}

// color maps are sRGB; normal/roughness/AO data stays linear
export function loadTexture(name, { srgb = false, repeat = null, anisotropy = 8 } = {}) {
  const t = textures.load(`/assets/textures/${name}.webp`);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropy;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

export function loadHDR(name) {
  return new RGBELoader().loadAsync(`/assets/hdri/${name}.hdr`);
}
