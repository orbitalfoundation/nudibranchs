// THE nudibranch parameter space.
//
// A nudibranch is a body-axis curve draped on a crawling plane, carrying a SUPERSET
// dorsal-appendage field. Every appendage family (rear plume rosette, projection
// field, side branches, surface bumps) is ALWAYS present at some `amount` — most at
// zero for any given animal — so a dorid↔aeolid morph fades one field out as another
// fades in instead of snapping across a topology change. Clade = which amounts are
// nonzero. See devlog 20260711-nudibranch-design.md.
//
// Geometry: body + chunky appendage bases are SDF primitives smooth-unioned and
// marching-cubed into one continuous surface; fine filigree (plume pinnules, antenna
// ribs) are light swept meshes parented at the blend point.

import { clone, lerpTree } from './math.js';

// One reusable APPENDAGE SPEC — drives cerata, plume pinnules, antenna clubs, side
// branches, hood papillae, and surface bumps, all as this at different specs.
export function appendage(over = {}) {
  return Object.assign({
    depth: 0,             // 0 finger/bump · 1–2 branch / feather-vane / ribbed club
    length: 0.12, baseRadius: 0.02, taper: 0.6, inflate: 0.0,
    section: 2.0,         // superellipse exp: 2 round · high = flattened leaf / feather vane
    curl: 0.2, droop: 0.1, splay: 0.3,
    ribs: 0,              // transverse ridges (antenna lamellae) — a surface op, not branches
    bumps: 0.0,
    branches: 0, branchAngle: 0.55, branchLen: 0.6,
    tip: 'none',          // 'cap' opaque node · 'accent' bright point · 'none'
    coreColor: '#c23a1a', baseColor: '#e8e8e8', tipColor: '#ffffff',
    translucency: 0.4,
  }, over);
}

// A dorsal-field layer = an appendage spec + a 2D placement over the notum (u,v).
export function field(over = {}) {
  const spec = over.spec || appendage();
  const o = Object.assign({
    amount: 0.0,          // master amplitude — 0 = family absent (skipped in build)
    arrange: 'rows',      // 'ring' | 'rows' | 'arches' | 'clusters' | 'scatter'
    count: 24, uRange: [0.15, 0.9], vSpread: 0.8,
    sizeGrad: 0.5, tilt: 0.4, jitter: 0.3, seed: 1,
  }, over);
  o.spec = spec;
  return o;
}

export function defaults() {
  return {
    id: 'generic', displayName: 'Generic dorid', clade: 'dorid',
    scale: 0.04, // most 2–6 cm; Spanish dancer up to ~0.6 m

    body: {
      length: 1.0, width: 0.42, height: 0.26, dome: 0.6, headArch: 0.3,
      mantleOverhang: 0.35, marginFrill: 0.2,
      tail: 0.15, tailTaper: 0.7, footWidth: 0.7,
      blend: 0.085, // smin radius (rel) — how "melted" appendages look where they merge
    },

    antennae: {
      length: 0.16, splay: 0.35, sheath: 0.3, retractile: 0.0,
      spec: appendage({ length: 0.16, taper: 0.8, ribs: 8, baseColor: '#3a2a5a', tipColor: '#140a24' }),
    },
    oral: { tentacles: 0.1, veil: 0.0, propodial: 0.0 },

    // THE SUPERSET DORSAL FIELD — every family always present at some `amount`.
    dorsal: {
      rosette: field({ amount: 1.0, arrange: 'ring', count: 9, uRange: [0.4, 0.4], vSpread: 0.0,
        spec: appendage({ depth: 2, length: 0.28, section: 5.0, branches: 5, taper: 0.5,
          baseColor: '#eef0ee', translucency: 0.5 }) }),
      cerata: field({ amount: 0.0, arrange: 'rows', count: 34, uRange: [0.2, 0.9], vSpread: 0.9,
        spec: appendage({ length: 0.22, taper: 0.55, tip: 'cap', coreColor: '#c23a1a',
          baseColor: '#d8b0c0', tipColor: '#eaf2ff', translucency: 0.6 }) }),
      branches: field({ amount: 0.0, arrange: 'rows', count: 10, uRange: [0.15, 0.9], vSpread: 1.0,
        spec: appendage({ depth: 2, length: 0.3, branches: 4, section: 2.5 }) }),
      bumps: field({ amount: 0.0, arrange: 'scatter', count: 110, uRange: [0.05, 0.95], vSpread: 1.0,
        spec: appendage({ length: 0.045, inflate: 0.8, bumps: 0.6, taper: 1.0 }) }),
    },

    // APPEARANCE — the identity. Procedural layers in body-UV (see NudiMaterial).
    surface: {
      base: '#f2f2f4', countershade: 0.15,
      margin: { color: '#ff7a1a', width: 0.09, secondColor: '#ffffff', secondWidth: 0.02 },
      spots: { amount: 0.0, color: '#242424', scale: 8, mode: 'worley' }, // worley | rd
      reticulation: { amount: 0.0, color: '#101010', scale: 10 },
      lines: { amount: 0.0, color: '#ffd000', count: 3 },
      gloss: 0.7, spec: 0.6, sss: 0.35, sssTip: 0.8,
    },

    motion: {
      pedalWave: 0.4, swayAmp: 0.06, swayPhase: 0.8,
      mantleUndulate: 0.0, swim: 0.0, glide: 0.3,
    },
  };
}

// Blend two colony trees. Structural counts round; categoricals snap at halfway.
export function morphParams(a, b, t) {
  if (t <= 0) return clone(a);
  if (t >= 1) return clone(b);
  const m = lerpTree(a, b, t);
  m.clade = t < 0.5 ? a.clade : b.clade;
  m.id = t < 0.5 ? a.id : b.id;
  m.displayName = t < 0.5 ? `${a.displayName} →` : `→ ${b.displayName}`;
  for (const key of ['rosette', 'cerata', 'branches', 'bumps']) {
    m.dorsal[key].arrange = t < 0.5 ? a.dorsal[key].arrange : b.dorsal[key].arrange;
  }
  m.surface.spots.mode = t < 0.5 ? a.surface.spots.mode : b.surface.spots.mode;
  return m;
}
