import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildAppendage } from './appendage.js';
import { surfacePoint } from './body.js';
import { rng, TAU, lerp, clamp } from '../core/math.js';

const Y = new THREE.Vector3(0, 1, 0);

// Place a dorsal-appendage family over the notum via place(u,v). One prototype
// appendage is built, then cloned+oriented to the body surface at each placement
// (erect along the surface normal, size by the along-body gradient, jittered), and
// all merged into a single BufferGeometry. Returns null when amount≈0 (skipped).
export function buildDorsalField(cfg, profiles, seed) {
  if (!cfg || cfg.amount <= 0.01 || cfg.count <= 0) return null;
  const rand = rng((cfg.seed || 1) * 2654435761 + seed);
  const proto = buildAppendage(cfg.spec, rand);
  const placements = layout(cfg, rand);
  const parts = [];
  const sp = {};
  const nrm = new THREE.Vector3(), q = new THREE.Quaternion(), tiltQ = new THREE.Quaternion();
  const scaleV = new THREE.Vector3(), posV = new THREE.Vector3(), m = new THREE.Matrix4();
  for (const pl of placements) {
    surfacePoint(profiles, pl.u, pl.v, sp);
    nrm.set(sp.nrm[0], sp.nrm[1], sp.nrm[2]);
    q.setFromUnitVectors(Y, nrm);
    // Lean: outward tilt + a little backward (toward the tail) + jitter.
    tiltQ.setFromEuler(new THREE.Euler(pl.tiltX, pl.tiltY, pl.tiltZ));
    q.multiply(tiltQ);
    posV.set(sp.pos[0], sp.pos[1], sp.pos[2]);
    const sc = pl.size;
    scaleV.set(sc, sc, sc);
    m.compose(posV, q, scaleV);
    parts.push(proto.clone().applyMatrix4(m));
  }
  if (!parts.length) return null;
  const geo = mergeGeometries(parts, false);
  geo.userData.verts = geo.attributes.position.count;
  return geo;
}

// Compute the (u,v,size,tilt) placements for a field's arrangement mode.
function layout(cfg, rand) {
  const out = [];
  const [u0, u1] = cfg.uRange;
  const uMid = (u0 + u1) * 0.5;
  const sizeOf = (u) => 1 - cfg.sizeGrad * clamp(Math.abs(u - uMid) / 0.5, 0, 1) * 0.7;

  if (cfg.arrange === 'ring') {
    // Rosette: appendages emanate from a ring around a centre point on the midline.
    const uc = u0, ringR = 0.03 + cfg.vSpread * 0.05;
    for (let k = 0; k < cfg.count; k++) {
      const a = (k / cfg.count) * TAU;
      out.push({
        u: clamp(uc + Math.cos(a) * ringR, 0.02, 0.98),
        v: clamp(0.5 + Math.sin(a) * ringR * 3.0, 0.15, 0.85),
        size: 1.0, tiltX: Math.sin(a) * 0.5, tiltY: a, tiltZ: -Math.cos(a) * 0.5,
      });
    }
  } else if (cfg.arrange === 'clusters') {
    const nC = Math.max(2, Math.round(cfg.count / 5));
    const seeds = [];
    for (let c = 0; c < nC; c++) {
      const side = c % 2 === 0 ? 1 : -1;
      seeds.push({ u: lerp(u0, u1, (c / 2 | 0) / (nC / 2)), v: 0.5 + side * cfg.vSpread * 0.4 });
    }
    for (let k = 0; k < cfg.count; k++) {
      const s = seeds[k % nC];
      out.push({
        u: clamp(s.u + (rand() - 0.5) * 0.06, 0.05, 0.95),
        v: clamp(s.v + (rand() - 0.5) * 0.12, 0.12, 0.88),
        size: sizeOf(s.u) * (0.8 + 0.4 * rand()),
        tiltX: 0.2 + rand() * 0.3, tiltY: (rand() - 0.5) * 0.6, tiltZ: (s.v - 0.5) * 1.4,
      });
    }
  } else if (cfg.arrange === 'scatter') {
    for (let k = 0; k < cfg.count; k++) {
      const u = lerp(u0, u1, rand());
      const v = 0.5 + (rand() - 0.5) * cfg.vSpread;
      out.push({ u, v, size: sizeOf(u) * (0.7 + 0.6 * rand()), tiltX: 0.1 * rand(), tiltY: rand() * TAU, tiltZ: 0 });
    }
  } else {
    // rows: cerata in wavy oblique rows down each side of the dorsum.
    for (let k = 0; k < cfg.count; k++) {
      const frac = k / (cfg.count - 1 || 1);
      const side = k % 2 === 0 ? 1 : -1;
      const u = lerp(u0, u1, frac);
      const v = clamp(0.5 + side * cfg.vSpread * (0.35 + 0.25 * Math.sin(frac * 9)) , 0.12, 0.88);
      out.push({
        u, v, size: sizeOf(u) * (0.85 + 0.3 * rand()),
        tiltX: 0.15, tiltY: (rand() - 0.5) * 0.4, tiltZ: side * cfg.tilt,
      });
    }
  }
  return out;
}
