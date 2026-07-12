// Real specimens as points in the parameter space, spanning the morphological +
// colour space (dorids / aeolids / dendronotids / a sacoglossan cousin). Morphology
// and colour sourced from the research pass (Sea Slug Forum, WoRMS, Australian
// Museum, species literature). Each overrides only its distinctive leaves.

import { defaults } from '../core/params.js';
import { clone } from '../core/math.js';

function merge(base, over) {
  for (const k in over) {
    const ov = over[k];
    if (ov && typeof ov === 'object' && !Array.isArray(ov) && base[k] && typeof base[k] === 'object') merge(base[k], ov);
    else base[k] = clone(ov);
  }
  return base;
}

// Shorthands for the four dorsal-field amounts.
const DORID = { rosette: { amount: 1 }, cerata: { amount: 0 }, branches: { amount: 0 }, bumps: { amount: 0 } };
const AEOLID = { rosette: { amount: 0 }, cerata: { amount: 1 }, branches: { amount: 0 }, bumps: { amount: 0 } };

const OVERRIDES = {
  // ---- Dorids (gill rosette + rhinophores; broad mantle) -----------------------
  chromodoris: {
    displayName: 'Chromodoris (blue)', clade: 'dorid', scale: 0.04,
    body: { length: 1.0, width: 0.44, height: 0.2, mantleOverhang: 0.42, tailTaper: 0.35 },
    dorsal: { ...DORID, rosette: { amount: 1, count: 9, spec: { baseColor: '#f0e8f4', coreColor: '#e0d0e8', tipColor: '#c8b0d8' } } },
    antennae: { spec: { baseColor: '#7a30a0', tipColor: '#3a1050' } },
    surface: { base: '#2a5ed8', gloss: 0.8,
      margin: { color: '#ff8a1a', width: 0.1, secondColor: '#ffffff', secondWidth: 0.03 } },
  },
  hypselodoris: {
    displayName: 'Hypselodoris apolegma', clade: 'dorid', scale: 0.045,
    body: { length: 1.1, width: 0.4, height: 0.2, mantleOverhang: 0.4, tailTaper: 0.4 },
    dorsal: { ...DORID, rosette: { amount: 1, count: 10, spec: { baseColor: '#f0c040', coreColor: '#f0a820', tipColor: '#ffd860' } } },
    antennae: { spec: { baseColor: '#f0b030', tipColor: '#f0a020' } },
    surface: { base: '#b0208a', gloss: 0.75,
      margin: { color: '#ffffff', width: 0.16, secondColor: '#ffffff', secondWidth: 0 },
      reticulation: { amount: 0.5, color: '#ffffff', scale: 14 } },
  },
  nembrotha: {
    displayName: 'Nembrotha kubaryana', clade: 'dorid', scale: 0.05,
    body: { length: 1.15, width: 0.34, height: 0.24, mantleOverhang: 0.2, tailTaper: 0.45, dome: 0.75 },
    dorsal: { ...DORID, rosette: { amount: 1, count: 8, spec: { baseColor: '#e05a1a', coreColor: '#c04010', tipColor: '#ff7a2a' } } },
    antennae: { spec: { baseColor: '#e05a1a', tipColor: '#ff7a2a' } },
    surface: { base: '#16301e', gloss: 0.6,
      margin: { color: '#e05a1a', width: 0.06, secondColor: '#40a030', secondWidth: 0 },
      lines: { amount: 0.5, color: '#3aa048', count: 4 } },
  },
  hexabranchus: {
    displayName: 'Hexabranchus (Spanish dancer)', clade: 'dorid', scale: 0.3,
    body: { length: 1.15, width: 0.5, height: 0.2, mantleOverhang: 0.55, marginFrill: 0.5, tailTaper: 0.3, dome: 0.5 },
    dorsal: { ...DORID, rosette: { amount: 1, count: 12, uRange: [0.5, 0.5], spec: { length: 0.34, baseColor: '#ff8a4a', coreColor: '#e04a2a', tipColor: '#ffb070' } } },
    antennae: { spec: { baseColor: '#e0602a', tipColor: '#ff9a5a' } },
    surface: { base: '#c8241a', gloss: 0.7,
      margin: { color: '#ffb890', width: 0.08 },
      spots: { amount: 0.25, color: '#ffffff', scale: 22, mode: 'worley' } },
    motion: { mantleUndulate: 0.8 },
  },
  phyllidia: {
    displayName: 'Phyllidia varicosa', clade: 'dorid', scale: 0.06,
    body: { length: 1.05, width: 0.42, height: 0.3, mantleOverhang: 0.25, tailTaper: 0.45, dome: 0.85, bump: 0.28, bumpU: 26, bumpV: 8, wrinkle: 0.03 },
    dorsal: { rosette: { amount: 0 }, cerata: { amount: 0 }, branches: { amount: 0 },
      bumps: { amount: 1, count: 90, spec: { length: 0.06, inflate: 0.9, baseColor: '#f0d020', coreColor: '#f0d020', tipColor: '#fff060' } } },
    antennae: { spec: { baseColor: '#f0d020', tipColor: '#fff060', ribs: 10 } },
    surface: { base: '#2a3a4e', gloss: 0.2,
      margin: { color: '#101820', width: 0.08 },
      lines: { amount: 0.4, color: '#0a1018', count: 3 } },
  },
  jorunna: {
    displayName: 'Jorunna parva (sea bunny)', clade: 'dorid', scale: 0.015,
    body: { length: 0.85, width: 0.5, height: 0.32, mantleOverhang: 0.3, tailTaper: 0.3, dome: 0.85 },
    dorsal: { rosette: { amount: 1, count: 7, uRange: [0.32, 0.32], spec: { length: 0.16, baseColor: '#f0f0f0', coreColor: '#202020', tipColor: '#101010' } },
      cerata: { amount: 0 }, branches: { amount: 0 },
      bumps: { amount: 1, count: 220, spec: { length: 0.03, inflate: 0.5, baseColor: '#e8d060', coreColor: '#c8b040', tipColor: '#403010' } } },
    antennae: { length: 0.2, spec: { length: 0.2, taper: 0.5, ribs: 6, baseColor: '#f0f0f0', tipColor: '#101010' } },
    surface: { base: '#efdd66', gloss: 0.35,
      margin: { color: '#e8d860', width: 0.05 },
      spots: { amount: 0.4, color: '#1a1206', scale: 20, mode: 'worley' } },
  },
  cadlina: {
    displayName: 'Cadlina luteomarginata', clade: 'dorid', scale: 0.03,
    body: { length: 1.0, width: 0.42, height: 0.22, mantleOverhang: 0.35, tailTaper: 0.4, dome: 0.7 },
    dorsal: { rosette: { amount: 1, count: 7, spec: { baseColor: '#f0f0e0', coreColor: '#f0e090', tipColor: '#f0d040' } },
      cerata: { amount: 0 }, branches: { amount: 0 },
      bumps: { amount: 0.7, count: 60, spec: { length: 0.035, inflate: 0.7, baseColor: '#f4f4ea', coreColor: '#f0e090', tipColor: '#f0d040' } } },
    antennae: { spec: { baseColor: '#f0f0e0', tipColor: '#f0d040' } },
    surface: { base: '#f2f0e6', gloss: 0.55,
      margin: { color: '#f5d020', width: 0.1 } },
  },
  willani: {
    displayName: 'Chromodoris willani', clade: 'dorid', scale: 0.04,
    body: { length: 1.05, width: 0.4, height: 0.2, mantleOverhang: 0.4, tailTaper: 0.4 },
    dorsal: { ...DORID, rosette: { amount: 1, count: 9, spec: { baseColor: '#d8e0e8', coreColor: '#b0c0d0', tipColor: '#ffffff' } } },
    antennae: { spec: { baseColor: '#c0d0e0', tipColor: '#ffffff' } },
    surface: { base: '#8fb0cc', gloss: 0.8,
      margin: { color: '#ffffff', width: 0.06 },
      lines: { amount: 0.7, color: '#101418', count: 3 } },
  },

  // ---- Aeolids (cerata field; elongate) ----------------------------------------
  flabellina: {
    displayName: 'Edmundsella (violet aeolid)', clade: 'aeolid', scale: 0.03,
    body: { length: 1.3, width: 0.26, height: 0.22, mantleOverhang: 0.0, tailTaper: 0.85, dome: 0.85 },
    dorsal: { ...AEOLID, cerata: { amount: 1, count: 30, arrange: 'clusters', vSpread: 0.7,
      spec: { length: 0.24, taper: 0.5, tip: 'cap', baseColor: '#a040c0', coreColor: '#c85020', tipColor: '#ffffff' } } },
    antennae: { spec: { baseColor: '#a040c0', tipColor: '#c860e0' } },
    surface: { base: '#b060d0', gloss: 0.6 },
  },
  glaucus: {
    displayName: 'Glaucus atlanticus (blue dragon)', clade: 'aeolid', scale: 0.03,
    body: { length: 1.35, width: 0.3, height: 0.18, mantleOverhang: 0.0, tailTaper: 0.9, dome: 0.7, headArch: 0.2 },
    dorsal: { ...AEOLID, cerata: { amount: 1, count: 36, arrange: 'clusters', vSpread: 1.0,
      spec: { length: 0.3, taper: 0.6, section: 3.0, baseColor: '#7fdfff', coreColor: '#2a6ad0', tipColor: '#eaffff' } } },
    antennae: { length: 0.08, spec: { length: 0.08, baseColor: '#2a6ad0', tipColor: '#7fdfff' } },
    surface: { base: '#2a6ad0', gloss: 0.7, countershade: 0.5,
      lines: { amount: 0.5, color: '#eaffff', count: 3 } },
  },
  cratena: {
    displayName: 'Cratena peregrina', clade: 'aeolid', scale: 0.035,
    body: { length: 1.3, width: 0.26, height: 0.22, mantleOverhang: 0.0, tailTaper: 0.85, dome: 0.85 },
    dorsal: { ...AEOLID, cerata: { amount: 1, count: 32, arrange: 'clusters', vSpread: 0.8,
      spec: { length: 0.24, taper: 0.5, tip: 'cap', baseColor: '#f0e8e0', coreColor: '#e05a20', tipColor: '#40b0ff' } } },
    antennae: { spec: { baseColor: '#e07a20', tipColor: '#f09a40' } },
    surface: { base: '#f4efe8', gloss: 0.65,
      spots: { amount: 0.0, color: '#e05a20', scale: 10 } },
  },
  aeolidia: {
    displayName: 'Aeolidia papillosa (shag-rug)', clade: 'aeolid', scale: 0.05,
    body: { length: 1.15, width: 0.36, height: 0.22, mantleOverhang: 0.05, tailTaper: 0.55, dome: 0.8 },
    dorsal: { ...AEOLID, cerata: { amount: 1, count: 90, arrange: 'scatter', vSpread: 1.1,
      spec: { length: 0.16, taper: 0.45, section: 3.5, inflate: 0.2, baseColor: '#d8ccb8', coreColor: '#a08868', tipColor: '#e8e0d0' } } },
    antennae: { spec: { baseColor: '#c8bca8', tipColor: '#e0d8c8' } },
    surface: { base: '#c8bca8', gloss: 0.4,
      spots: { amount: 0.35, color: '#6a5a44', scale: 16 } },
  },
  dirona: {
    displayName: 'Dirona albolineata (alabaster)', clade: 'aeolid', scale: 0.045,
    body: { length: 1.2, width: 0.3, height: 0.22, mantleOverhang: 0.05, tailTaper: 0.7, dome: 0.85 },
    dorsal: { ...AEOLID, cerata: { amount: 1, count: 40, arrange: 'rows', vSpread: 0.9,
      spec: { length: 0.2, taper: 0.4, section: 4.0, baseColor: '#f0e4ea', coreColor: '#e8d8e2', tipColor: '#ffffff' } } },
    antennae: { spec: { baseColor: '#f0e4ea', tipColor: '#ffffff' } },
    surface: { base: '#f2e6ec', gloss: 0.7,
      reticulation: { amount: 0.3, color: '#ffffff', scale: 10 } },
  },

  // ---- Dendronotid (branched cerata) -------------------------------------------
  dendronotus: {
    displayName: 'Dendronotus iris', clade: 'dendronotid', scale: 0.08,
    body: { length: 1.25, width: 0.3, height: 0.24, mantleOverhang: 0.05, tailTaper: 0.55, dome: 0.85 },
    dorsal: { rosette: { amount: 0 }, cerata: { amount: 0 },
      branches: { amount: 1, count: 12, arrange: 'rows', vSpread: 0.85,
        spec: { depth: 2, length: 0.3, branches: 5, taper: 0.5, baseColor: '#e0b0a0', coreColor: '#c07060', tipColor: '#ffffff' } },
      bumps: { amount: 0 } },
    antennae: { spec: { baseColor: '#d0a090', tipColor: '#ffffff', ribs: 6 } },
    surface: { base: '#d8a898', gloss: 0.55 },
  },

  // ---- Sacoglossan cousin (flagged: not a true nudibranch) ---------------------
  costasiella: {
    displayName: 'Costasiella (leaf sheep) ✻', clade: 'aeolid', scale: 0.008,
    body: { length: 1.0, width: 0.3, height: 0.2, mantleOverhang: 0.05, tailTaper: 0.5, dome: 0.7 },
    dorsal: { rosette: { amount: 0 }, branches: { amount: 0 }, bumps: { amount: 0 },
      cerata: { amount: 1, count: 44, arrange: 'scatter', vSpread: 1.0,
        spec: { length: 0.16, taper: 0.3, section: 5.0, inflate: 0.3, baseColor: '#3a9a30', coreColor: '#2a7a24', tipColor: '#ff90c0' } } },
    antennae: { length: 0.22, spec: { length: 0.22, taper: 0.5, baseColor: '#e8e0d0', tipColor: '#101010' } },
    surface: { base: '#e8e2d2', gloss: 0.4 },
  },
};

export const SPECIES_ORDER = [
  'chromodoris', 'hypselodoris', 'nembrotha', 'hexabranchus', 'phyllidia', 'jorunna', 'cadlina', 'willani',
  'flabellina', 'glaucus', 'cratena', 'aeolidia', 'dirona', 'dendronotus', 'costasiella',
];

export const SPECIES_LABELS = {
  chromodoris: 'Chromodoris', hypselodoris: 'Hypselodoris', nembrotha: 'Nembrotha', hexabranchus: 'Spanish dancer',
  phyllidia: 'Phyllidia', jorunna: 'Sea bunny', cadlina: 'Cadlina', willani: 'C. willani',
  flabellina: 'Edmundsella', glaucus: 'Blue dragon', cratena: 'Cratena', aeolidia: 'Shag-rug', dirona: 'Dirona',
  dendronotus: 'Dendronotus', costasiella: 'Leaf sheep',
};

export function makeSpecies(id) {
  const p = defaults();
  const over = OVERRIDES[id];
  if (!over) throw new Error(`unknown species: ${id}`);
  merge(p, over);
  p.id = id;
  return p;
}

export const SPECIES = OVERRIDES;
