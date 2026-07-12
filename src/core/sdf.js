import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';

// Signed-distance field builder + marching cubes — the geometry backbone.
//
// The animal is a set of SDF primitives (ellipsoid body, capsule projections,
// sphere bumps) combined with a smooth union and polygonised into ONE continuous
// mesh, so appendages flow out of the flesh with no seam. Two tricks keep it fast
// enough to rebuild on every structural param change:
//   1. EXPONENTIAL smin, accumulated as Σ exp(-k·dᵢ) — order-independent, so each
//      primitive can be splatted independently and the blend is exact.
//   2. BOUNDED splatting — a primitive only writes to grid cells inside its bbox
//      (+ a blend margin), so cost scales with total primitive volume, not
//      nPrimitives × gridVolume. A body with 150 bumps still builds in ~100 ms.
// Normals come from the grid gradient; per-vertex (u,v) + colour are baked by
// callbacks at the (few thousand) output vertices.

const LARGE = 1e9;

export class SDFField {
  constructor() {
    this.prims = [];
    this.min = [LARGE, LARGE, LARGE];
    this.max = [-LARGE, -LARGE, -LARGE];
  }

  _grow(cx, cy, cz, r) {
    if (cx - r < this.min[0]) this.min[0] = cx - r;
    if (cy - r < this.min[1]) this.min[1] = cy - r;
    if (cz - r < this.min[2]) this.min[2] = cz - r;
    if (cx + r > this.max[0]) this.max[0] = cx + r;
    if (cy + r > this.max[1]) this.max[1] = cy + r;
    if (cz + r > this.max[2]) this.max[2] = cz + r;
  }

  // Ellipsoid (approximate SDF — the standard scaled-sphere bound).
  ellipsoid(c, r, blend = 0.05) {
    const [cx, cy, cz] = c, [rx, ry, rz] = r;
    this.prims.push({
      blend,
      bbmin: [cx - rx, cy - ry, cz - rz], bbmax: [cx + rx, cy + ry, cz + rz],
      d(x, y, z) {
        const px = (x - cx) / rx, py = (y - cy) / ry, pz = (z - cz) / rz;
        const k0 = Math.sqrt(px * px + py * py + pz * pz);
        const k1 = Math.sqrt((px / rx) ** 2 + (py / ry) ** 2 + (pz / rz) ** 2);
        return k1 > 1e-9 ? (k0 * (k0 - 1.0)) / k1 : k0 - 1.0;
      },
    });
    this._grow(cx, cy, cz, Math.max(rx, ry, rz));
    return this;
  }

  sphere(c, r, blend = 0.05) {
    const [cx, cy, cz] = c;
    this.prims.push({
      blend,
      bbmin: [cx - r, cy - r, cz - r], bbmax: [cx + r, cy + r, cz + r],
      d(x, y, z) { return Math.hypot(x - cx, y - cy, z - cz) - r; },
    });
    this._grow(cx, cy, cz, r);
    return this;
  }

