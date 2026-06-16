# Dune Builder

This repository contains the V2 builder — a data-driven placement engine for planning Dune: Awakening bases. The legacy v1 builder has been removed; the V2 app now runs at the root URL. The current working checkpoint is `v2-dev-0035` (authoritative source: `v2/version.ts` and the top of `v2/CHANGELOG.md`).

> **Deploying / uploading this build?** Read [`HANDOFF.md`](HANDOFF.md) first — the game-asset `.glb` files are local-only, so a plain git-connected deploy produces a site with **no building models**. A local `npm run build` (which copies the GLBs into `dist/`) followed by a direct upload is the only correct path.

## V2 Builder Prototype

V2 is being built as a data-driven placement engine:

- Logical footprints define occupied space.
- Edge anchors define alignment.
- Placement rules define allowed placement.
- Occupancy validation rejects overlaps.
- GLB files are visual wrappers only.
- Placement is connection-first: there is no world grid. The first placed piece establishes the build grid, like the game; everything else snaps to existing pieces.
- Floor, foundation, and wall snapping is separated by profile and channel.

The V2 code lives under `v2/`; the root `App.tsx` is a thin wrapper that renders the V2 builder.

## Current V2 Checkpoint

`v2-dev-0035`. See `v2/CHANGELOG.md` for the full history and [`ROADMAP.md`](ROADMAP.md) for what's planned; highlights of the current state:

- Connection-first placement: no world grid; the first placed piece establishes the build grid. When no connection target is found, the part uses the ground hit position.
- Buildable parts are real Harkonnen GLBs (32 of 92 audited registered): foundations + floors (square/wedge); the full wall family — straight styles 1–5, half wall, windows, all 12 wedge walls, tall corner, inclined tall, door assembly; and inclines — straight stairs/ramps + half versions.
- Logical heights are calibrated from measured GLBs: floors 0.3735 thick (pivot at walking surface), foundations 3.8968 tall (pivot at base).
- Snapping by profile/channel: foundations use structural side-adjacency; floors use floor-support and expose wall-compatible sides; walls use wall-support. Walls stand on foundation/floor/wall tops, can run off a foundation's perimeter to build outward, and cannot pass through a foundation's solid block.
- Inclines descend off a foundation/floor edge, snap side-by-side into wide staircases, and tile edge-to-edge into sloped roofs/ceilings and climbing runs.
- Claim borders can be shown as visual-only 10x10 planning chunks with up to 6 horizontal staking units and one vertical staking tier. Build pieces never snap to the claim overlay.
- Base designs can be exported and imported as versioned JSON files for sharing or starter bases; import supports drag-and-drop, file picking, and paste.
- R flips wall/door facing when snapped; the cursor's height picks which stacked target (build up vs down). Ghost previews show a facing arrow + inner-face tint.
- All part GLBs are preloaded and the scene is wrapped in Suspense, so selecting a new part never freezes the placement preview.

Do not use GLB bounds, pivots, mesh centers, or `_COL` files as placement truth.

## Local Assets

Game-provided GLB files are not included in this repository and must not be committed or redistributed.

The app may reference local asset URLs under `public/assets/...`, such as `/assets/parts/harkonnen/...`, but `.glb` files are ignored by git via:

```gitignore
public/assets/**/*.glb
```

Keep those assets local-only.

## Run Locally

```bash
npm install
npm run dev
```

The V2 builder loads at the root URL.

Use the in-app browser, Browser plugin, or Chrome for placement testing. The current preview was verified at:

```text
http://127.0.0.1:3000/
```

## Validate

```bash
npm run build
npx tsc --noEmit
```
