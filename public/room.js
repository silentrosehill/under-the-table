// The back room: a worn wooden table under one hanging incandescent bulb, everything else in darkness.
// Units: 1 unit = 4 cm (the board is ~50 cm across). See CREDITS.md for asset sources.
import * as THREE from 'three';
import { loadModel, loadTexture, loadHDR } from './assets.js';
import { sfx } from './sfx.js';

export const UNITS_PER_M = 25;
export const BULB_COLOR = new THREE.Color().setRGB(1.0, 0.62, 0.3);   // ~2700 K incandescent
const BULB_HEIGHT = 13;      // bulb hangs ~52 cm above the table, low like a card-room lamp
const TABLE_W = 52, TABLE_D = 30, TABLE_T = 1.1;
const SPOT_POWER = 620;      // candela-ish; tuned so the board sits just below white under AgX

// ------------------------------------------------------------------ light shaft & dust shaders

const coneMaterial = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { color: { value: BULB_COLOR.clone() }, intensity: { value: 0.07 }, time: { value: 0 }, height: { value: 1 } },
  vertexShader: /* glsl */`
    uniform float height;
    varying vec3 vWorld; varying vec3 vNormal; varying float vH;
    void main() {
      vH = position.y / height + 0.5;                       // 0 at the table, 1 at the bulb
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color; uniform float intensity, time;
    varying vec3 vWorld; varying vec3 vNormal; varying float vH;
    void main() {
      vec3 V = normalize(cameraPosition - vWorld);
      float edge = pow(abs(dot(normalize(vNormal), V)), 3.0);           // thick in the middle, gone at the rim
      float haze = 0.7 + 0.3 * sin(vWorld.y * 0.45 + time * 0.6 + sin(vWorld.x * 0.7 + time * 0.25) * 2.0);
      float a = edge * (0.35 + 0.45 * vH) * haze * intensity * smoothstep(0.0, 0.12, vH) * smoothstep(1.0, 0.8, vH);
      a *= smoothstep(2.0, 9.0, distance(cameraPosition, vWorld));   // thin out when the camera is inside the beam
      gl_FragColor = vec4(color * a, 1.0);
    }`,
});

const dustMaterial = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: {
    time: { value: 0 }, apex: { value: new THREE.Vector3() }, tanA: { value: 0.9 },
    color: { value: BULB_COLOR.clone().multiplyScalar(0.55) }, size: { value: 9 }, pixelRatio: { value: 1 },
  },
  vertexShader: /* glsl */`
    uniform float time, tanA, size, pixelRatio; uniform vec3 apex;
    attribute float seed;
    varying float vA;
    void main() {
      vec3 p = position;
      p.x += sin(time * 0.11 + seed * 12.0) * 0.7;
      p.z += cos(time * 0.09 + seed * 9.0) * 0.7;
      p.y += sin(time * 0.06 + seed * 7.0) * 0.6;
      float dy = apex.y - p.y;
      float R = max(dy, 0.0) * tanA;
      float inBeam = dy > 0.5 ? smoothstep(R, R * 0.55, length(p.xz - apex.xz)) : 0.0;
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = size * pixelRatio * (0.5 + seed) / -mv.z;
      vA = inBeam * (0.35 + 0.65 * (0.5 + 0.5 * sin(time * 0.9 + seed * 40.0))) * smoothstep(0.0, 3.0, dy);
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color;
    varying float vA;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.05, d) * vA;
      gl_FragColor = vec4(color * a, 1.0);
    }`,
});

// a soft stain left by a wet glass
function ringTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.translate(128, 128);
  for (let k = 0; k < 3; k++) {
    g.beginPath();
    const r = 92 + k * 6 + Math.random() * 6;
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.05) {
      const rr = r + Math.sin(a * 3 + k) * 3 + Math.sin(a * 11) * 1.5;
      a === 0 ? g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    g.strokeStyle = `rgba(255,255,255,${0.45 - k * 0.12})`; g.lineWidth = 7 - k * 2; g.stroke();
  }
  g.globalAlpha = 0.08; g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 90, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

// ------------------------------------------------------------------ the room

