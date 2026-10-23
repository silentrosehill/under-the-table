// Free everything a scene owns when its mode is torn down. Materials and textures that live in module-level caches (props, city kit)
// are shared by every scene ever created: three hangs a 'dispose' listener on each of them per renderer, and that listener keeps the old
// renderer, canvas and whole scene alive. Disposing them here removes the listeners (they are simply re-uploaded by the next scene).
export function disposeScene(scene) {
  const mats = new Set(), texs = new Set();
  scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.isInstancedMesh) o.dispose();
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) mats.add(m);
  });
  for (const m of mats) {
    for (const k in m) { const v = m[k]; if (v && v.isTexture) texs.add(v); }
    if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture) texs.add(v); }
    m.dispose();
  }
  for (const t of [scene.environment, scene.background]) if (t && t.isTexture) texs.add(t);
  texs.forEach(t => t.dispose());
}
