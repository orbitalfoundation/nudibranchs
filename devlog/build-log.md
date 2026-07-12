# Nudibranch — session build log — 2026-07-11

The fifth parametric visualizer, built autonomously in one session from the
[design spec](20260711-nudibranch-design.md). Live at **https://nudis.exe.xyz** ·
repo **github.com/orbitalfoundation/nudibranchs**.

## What shipped

- One procedural Three.js rig spanning **15 real sea slugs** across dorids, aeolids,
  dendronotids, and a sacoglossan cousin — each a point in one parameter space.
- The three design-spec ideas all landed: **superset dorsal field** (rosette / cerata
  / branches / bumps all always present at some amount, so dorid↔aeolid morphs survive
  the clade boundary), **one recursive appendage primitive** (drives cerata, gill
  pinnules, rhinophore clubs, dendritic branches, tubercles), and **place(u,v)**
  placement (ring / rows / clusters / scatter).
- A **procedural pattern stack** in body-UV (base, countershade, mantle-margin band,
  spots/Worley, reticulation/Voronoi, longitudinal lines, gut-coloured cerata cores) —
  the identity. Opaque wet PBR on a lit reef, not the siphonophore blackwater void.
- Gentle motion (cerata sway + crawl rock), headless smoke + render harness,
  content-hashed build (no stale pages), exe.dev deploy + autodeploy.

## The big detour: SDF vs swept mesh

The user specifically championed **metaballs / SDF / marching cubes** for smooth
organic surfacing, and it's the right idea in principle (appendages *flow out of* the
flesh with no seam). So I built `core/sdf.js` properly: SDF primitives (sphere,
ellipsoid, capsule), **bounded exponential-smin** splatting (order-independent, each
primitive only touches nearby grid cells → fast with 100+ primitives), **marching
tetrahedra** (no 256-entry table to mistype), vertex merging + smoothed normals.

It *worked* (the field was provably solid) but the polygonised body kept coming out
**terraced and torn** — the animal is very flat, so the grid had too few cells through
its thin dimension, and the ellipsoid-stack / sphere-carpet approaches fought the
marching-tetrahedra + merge stack in ways that ate a lot of iteration. Diagnosis by
field-sampling confirmed the geometry was solid but the surface extraction was
mangling it.

**Decision:** fall back to a **clean swept mesh** (the proven fish/siphonophore
technique) — a flattened cross-section swept along the body axis with profiles that
morph dorid disc ↔ aeolid taper. It built in **2 ms vs ~1.8 s**, was perfectly smooth,
and gave reliable body-UVs for the pattern stack (which marching cubes can't do
naturally). The right tool won on the merits. `core/sdf.js` stays in the repo — it's
genuinely the better tool for the *tubercled* species (Phyllidia ridges, sea-bunny
caryophyllidia as smooth-unioned bumps), noted in the ROADMAP.

Lesson: prototype the risky infra first (I did), but be willing to swap it out when a
simpler proven technique clears the bar. A gorgeous swept-mesh nudibranch beats a
broken SDF one, and the SDF vision isn't wasted — it's the right call for phase 4.

## What went right

- The **recursive appendage primitive** paid off exactly as the spec predicted: the
  *same* function makes an aeolid ceras (depth 0, colour core + tip cap), a dorid gill
  (depth 2, many branches → pinnate plume), a dendritic Dendronotus branch, a ribbed
  rhinophore, and a Phyllidia tubercle. One primitive, the whole animal.
- The **pattern stack** is what makes them read as real: the moment the orange mantle
  margin appeared on the blue Chromodoris, and the white Voronoi net on the magenta
  Hypselodoris, they stopped being blobs and became nudibranchs.
- **Colour-along-length on cerata** (base → gut core → cnidosac tip) is the single most
  "alive" detail — Cratena's orange-cored blue-tipped cerata are unmistakable.
- The whole render→see→iterate loop on this box made the SDF detour survivable — every
  wrong turn was visible within seconds.

## Known rough edges (ROADMAP)

Bodies read a touch flat/lens-like; a hot specular under-glow on some species (bloom
vs substrate reflection); Willani's stripes too subtle; motion is gentle rather than a
full pedal-wave/Spanish-dancer swim. All phase-1/2/3 polish. The core is done and the
15-species set spans the space.

## Workflow notes

Same box, same loop as the siphonophores (headless Playwright Chromium render +
exe.dev gateway-SSH deploy + autodeploy). Baked the content-hashed cache fix into the
build from day one. Retargeted the siphonophore harness (VM `nudis`, repo
`orbitalfoundation/nudibranchs`).
