# Roadmap

Where the nudibranch rig goes next. A sibling of `fish/`, `flowers/`, `fruit/`, and
`siphonophores/`; same philosophy — one param space, presets as points, morphable
tree, one reused primitive — with a genuinely different rendering thesis (opaque +
patterned + lit, not additive + glowing + black).

Legend: ⭐ recommended next · 🟢 cheap · 🟡 medium · 🔴 large

## Phase 1 — Pattern & colour depth ⭐ 🟡
*Pattern is nudibranch identity; there's a lot of headroom.*

- [ ] **Structural-colour layer.** Blue/white/opalescent lines rendered as
      view-dependent iridescence (guanine photonic look), separate from flat pigment.
- [ ] **More pattern generators:** rings/ocelli, transverse bands, gradient washes,
      per-species reaction-diffusion presets (as visual analogy).
- [ ] **Per-species pattern tuning** — the current presets are a first pass; several
      (Willani's stripes, Nembrotha's spots) want finer control.
- [ ] **Translucency map** — genuinely glassy species (Melibe, phylliroids) with the
      body PBR fading to transmission.

## Phase 2 — Body & appendage refinement 🟡
- [ ] **Rounder, plumper bodies** — the swept body reads a touch flat/lens-like;
      add belly volume and a rounded head cap; fix the two-rhinophore symmetry.
- [ ] **Ceras shape variety** — inflated (Eubranchus), flattened leaf (Phyllodesmium),
      the flat white-edged Dirona blades; denser, more natural scatter.
- [ ] **Gill as a true rosette** — tighten the ring, add the retractile (cryptobranch)
      vs non-retractile (phanerobranch) distinction as an animated pocket.
- [ ] **Oral tentacles + propodial tentacles** (aeolids); the **Melibe oral hood**.
- [ ] **Caruncle** (Janolus), **oral veil** (dendronotids).

## Phase 3 — Motion 🟡
- [ ] **Pedal-wave crawl** — a travelling muscular wave along the foot sole (body
      vertex shader), so it visibly creeps.
- [ ] **Spanish-dancer swim** — the hero: rhythmic undulation of the flared red
      mantle margin (`motion.mantleUndulate` is stubbed).
- [ ] **Melibe / Dendronotus lateral-flexion swim** (~3 s per cycle, different planes).
- [ ] Richer cerata sway (currently a gentle shader wobble) + saccadic rhinophore bob.

## Phase 4 — Geometry: revisit SDF 🔴
*`core/sdf.js` works (bounded exp-smin + marching tetrahedra + vertex merge) but the
swept mesh won on smoothness/speed/UVs for the body. Where SDF still wins:*
- [ ] **Tubercled species** (Phyllidia ridges, sea-bunny caryophyllidia) as SDF bumps
      smooth-unioned onto the body — the flesh-continuous look meshes can't do.
- [ ] Fix the marching-tetrahedra thin-region artifacts (or swap in real marching
      cubes with the standard tables) if pursuing SDF further.

## Phase 5 — The genome & sharing 🟢
*A slug already **is** its parameter tree — the fish/siphonophore trick ports directly.*
- [ ] Serialize genome → shareable URL (diff-vs-preset codec); load from hash on boot.
- [ ] Breeding / mutation across the superset field (morphs already survive clades).

## Phase 6 — Deployment 🟢
- [x] ✅ Content-hashed build (no stale pages — the fix from the siphonophore project).
- [ ] exe.dev VM + autodeploy (push `main` → redeploy), mirroring `siphonophores/deploy/`.

## Cross-cutting
- [ ] More species: *Facelina* (annulate rhinophores + blue iridescence), *Antiopella*
      (caruncle + blue tips), *Tritonia* (branched plumes), *Elysia* (ruffled parapodia).
- [ ] Egg-ribbon spiral companion prop (instantly reads "nudibranch").
- [ ] Reduce the hot specular under-glow on some species (bloom vs substrate reflection).
- [ ] Contact-sheet + per-species gallery for the README.
