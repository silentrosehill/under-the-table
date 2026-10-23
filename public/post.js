// Post-processing for the back-room look:
// scene → ambient occlusion → bloom → depth of field → grade + vignette + grain → AgX tone map → SMAA.
// Graphics quality: low / medium / high, or auto (steps down if the frame rate can't hold ~45 fps).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { HorizontalTiltShiftShader } from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/addons/shaders/VerticalTiltShiftShader.js';

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    tint: { value: new THREE.Vector3(1.06, 1.0, 0.9) },     // warm highlights
    shadowTint: { value: new THREE.Vector3(0.9, 0.95, 1.0) },
    saturation: { value: 0.95 },
    contrast: { value: 1.08 },
    vignette: { value: 0.55 },
    grain: { value: 0.035 },
    time: { value: 0 },
    aspect: { value: 1.6 },
    broadcast: { value: 0 },                                   // 0 colour … 1 the 1960s broadcast look
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform vec3 tint, shadowTint;
    uniform float saturation, contrast, vignette, grain, time, aspect, broadcast;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col *= mix(shadowTint, tint, smoothstep(0.02, 0.6, l));        // split-tone: cool shadows, warm light
      col = mix(vec3(l), col, saturation);
      col = max(vec3(0.0), (col - 0.18) * contrast + 0.18);
      vec2 d = (vUv - 0.5) * vec2(aspect, 1.0);
      col *= 1.0 - vignette * smoothstep(0.25, 1.05, length(d));
      float n = hash(vUv * 1000.0 + fract(time) * 100.0) - 0.5;      // film grain, stronger in mid-tones
      col += n * grain * (0.15 + sqrt(l));
      if (broadcast > 0.0) {                                           // near black-and-white, soft scanlines, a faint roll
        float bw = dot(col, vec3(0.299, 0.587, 0.114));
        vec3 tv = vec3(bw) * vec3(1.02, 1.0, 0.95);
        tv = max(vec3(0.0), (tv - 0.18) * 1.1 + 0.18);                 // a touch more contrast (linear light, before tone mapping)
        float lines = 0.9 + 0.1 * sin(gl_FragCoord.y * 3.14159 * 0.5);
        float roll = 1.0 - 0.035 * smoothstep(0.0, 0.08, fract(vUv.y * 0.5 - time * 0.07)) * (1.0 - smoothstep(0.08, 0.16, fract(vUv.y * 0.5 - time * 0.07)));
        col = mix(col, max(tv, 0.0) * lines * roll, broadcast);
      }
      gl_FragColor = vec4(max(col, 0.0), c.a);
    }`,
};


// The shadow map is the costliest single pass (every caster drawn again from the bulb) and most of the time nothing in it moves.
// So it is only redrawn when a caster, the bulb or a clipping plane has changed (quantised to about a shadow texel), and at least
// every SHADOW_MAX_AGE ms as a safety net for anything animated in a way the signature can't see.
const SHADOW_MAX_AGE = 300;
const qz = (v, k) => Math.round(v * k);
function matSig(e) {
  return qz(e[12], 64) * 3 + qz(e[13], 64) * 5 + qz(e[14], 64) * 7 + qz(e[0], 1024) + qz(e[5], 1024) * 2 + qz(e[10], 1024) * 3
    + qz(e[1], 1024) * 5 + qz(e[2], 1024) * 7 + qz(e[4], 1024) * 11 + qz(e[6], 1024) * 13 + qz(e[8], 1024) * 17 + qz(e[9], 1024) * 19;
}
// Transmissive glass (the bulb, the whiskey, the spectacles) makes three draw every opaque object a second time into a full-size
// multisampled buffer whenever one of them is in view: about a third of the whole frame. Medium and Low use plain see-through glass.
let realGlass = true;
const glassSaved = new Map();
function cheapGlass(m) {
  glassSaved.set(m, [m.transmission, m.transparent, m.opacity, m.depthWrite]);
  m.opacity = 0.12 + 0.3 * m.transmission; m.transmission = 0; m.transparent = true; m.depthWrite = false; m.needsUpdate = true;
}
function restoreGlass() {
  for (const [m, [t, tr, op, dw]] of glassSaved) { m.transmission = t; m.transparent = tr; m.opacity = op; m.depthWrite = dw; m.needsUpdate = true; }
  glassSaved.clear();
}
const shadowLights = [], lightRef = new WeakMap();
let lightTick = 0;
function shadowSignature(scene) {
  let sum = 0, n = 0;
  shadowLights.length = 0;
  const walk = o => {
    if (!o.visible) { sum += o.id * 31; return; }      // a hidden subtree casts nothing, but showing it again must register
    n++;
    if (o.isMesh) {
      if (!realGlass) for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m.transmission > 0) cheapGlass(m);
      if (o.castShadow) {
        sum += (matSig(o.matrixWorld.elements) + o.geometry.id) * ((n & 7) + 1);
        if (o.isInstancedMesh) sum += o.instanceMatrix.version * 977 + o.count;
        if (o.isSkinnedMesh) for (const b of o.skeleton.bones) sum += matSig(b.matrixWorld.elements);
        const m = o.material, cp = m && m.clippingPlanes;
        if (cp) for (const p of cp) sum += qz(p.constant, 256) * 53;
      }
    } else if (o.isLight && o.castShadow) shadowLights.push(o);
    for (const c of o.children) walk(c);
  };
  scene.updateMatrixWorld();
  walk(scene);
  // the swaying bulb: redraw once its light (or aim) has drifted about a shadow texel since the last draw, not at every quantum of its matrix
  for (const l of shadowLights) {
    const a = l.matrixWorld.elements, b = l.target.matrixWorld.elements, r = lightRef.get(l);
    if (!r) { lightRef.set(l, [a[12], a[13], a[14], b[12], b[13], b[14]]); sum += 1; continue; }
    const d = Math.max(Math.abs(a[12] - r[0]), Math.abs(a[13] - r[1]), Math.abs(a[14] - r[2]), Math.abs(b[12] - r[3]), Math.abs(b[13] - r[4]), Math.abs(b[14] - r[5]));
    if (d > 0.1) { r[0] = a[12]; r[1] = a[13]; r[2] = a[14]; r[3] = b[12]; r[4] = b[13]; r[5] = b[14]; lightRef.set(l, r); lightTick++; }
  }
  return sum + n * 7919 + lightTick * 104729;
}

export const QUALITY = {
  high: { pixelRatio: 1.75, samples: 0, ao: true, bloom: true, dof: 'bokeh', shadow: 4096 },
  medium: { pixelRatio: 1.5, samples: 0, ao: false, bloom: true, dof: 'tilt', shadow: 2048 },
  low: { pixelRatio: 1, samples: 0, ao: false, bloom: false, dof: 'none', shadow: 1024 },
};
const TIERS = ['high', 'medium', 'low'];

export function savedQuality() {
  const fromUrl = new URLSearchParams(location.search).get('quality');
  let saved = null;
  try { saved = localStorage.getItem('mono.quality'); } catch {}
  const pick = fromUrl || saved;
  return QUALITY[pick] ? pick : 'auto';
}

// `look` lets another mode reuse the chain with its own grade (City Mode: bright, tilt-shift, no grain)
export function createPost(renderer, scene, camera, { onShadowSize, look = {} } = {}) {
  renderer.toneMapping = look.toneMapping ?? THREE.AgXToneMapping;
  renderer.toneMappingExposure = look.exposure ?? 1.35;

  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType })  // no MSAA: it breaks transmissive glass here; SMAA handles edges;
  const composer = new EffectComposer(renderer, target);
  const ao = new GTAOPass(scene, camera, 1, 1);
  ao.blendIntensity = 0.9;
  ao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.5, thickness: 1.2, scale: 1.0, samples: 8 });
  // the AO pass draws everything with one plain material: skinned meshes would appear unposed and
  // sprites (smoke, steam) as solid squares, so leave them out of it like points and lines (one walk, skipping hidden subtrees)
  // ...and so are glow / haze / beam quads (transparent, no depth write) and anything only a few pixels across: they add
  // nothing to AO or depth of field but cost a draw call each
  const aoHidden = [];
  const aoHide = o => {
    if (!o.visible) return;
    if (o.isPoints || o.isLine || o.isSkinnedMesh || o.isSprite) { o.visible = false; aoHidden.push(o); return; }
    if (o.isMesh) {
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      let skip = m.transparent && m.depthWrite === false;
      if (!skip && !o.isInstancedMesh) {
        const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
        const e = o.matrixWorld.elements, dx = e[12] - camera.position.x, dy = e[13] - camera.position.y, dz = e[14] - camera.position.z;
        skip = g.boundingSphere.radius * o.matrixWorld.getMaxScaleOnAxis() < 0.015 * Math.sqrt(dx * dx + dy * dy + dz * dz);
      }
      if (skip) { o.visible = false; aoHidden.push(o); return; }
    }
    for (const c of o.children) aoHide(c);
  };
  ao.overrideVisibility = () => { aoHidden.length = 0; aoHide(scene); };
  ao.restoreVisibility = () => { for (const o of aoHidden) o.visible = true; aoHidden.length = 0; };
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), ...(look.bloom || [0.45, 0.4, 2.4]))   // only the filament and hot glints;
  const bokeh = new BokehPass(scene, camera, { focus: 25, aperture: 0.00045, maxblur: 0.006 });
  // the depth of field reads the depth buffer the AO pass already rendered instead of drawing the whole scene a second time
  const bokehOwnRender = bokeh.render.bind(bokeh);
  let bokehShared = null;
  const bokehDepthFrom = shared => {
    if (shared === bokehShared) return;
    bokehShared = shared;
    bokeh.materialBokeh.defines.DEPTH_PACKING = shared ? 0 : 1;
    bokeh.uniforms.tDepth.value = shared ? ao.depthTexture : bokeh.renderTargetDepth.texture;
    bokeh.materialBokeh.needsUpdate = true;
  };
  bokeh.render = (renderer, writeBuffer, readBuffer) => {
    bokehDepthFrom(ao.enabled);
    if (!ao.enabled) return bokehOwnRender(renderer, writeBuffer, readBuffer);
    bokeh.uniforms.tColor.value = readBuffer.texture;
    bokeh.uniforms.nearClip.value = camera.near; bokeh.uniforms.farClip.value = camera.far;
    renderer.setRenderTarget(bokeh.renderToScreen ? null : writeBuffer);
    if (!bokeh.renderToScreen) renderer.clear();
    bokeh.fsQuad.render(renderer);
  };
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.uniforms.r.value = tiltV.uniforms.r.value = look.tiltCenter ?? 0.52;
  const tiltAmount = look.tiltAmount ?? 1.6;
  const grade = new ShaderPass(GradeShader);
  for (const [k, v] of Object.entries(look.grade || {})) { const u = grade.uniforms[k]; if (u.value && u.value.set) u.value.set(...v); else u.value = v; }
  const smaa = new SMAAPass(1, 1);
  for (const p of [new RenderPass(scene, camera), ao, bloom, bokeh, tiltH, tiltV, grade, new OutputPass(), smaa]) composer.addPass(p);

  renderer.capabilities.maxSamples = 0;       // three's refraction buffer is 4x multisampled by default; it is only ever blurred, so plain is identical
  renderer.shadowMap.autoUpdate = false;     // redrawn on demand (see shadowSignature)
  let shadowSig = NaN, shadowAt = 0, shadowDirty = true;
  let mode = savedQuality();
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  let tier = mode !== 'auto' ? mode : mobile ? 'medium' : 'high';
  if (mode === 'auto') { try { const t = sessionStorage.getItem('mono.autotier'); if (QUALITY[t] && TIERS.indexOf(t) > TIERS.indexOf(tier)) tier = t; } catch {} }
  let w = 1, h = 1;

  function apply() {
    const q = QUALITY[tier];
    const pr = Math.min(devicePixelRatio || 1, q.pixelRatio);
    renderer.setPixelRatio(pr);
    composer.setPixelRatio(pr);
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.samples = q.samples; rt.dispose(); }
    ao.enabled = q.ao;
    bloom.enabled = q.bloom;
    const dof = look.dof ? look.dof(tier, q.dof) : q.dof;
    bokeh.enabled = dof === 'bokeh';
    tiltH.enabled = tiltV.enabled = dof === 'tilt';
    onShadowSize && onShadowSize(q.shadow);
    realGlass = tier === 'high';
    if (realGlass) restoreGlass();
    shadowDirty = true;
    setSize(w, h);
  }

  function setSize(width, height) {
    w = width; h = height;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    grade.uniforms.aspect.value = w / Math.max(1, h);
    tiltH.uniforms.h.value = tiltAmount / (w * renderer.getPixelRatio());
    tiltV.uniforms.v.value = tiltAmount / (h * renderer.getPixelRatio());
  }

  // Auto quality: a short window of frame times (skipping tab switches and the warm-up after a change), stepping down at once when
  // far too slow and after ~0.75 s when merely slow. It never steps back up, so it cannot thrash; the tier is remembered for the session.
  let frames = 0, acc = 0, warmup = 36;
  const WINDOW = 40, SLOW = 22, VERY_SLOW = 45;
  function lower(avg, steps) {
    tier = TIERS[Math.min(TIERS.length - 1, TIERS.indexOf(tier) + steps)];
    warmup = 30; frames = 0; acc = 0;
    try { sessionStorage.setItem('mono.autotier', tier); } catch {}
    console.info(`[graphics] ${avg.toFixed(1)} ms/frame — lowering quality to "${tier}"`);
    apply();
  }
  function measure(dtMs) {
    if (mode !== 'auto' || tier === 'low' || dtMs > 250 || document.hidden) return;
    if (warmup > 0) { warmup--; return; }
    acc += dtMs; frames++;
    const avg = acc / frames;
    if (frames >= 12 && avg > VERY_SLOW) return lower(avg, 2);
    if (frames < WINDOW) return;
    if (avg > SLOW) return lower(avg, 1);
    frames = 0; acc = 0;
  }

  apply();
  return {
    dispose() { restoreGlass(); for (const p of composer.passes) p.dispose && p.dispose(); composer.dispose && composer.dispose(); target.dispose(); },
    setSize,
    render(dtMs, time) {
      measure(dtMs);
      grade.uniforms.time.value = time;
      const sig = shadowSignature(scene), now = performance.now();
      if (shadowDirty || sig !== shadowSig || now - shadowAt > SHADOW_MAX_AGE) { renderer.shadowMap.needsUpdate = true; shadowSig = sig; shadowAt = now; shadowDirty = false; }
      composer.render();
    },
    setFocus(distance) { bokeh.uniforms.focus.value = distance; },
    setBroadcast(on) { grade.uniforms.broadcast.value = on ? 1 : 0; },
    setQuality(next) {
      mode = QUALITY[next] ? next : 'auto';
      try { localStorage.setItem('mono.quality', mode); } catch {}
      tier = mode !== 'auto' ? mode : mobile ? 'medium' : 'high';
      try { sessionStorage.removeItem('mono.autotier'); } catch {}
      warmup = 36; frames = 0; acc = 0;
      apply();
    },
    get mode() { return mode; },
    get tier() { return tier; },
  };
}
