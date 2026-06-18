# Dune: Awakening Base Builder — Roadmap

A community planning tool for designing Dune: Awakening bases in 3D. Placement is
**connection-first**, exactly like the game: the first piece you place sets the
build grid, and everything else snaps to edges of existing pieces — no fixed
ground grid.

This page tracks what's done, what's being worked on, what's planned, and the
known issues. It's updated as the tool evolves; the detailed per-build history
lives in [`v2/CHANGELOG.md`](v2/CHANGELOG.md).

_Last updated: 2026-06-18 (build `v2-dev-0040`)._

---

## ✅ Shipped

- **Connection-first placement engine** — no world grid; pieces snap to each
  other's edges. Free placement on open ground when nothing is nearby.
- **Foundations & floors** — square, wedge (triangle), and round-corner pieces, calibrated to the
  real in-game dimensions.
- **Full wall family** — straight wall styles 1–5, half wall, windows (incl.
  glazed), all 12 wedge/gable walls, tall corner, inclined tall wall, round
  corners, and the door assembly.
- **Walls on foundations** — stand walls on a foundation's top edges to build
  rooms and towers; stack walls to add stories.
- **Walls off foundations** — run a wall outward from a foundation's edge to
  build fortress-style perimeter walls, at ground level or along the top.
- **Facing indicator** — wall/door previews show which way the piece faces
  (outward arrow + inner-face tint); press **R** to flip it in place.
- **Reliable building controls** — Debug overlays never change where a piece
  snaps; selecting a new piece never stalls the preview.
- **Build menu** — category tabs, piece cycling, and an Admin panel for
  organizing pieces (incl. a "Reverse scroll wheel" control option).
- **Claim overlay planner** — optional visual-only 10x10 land-claim chunks,
  up to 6 horizontal staking units, and one vertical staking tier across the
  whole claim footprint. The overlay is saved locally and never affects build
  snapping or placement.
- **Base design import/export** — download placed parts as a versioned JSON file
  and import/paste shared JSON designs back into the builder.
- **Public About / Feedback modal** — trimmed in-app Features, Roadmap, and
  Feedback tabs with copy/download report packaging.

## 🚧 In progress

- **Stairs & ramps** — inclines that connect one level to the next.
  - ✅ Straight stairs/ramps + half versions, descending from a foundation/floor edge.
  - ✅ **Side-by-side** — snap two inclines flush along their side edges (wide staircases).
  - ✅ **Sloped surfaces** — tile ramps/stairs edge-to-edge (high edge to next low
    edge) to build sloped roofs/ceilings and climbing runs, as in the reference bases.
  - ☐ **Corner variants** — the corner stair/ramp pieces (90° turns).
  - ☐ **Two-end snapping** — connect an incline's bottom to a lower level and its
    top to an upper level at once (also fixes a half-incline floating from a
    full-height edge).

## 🗺️ Planned

- **Roofs** — roof tiles, tops, wedges, caps, and corners (already inventoried).
- **Remaining curved fillers/openings** — the inner floor round-corner filler and
  window round-corner pieces.
- **Structural & access extras** — pillars, railings, ladders, hatches, gates,
  passageways, and columns.
- **Level/story selector** — an explicit control to choose which floor a piece
  snaps to when targets stack vertically (today the cursor height decides).
- **Foundation-on-foundation stacking** — stack foundations to raise terrain.
- **Autosave / design library** — persistent local design slots and starter-base
  browsing on top of the JSON import/export format.
- **Hosted feedback submission** — send bug reports directly from the app once a
  backend or form endpoint exists.
- **Hosted models** — serve the building-piece models so the public site shows
  them (today the deployed site is geometry-only; see Known Issues).
- **"Base Parts Builder" (separate project)** — let players of other games define
  their own snappable pieces on top of the same data-driven engine.

## ⚠️ Known issues

- **The public/deployed site currently shows no building models.** The game asset
  files are local-only (provided by the developer, not redistributable), so a
  git-based deploy has the engine but no meshes. Hosted models are on the roadmap.
- **Wedge (gable) wall facing tint** is drawn as a rectangle, so the inner-face
  highlight overshoots the sloped top edge. Cosmetic, preview-only.
- **Shift+Wheel zoom** may not work on some mice (e.g. certain Logitech models
  whose software remaps Shift+wheel). Workaround: enable **Reverse scroll wheel**
  in the Admin panel so the bare wheel zooms instead.
- **Stacked snap targets** directly above one another can be ambiguous right at a
  foundation's top height — the level/story selector (planned) will fix this.

---

_Have feedback or a request? Note it against the relevant section above._
