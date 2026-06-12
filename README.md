# Dune Builder

This repository contains the V2 builder — a data-driven placement engine for planning Dune: Awakening bases. The legacy v1 builder has been removed; the V2 app now runs at the root URL. The current working checkpoint is `v2-dev-0015`.

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

`v2-dev-0010` removes the world grid and promotes the real Harkonnen parts:

- Global grid snapping and the visible ground grid are removed entirely.
- When no connection target is found, the preview and placed part use the ground hit position.
- The buildable parts are the real Harkonnen floor/foundation squares and wedges plus the wall batch; the generic placeholder square/triangle are gone.
- Logical heights are calibrated from measured GLBs: floors are 0.3735 thick (pivot at walking surface), foundations 3.8968 tall (pivot at base).
- Pressing R rotates the preview, including snapped previews (the solver prefers the orientation nearest the requested rotation).
- Foundation pieces use the structural side-adjacency channel.
- Floor pieces use the floor-support channel and expose wall-compatible sides.
- Wall pieces use the wall-support channel.
- Walls use full-edge wall support on floors and foundation-specific endpoint support on foundations.

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
