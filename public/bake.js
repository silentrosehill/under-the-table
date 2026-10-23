// Fuse static meshes that share a parent into one mesh per material (in the parent's own space), so a heap of
// chips or banknotes costs a few draw calls instead of one per piece (three draws each for a multi-material chip).
// A mesh may have one material or an array with draw groups; the pieces keep their own look, only the draws merge.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export function mergeMeshes(meshes) {
  const buckets = new Map();
  const add = (geo, mat, matrix) => {
    const g = geo.clone().applyMatrix4(matrix);
    if (!buckets.has(mat)) buckets.set(mat, []);
    buckets.get(mat).push(g);
  };
  for (const o of meshes) {
    o.updateMatrix();
    const geo = o.geometry;
    if (!Array.isArray(o.material)) { add(geo, o.material, o.matrix); continue; }
    for (const grp of geo.groups) {             // split by draw group: each group becomes a part with one material
      const part = new THREE.BufferGeometry();
      for (const name of Object.keys(geo.attributes)) part.setAttribute(name, geo.attributes[name]);
      part.setIndex(new THREE.BufferAttribute(geo.index.array.slice(grp.start, grp.start + grp.count), 1));
      add(part, o.material[grp.materialIndex], o.matrix);
    }
  }
  const out = [];
  for (const [mat, geos] of buckets) {
    const merged = mergeGeometries(geos, false);
    geos.forEach(g => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mesh.receiveShadow = true;
    out.push(mesh);
  }
  return out;
}
