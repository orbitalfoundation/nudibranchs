// Small pure-math helpers shared across the rig. No THREE import, so these run
// under Node in the smoke test as well as in the browser.

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const mix = lerp;
export const TAU = Math.PI * 2;

// Deterministic little RNG (mulberry32) so a given seed reproduces the same
// colony — headless renders and shared links stay stable.
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Deep clone of the plain-object / array / primitive trees we use for params.
export function clone(v) {
  if (Array.isArray(v)) return v.map(clone);
  if (v && typeof v === 'object') {
    const o = {};
    for (const k in v) o[k] = clone(v[k]);
    return o;
  }
  return v;
}

// Recursively lerp two parameter trees of identical shape. Numbers interpolate;
// everything else (strings, booleans) snaps at the halfway point. This is what
// lets one colony morph continuously into another.
export function lerpTree(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return lerp(a, b, t);
  if (Array.isArray(a) && Array.isArray(b)) {
    const n = Math.round(lerp(a.length, b.length, t));
    const out = [];
    for (let i = 0; i < n; i++) {
      const ai = a[Math.min(i, a.length - 1)];
      const bi = b[Math.min(i, b.length - 1)];
      out.push(lerpTree(ai, bi, t));
    }
    return out;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const out = {};
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (k in a && k in b) out[k] = lerpTree(a[k], b[k], t);
      else out[k] = clone(k in a ? a[k] : b[k]);
    }
    return out;
  }
  return t < 0.5 ? clone(a) : clone(b);
}

// Superellipse radius at angle theta for exponent n (2 = circle, →∞ = square).
// Used to give calycophore bells their prismatic, faceted cross-section.
export function superRadius(theta, n) {
  const c = Math.abs(Math.cos(theta));
  const s = Math.abs(Math.sin(theta));
  return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
}
