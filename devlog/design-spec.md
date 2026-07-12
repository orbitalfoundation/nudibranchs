# Nudibranch — design & architecture spec — 2026-07-11

The fifth parametric visualizer. Written in the "thinking" phase (Fable) so the
build phase (Opus) has a concrete plan. Sourced morphology lands separately from a
research pass; this doc is the *architecture* — the parameter space, the rig, what
to reuse, the rendering direction, and the build order.

## Why nudibranchs are a different animal (literally) from the last four

- **fish** = a swimming spine (1D backbone + fins + skin pattern).
- **siphonophore** = a hanging chain of modules along a stem (1D backbone + zooids).
- **nudibranch** = a **soft 3D body gliding on a substrate**, encrusted with dorsal
  appendages, and — the whole point — **richly coloured and patterned**.

So the body is a real 3D form (not a 1D chain), and the colour/pattern layer is
*central*, not a finishing touch. This is the most reuse-heavy build yet, but the
body-generation and the "make colour pop" work are new.

## ★ Second-pass synthesis (supersedes the categorical-clade framing below)

Three ideas from a second counsel pass that are better than my first draft — adopt these:

**1. The dorsal field is a SUPERSET, not a switch.** Do NOT make clade a categorical
branch that builds one apparatus or another. Make gill-rosette, ceras-field, dendritic-
branches, and tubercles *all always present at some amplitude/density* — most at zero for
any given animal. Clade is then just *which amplitudes are nonzero*: dorid = rosette on +
cerata off; aeolid = cerata on + rosette off; phyllidiid = tubercles on + gills hidden;
etc. This is the same move as siphonophore "structural counts round to whole numbers so a
blend rebuilds cleanly" — a dorid→aeolid **morph fades the rosette out as cerata fade in**
instead of snapping across a topology change. The morphs are the whole point of the
project; without this rule they break at exactly the interesting boundaries. (Cost: the
geometry builder must cheaply *skip* a field whose amplitude≈0 so a pure dorid doesn't pay
for an empty ceras field.)

