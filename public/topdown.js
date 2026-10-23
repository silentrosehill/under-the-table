// The "Top-down" camera (both modes): a high three-quarter view of the whole board seen from a corner, so the square loop reads as a
// diamond ("Business Tour" style). The view is written for the +z seat and turned to the viewer's own seat by `yaw`; it looks from the
// corner between the seat's own row and the row on its +x side (the corner where play starts when you sit at the near edge).
// fitTopDown() finds the distance (and the small aim shift) at which the given points - the corners of the board, at the ground and at
// building height - just fill the screen, whatever the aspect ratio.
import * as THREE from 'three';

const Y = new THREE.Vector3(0, 1, 0);
const cam = new THREE.PerspectiveCamera();
const p = new THREE.Vector3(), fwd = new THREE.Vector3(), flat = new THREE.Vector3();

export const AZIMUTH = Math.PI / 4;                       // from the corner, not from the side

// pts: world points that must stay in view; center: the point the camera looks at (on the ground, in the middle of the board)
// → writes the camera position into P and the aim into T; returns the distance
export function fitTopDown({ pts, center, fov, aspect, yaw = 0, T, P, margin = {} }) {
  const portrait = aspect < 1;
  const tilt = (portrait ? 62 : 55) * Math.PI / 180;               // degrees down from the horizon: a bit steeper on a phone
  const mx = margin.x ?? (portrait ? 1.1 : 1.0), top = margin.top ?? (portrait ? 0.62 : 0.82), bottom = margin.bottom ?? (portrait ? 0.45 : 0.64);
  const dir = new THREE.Vector3(Math.sin(AZIMUTH) * Math.cos(tilt), Math.sin(tilt), Math.cos(AZIMUTH) * Math.cos(tilt)).applyAxisAngle(Y, yaw);
  flat.set(-dir.x, 0, -dir.z).normalize();                         // along the ground, away from the camera
  cam.fov = fov; cam.aspect = aspect; cam.near = 0.1; cam.far = 1000; cam.updateProjectionMatrix();
  const aim = center.clone();
  const half = Math.tan(fov * Math.PI / 360);
  let d = 20, box = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const measure = dist => {                                       // the points' extent in NDC from this distance
    cam.position.copy(aim).addScaledVector(dir, dist);
    cam.lookAt(aim); cam.updateMatrixWorld(); cam.matrixWorldInverse.copy(cam.matrixWorld).invert();
    let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    for (const q of pts) { p.copy(q).applyMatrix4(cam.matrixWorldInverse).applyMatrix4(cam.projectionMatrix); x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
    box = { x0, x1, y0, y1 };
  };
  const goalMid = (top - bottom) / 2, goalH = top + bottom;       // the wanted vertical band: from -bottom to +top
  for (let it = 0; it < 4; it++) {
    let lo = 3, hi = 400;
    for (let k = 0; k < 26; k++) {
      d = (lo + hi) / 2; measure(d);
      if (box.x1 - box.x0 <= 2 * mx && box.y1 - box.y0 <= goalH) hi = d; else lo = d;
    }
    d = hi; measure(d);
    // slide the aim along the ground so the board sits in the wanted band (a little further ahead moves it down the screen)
    const cy = (box.y0 + box.y1) / 2 - goalMid, cx = (box.x0 + box.x1) / 2;
    const hh = d * half;
    aim.addScaledVector(flat, cy * hh / Math.sin(tilt));
    fwd.crossVectors(flat, Y).normalize();                          // screen-right on the ground
    aim.addScaledVector(fwd, cx * hh * aspect);
  }
  T.copy(aim); P.copy(aim).addScaledVector(dir, d);
  return d;
}

// the four corners of a square footprint (half-side `h`, centred on (cx, cz)) at the given heights
export function squarePoints(h, ys, cx = 0, cz = 0) {
  const out = [];
  for (const y of ys) for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(new THREE.Vector3(cx + sx * h, y, cz + sz * h));
  return out;
}
