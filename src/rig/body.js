import * as THREE from 'three';
import { smoothstep, clamp, lerp } from '../core/math.js';

// The body: a slug form built as radius-varying ellipsoids strung along the body
// axis (x), smin-blended by the SDF into one smooth surface. Profiles morph it from
// a flat, wide, overhanging DORID disc to an elongate, tapered AEOLID body. Sits on
// the substrate plane y=0 (the rounded underside dips just below, hidden by it).
//
// Head is +x (u=1), tail is -x (u=0). Cross-section in (z,y): phi=0 is the dorsal
// midline (top), phi=±90° are the left/right mantle margins.

// A profile-bundle capturing the body's shape functions, shared by the SDF builder
// and the appendage placer so both agree on where the surface is.
export function bodyProfiles(p) {
  const b = p.body;
  const half = b.length;                 // x ∈ [-half, half]
  const tailSharp = 0.5 + b.tailTaper * 1.6;

  const widthAt = (u) => {
    const tailT = Math.pow(smoothstep(0, 0.5, u), tailSharp);     // taper in from the tail
    const headT = 0.32 + 0.68 * Math.pow(smoothstep(0, 0.34, 1 - u), 0.5);      // round the head
    const skirt = b.mantleOverhang * Math.pow(Math.sin(Math.PI * clamp(u, 0, 1)), 0.7);
    return 0.55 * (b.width + skirt) * tailT * headT;              // slug proportions
  };
  const heightAt = (u) => {
    const env = Math.pow(smoothstep(0, 0.4, u), 0.8) * Math.pow(smoothstep(0, 0.28, 1 - u), 0.6);
    const arch = 1 + b.headArch * smoothstep(0.6, 1.0, u);        // raised head
    return b.height * b.dome * env * arch;
  };
  const centreY = (u) => heightAt(u) * 0.8;                       // sit on the substrate

  return { half, widthAt, heightAt, centreY };
}

