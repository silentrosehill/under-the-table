// Kenney kit models for City Mode (CC0, see CREDITS.md). Models are loaded once, then cloned.
// A district can repaint a kit with its own palette (tools/city-palettes.mjs), and windows can
// glow through a mask that only lets the window swatches emit light.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const loader = new GLTFLoader();
const texLoader = new THREE.TextureLoader();
const models = new Map();        // 'kit/name' -> { scene, animations }
const textures = new Map();
const materials = new Map();
export const glowKeys = new Set();
export const glowColors = {};     // palette -> window light colour (default warm yellow; the canal district burns red-amber)
// every kit material is cut at street level, so buildings can rise out of the ground (cityScene sets it)
export const groundClip = new THREE.Plane(new THREE.Vector3(0, 1, 0), 1e6);

// models of one kit that use the same colour/texture get the very same material, so they can be merged
const canon = new Map();
function shared(kit, m) {
  const key = [kit, m.type, m.name, m.color && m.color.getHexString(), m.map ? 'colormap' : '', m.transparent, m.opacity].join('|');
  if (!canon.has(key)) canon.set(key, m);
  return canon.get(key);
}

export function preload(list) {
  return Promise.all(list.map(([kit, name]) => {
    const key = `${kit}/${name}`;
    if (models.has(key)) return models.get(key).ready;
    const entry = { scene: null, animations: [] };
    entry.ready = loader.loadAsync(`/assets/city/${kit}/${name}.glb`).then(g => {
      g.scene.traverse(o => {
        if (!o.isMesh) return;
        o.castShadow = true; o.receiveShadow = true;
        if (!Array.isArray(o.material) && !o.isSkinnedMesh) o.material = shared(kit, o.material);
      });
      entry.scene = g.scene; entry.animations = g.animations;
    }).catch(e => console.warn('[city] missing model', key, e.message));
    models.set(key, entry);
    return entry.ready;
  }));
}

function texture(kit, name) {
  const key = `${kit}/${name}`;
  if (!textures.has(key)) {
    const t = texLoader.load(`/assets/city/${kit}/Textures/${name}.png`);
    t.flipY = false;                                    // glTF texture convention
    t.colorSpace = name === 'windows' ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    textures.set(key, t);
  }
  return textures.get(key);
}

// one material per kit × palette, shared across tiles; window glow is per tile (glow = the tile's key)
function material(kit, base, palette, glow) {
  const key = `${kit}|${base.name}|${palette || ''}|${glow ?? ''}`;
  if (!materials.has(key)) {
    const m = base.clone();
    m.clippingPlanes = [groundClip];
    if (palette && m.map) m.map = texture(kit, palette);
    else if (palette && m.color) m.color.multiplyScalar(0.3);      // flat-coloured parts: into the night palette too
    if (glow != null && m.map) {
      m.emissive = new THREE.Color(glowColors[palette] || '#ffb25e');
      m.emissiveMap = texture(kit, 'windows');
      m.emissiveIntensity = 0;
      m.userData.windows = true;
      m.userData.glowKey = glow;
    }
    materials.set(key, m);
  }
  return materials.get(key);
}

// a fresh copy of a model: { s: scale, palette: district, glow: a key whose windows light up together }
export function make(kit, name, { s = 1, palette = null, glow = null, x = 0, y = 0, z = 0, ry = 0 } = {}) {
  if (glow != null) glowKeys.add(glow);
  const entry = models.get(`${kit}/${name}`);
  const src = entry && entry.scene;
  if (!src) { const g = new THREE.Group(); g.userData.missing = `${kit}/${name}`; return g; }
  const skinned = !!entry.animations.length;
  const obj = skinned ? SkeletonUtils.clone(src) : src.clone();
  if (palette || glow != null) obj.traverse(o => { if (o.isMesh) o.material = material(kit, o.material, palette, glow); });
  obj.scale.setScalar(s);
  obj.position.set(x, y, z);
  obj.rotation.y = ry;
  if (skinned) obj.userData.animations = entry.animations;
  return obj;
}

// materials for code-built buildings (archetypes.js): shared by id, cut at street level like the kit's, and lit through the
// same glow keys as kit windows (glow = the key; null = no lit windows). build(lit) returns the MeshStandardMaterial.
export function procMaterial(id, glow, build) {
  const key = `proc|${id}|${glow ?? ''}`;
  if (!materials.has(key)) {
    const m = build(glow != null);
    m.clippingPlanes = [groundClip];
    if (glow != null) { m.userData.windows = true; m.userData.glowKey = glow; glowKeys.add(glow); }
    materials.set(key, m);
  }
  return materials.get(key);
}

// the window materials of one lit piece (glow key 't6_2': tile 6, piece 2)
export const glowMaterials = key => [...materials.entries()].filter(([k, m]) => m.userData.windows && k.endsWith('|' + key)).map(([, m]) => m);

// Fuse a group of static models into as few meshes as possible (in the group's own space), so a whole
// square costs a handful of draw calls instead of dozens. Textured models merge per material; the
// flat-coloured ones (nature kit) become vertex colours and all merge into one. Skinned stay apart.
const flatMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
export function bake(group) {
  group.updateWorldMatrix(true, true);
  const inv = group.matrixWorld.clone().invert(), m = new THREE.Matrix4();
  const buckets = new Map(), kept = [];
  const col = new THREE.Color();
  group.traverse(o => {
    if (!o.isMesh) return;
    const mat = o.material;
    if (o.isSkinnedMesh || o.userData.keep || Array.isArray(mat) || mat.transparent) { kept.push(o); return; }
    const flat = !mat.map && mat.isMeshStandardMaterial;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    const keep = flat ? ['position', 'normal'] : mat.vertexColors ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];      // (a textured, vertex-coloured piece keeps its colours: the district's road tint)
    for (const name of Object.keys(g.attributes)) if (!keep.includes(name)) g.deleteAttribute(name);
    if (!flat && !g.attributes.uv) { kept.push(o); return; }
    if (flat) {
      col.copy(mat.color);
      const n = g.attributes.position.count, c = new Float32Array(n * 3);
      for (let k = 0; k < n; k++) { c[k * 3] = col.r; c[k * 3 + 1] = col.g; c[k * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    g.applyMatrix4(m.multiplyMatrices(inv, o.matrixWorld));
    const key = flat ? 'flat' : mat.uuid;
    if (!buckets.has(key)) buckets.set(key, { material: flat ? flatMaterial : mat, geos: [] });
    buckets.get(key).geos.push(g);
  });
  const out = new THREE.Group();
  for (const { material, geos } of buckets.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = mesh.receiveShadow = true;
    out.add(mesh);
  }
  for (const o of kept) { o.updateWorldMatrix(true, false); const c = o.clone(); c.matrix.multiplyMatrices(inv, o.matrixWorld); c.matrix.decompose(c.position, c.quaternion, c.scale); out.add(c); }
  return out;
}