  // Capsule = swept sphere between a and b, radius r0→r1 along its length. The
  // workhorse for projections (cerata, plume branches, antenna stalks).
  capsule(a, b, r0, r1 = r0, blend = 0.05) {
    const ax = a[0], ay = a[1], az = a[2];
    const bax = b[0] - ax, bay = b[1] - ay, baz = b[2] - az;
    const bb = bax * bax + bay * bay + baz * baz || 1e-9;
    const rmax = Math.max(r0, r1);
    this.prims.push({
      blend,
      bbmin: [Math.min(a[0], b[0]) - rmax, Math.min(a[1], b[1]) - rmax, Math.min(a[2], b[2]) - rmax],
      bbmax: [Math.max(a[0], b[0]) + rmax, Math.max(a[1], b[1]) + rmax, Math.max(a[2], b[2]) + rmax],
      d(x, y, z) {
        const px = x - ax, py = y - ay, pz = z - az;
        let h = (px * bax + py * bay + pz * baz) / bb;
        h = h < 0 ? 0 : h > 1 ? 1 : h;
        const dx = px - bax * h, dy = py - bay * h, dz = pz - baz * h;
        return Math.sqrt(dx * dx + dy * dy + dz * dz) - (r0 + (r1 - r0) * h);
      },
    });
    this._grow((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2,
      Math.hypot(bax, bay, baz) / 2 + rmax);
    return this;
  }

  // Polygonise. `res` = grid samples on the longest axis. `attr(x,y,z,out)` may
  // fill per-vertex attributes (e.g. uv); `col(x,y,z,out)` a per-vertex colour.
  build({ res = 96, attr = null, col = null } = {}) {
    // Pad the bounds so the surface isn't clipped at the grid edge.
    const size = [this.max[0] - this.min[0], this.max[1] - this.min[1], this.max[2] - this.min[2]];
    const pad = Math.max(size[0], size[1], size[2]) * 0.06 + 1e-4;
    const mn = [this.min[0] - pad, this.min[1] - pad, this.min[2] - pad];
    const mx = [this.max[0] + pad, this.max[1] + pad, this.max[2] + pad];
    const span = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
    const longest = Math.max(span[0], span[1], span[2]);
    const nx = Math.max(8, Math.round((span[0] / longest) * res));
    const ny = Math.max(8, Math.round((span[1] / longest) * res));
    const nz = Math.max(8, Math.round((span[2] / longest) * res));
    const dx = span[0] / (nx - 1), dy = span[1] / (ny - 1), dz = span[2] / (nz - 1);

    // Accumulate Σ exp(-k·d) per cell, bounded to each primitive's bbox.
    const acc = new Float64Array(nx * ny * nz);
    const idx = (i, j, k) => (k * ny + j) * nx + i;
    for (const p of this.prims) {
      const k = 1.0 / Math.max(p.blend, 1e-4);
      const margin = p.blend * 4;
      let i0 = Math.floor((p.bbmin[0] - margin - mn[0]) / dx);
      let i1 = Math.ceil((p.bbmax[0] + margin - mn[0]) / dx);
      let j0 = Math.floor((p.bbmin[1] - margin - mn[1]) / dy);
      let j1 = Math.ceil((p.bbmax[1] + margin - mn[1]) / dy);
      let k0 = Math.floor((p.bbmin[2] - margin - mn[2]) / dz);
      let k1 = Math.ceil((p.bbmax[2] + margin - mn[2]) / dz);
      i0 = Math.max(0, i0); j0 = Math.max(0, j0); k0 = Math.max(0, k0);
      i1 = Math.min(nx - 1, i1); j1 = Math.min(ny - 1, j1); k1 = Math.min(nz - 1, k1);
      for (let kk = k0; kk <= k1; kk++) {
        const z = mn[2] + kk * dz;
        for (let jj = j0; jj <= j1; jj++) {
          const y = mn[1] + jj * dy;
          for (let ii = i0; ii <= i1; ii++) {
            const x = mn[0] + ii * dx;
            let e = -k * p.d(x, y, z);
            if (e > 30) e = 30; else if (e < -30) continue; // negligible weight
            acc[idx(ii, jj, kk)] += Math.exp(e);
          }
        }
      }
    }

    // Convert to a signed-distance grid: -ln(acc)/k_ref. Use a representative k
    // (mean blend) just for the field magnitude; the zero-crossing is what MC uses.
    const kRef = 1.0 / Math.max(meanBlend(this.prims), 1e-4);
    const field = new Float32Array(nx * ny * nz);
    for (let n = 0; n < field.length; n++) {
      field[n] = acc[n] > 1e-12 ? -Math.log(acc[n]) / kRef : LARGE;
    }

    // Polygonise → non-indexed triangle soup.
    const positions = [];
    marchingTetrahedra(field, nx, ny, nz, mn, [dx, dy, dz], positions);

    // Bake per-vertex uv/colour from callbacks, then merge coincident vertices and
    // compute smoothed (area-weighted face) normals — far more robust than sampling
    // the coarse grid gradient, which bands on thin flat regions.
    const nVerts = positions.length / 3;
    const posArr = new Float32Array(positions);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    if (attr) {
      const uvs = new Float32Array(nVerts * 2); const t = [0, 0];
      for (let v = 0; v < nVerts; v++) { attr(posArr[v * 3], posArr[v * 3 + 1], posArr[v * 3 + 2], t); uvs[v * 2] = t[0]; uvs[v * 2 + 1] = t[1]; }
      geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    }
    if (col) {
      const cs = new Float32Array(nVerts * 3); const t = [0, 0, 0];
      for (let v = 0; v < nVerts; v++) { col(posArr[v * 3], posArr[v * 3 + 1], posArr[v * 3 + 2], t); cs[v * 3] = t[0]; cs[v * 3 + 1] = t[1]; cs[v * 3 + 2] = t[2]; }
      geo.setAttribute('color', new THREE.BufferAttribute(cs, 3));
    }
    const merged = mergeVertices(geo, Math.min(dx, dy, dz) * 0.25);
    merged.computeVertexNormals();
    merged.userData.verts = merged.attributes.position.count;
    return merged;
  }
}

function meanBlend(prims) {
  if (!prims.length) return 0.05;
  let s = 0; for (const p of prims) s += p.blend; return s / prims.length;
}

function trilerp(field, nx, ny, nz, mn, d, x, y, z) {
  let fx = (x - mn[0]) / d[0], fy = (y - mn[1]) / d[1], fz = (z - mn[2]) / d[2];
  fx = clampf(fx, 0, nx - 1.001); fy = clampf(fy, 0, ny - 1.001); fz = clampf(fz, 0, nz - 1.001);
  const i = fx | 0, j = fy | 0, k = fz | 0;
  const tx = fx - i, ty = fy - j, tz = fz - k;
  const g = (ii, jj, kk) => field[(kk * ny + jj) * nx + ii];
  const c00 = g(i, j, k) * (1 - tx) + g(i + 1, j, k) * tx;
  const c10 = g(i, j + 1, k) * (1 - tx) + g(i + 1, j + 1, k) * tx;
  const c01 = g(i, j, k + 1) * (1 - tx) + g(i + 1, j, k + 1) * tx;
  const c11 = g(i, j + 1, k + 1) * (1 - tx) + g(i + 1, j + 1, k + 1) * tx;
  const c0 = c00 * (1 - ty) + c10 * ty, c1 = c01 * (1 - ty) + c11 * ty;
  return c0 * (1 - tz) + c1 * tz;
}
const clampf = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---- Marching tetrahedra ----------------------------------------------------
// Each cube is split into 6 tetrahedra sharing the main diagonal (0–6); each tet
// is polygonised with the tiny, unambiguous MT case logic (Bourke's PolygoniseTri).
// No 256-entry table to mistype. More triangles than marching cubes, but exact and
// robust — fine for one hero mesh. Normals come from the grid gradient, so triangle
// winding only matters for culling (we render DoubleSide to be safe).
const CUBE = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]];
const TETS = [[0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6], [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6]];

