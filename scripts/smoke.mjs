// Node-only smoke test: build every species' geometry via the SDF pipeline and
// check for NaNs + non-empty meshes. No WebGL needed.
import { SPECIES_ORDER, makeSpecies } from '../src/species/presets.js';
import { NudibranchRig } from '../src/rig/NudibranchRig.js';

function firstNaN(arr) { for (let i = 0; i < arr.length; i++) if (!Number.isFinite(arr[i])) return i; return -1; }

let fail = 0;
for (const id of SPECIES_ORDER) {
  const t0 = Date.now();
  try {
    const p = makeSpecies(id);
    const rig = new NudibranchRig(p);
    const g = rig.bodyMesh.geometry;
    const pos = g.attributes.position.array;
    const nrm = g.attributes.normal.array;
    const pNaN = firstNaN(pos), nNaN = firstNaN(nrm);
    for (let f = 0; f < 4; f++) rig.update(0.016);
    const ok = pNaN < 0 && nNaN < 0 && pos.length > 0;
    if (!ok) fail++;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${id.padEnd(12)} ${p.clade.padEnd(8)} verts=${String(g.userData.verts).padStart(7)} tris=${String(pos.length / 9 | 0).padStart(6)} ${pNaN < 0 ? '' : 'posNaN@' + pNaN} ${nNaN < 0 ? '' : 'nrmNaN@' + nNaN} ${Date.now() - t0}ms`);
  } catch (e) {
    fail++; console.log(`FAIL ${id.padEnd(12)} threw: ${e.message}`);
  }
}
console.log(`\n${fail === 0 ? 'ALL PASS' : fail + ' FAILURES'}`);
process.exit(fail === 0 ? 0 : 1);