// Swept-mesh body: a slug form built by sweeping a flattened cross-section (domed
// top + flat foot sole) along the body axis, with width/height profiles that morph
// from a broad overhanging dorid disc to an elongate tapered aeolid. Clean, fast,
// and reliable — the proven fish/siphonophore technique. Returns a BufferGeometry
// with body-UV (u along body, v around the cross-section, 0.5 = dorsal midline).
export function buildBodyMesh(p) {
  const prof = bodyProfiles(p);
  const { half, widthAt, heightAt } = prof;
  const Nu = 80;       // stations along the body
  const M = 56;        // points around the cross-section loop
  const rows = [];
  for (let iu = 0; iu <= Nu; iu++) {
    const u = iu / Nu;
    const x = lerp(-half, half, u);
    const w = Math.max(widthAt(u), 0.004);
    const h = Math.max(heightAt(u), 0.004);
    const ring = [];
    for (let it = 0; it < M; it++) {
      const t = it / M;
      let y, z;
      if (t < 0.62) {
        // Domed top, right margin → over the top → left margin.
        const phi = (t / 0.62) * Math.PI;
        z = w * Math.sign(Math.cos(phi)) * Math.pow(Math.abs(Math.cos(phi)), 0.85);
        y = h * Math.pow(Math.sin(phi), 0.78);
        // Procedural NOTUM TEXTURE — displace the surface outward for tubercles
        // (rounded bumps) and wrinkles (soft folds), so the body isn't a smooth
        // lens. This is the cheap-and-controllable alternative to SDF lumpiness.
        const bd = p.body;
        if ((bd.bump || 0) + (bd.wrinkle || 0) > 0.001) {
          const dome = Math.pow(Math.sin(phi), 0.5); // fade texture out at the margins
          const tuber = Math.max(0, Math.sin(u * (bd.bumpU || 42)) * Math.sin(t * 6.2831 * (bd.bumpV || 13)));
          const wrink = 0.5 * Math.sin(u * 9.0 + t * 6.0) + 0.5 * Math.sin(t * 6.2831 * 3.0 + u * 4.0);
          const disp = ((bd.bump || 0) * tuber + (bd.wrinkle || 0) * wrink * 0.5) * h * dome;
          const cy = h * 0.35, dy = y - cy, dl = Math.hypot(dy, z) || 1;
          y += (dy / dl) * disp;
          z += (z / dl) * disp;
        }
      } else {
        // Flat foot sole (left margin → right margin) just above the substrate.
        const b = (t - 0.62) / 0.38;
        z = -w + b * 2 * w;
        y = 0.004 + h * 0.06 * Math.sin(b * Math.PI); // a hint of a rounded sole
      }
      ring.push([x, y, z]);
    }
    rows.push(ring);
  }

  const pos = [], uv = [], idx = [];
  for (let iu = 0; iu <= Nu; iu++) {
    for (let it = 0; it < M; it++) {
      const v = rows[iu][it];
      pos.push(v[0], v[1], v[2]);
      // v-coord: 0.5 at dorsal midline (t≈0.31), wrapping to 0/1 at the margins.
      uv.push(iu / Nu, it / M);
    }
  }
  const rowLen = M;
  for (let iu = 0; iu < Nu; iu++) {
    for (let it = 0; it < M; it++) {
      const a = iu * rowLen + it;
      const b = iu * rowLen + ((it + 1) % M);
      const c = (iu + 1) * rowLen + it;
      const d = (iu + 1) * rowLen + ((it + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  // Cap the tail (u=0) and head (u=1) with a centre fan.
  const capTail = pos.length / 3;
  pos.push(-half, heightAt(0) * 0.3, 0); uv.push(0, 0.5);
  for (let it = 0; it < M; it++) idx.push(capTail, (it + 1) % M, it);
  const capHead = pos.length / 3;
  pos.push(half, heightAt(1) * 0.3, 0); uv.push(1, 0.5);
  const base = Nu * rowLen;
  for (let it = 0; it < M; it++) idx.push(capHead, base + it, base + ((it + 1) % M));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  geo.userData.verts = pos.length / 3;
  return geo;
}

// Emit the body's SDF primitives into `field` as a SPHERE CARPET: overlapping
// exact-SDF spheres tiled over the (x along body, w across width) footprint, with
// radius thick along the dorsal midline and thin at the mantle margins. Spheres
// blend smoothly (exact isotropic distance), fill the volume solid, and give a
// domed top + thin frilly margin + a flat sole on the substrate — for free.
export function buildBody(field, p) {
  const { half, widthAt, heightAt } = bodyProfiles(p);
  const blend = p.body.blend;
  const Nx = 52, Nz = 22;
  // A base radius large enough that even the thin-margin spheres always overlap
  // their neighbours (else the mantle edge breaks into disconnected blobs/holes).
  const baseR = Math.max(2 * half / Nx, 0.045);
  for (let ix = 0; ix <= Nx; ix++) {
    const u = ix / Nx;
    const x = lerp(-half, half, u);
    const hw = widthAt(u);      // half-width at this station
    const dome = heightAt(u);   // dorsal dome height at the midline
    if (hw < 0.008) continue;
    for (let iz = 0; iz <= Nz; iz++) {
      const w = (iz / Nz) * 2 - 1;                  // -1..1 across the width
      const z = w * hw;
      const across = Math.sqrt(Math.max(0, 1 - w * w)); // domed cross-section profile
      const r = baseR + dome * across;              // thick midline, thin margin
      field.sphere([x, r * 0.85, z], r, blend);     // sit the sole on y≈0
    }
  }
}

// Surface point + outward normal at (u along body, v across dorsum). v: 0 = left
// margin, 0.5 = dorsal midline, 1 = right margin. Used to seat appendages — so it
// MUST match the swept mesh's cross-section exactly (see buildBodyMesh), or the
// appendages float above / sink into the body.
export function surfacePoint(profiles, u, v, out = {}) {
  const { half, widthAt, heightAt } = profiles;
  const x = lerp(-half, half, u);
  const w = Math.max(widthAt(u), 0.006);
  const h = Math.max(heightAt(u), 0.006);
  // The mesh's top cross-section, parametrised by phi ∈ [0,π]: phi=0 → right margin,
  // π/2 → dorsal midline, π → left margin. v maps in reverse so v=0.5 is the top.
  const cs = (phi) => {
    const c = Math.cos(phi), s = Math.sin(phi);
    return [h * Math.pow(Math.max(0, s), 0.78), w * Math.sign(c) * Math.pow(Math.abs(c), 0.85)];
  };
  const phi = (1 - v) * Math.PI;
  const [y, z] = cs(phi);
  // Outward normal from the cross-section tangent (finite difference), oriented away
  // from a point just inside the dome; plus a small x-tilt from the along-body slope.
  const e = 0.02;
  const [ya, za] = cs(phi - e), [yb, zb] = cs(phi + e);
  let ny = zb - za, nz = -(yb - ya);
  if (ny * (y - h * 0.35) + nz * z < 0) { ny = -ny; nz = -nz; }
  const slope = heightAt(Math.min(1, u + 0.02)) - heightAt(Math.max(0, u - 0.02));
  let nx = -slope * Math.max(0, Math.sin(phi)) * 1.0;
  const nl = Math.hypot(nx, ny, nz) || 1;
  out.pos = [x, y, z];
  out.nrm = [nx / nl, ny / nl, nz / nl];
  out.w = w; out.h = h;
  return out;
}
