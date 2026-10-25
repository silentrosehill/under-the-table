// Shader and texture warm-up, run behind the loading screen so the game never stutters on its first seconds or when the light changes.
// Three compiles a material's program the first time an object using it is drawn, and uploads a texture the first time it is sampled;
// each costs a few to a few hundred milliseconds on the main thread. Here every program the scene can ever need is built up front
// (renderer.compileAsync links them in parallel where KHR_parallel_shader_compile exists), every texture is uploaded, and a couple of
// real frames are drawn so the shadow maps and post-processing passes are warm too.
import * as THREE from 'three';
import { whenIdle } from './assets.js';

const kept = [];
const nextFrame = () => new Promise(r => requestAnimationFrame(r));

// samples of the material kinds effects create on the fly (sprites, additive quads, stamps): one of each program variant
function probes() {
  const g = new THREE.Group(), map = new THREE.CanvasTexture(Object.assign(document.createElement('canvas'), { width: 2, height: 2 }));
  const add = o => { o.frustumCulled = false; o.position.set(0, 0.01, 0); g.add(o); };
  add(new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity: 0.01 })));
  add(new THREE.Sprite(new THREE.SpriteMaterial({ color: '#fff', transparent: true, depthTest: false, opacity: 0.01 })));
  const plane = new THREE.PlaneGeometry(0.01, 0.01);
  for (const side of [THREE.FrontSide, THREE.DoubleSide]) {
    add(new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, opacity: 0.01, side, polygonOffset: true, polygonOffsetFactor: -2 })));
    add(new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, depthWrite: false, opacity: 0.01, side })));
    add(new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ map, emissive: '#fff', emissiveMap: map, emissiveIntensity: 0, transparent: true, alphaTest: 0.05, side })));
    add(new THREE.Mesh(plane, new THREE.MeshStandardMaterial({ color: '#222', emissive: '#fff', emissiveIntensity: 0, side })));
  }
  return g;
}

const MAP_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'alphaMap', 'bumpMap', 'lightMap', 'clearcoatMap', 'clearcoatNormalMap', 'transmissionMap', 'thicknessMap', 'specularIntensityMap'];
function textures(scene) {
  const set = new Set();
  scene.traverse(o => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) for (const k of MAP_KEYS) { const t = m[k]; if (t && t.isTexture && !t.isRenderTargetTexture && t.version > 0) set.add(t); }
  });
  return [...set];
}

// opts: renderer, scene, camera, post (createPost's), room (createRoom's), clock, progress(f), before() / after() to put the scene in an extra state while compiling
export async function warmUp({ renderer, scene, camera, post, room, clock, progress = () => {}, before, after }) {
  await whenIdle();                                           // every model, texture and the environment map are in
  if (room.envReady) await room.envReady;                     // (the environment changes every material's program, so it must be there before compiling)
  performance.mark('warm:assets');
  progress(0.05);
  // show everything that is hidden now but appears later (Day sky and sun, light shafts, glows, beams, fade variants …)
  const hidden = [];
  scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } });
  const extra = probes();
  scene.add(extra);
  // the scene is drawn into the composer's target, where three leaves tone mapping and the colour space to the last pass: programs
  // compiled against the screen would be different ones, so compile with that target set (only the synchronous part needs it)
  const compile = () => { renderer.setRenderTarget(post.target); const p = renderer.compileAsync(scene, camera); renderer.setRenderTarget(null); return p; };
  const frame = async () => { room.update(clock.getElapsedTime()); post.render(16, clock.getElapsedTime()); await nextFrame(); };
  const culled = [];
  try {
    scene.updateMatrixWorld(true);
    // (frames draw everything, in view or not: a program that clips against the street level is only built by drawing, not by compile)
    scene.traverse(o => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
    room.showAll(true);                                       // (both the bulb's and the sun's shadow maps, so their depth programs build too)
    await compile();
    performance.mark('warm:compiled');
    progress(0.4);
    const list = textures(scene);
    let t0 = performance.now();
    for (let k = 0; k < list.length; k++) {
      renderer.initTexture(list[k]);
      if (performance.now() - t0 > 10) { await nextFrame(); t0 = performance.now(); progress(0.4 + 0.3 * (k / list.length)); }
    }
    performance.mark('warm:textures');
    // real frames: shadow maps, the ambient-occlusion / bloom / depth-of-field passes, every depth program
    await frame(); performance.mark('warm:frame1'); progress(0.8);
    if (before) {                                             // and in the scene's extra state (City: the see-through variant of every building material)
      before();
      await compile();
      await frame();
      after && after();
    }
    progress(0.95);
    for (const o of culled) o.frustumCulled = true;
  } finally {
    for (const o of culled) o.frustumCulled = true;
    scene.remove(extra);
    kept.push(extra);                                         // (not disposed: a program stays compiled for as long as some material uses it)
    for (const o of hidden) o.visible = false;
    room.showAll(false);
  }
  progress(1);
}