function marchingTetrahedra(field, nx, ny, nz, mn, d, out) {
  const iso = 0.0;
  const at = (i, j, k) => field[(k * ny + j) * nx + i];
  const val = new Array(8), pos = new Array(8);
  const vp = (a, b) => { // interpolate a point on edge a–b at the isosurface
    const t = (iso - val[a]) / (val[b] - val[a] || 1e-9);
    return [pos[a][0] + t * (pos[b][0] - pos[a][0]),
            pos[a][1] + t * (pos[b][1] - pos[a][1]),
            pos[a][2] + t * (pos[b][2] - pos[a][2])];
  };
  const push = (p) => out.push(p[0], p[1], p[2]);
  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        for (let c = 0; c < 8; c++) {
          val[c] = at(i + CUBE[c][0], j + CUBE[c][1], k + CUBE[c][2]);
          pos[c] = [mn[0] + (i + CUBE[c][0]) * d[0], mn[1] + (j + CUBE[c][1]) * d[1], mn[2] + (k + CUBE[c][2]) * d[2]];
        }
        for (const T of TETS) polyTet(T, val, pos, iso, vp, push);
      }
    }
  }
}

function polyTet(T, val, pos, iso, vp, push) {
  // Local indices 0..3 map to cube corners T[0..3]. Interp helper e(a,b)=vp(T[a],T[b]).
  const e = (a, b) => vp(T[a], T[b]);
  let idx = 0;
  if (val[T[0]] < iso) idx |= 1;
  if (val[T[1]] < iso) idx |= 2;
  if (val[T[2]] < iso) idx |= 4;
  if (val[T[3]] < iso) idx |= 8;
  switch (idx) {
    case 0x00: case 0x0F: return;
    case 0x01: case 0x0E: push(e(0, 1)); push(e(0, 2)); push(e(0, 3)); return;
    case 0x02: case 0x0D: push(e(1, 0)); push(e(1, 3)); push(e(1, 2)); return;
    case 0x04: case 0x0B: push(e(2, 0)); push(e(2, 1)); push(e(2, 3)); return;
    case 0x08: case 0x07: push(e(3, 0)); push(e(3, 2)); push(e(3, 1)); return;
    case 0x03: case 0x0C: {
      const a = e(0, 3), b = e(0, 2), c = e(1, 3), dd = e(1, 2);
      push(a); push(b); push(c); push(c); push(b); push(dd); return;
    }
    case 0x05: case 0x0A: {
      const a = e(0, 1), b = e(2, 3), c = e(0, 3), dd = e(1, 2);
      push(a); push(b); push(c); push(a); push(dd); push(b); return;
    }
    case 0x06: case 0x09: {
      const a = e(0, 1), b = e(1, 3), c = e(2, 3), dd = e(0, 2);
      push(a); push(b); push(c); push(a); push(c); push(dd); return;
    }
  }
}
