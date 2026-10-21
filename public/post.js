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
  // sprites (smoke, steam) as solid squares, so leave them out of it like points and lines
  const aoHide = ao.overrideVisibility.bind(ao);
  ao.overrideVisibility = () => { aoHide(); scene.traverse(o => { if (o.isSkinnedMesh || o.isSprite) o.visible = false; }); };
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), ...(look.bloom || [0.45, 0.4, 2.4]))   // only the filament and hot glints;
  const bokeh = new BokehPass(scene, camera, { focus: 25, aperture: 0.00045, maxblur: 0.006 });
  const tiltH = new ShaderPass(HorizontalTiltShiftShader);
  const tiltV = new ShaderPass(VerticalTiltShiftShader);
  tiltH.uniforms.r.value = tiltV.uniforms.r.value = look.tiltCenter ?? 0.52;
  const tiltAmount = look.tiltAmount ?? 1.6;
  const grade = new ShaderPass(GradeShader);
  for (const [k, v] of Object.entries(look.grade || {})) { const u = grade.uniforms[k]; if (u.value && u.value.set) u.value.set(...v); else u.value = v; }
  const smaa = new SMAAPass(1, 1);
  for (const p of [new RenderPass(scene, camera), ao, bloom, bokeh, tiltH, tiltV, grade, new OutputPass(), smaa]) composer.addPass(p);

  let mode = savedQuality();
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  let tier = mode !== 'auto' ? mode : mobile ? 'medium' : 'high';
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

  let frames = 0, acc = 0, warmup = 150;
  function measure(dtMs) {
    if (mode !== 'auto' || tier === 'low' || dtMs > 250 || document.hidden) return;
    if (warmup > 0) { warmup--; return; }
    acc += dtMs; frames++;
    if (frames < 90) return;
    const avg = acc / frames;
    frames = 0; acc = 0;
    if (avg > 22) {
      tier = TIERS[TIERS.indexOf(tier) + 1];
      warmup = 120;
      console.info(`[graphics] ${avg.toFixed(1)} ms/frame — lowering quality to "${tier}"`);
      apply();
    }
  }

  apply();
  return {
    dispose() { composer.dispose && composer.dispose(); target.dispose(); },
    setSize,
    render(dtMs, time) { measure(dtMs); grade.uniforms.time.value = time; composer.render(); },
    setFocus(distance) { bokeh.uniforms.focus.value = distance; },
    setBroadcast(on) { grade.uniforms.broadcast.value = on ? 1 : 0; },
    setQuality(next) {
      mode = QUALITY[next] ? next : 'auto';
      try { localStorage.setItem('mono.quality', mode); } catch {}
      tier = mode !== 'auto' ? mode : mobile ? 'medium' : 'high';
      warmup = 150;
      apply();
    },
    get mode() { return mode; },
    get tier() { return tier; },
  };
}
