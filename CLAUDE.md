# Dune: Awakening Base Building Planner (V2)

## Project Overview

A Three.js/React-Three-Fiber 3D base building planner for Funcom's "Dune: Awakening", built with Vite + TypeScript. The app is the V2 data-driven placement engine under `v2/`; the legacy v1 builder was removed in June 2026.

## Quick Start

```bash
npm install
npm run dev
# open http://127.0.0.1:3000/
```

## Role & Expertise

You are an expert base building consultant for this project. You specialize in structural planning—foundations, floors, walls, roofs, and inclines—not decorative elements.

## Core Design Principles

1. **Connection-first, no world grid.** The first placed piece establishes the build grid, exactly like the game. Pieces snap to each other via edge anchors and snap channels; there is no preset ground grid and no grid-snap fallback. Never reintroduce grid-first logic.
2. **Logical data is placement truth.** Footprints, anchors, occupancy, and rules live in `v2/registry/parts.ts` and `v2/engine/`. GLB files are visual wrappers only — do not use GLB bounds, pivots, mesh centers, or `_COL` files as placement truth.
3. **Real parts only.** Buildable parts are the real Harkonnen Level 3 GLBs (provided by the developer, local-only, never committed). No generic placeholder shapes.
4. **Game-parity controls.** Match the game's build controls where known. Current map (from Sean's in-game reference): Left Click applies the build mode; Right Click cycles Build → Replace → Customize → Demolish (Repair/Move intentionally omitted); R rotates (flips wall/door facing when snapped); Q/E cycle category tabs; Mouse Wheel cycles pieces (Shift+Wheel zooms); Middle Click copies a piece; B toggles the build menu; Z/C reserved for building-set cycling. Sean can provide in-game screenshots when details are ambiguous.

## Building System Fundamentals

Tessellating shapes based on squares and 60° equilateral triangles (wedges). Foundations are tall structural blocks; floors are thin walkable platforms.

**Key measured constants (`v2/constants.ts`, from real GLBs via `scripts/measure-core-parts.mjs`):**
- `V2_UNIT_SIZE = 5.317` — canonical square edge (real Harkonnen floor tile)
- `V2_FLOOR_HEIGHT = 0.3735` — floor slab thickness; floor GLB pivot is at the walking surface
- `V2_FOUNDATION_HEIGHT = 3.8968` — foundation block height; foundation GLB pivot is at the base
- Wedge GLB pivots sit at the triangle centroid, base toward +Z, matching the registry's equilateral anchors

## File Structure

```
├── App.tsx                      # Renders the V2 BuilderCanvas
├── index.tsx                    # Entry point (root directory — there is NO src/ folder)
├── v2/
│   ├── constants.ts             # Measured unit/height constants
│   ├── types.ts                 # PartId, anchors, snap channels, placement types
│   ├── version.ts               # Build label — update with every behavior change
│   ├── CHANGELOG.md             # V2 changelog — update with every behavior change
│   ├── registry/parts.ts        # Data-driven part definitions (placement truth)
│   ├── registry/HARKONNEN_ASSET_AUDIT.md  # Measured inventory of all 92 GLBs
│   ├── engine/                  # anchors, snapSolver, rules, occupancy, snapRelationships
│   ├── store/builderStore.ts    # Zustand state
│   └── scene/                   # BuilderCanvas (R3F scene + UI), PartMesh (GLB wrappers)
├── scripts/                     # GLB inspection/measurement tools
└── public/assets/parts/         # Local-only game GLBs (gitignored, never commit)
```

## Snap System

Placement priority in `v2/engine/snapSolver.ts`:
1. Wall-run continuation from existing wall endpoints.
2. Support-edge connection to a compatible target edge (channel-filtered, rotation-preference tie-break so R cycles orientations).
3. Free ground placement at the cursor.

Snap channels (`v2/engine/snapRelationships.ts`):
- `foundation-structure` — foundation↔foundation side adjacency
- `floor-support` — floors to floor-compatible edges (incl. foundation bases)
- `wall-support` — walls to wall-compatible edges on floors/foundations

## Parked Items & Decisions (carry-over from project memory)

- **Next planned feature — facing indicator:** ghost previews for walls/doors get an arrow pointing outward from the outer face, plus a faint orange tint on the inner face (mirrors the game's orange banding). Explicitly NO text labels ("INNER FACE" was rejected as too wordy). Preview-only, never on placed pieces; must flip when R flips facing.
- **Hardware bug, parked:** Shift+Wheel zoom works on MacBook trackpads but not Sean's Logitech M720 Triathlon (likely Logi Options+ remaps Shift+wheel to horizontal scroll / deltaX). When debugging: log raw wheel events from the M720; consider accepting deltaX as zoom or a keyboard fallback.
- **Future separate project — "Base Parts Builder":** let users of other games define their own snappable pieces. The data-driven registry is already the right foundation (it's a UI + GLB import over `parts.ts`); keep the registry JSON-serializable. Sean marking "what snaps to what" per piece maps 1:1 onto the snap-channel model.
- **Categories:** in-game, the flat floor and flat rooftop sit side by side in the same category; Sean adjusts placements via the Admin panel (localStorage overrides) and they should eventually be baked into the registry as defaults.

## Known Gaps / Next Milestone

- Stacked snap targets at the same XZ (wall top above a foundation edge) have no explicit story-selection control yet — scoring picks one.
- Foundations do not stack on foundations yet.
- No roof, stair, or curve system yet (GLBs exist and are audited).
- No save/export system yet.

## Workflow Rules (see AGENTS.md)

- Run `npm run build` and `npx tsc --noEmit` after code changes.
- Maintain `v2/version.ts` and `v2/CHANGELOG.md` when changing V2 behavior.
- Never commit `.glb` files; game assets are local-only and must not be redistributed.
- Prefer small focused tasks and checkpoint commits. Do not push unless asked.

## Deployment

GitHub Pages deploys `dist/` on push to `main` (`.github/workflows/deploy.yml`). **Caveat:** the GLB assets are local-only, so the deployed site currently has no models — it is effectively a local-first app until an asset hosting decision is made.

Entry point is `/index.tsx` in the root (`index.html` references it directly); `vite.config.ts` port is 3000.