export function createRoom(scene, renderer, { tableY }) {
  const group = new THREE.Group();
  scene.add(group);
  scene.background = new THREE.Color('#040302');
  scene.fog = new THREE.FogExp2('#050302', 0.0085);

  // dim warm reflections from a real interior (barely visible — the bulb does the lighting)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envReady = loadHDR('fireplace_2k').then(hdr => { const t = pmrem.fromEquirectangular(hdr).texture; scene.environment = t; hdr.dispose(); return t; });
  scene.environmentIntensity = 0.07;

  // ---- the table: worn varnished wood, thick, with rounded edges
  const tex = name => loadTexture(name, { srgb: name.endsWith('color'), repeat: [1 / UNITS_PER_M, 1 / UNITS_PER_M], anisotropy: 12 });
  const tableMat = new THREE.MeshPhysicalMaterial({
    map: tex('table_color'), normalMap: tex('table_normal'), roughnessMap: tex('table_arm'), aoMap: tex('table_arm'),
    roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1.2, 1.2),
    clearcoat: 0.35, clearcoatRoughness: 0.38, color: new THREE.Color('#d9c2a8'),
  });
  const shape = new THREE.Shape();
  const w = TABLE_W / 2, d = TABLE_D / 2, r = 1.2;
  shape.moveTo(-w + r, -d); shape.lineTo(w - r, -d); shape.quadraticCurveTo(w, -d, w, -d + r);
  shape.lineTo(w, d - r); shape.quadraticCurveTo(w, d, w - r, d); shape.lineTo(-w + r, d);
  shape.quadraticCurveTo(-w, d, -w, d - r); shape.lineTo(-w, -d + r); shape.quadraticCurveTo(-w, -d, -w + r, -d);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: TABLE_T, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.22, bevelSegments: 4, curveSegments: 10 }), tableMat);
  top.rotation.x = -Math.PI / 2;
  top.position.y = tableY - TABLE_T - 0.22;
  top.receiveShadow = true; top.castShadow = true;
  group.add(top);
  // heavy square legs and an apron, mostly lost in the dark
  const legMat = tableMat.clone(); legMat.color.set('#8a7563');
  for (const [x, z] of [[w - 2.2, d - 2.2], [-w + 2.2, d - 2.2], [w - 2.2, -d + 2.2], [-w + 2.2, -d + 2.2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(2.2, 18, 2.2), legMat);
    leg.position.set(x, tableY - 1.3 - 9, z); leg.castShadow = true;
    group.add(leg);
  }
  const floorMat = tableMat.clone();
  floorMat.color.set('#5a4636'); floorMat.clearcoat = 0;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.position.y = tableY - 19.3; floor.receiveShadow = true;
  group.add(floor);

  // glass rings soaked into the varnish
  const ringMat = new THREE.MeshStandardMaterial({ color: '#1c0f07', transparent: true, alphaMap: ringTexture(), opacity: 0.55, roughness: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  for (const [x, z, s] of [[-14.5, 8.5, 3.1], [15.8, -7.2, 3.4], [17.6, 9.4, 2.9], [-17.2, -9.6, 3.2], [16.4, 8.1, 3.0]]) {
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(s, s), ringMat);
    ring.rotation.set(-Math.PI / 2, 0, Math.random() * 6);
    ring.position.set(x, tableY + 0.01, z);
    ring.receiveShadow = true;
    group.add(ring);
  }

  // empty chairs around the table, half lost in shadow
  loadModel('WoodenChair_01').then(chair => {
    const box = new THREE.Box3().setFromObject(chair);
    const scale = (0.95 * UNITS_PER_M) / (box.max.y - box.min.y);
    for (const [x, z, rot] of [[-11, -d - 5, 0], [11, -d - 5.5, 0.12], [-w - 6, 2, Math.PI / 2], [w + 6, -2, -Math.PI / 2]]) {
      const c = chair.clone(true);
      c.scale.setScalar(scale);
      c.position.set(x, tableY - 19.3, z);
      c.rotation.y = rot;
      c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      group.add(c);
    }
  });

  // ---- the lamp: braided cord from the dark ceiling, enamel shade, bare bulb
  const pivot = new THREE.Group();                 // the lamp sways around its ceiling hook
  const CEILING = tableY + 80;
  pivot.position.set(0, CEILING, 0);
  group.add(pivot);
  const lampDrop = CEILING - (tableY + BULB_HEIGHT); // ceiling → bulb
  const bulbLocal = new THREE.Vector3(0, -lampDrop, 0);

  const ropeMat = new THREE.MeshStandardMaterial({
    map: loadTexture('rope_color', { srgb: true, repeat: [1, 40] }), normalMap: loadTexture('rope_normal', { repeat: [1, 40] }),
    color: '#3a2c22', roughness: 0.85,
  });
  let cord = null;
  const lampEmissive = [];
  const shadeHolder = new THREE.Group();
  pivot.add(shadeHolder);
  loadModel('hanging_industrial_lamp').then(lamp => {
    lamp.scale.setScalar(UNITS_PER_M * 0.62);
    lamp.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false;                                     // the spot sits inside the shade
      const m = o.material;
      if (/glass/i.test(m.name)) o.visible = false;             // its own bulb is replaced by the Edison bulb below
      else if (m.emissive) m.emissiveIntensity = 0;             // the shade itself doesn't glow
    });
    const box = new THREE.Box3().setFromObject(lamp);
    lamp.position.y = bulbLocal.y - box.min.y + 0.9;           // shade rim sits just below the bulb's middle
    shadeHolder.add(lamp);
    const lampTop = new THREE.Box3().setFromObject(lamp).max.y - pivot.position.y;
    const len = -lampTop;
    cord = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, len, 10, 1, true), ropeMat);
    cord.position.y = lampTop + len / 2 + 0.01;
    pivot.add(cord);
  });
  // the bare Edison bulb: clear glass, glowing filament
  loadModel('lightbulb_01').then(bulb => {
    bulb.scale.setScalar(UNITS_PER_M * 1.1);
    bulb.rotation.x = Math.PI;                                  // hanging, screw base up
    const box = new THREE.Box3().setFromObject(bulb);
    bulb.position.copy(bulbLocal).add(new THREE.Vector3(0, -(box.min.y + box.max.y) / 2, 0));
    bulb.traverse(o => {
      if (!o.isMesh) return;
      o.castShadow = false;
      const m = o.material;
      if (m.emissiveMap) { m.emissive.copy(BULB_COLOR); lampEmissive.push(m); }   // only the filament has a glow map
      if (m.transmission) { m.roughnessMap = null; m.metalnessMap = null; m.roughness = 0.03; m.metalness = 0; m.thickness = 0.02; m.ior = 1.5; m.color.set('#fff6ea'); m.needsUpdate = true; }
    });
    shadeHolder.add(bulb);
  });

  // the light itself: a warm spot under the shade, plus a tiny fill so the shade's inside glows
  const spot = new THREE.SpotLight(BULB_COLOR, SPOT_POWER, 0, 1.1, 1.0, 2);
  spot.position.copy(bulbLocal).add(new THREE.Vector3(0, 0.6, 0));
  spot.target.position.copy(bulbLocal).add(new THREE.Vector3(0, -20, 0));
  spot.castShadow = true;
  spot.shadow.mapSize.set(4096, 4096);
  spot.shadow.camera.near = 1; spot.shadow.camera.far = 70;
  spot.shadow.bias = -0.00008; spot.shadow.normalBias = 0.02;
  pivot.add(spot, spot.target);
  const inner = new THREE.PointLight(BULB_COLOR, 7, 7, 2);
  inner.position.copy(spot.position).add(new THREE.Vector3(0, 2.6, 0));   // up in the shade, lighting its inside
  pivot.add(inner);
  // the faint spill that reaches the walls and floor
  const spill = new THREE.HemisphereLight('#3a2416', '#000000', 0.4);
  group.add(spill);

  // visible light shaft
  const coneH = BULB_HEIGHT + 0.4;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(Math.tan(0.62) * coneH, coneH, 64, 1, true), coneMaterial());
  cone.material.uniforms.height.value = coneH;
  cone.position.copy(bulbLocal).add(new THREE.Vector3(0, -coneH / 2 + 0.4, 0));
  cone.renderOrder = 5;
  pivot.add(cone);

  // dust drifting through the beam (world space, so it doesn't swing with the lamp)
  const N = 1400, pos = new Float32Array(N * 3), seed = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 12;
    pos.set([Math.cos(a) * rr, tableY + 1 + Math.random() * (BULB_HEIGHT - 1), Math.sin(a) * rr], k * 3);
    seed[k] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dustGeo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const dust = new THREE.Points(dustGeo, dustMaterial());
  dust.frustumCulled = false;
  dust.renderOrder = 6;
  group.add(dust);
  dust.material.uniforms.tanA.value = Math.tan(0.62);

  // ---- sway & flicker
  const bulbWorld = new THREE.Vector3();
  let flickerUntil = 0, nextFlicker = 4, flickerDepth = 0;
  function update(time) {
    pivot.rotation.z = 0.011 * Math.sin(time * (2 * Math.PI / 7.3));
    pivot.rotation.x = 0.008 * Math.sin(time * (2 * Math.PI / 9.1) + 1.3);
    let f = 1 + 0.006 * Math.sin(time * 37) * Math.sin(time * 5.3);  // filament never quite steady
    if (time > nextFlicker) { flickerUntil = time + 0.05 + Math.random() * 0.08; flickerDepth = 0.04 + Math.random() * 0.05; nextFlicker = time + 3 + Math.random() * 9; sfx.flicker(flickerDepth); }
    if (time < flickerUntil) f -= flickerDepth;
    spot.intensity = SPOT_POWER * f;
    inner.intensity = 7 * f;
    for (const m of lampEmissive) m.emissiveIntensity = 28 * f;
    cone.material.uniforms.time.value = time;
    cone.material.uniforms.intensity.value = 0.07 * f;
    pivot.updateMatrixWorld();
    bulbWorld.copy(bulbLocal).applyMatrix4(pivot.matrixWorld);
    dust.material.uniforms.time.value = time;
    dust.material.uniforms.apex.value.copy(bulbWorld);
    dust.material.uniforms.pixelRatio.value = renderer.getPixelRatio();
  }

  return {
    group, update, bulbWorld, envReady,
    setShadowSize(size) {
      if (spot.shadow.mapSize.x === size) return;
      spot.shadow.mapSize.set(size, size);
      if (spot.shadow.map) { spot.shadow.map.dispose(); spot.shadow.map = null; }
    },
  };
}