**2. ONE recursive appendage primitive drives everything** (the crown-jewel reuse — the
analog of the siphonophore's single bell/zooid builder). `appendage(spec)` = a tapered
segmented tube along a short space-curve, with knobs: **recursion depth** (0 = finger /
ceras / tubercle; 1–2 = dendritic branch / pinnate gill vane, children spawned along the
parent by the same function); **cross-section** (round / flattened-leaf / feather-vane via
the superellipse exponent); **inflation curve** (even / club / bulbed); curl / droop /
splay; **surface modulation** (smooth ↔ warty ↔ *transverse ribs* — see refinement below);
**tip node** (cnidosac bulge / pigment point / none); **colour-along-length** (base → core
→ tip, where "core" is the gut-derived diverticulum colour — this is what makes an aeolid
ceras read as *living tissue*). Then cerata, gill pinnules, rhinophore clubs, dendronotid
branches, oral-hood papillae, and dorid tubercles are all the *same* primitive at different
specs. **Refinement (Fable):** rhinophore **lamellae/annulations are transverse ridges on a
stalk, not branches** — don't force them through the branch operator; give the primitive a
separate *rib/lamella surface operator* (radius modulation along length) alongside the
branch operator. Melibe's oral hood is the primitive in a wide flattened-vane, low-recursion
mode with a rim fringe.

**3. Placement is a 2D field over the notum: `place(u,v)`** (promote the 1D cormidium
series to a surface). Arrangement modes: **ring** (dorid rosette — a circle at fixed rear-u,
plumes in feather-vane mode), **rows** (aeolid transverse/oblique ceras rows = constant-u
lines), **arches** (v-symmetric arcs), **clusters** (Poisson-disk clumps — use the
deterministic seeded RNG so the genome-in-URL codec reproduces the exact scatter, same as
fish), **scatter** (sea-bunny velvet / phyllidiid tubercles). Layer a **size-gradient g(u)**
(cerata largest mid-body, tapering fore/aft) and a tilt field. Rhinophores + oral tentacles
are fixed anterior placements; cryptobranch/phanerobranch (gills retract into a pocket or
not) is one leaf.

### How this reconciles with SDF + marching cubes (the counsel above missed this)

The recursive primitive and the SDF surfacing are **orthogonal and complementary**: the
primitive is the *morphology generator* (what shapes exist + their hierarchy + colour); the
SDF+MC is the *surfacing method* (how the chunky parts become continuous flesh). One spec
tree, **two emitters**:
- **Chunky, flesh-continuous parts** (body, tubercles, ceras *bases/shafts*) → emit as SDF
  capsule/sphere primitives, `smin`-blended so they flow out of the body with no seam. This
  is what MC is *for*.
- **Fine, high-frequency branches** (feather-gill pinnules, rhinophore lamellae, dendritic
  tips) → too thin for a sane MC grid, and they attach at a clear base (no flesh-blend
  needed) → emit as **swept-tube meshes** from the same primitive, parented at the blend
  point. My doc already hedged "gill/rhinophore… or a light separate mesh"; make that
  explicit and principled: **MC for the merge, swept mesh for the filigree.**

## The parameter space

*(Framing below predates the superset-field synthesis above — read `clade` as "a named
preset point in the always-present superset field," not a hard switch, and `cerata.present`
/ `gill.present` as amplitudes that morph continuously rather than booleans.)*

The big axis is **clade**: **dorid** vs **aeolid** (+ dendronotid as a branched-cerata
variant), realised as amplitudes in the superset dorsal field, not a categorical switch.

```
{
  id, displayName,
  clade: 'dorid' | 'aeolid' | 'dendronotid',
  scale,                          // most 2–6 cm; Spanish dancer up to ~60 cm

  body: {                         // the shared soft-body generator
    length, width, height,        // swept superellipse cross-section along a centreline
    dome,                         // dorsal doming
    mantleOverhang,               // DORID skirt: mantle wider than foot, frilly margin (0 for aeolid)
    marginFrill,                  // waviness/undulation of the mantle edge
    tailLength, tailTaper,        // aeolids taper to a pointed tail
    footWidth,                    // the gliding sole
    notum: { tubercles, spikes }  // smooth ↔ caryophyllidia ↔ Phyllidia ridges/spikes
  },

  rhinophores: {                  // the paired dorsal "horns" near the head
    length, splay, sheath,
    club: 'lamellate'|'annulate'|'papillate'|'smooth', lamellae,
    color, tipColor
  },

  oral: { tentacles, veil, propodial },  // veil→Melibe hood; propodial=foot-corner tentacles

  cerata: {                       // AEOLID / dendronotid dorsal apparatus
    present, count,
    arrangement: 'rows'|'clusters'|'arches'|'field',
    rows, length, taper, inflate, curl, branched,   // branched→dendronotid
    coreColor, tipColor, tipOpacity, translucency    // digestive-gland core + cnidosac tip
  },

  gill: {                         // DORID dorsal apparatus (rosette around the anus)
    present, leaves, branching: 'pinnate'|'tripinnate', height, splay, color, retract
  },

  surface: {                      // ★ the star — reuse the fish chromatophore + RD stack
    bodyColor, countershade,
    pattern: { preset, feed, kill, anisotropy, threshold, contrast, patternColor, scale }, // Gray-Scott
    marginColor, marginWidth,     // the contrasting mantle-margin band (blue body + orange rim, etc.)
    iridLines, iridColor,         // Chromodoris opalescent longitudinal lines
    gloss, sss, spec              // the "glistening wet" mucus surface
  },

  motion: { crawlWave, mantleRipple, cerataSway, flex, swim }  // swim = Spanish-dancer full-body flex
}
```

Presets override only the distinctive leaves (same pattern as every prior project).

## Surfacing approach: implicit surfaces (SDF + marching cubes) ★ user's call, adopted

The body must read as **continuous soft flesh** — cerata *flow out of* the body (no
seam), tubercles/caryophyllidia *swell from* the surface, the mantle blends smoothly
into the foot. Swept cross-section meshes (the fish/siphonophore approach) fight this:
you get hard intersection seams where a ceras cylinder pokes into the body tube. The
right tool is **implicit surfaces**: build the animal as a field of **signed-distance
primitives** (a capsule/ellipsoid for the body + tail, a capsule per ceras, spheres
for tubercles, thin capsules for gill/rhinophore branches), combine with a **smooth
minimum (`smin`)** so everything blends into one continuous surface, and **polygonise
with marching cubes** into a BufferGeometry.

**Route chosen: SDF → marching-cubes MESH (not pure raymarching).** Reasons:
- Keeps the existing **mesh material pipeline** (chromatophore/RD shader, wet clearcoat,
  bloom, shadows) — pure SDF raymarching would force re-implementing all shading per-pixel
  and make the RD pattern integration much harder.
- Polygonise on **structural param change only** (like the fish rebuilds geometry on a
  shape edit) — tens of ms at 96³–128³ grid, fine for a hero animal.
- **Animation** = vertex-shader / CPU displacement of the baked mesh (the `flow(s,t)`
  crawl/sway waves move vertices), *not* re-polygonising each frame.

**The UV problem (marching cubes has no natural UVs) — solved two ways, combined:**
- **Triplanar projection** for the RD spot/reticulation/tubercle detail (blend 3 axis
  projections by normal). Robust, organic, no UVs needed.
- **Body-parametric coordinate** baked per output vertex: for each MC vertex, find the
  nearest point on the body centreline → `(u = arclength, v = angle-around-axis)`. Use
  `u,v` for the **margin band**, **longitudinal opalescent lines**, and **countershading**
  (things that need to follow the body's long axis), where triplanar would look wrong.
  Bake `u,v` as a vertex attribute during polygonisation.

**Implementation notes:** three.js ships `MarchingCubes` (addons) oriented at realtime
metaballs — repurpose-able, or drop in a compact standalone MC over an explicit SDF grid
(more control over the field + baking the `u,v` attribute). Evaluate the SDF on a grid
sized to the body's bounds; `smin` blend radius is a *parameter* (how "melted" the cerata
look). Compute vertex normals from the SDF gradient (cheap, exact) rather than from the
triangles — smoother.

**Risk:** MC is the biggest new piece of infra and the main perf/quality knob (grid
resolution vs detail vs build time). Prototype `body.js` first (see build order) to prove
the SDF+MC+`u,v`-baking path end-to-end before layering anything on it. Raymarching stays
a fallback if MC detail/resolution disappoints, but the mesh route is strongly preferred
for pipeline reuse.

## Concrete `core/params.js` scaffold (drop-in — supersedes the JSON sketch below)

Authoritative parameter tree in the repo idiom (`defaults()` + `morphParams()`), neutral
geometry vocabulary. One reusable `appendage(spec)`; a superset `dorsal` field where every
family is always present at some `amount`; a rich `surface` layer stack (the identity).

```js
// A single reusable APPENDAGE SPEC — one recursive generator drives every projection:
// rear-plume pinnules, dorsal finger-projections, antenna clubs, side branches, hood
// papillae, and surface bumps are all this at different specs.
function appendage(over = {}) {
  return Object.assign({
    depth: 0,             // 0 = finger/bump · 1–2 = branch / feather-vane / ribbed club
    length: 0.12,         // rel. to body length
    baseRadius: 0.02, taper: 0.6, inflate: 0.0,   // taper<1 → point · inflate>0 → club/bulb
    section: 2.0,         // superellipse exp: 2 round · high = flattened leaf / feather vane
    curl: 0.2, droop: 0.1, splay: 0.3,
    ribs: 0,              // transverse ridges (antenna lamellae) — a SURFACE op, NOT branches
    bumps: 0.0,           // warty surface noise
    branches: 0, branchAngle: 0.5, branchLen: 0.6,  // children spawned when depth>0
    tip: 'none',          // 'cap' opaque node · 'accent' bright point · 'none'
    coreColor: '#c23a1a', // inner-tissue colour that reads through translucent walls
    baseColor: '#e8e8e8', tipColor: '#ffffff',
    translucency: 0.4,    // subsurface — concentrated toward the tip
  }, over);
}

// A dorsal-field layer = an appendage spec + a 2D placement over the notum surface (u,v).
function field(over = {}) {
  return Object.assign({
    amount: 0.0,          // master amplitude — 0 = family absent (SKIP in build; no cost)
    arrange: 'rows',      // 'ring' | 'rows' | 'arches' | 'clusters' | 'scatter'
    count: 24,            // number placed (rounds → clean morphs)
    uRange: [0.15, 0.9],  // where along the body it lives
    vSpread: 0.8,         // spread across the back (0 = midline, 1 = to the margin)
    sizeGrad: 0.5,        // >0 → largest mid-body, tapering fore/aft
    tilt: 0.4, jitter: 0.3, seed: 1,   // seeded RNG → genome-in-URL reproduces the scatter
    spec: appendage(),
  }, over);
}

export function defaults() {
  return {
    id: 'generic', displayName: 'Generic dorid',
    scale: 0.04,           // most 2–6 cm; Spanish dancer up to ~0.6 m

    // BODY — an SDF ellipsoid along a substrate-hugging centreline (flat sole).
    body: {
      length: 1.0, width: 0.42, height: 0.28,   // dorids broad · aeolids slender
      dome: 0.6, headArch: 0.3,
      mantleOverhang: 0.35,   // dorid skirt beyond the foot (0 = aeolid)
      marginFrill: 0.2,       // waviness of the mantle edge (Spanish-dancer frill)
      tail: 0.15, tailTaper: 0.7, footWidth: 0.7,
      blend: 0.06,            // smin radius — how "melted" appendages look where they merge
    },

    // Paired anterior ANTENNAE (rhinophores) — the primitive in ribbed mode.
    antennae: {
      length: 0.16, splay: 0.35, sheath: 0.3, retractile: 0.0,  // retract-into-pocket flag
      spec: appendage({ length: 0.16, taper: 0.8, ribs: 8, baseColor: '#3a2a5a', tipColor: '#140a24' }),
    },
    oral: { tentacles: 0.1, veil: 0.0, propodial: 0.0 },   // veil → Melibe hood

    // THE SUPERSET DORSAL FIELD — every family ALWAYS present at some `amount`;
    // clade = which amounts are nonzero. Morphs fade fields in/out, never snap topology.
    dorsal: {
      rosette:  field({ amount: 1.0, arrange: 'ring', count: 9, uRange: [0.72, 0.72], vSpread: 0.0,
        spec: appendage({ depth: 2, length: 0.30, section: 5.0, branches: 5, taper: 0.5,
          baseColor: '#f0f0f0', translucency: 0.5 }) }),            // dorid rear plume ring
      cerata:   field({ amount: 0.0, arrange: 'rows', count: 40, uRange: [0.2, 0.9], vSpread: 0.9,
        spec: appendage({ length: 0.22, taper: 0.55, tip: 'cap', coreColor: '#c23a1a',
          baseColor: '#d8b0c0', tipColor: '#eaf2ff', translucency: 0.6 }) }),  // aeolid field
      branches: field({ amount: 0.0, arrange: 'rows', count: 12, uRange: [0.15, 0.9], vSpread: 1.0,
        spec: appendage({ depth: 2, length: 0.30, branches: 4, section: 2.5 }) }),  // dendronotid
      bumps:    field({ amount: 0.0, arrange: 'scatter', count: 120, uRange: [0.05, 0.95], vSpread: 1.0,
        spec: appendage({ length: 0.04, inflate: 0.8, bumps: 0.6, taper: 1.0 }) }),  // phyllidiid/velvet
    },

    // APPEARANCE — the identity, far more than silhouette. A stack of procedural
    // layers in body-UV so they follow + morph with the body. Budget the most here.
    surface: {
      base: '#f4f4f4', countershade: 0.15,
      margin: { color: '#ff7a1a', width: 0.08, secondColor: '#ffffff', secondWidth: 0.02 },
      spots: { amount: 0.0, color: '#222222', scale: 8, mode: 'worley' },   // worley | rd (crisp!)
      reticulation: { amount: 0.0, color: '#101010', scale: 10 },           // voronoi edges
      lines: { amount: 0.0, color: '#ffd000', count: 3 },                   // longitudinal opalescent
      gloss: 0.7, spec: 0.6,          // wet mucus surface (opaque PBR + clearcoat, NOT additive)
      sss: 0.35, sssTip: 0.8,         // subsurface concentrated in appendage tips
    },

    // MOTION — reuse the metachronal offset; hero modes per species.
    motion: {
      pedalWave: 0.4,                 // retrograde foot wave (crawl glide)
      swayAmp: 0.06, swayPhase: 0.8,  // appendage sway, phase-offset down the body (shimmer)
      mantleUndulate: 0.0,            // Spanish-dancer flared-margin flamenco — the hero shot
      swim: 0.0, glide: 0.3,
    },
  };
}

// morphParams(a,b,t) = lerpTree (numbers interp, counts round), snapping categoricals:
//   arrange modes, tip type, spots.mode, id/displayName at t=0.5. Same as siphonophores.
```

**Presets are points in this tree.** E.g. *Chromodoris/Goniobranchus*: broad body, rosette
amount 1 / cerata 0, crisp `spots`+`margin`, high `gloss`. *Glaucus*: slender, cerata amount
1 (arrange `clusters` → splayed fans), rosette 0, blue base + silver countershade, high
`sssTip`. *Phyllidia*: bumps amount 1, rosette 0 (gills hidden), hard `reticulation`, low
gloss/velvety. *Hexabranchus*: large scale, big `mantleOverhang`+`marginFrill`,
`mantleUndulate` on. *Jorunna*: bumps amount 1 (fine velvet) + big ribbed antennae.

**Rendering thesis (do NOT reuse blackwater/additive):** opaque saturated PBR on a lit reef
substrate; the beauty is colour-blocking + pattern, not glow. Additive-on-black makes them
ghosts. Keep subsurface only in the appendage tips. Crisp pattern edges (Voronoi/Worley,
hard-thresholded) — Chromodoris colour-blocking is *hard-edged*, not soft Gray-Scott.

**Companion prop:** an egg-ribbon spiral (the appendage/ribbon math coiled) — instantly reads
"nudibranch," nearly free.

## Rig architecture (`src/`)

Shared body + a clade switch for the dorsal apparatus. Geometry via SDF+marching-cubes
(above), animated by vertex displacement.

- `core/math.js` — reuse: smoothstep, RNG, lerpTree/clone; add SDF helpers (capsule,
  ellipsoid, sphere distance; `smin` smooth-union) and a compact **marching cubes**.
- `core/sdf.js` — the field builder: assemble the animal's SDF from primitives and a
  `smin` blend; sample a grid; polygonise; bake per-vertex `(u,v)` body-parametric coords
  and SDF-gradient normals. The shared geometry backbone for body + cerata + tubercles.
- `core/params.js` — the space above; `defaults()` + `morphParams()`.
- `species/presets.js` — ~14–18 real species as points (from the research pass).
- `rig/body.js` — emits the **body SDF primitives**: an ellipsoid/capsule body along a
  substrate-hugging centreline (flat sole), widened into a **mantle skirt** for dorids,
  tapered to a **tail** for aeolids; plus tubercle spheres for notum texture. All fed to
  `core/sdf.js` and `smin`-blended into one continuous surface.
- `rig/cerata.js` — emits **ceras primitives** (a capsule per ceras, branched for
  dendronotids) blended onto the body so they flow out of the flesh; carries the coloured
  digestive-gland **core** (an inner emissive/translucent strand) + opaque **cnidosac tip**.
  Placed in rows/clusters/arches by a frame walker over the dorsum (reuse the siphonophore
  module-placement idea) with organic scatter.
- `rig/gill.js` — the dorid branchial rosette: N pinnate/tripinnate plumes in a ring
  (thin-capsule SDF branches, or a light separate mesh — plumes are fine as their own mesh).
- `rig/rhinophore.js` — stalk + club with lamellate/annulate/papillate texture (SDF, or a
  small separate mesh with stacked-disc lamellae).
- `rig/NudibranchRig.js` — assembles body + apparatus + rhinophores + oral tentacles;
  `update(dt)` runs the crawl wave, mantle ripple, cerata sway, body flex.
- `pattern/reactionDiffusion.js` — reuse the fish's GPU Gray-Scott engine wholesale
  for the notum pattern (spots/reticulation/stripes are exactly RD).
- `shading/NudiMaterial.js` — the wet chromatophore material: base colour →
  RD pattern mask → margin band → opalescent iridescent lines → **wet clearcoat**
  (glossy mucus) + subsurface translucency. Extends the fish `FishMaterial` stack.
  Cerata get a translucent core-glow material (reuse the siphonophore gel idea).
- `scene/environment.js` — a **macro dive-light** look, not blackwater: the animal on
  a subtly-textured dark substrate, a warm-cool key that glistens the wet surface and
  backlights the translucent cerata, gentle caustics, shallow-DOF feel, subtle bloom
  on wet highlights. Jewel-like, lit, close-up — a deliberately different mood.
- `main.js` + `scripts/{smoke,render,build}.mjs` + `deploy/` — copy the siphonophore
  harness verbatim, retarget names (VM `nudi`/`nudis`, repo `orbitalfoundation/nudibranchs`).

## What to reuse (this is ~60–70% built already)

- **From fish:** the Gray-Scott RD engine (the pattern star), superellipse/beta-bump
  geometry, the layered chromatophore material + wet clearcoat, genome-in-URL codec.
- **From siphonophores:** module-placement-along-a-frame (cerata rows), translucent
  core-glow gel material (cerata cores/tips), the `flow(s,t)` body-wave animation
  (crawl wave, cerata sway, mantle ripple, Spanish-dancer swim), the whole render /
  smoke / build / deploy / autodeploy harness, bloom + drift, the fingerprinted-bundle
  cache fix (bake it into the build from day one).

## Rendering direction — "wet jewel under a dive light"

Different from the siphonophore void. Nudibranchs are macro, lit, saturated:
- A dark, subtly-textured substrate plane (rock/sand) the animal crawls on.
- A warm key + cool fill (a diver's torch) that rakes the **wet glossy** surface into
  bright specular glints and backlights the **translucent cerata** so their coloured
  cores glow.
- Saturated subsurface colour; strong clearcoat; gentle caustics; subtle bloom only on
  the wettest highlights (not the whole body — they don't glow, they *gleam*).
- Colour must POP — this is the entire appeal. Budget the most iteration here.

## Motion (feel alive)

Reuse the siphonophore `flow(s,t)` + per-appendage wave:
- **Crawl wave** — a subtle muscular travelling wave along the foot sole; the whole
  body inches and gently flexes/turns as it glides.
- **Mantle ripple** (dorids) — a travelling undulation along the frilly mantle margin
  (the Spanish dancer does this dramatically).
- **Cerata sway** (aeolids) — each ceras waves with a phase by position, drifting in
  the current.
- **Rhinophore bob**, occasional retract.
- **Swim mode** (Spanish dancer / Melibe) — a big rhythmic full-body flexion.

## Risks / where the hard bits are

1. **The soft-body generator** — one mesh that convincingly spans a flat frilly dorid
   disc and an elongate tapered aeolid. This is the new geometry work. Mantle skirt +
   frilly margin is the tricky part.
2. **Cerata field** — many translucent projections with visible cores, placed densely
   and naturally over a curved dorsum (not in stiff rows). Reuses module placement but
   needs organic scatter.
3. **Making colour pop** — the RD pattern + margin band + opalescent lines + wet
   clearcoat all have to compose into something that reads as a real nudibranch. Most
   of the iteration budget goes here.
4. **Bigger scope than siphonophores** — a genuine 3D body + a central pattern layer.
   Mitigated by heavy reuse; but budget accordingly.

## Build order (for the execution phase)

1. Scaffold from the siphonophore project (harness, deploy, cache-fixed build). Retarget.
2. **`core/sdf.js` spike FIRST** — SDF primitives + `smin` + marching cubes + `(u,v)` +
   gradient-normal baking, proven on a trivial "two blended capsules" case, verified
   headless. This is the riskiest infra; de-risk it before anything depends on it.
3. `body.js` — a convincing dorid disc ↔ aeolid body morphing on one slider, via the SDF.
4. Rhinophores + one dorsal apparatus (start with aeolid cerata blended onto the body,
   then the dorid gill rosette).
4. Port the RD engine + wet chromatophore material; get colour/pattern popping on the
   notum with a margin band. **Spend time here.**
5. Cerata core-glow translucency; oral tentacles; notum texture.
6. Motion (crawl wave, cerata sway, mantle ripple).
7. Presets (~14–18 species) from the research table; tune each.
8. Scene/lighting pass (wet jewel look); bloom; DOF feel.
9. Gallery, README/ROADMAP, deploy + autodeploy.

## Open questions for the research pass (being answered in the background)
- Exact dorid-vs-aeolid body proportions; mantle-overhang ratios.
- Cerata arrangement patterns (rows vs arches vs clusters) per family + counts.
- Rhinophore club types per iconic species.
- The colour/pattern vocabulary + a sourced ~14–18 species preset table.
- Sacoglossans (Elysia/Costasiella) — include as flagged "leaf slug" cousins or omit?
