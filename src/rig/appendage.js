import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { superRadius, TAU, lerp, smoothstep, clamp } from '../core/math.js';

// THE one recursive appendage generator. A tapered tube swept along a short curve,
// with knobs for cross-section shape, curl/droop, inflation, transverse ribs (antenna
// lamellae), a tip node, colour-along-length (base → gut core → tip), and recursive
// child branches. Cerata, gill pinnules, rhinophore clubs, dendritic branches, oral
// papillae, and surface bumps are all THIS at different specs. Built in local space:
// base at the origin, growing along +Y. Returns a BufferGeometry with vertex colours.
export function buildAppendage(spec, rand = Math.random) {
  const geo = buildRaw(spec, rand, spec.depth);
  geo.computeVertexNormals();
  return geo;
}

// Recursive build WITHOUT normals (so parent + children have identical attributes
// and merge cleanly); the public wrapper computes normals once at the end.
function buildRaw(spec, rand, depthLeft) {
  const parts = [tubeGeometry(spec, rand)];

  if (depthLeft > 0 && spec.branches > 0) {
    const nb = spec.branches;
    const L = spec.length;
    for (let b = 0; b < nb; b++) {
      const s = lerp(0.35, 0.95, nb === 1 ? 0.6 : b / (nb - 1)); // where on the parent
      const side = b % 2 === 0 ? 1 : -1;
      const around = (b / nb) * TAU;
      // Child spec: shorter, thinner, one recursion shallower.
      const child = {
        ...spec, depth: depthLeft - 1,
        length: L * spec.branchLen * (0.7 + 0.3 * rand()),
        baseRadius: spec.baseRadius * 0.6,
        branches: Math.max(0, spec.branches - 2),
        tip: depthLeft - 1 === 0 ? spec.tip : 'none',
      };
      let childGeo = buildRaw(child, rand, depthLeft - 1);
      // Orient the child: splay outward from the parent axis at height s·L.
      const splay = spec.branchAngle * (0.7 + 0.5 * rand());
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(splay * side, around, 0));
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(bendX(spec, s), s * L, 0), q, new THREE.Vector3(1, 1, 1));
      childGeo = childGeo.clone().applyMatrix4(m);
      parts.push(childGeo);
    }
  }
  return parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
}

// Lateral offset of the appendage centreline at parameter s (the curl).
function bendX(spec, s) {
  return Math.sin(s * Math.PI * 0.5) * spec.curl * spec.length * 0.5
    - Math.sin(s * Math.PI) * spec.droop * spec.length * 0.15;
}

// One tapered, ribbed tube (no children).
function tubeGeometry(spec, rand) {
  const N = 12, M = 10;
  const L = spec.length;
  const baseR = spec.baseRadius;
  const cBase = new THREE.Color(spec.baseColor);
  const cCore = new THREE.Color(spec.coreColor);
  const cTip = new THREE.Color(spec.tipColor);

  const radiusAt = (s) => {
    let r = baseR * lerp(1.0, Math.max(0.02, 1 - spec.taper), s);   // taper toward tip
    r *= 1 + spec.inflate * Math.sin(s * Math.PI);                  // club/bulb
    if (spec.ribs > 0) r *= 1 + 0.14 * Math.sin(s * spec.ribs * TAU); // lamellae
    if (spec.bumps > 0) r *= 1 + spec.bumps * 0.5 * Math.sin(s * 9 + rand() * 6);
    return r;
  };
  const colorAt = (s, out) => {
    if (s < 0.5) out.copy(cBase).lerp(cCore, smoothstep(0.0, 0.5, s));
    else out.copy(cCore).lerp(cTip, smoothstep(0.55, 1.0, s));
  };

  const pos = [], col = [], idx = [];
  const tc = new THREE.Color();
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    const cx = bendX(spec, s);
    const cy = s * L;
    const r = radiusAt(s);
    colorAt(s, tc);
    for (let j = 0; j < M; j++) {
      const th = (j / M) * TAU;
      const sr = superRadius(th, spec.section);
      pos.push(cx + r * sr * Math.cos(th), cy, r * sr * Math.sin(th));
      col.push(tc.r, tc.g, tc.b);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M);
      const c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  // Tip node: a rounded cap (opaque cnidosac) or a small point.
  const tipY = N / N * L, tipR = radiusAt(1);
  const capC = spec.tip === 'cap' ? cTip : (spec.tip === 'accent' ? cTip : tc);
  const tipIdx = pos.length / 3;
  pos.push(bendX(spec, 1), tipY + tipR * (spec.tip === 'cap' ? 1.1 : 0.4), 0);
  col.push(capC.r, capC.g, capC.b);
  for (let j = 0; j < M; j++) idx.push(tipIdx, N * M + j, N * M + ((j + 1) % M));

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(col), 3));
  geo.setIndex(idx);
  return geo;
}
