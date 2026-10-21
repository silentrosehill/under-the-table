// City Mode geometry: the classic square loop, one little diorama per board square, in board order.
// A side square is TW units wide (along the street) and D deep: a narrow street cell (ROAD deep:
// carriageway plus two pavements) and a deeper lot where the buildings stand. Corners are D×D with the
// street bending through their inner cell. Tile 0 (Start) is the near-right corner; play runs
// right→left along the near side, like Table Mode. (Units are city units; the whole city is scaled
// onto the table by cityScene.js.)
import * as THREE from 'three';

export const ROAD = 0.72, LOT = 1.38, D = ROAD + LOT, C = D;
export const CARRIAGE = 0.42;             // the asphalt between the kerbs
export const TW = 0.86;                   // a side square's frontage along the street (narrower than the old 1.0: reads as distinct Monopoly slots)
export const H = C + 4.5 * TW;            // half the loop's width
export const R = H - D + ROAD / 2;        // the street's centre line, from the middle
export const BASE_H = 0.12;               // height of each tile's base
export const TOP = BASE_H;                // ground level on a tile
export const LANE = 0.1;                  // offset from the centre line where pieces drive

const sideAngle = s => -s * Math.PI / 2;
const rot = (x, z, a, out) => out.set(x * Math.cos(a) + z * Math.sin(a), out.y, -x * Math.sin(a) + z * Math.cos(a));

// where a tile sits; its local +z points out of the loop, local +x runs along the street against play
export function tileFrame(i) {
  const side = Math.floor(i / 10), k = i % 10, a = sideAngle(side);
  const x = k === 0 ? H - C / 2 : (H - C) - (k - 0.5) * TW, z = k === 0 ? H - C / 2 : H - D / 2;
  return { i, side, k, corner: k === 0, rotY: a, pos: rot(x, z, a, new THREE.Vector3()), w: k === 0 ? C : TW, d: D };
}

// a point on the street's centre line; t runs 0…40 with tile i's stop at t = i
export function roadPoint(t, out = new THREE.Vector3(), heading = new THREE.Vector3()) {
  t = ((t % 40) + 40) % 40;
  const side = Math.floor(t / 10), u = t - side * 10, c = H - C, r = ROAD / 2;
  let x, z, hx, hz;
  if (u <= 0.5) {                                        // leaving the corner: second half of its bend
    const f = Math.PI / 4 + (u / 0.5) * Math.PI / 4;
    x = c + r * Math.cos(f); z = c + r * Math.sin(f); hx = -Math.sin(f); hz = Math.cos(f);
  } else if (u < 9.5) { x = c - (u - 0.5) * TW; z = R; hx = -1; hz = 0; }
  else {                                                 // into the next corner's bend
    const f = Math.PI / 2 + ((u - 9.5) / 0.5) * Math.PI / 4;
    x = -c + r * Math.cos(f); z = c + r * Math.sin(f); hx = -Math.sin(f); hz = Math.cos(f);
  }
  const a = sideAngle(side);
  out.y = TOP; rot(x, z, a, out);
  heading.y = 0; rot(hx, hz, a, heading);
  return out;
}

// a point offset sideways from the centre line (+ = right-hand side)
export function lanePoint(t, offset, out = new THREE.Vector3(), heading = new THREE.Vector3()) {
  roadPoint(t, out, heading);
  out.x += -heading.z * offset; out.z += heading.x * offset;
  return out;
}
export const yawOf = h => Math.atan2(h.x, h.z);
