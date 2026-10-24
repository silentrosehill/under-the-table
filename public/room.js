// The back room: a worn wooden table under one hanging incandescent bulb, everything else in darkness.
// Units: 1 unit = 4 cm (the board is ~50 cm across). See CREDITS.md for asset sources.
import * as THREE from 'three';
import { loadModel, loadTexture, loadHDR } from './assets.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sfx } from './sfx.js';
import { lighting } from './lighting.js';

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

const dustMaterial = (flat = false) => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  defines: flat ? { FLAT: 1 } : {},                       // FLAT: motes in the sun shaft (no cone to stay inside)
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
      #ifdef FLAT
      float dy = 99.0, inBeam = 1.0;
      #else
      float dy = apex.y - p.y;
      float R = max(dy, 0.0) * tanA;
      float inBeam = dy > 0.5 ? smoothstep(R, R * 0.55, length(p.xz - apex.xz)) : 0.0;
      #endif
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


// the sun shaft: the window's prism of light plus a few slices of it, each carrying the window bars, so the beam reads as striped light
const shaftMaterial = () => new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { color: { value: new THREE.Color(1.0, 0.9, 0.72) }, intensity: { value: 0 }, time: { value: 0 } },
  vertexShader: /* glsl */`
    attribute vec2 wuv; attribute vec2 sk;                 // sk.x: distance along the beam 0…1, sk.y: 0 prism wall, 1 slice
    varying vec2 vUv; varying vec2 vSk; varying vec3 vWorld;
    void main() {
      vUv = wuv; vSk = sk;
      vec4 w = modelMatrix * vec4(position, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */`
    uniform vec3 color; uniform float intensity, time;
    varying vec2 vUv; varying vec2 vSk; varying vec3 vWorld;
    void main() {
      float fade = smoothstep(0.0, 0.06, vSk.x) * (1.0 - smoothstep(0.55, 1.0, vSk.x));
      float haze = 0.8 + 0.2 * sin(vWorld.x * 0.21 + vWorld.y * 0.17 + time * 0.35);
      float a;
      if (vSk.y > 0.5) {                                              // a slice: bright pane, dark bars
        vec2 e = smoothstep(0.0, 0.05, vUv) * (1.0 - smoothstep(0.95, 1.0, vUv));
        float bars = 1.0 - max(smoothstep(0.03, 0.018, min(abs(vUv.x - 0.3333), abs(vUv.x - 0.6667))), smoothstep(0.035, 0.02, min(abs(vUv.y - 0.3333), abs(vUv.y - 0.6667))));
        a = e.x * e.y * (0.25 + 0.75 * bars) * 0.55;
      } else a = 0.2;                                                 // the wall of the prism, a faint edge to the beam
      a *= fade * haze * intensity * smoothstep(2.0, 10.0, distance(cameraPosition, vWorld));
      gl_FragColor = vec4(color * a, 1.0);
    }`,
});

// a bright afternoon sky for the window: gradient, soft clouds and a skyline of old buildings
function skyTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 512);
  sky.addColorStop(0, '#5e9be3'); sky.addColorStop(0.45, '#9cc7f0'); sky.addColorStop(0.72, '#e9f1f4'); sky.addColorStop(1, '#f6ecd6');
  g.fillStyle = sky; g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.shadowColor = 'rgba(255,255,255,0.9)'; g.shadowBlur = 18;
  for (const [x, y, w, h] of [[60, 90, 70, 16], [150, 140, 90, 18], [40, 230, 80, 14], [180, 280, 70, 12]]) { g.beginPath(); g.ellipse(x, y, w / 2, h / 2, 0, 0, 7); g.fill(); }
  g.shadowBlur = 0;
  let x = -10;
  while (x < 266) {                                                    // far buildings, hazy blue-grey
    const w = 24 + Math.random() * 30, h = 60 + Math.random() * 110;
    g.fillStyle = Math.random() < 0.5 ? '#9fa9b5' : '#8e99a8';
    g.fillRect(x, 512 - h, w, h);
    g.fillStyle = 'rgba(255,245,220,0.35)';
    for (let yy = 512 - h + 8; yy < 505; yy += 12) for (let xx = x + 4; xx < x + w - 5; xx += 9) g.fillRect(xx, yy, 4, 6);
    x += w + 2;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
// 1960s office wallpaper: faint vertical stripes
function wallpaperTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#c4af90'; g.fillRect(0, 0, 128, 128);
  for (let x = 0; x < 128; x += 16) { g.fillStyle = 'rgba(255,248,230,0.16)'; g.fillRect(x, 0, 8, 128); g.fillStyle = 'rgba(70,50,30,0.1)'; g.fillRect(x + 8, 0, 1.5, 128); }
  for (let k = 0; k < 400; k++) { g.fillStyle = `rgba(60,40,20,${Math.random() * 0.05})`; g.fillRect(Math.random() * 128, Math.random() * 128, 2, 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
  return t;
}

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


  // ---- DAY: a tall window in the back wall, the sun coming through it, light shafts and dust in them.
  // Everything here is hidden at Night (no extra draw calls); the lighting blend `k` (lighting.js) fades it all in.
  const FLOOR_Y = tableY - 19.3, CEIL_Y = tableY + 82, RX = 70, RZ = 62;
  const WIN = { x: -16, y: tableY + 34, w: 38, h: 40 };
  const sunTarget = new THREE.Vector3(4, tableY, 2);
  const sunDir = sunTarget.clone().sub(new THREE.Vector3(WIN.x, WIN.y, -RZ)).normalize();     // where the light travels
  const day = new THREE.Group(); day.visible = false; group.add(day);
  const wallTex = wallpaperTexture();
  const wallMat = (w, h) => { const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(w / 16, h / 16); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95, color: '#ffffff' }); };
  const WALL_H = CEIL_Y - FLOOR_Y;
  {
    // the back wall with the window cut out of it
    const sh = new THREE.Shape([new THREE.Vector2(-RX, 0), new THREE.Vector2(RX, 0), new THREE.Vector2(RX, WALL_H), new THREE.Vector2(-RX, WALL_H)]);
    const hx = WIN.x, hy = WIN.y - FLOOR_Y, hole = new THREE.Path();
    hole.moveTo(hx - WIN.w / 2, hy - WIN.h / 2); hole.lineTo(hx - WIN.w / 2, hy + WIN.h / 2); hole.lineTo(hx + WIN.w / 2, hy + WIN.h / 2); hole.lineTo(hx + WIN.w / 2, hy - WIN.h / 2); hole.closePath();
    sh.holes.push(hole);
    const gm = new THREE.ShapeGeometry(sh);
    const uv = gm.attributes.uv, pos = gm.attributes.position;
    for (let k = 0; k < uv.count; k++) uv.setXY(k, pos.getX(k), pos.getY(k));       // world-sized wallpaper
    const back = new THREE.Mesh(gm, wallMat(16, 16));
    back.material.map.repeat.set(1 / 16, 1 / 16);
    back.position.set(0, FLOOR_Y, -RZ); back.castShadow = true;
    day.add(back);
    for (const [x, z, ry, w] of [[-RX, 0, Math.PI / 2, 2 * RZ], [RX, 0, -Math.PI / 2, 2 * RZ], [0, RZ, Math.PI, 2 * RX]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, WALL_H), wallMat(w, WALL_H));
      m.position.set(x, FLOOR_Y + WALL_H / 2, z); m.rotation.y = ry; m.receiveShadow = true;
      day.add(m);
    }
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(2 * RX, 2 * RZ), new THREE.MeshStandardMaterial({ color: '#d8ccb6', roughness: 1 }));
    ceil.rotation.x = Math.PI / 2; ceil.position.y = CEIL_Y + 0.5;
    day.add(ceil);
    // frame, mullions and sill: a dark-painted wooden sash; its shadow is what stripes the sun patch
    const bar = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const T = 1.2, parts = [
      bar(T, WIN.h, 1.6, -WIN.w / 2 + T / 2, 0, 0.2), bar(T, WIN.h, 1.6, WIN.w / 2 - T / 2, 0, 0.2),
      bar(WIN.w, T, 1.6, 0, WIN.h / 2 - T / 2, 0.2), bar(WIN.w, T, 1.6, 0, -WIN.h / 2 + T / 2, 0.2),
      bar(0.8, WIN.h, 1.2, -WIN.w / 6, 0, 0.2), bar(0.8, WIN.h, 1.2, WIN.w / 6, 0, 0.2), bar(WIN.w, 0.7, 1.2, 0, WIN.h / 6, 0.2), bar(WIN.w, 0.7, 1.2, 0, -WIN.h / 6, 0.2),
      bar(WIN.w + 4, 1.1, 3.4, 0, -WIN.h / 2 - 0.4, 1.2),
    ];
    const frame = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ color: '#4d3826', roughness: 0.6 }));
    frame.position.set(WIN.x, WIN.y, -RZ); frame.castShadow = true; frame.receiveShadow = true;
    day.add(frame);
    // the sky beyond
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture(), fog: false });
    skyMat.color.setScalar(1.35);
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(64, 86), skyMat);
    sky.position.set(WIN.x, WIN.y - 4, -RZ - 3);
    day.add(sky);
  }
  const SUN_POWER = 6;
  const sun = new THREE.DirectionalLight('#fff0d6', 0);
  sun.position.copy(sunTarget).addScaledVector(sunDir, -95);
  sun.target.position.copy(sunTarget);
  sun.visible = false; sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -80, right: 80, top: 80, bottom: -80, near: 1, far: 230 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
  group.add(sun, sun.target);

  // the shaft of light: window prism + slices, ending where it meets the floor
  const shaftGeo = (() => {
    const P = [], UV = [], SK = [], idx = [];
    const corner = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const world = (u, v) => new THREE.Vector3(WIN.x + (u - 0.5) * WIN.w, WIN.y + (v - 0.5) * WIN.h, -RZ + 0.5);
    const len = p => (p.y - FLOOR_Y) / -sunDir.y;
    const push = (p, u, v, s, kind) => { P.push(p.x, p.y, p.z); UV.push(u, v); SK.push(s, kind); return P.length / 3 - 1; };
    for (let i = 0; i < 4; i++) {
      const [u0, v0] = corner[i], [u1, v1] = corner[(i + 1) % 4], a = world(u0, v0), b = world(u1, v1);
      const a2 = a.clone().addScaledVector(sunDir, len(a)), b2 = b.clone().addScaledVector(sunDir, len(b));
      const i0 = push(a, u0, v0, 0, 0), i1 = push(b, u1, v1, 0, 0), i2 = push(b2, u1, v1, 1, 0), i3 = push(a2, u0, v0, 1, 0);
      idx.push(i0, i1, i2, i0, i2, i3);
    }
    const L = len(world(0.5, 0.5));
    for (let n = 0; n < 9; n++) {
      const s = 0.04 + n * 0.1, off = sunDir.clone().multiplyScalar(s * L), base = P.length / 3;
      for (const [u, v] of corner) push(world(u, v).add(off), u, v, s, 1);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    g.setAttribute('wuv', new THREE.Float32BufferAttribute(UV, 2));
    g.setAttribute('sk', new THREE.Float32BufferAttribute(SK, 2));
    g.setIndex(idx);
    return g;
  })();
  const shaft = new THREE.Mesh(shaftGeo, shaftMaterial());
  shaft.frustumCulled = false; shaft.renderOrder = 5; shaft.visible = false;
  group.add(shaft);
  // motes drifting in the sun (the same dust shader, without the cone)
  const ND = 700, dpos = new Float32Array(ND * 3), dseed = new Float32Array(ND);
  for (let k = 0; k < ND; k++) {
    const p = new THREE.Vector3(WIN.x + (Math.random() - 0.5) * WIN.w * 0.9, WIN.y + (Math.random() - 0.5) * WIN.h * 0.9, -RZ + 1);
    p.addScaledVector(sunDir, Math.random() * 0.85 * (p.y - FLOOR_Y) / -sunDir.y);
    dpos.set([p.x, p.y, p.z], k * 3); dseed[k] = Math.random();
  }
  const sunDustGeo = new THREE.BufferGeometry();
  sunDustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  sunDustGeo.setAttribute('seed', new THREE.BufferAttribute(dseed, 1));
  const sunDust = new THREE.Points(sunDustGeo, dustMaterial(true));
  sunDust.frustumCulled = false; sunDust.renderOrder = 6; sunDust.visible = false;
  sunDust.material.uniforms.size.value = 8;
  group.add(sunDust);

  // night values (what the room already had), so Day is a blend from them and Night comes back exactly
  const NIGHT = { bg: scene.background.clone(), fog: scene.fog.color.clone(), fogD: scene.fog.density, skyC: spill.color.clone(), gndC: spill.groundColor.clone(), spillI: spill.intensity, env: scene.environmentIntensity };
  const DAYC = { bg: new THREE.Color('#9a8c78'), fog: new THREE.Color('#d2c0a2'), skyC: new THREE.Color('#a4c4f4'), gndC: new THREE.Color('#e6bd8c') };
  const DAY_FOG = 0.0034, DAY_SPILL = 1.5, DAY_ENV = 0.5;
  const dustNight = dust.material.uniforms.color.value.clone(), dustDay = new THREE.Color(1.0, 0.92, 0.78).multiplyScalar(0.8);
  let k = 0, lastK = -1, shaftsOn = true;
  function applyDay(kk) {
    k = kk; lastK = kk;
    const day_ = kk > 0.001, full = kk > 0.999;
    day.visible = day_;
    sun.visible = day_; sun.intensity = SUN_POWER * kk;
    spot.visible = inner.visible = !full;
    scene.background.copy(NIGHT.bg).lerp(DAYC.bg, kk);
    scene.fog.color.copy(NIGHT.fog).lerp(DAYC.fog, kk);
    scene.fog.density = NIGHT.fogD + (DAY_FOG - NIGHT.fogD) * kk;
    spill.color.copy(NIGHT.skyC).lerp(DAYC.skyC, kk);
    spill.groundColor.copy(NIGHT.gndC).lerp(DAYC.gndC, kk);
    spill.intensity = NIGHT.spillI + (DAY_SPILL - NIGHT.spillI) * kk;
    scene.environmentIntensity = NIGHT.env + (DAY_ENV - NIGHT.env) * kk;
    const nightOn = kk < 0.999;
    cone.visible = dust.visible = nightOn;
    dust.material.uniforms.color.value.copy(dustNight).multiplyScalar(1 - kk);
    const sunOn = day_ && shaftsOn;
    shaft.visible = sunDust.visible = sunOn;
    shaft.material.uniforms.intensity.value = 0.055 * kk;
    sunDust.material.uniforms.color.value.copy(dustDay).multiplyScalar(kk);
  }

  // ---- sway & flicker
  const bulbWorld = new THREE.Vector3();
  let flickerUntil = 0, nextFlicker = 4, flickerDepth = 0;
  function update(time) {
    pivot.rotation.z = 0.011 * Math.sin(time * (2 * Math.PI / 7.3));
    pivot.rotation.x = 0.008 * Math.sin(time * (2 * Math.PI / 9.1) + 1.3);
    const kk = lighting.k;
    if (Math.abs(kk - lastK) > 1e-4) applyDay(kk);
    let f = 1 + 0.006 * Math.sin(time * 37) * Math.sin(time * 5.3);  // filament never quite steady
    if (k < 0.3 && time > nextFlicker) { flickerUntil = time + 0.05 + Math.random() * 0.08; flickerDepth = 0.04 + Math.random() * 0.05; nextFlicker = time + 3 + Math.random() * 9; sfx.flicker(flickerDepth); }
    if (time < flickerUntil) f -= flickerDepth;
    spot.intensity = SPOT_POWER * f * (1 - k);
    inner.intensity = 7 * f * (1 - k);
    for (const m of lampEmissive) m.emissiveIntensity = 28 * f * (1 - 0.93 * k);     // by day the bulb is switched off, only a faint warm tint
    cone.material.uniforms.time.value = time;
    cone.material.uniforms.intensity.value = 0.07 * f * (1 - k);
    shaft.material.uniforms.time.value = time;
    pivot.updateMatrixWorld();
    bulbWorld.copy(bulbLocal).applyMatrix4(pivot.matrixWorld);
    dust.material.uniforms.time.value = time;
    dust.material.uniforms.apex.value.copy(bulbWorld);
    dust.material.uniforms.pixelRatio.value = renderer.getPixelRatio();
  }

  return {
    group, update, bulbWorld, envReady,
    get dayK() { return k; },
    dayExposure: 0.85,                                   // the tone-map exposure at full Day, relative to Night (sun and sky are far brighter than the bulb)
    setDetail(tier) {
      const n = tier === 'low' ? 450 : N; if (dustGeo.drawRange.count !== n) dustGeo.setDrawRange(0, n);   // fewer motes on Low
      const on = tier !== 'low';
      if (on !== shaftsOn) { shaftsOn = on; lastK = -1; }                                                  // no light shafts on Low
    },
    setShadowSize(size) {
      for (const [l, sz] of [[spot, size], [sun, Math.min(size, 2048)]]) {
        if (l.shadow.mapSize.x === sz) continue;
        l.shadow.mapSize.set(sz, sz);
        if (l.shadow.map) { l.shadow.map.dispose(); l.shadow.map = null; }
      }
    },
  };
}
