# Dune Builder

This repository currently contains the original legacy builder and an isolated V2 builder prototype.

The V2 prototype is available at `/v2`. The current working checkpoint is `v2-dev-0009`.

## V2 Builder Prototype

V2 is being built as a data-driven placement engine:

- Logical footprints define occupied space.
- Edge anchors define alignment.
- Placement rules define allowed placement.
- Occupancy validation rejects overlaps.
- GLB files are visual wrappers only.
- Global grid snapping is optional and off by default.
- Connection targets take priority over ground fallback placement.
- Floor, foundation, and wall snapping is separated by profile and channel.

The V2 code is intentionally isolated under `v2/` so it can evolve without depending on the legacy builder implementation.

## Current V2 Checkpoint

`v2-dev-0009` makes placement connection-first, channel-aware, and profile-aware:

- Existing connection targets are evaluated before ground placement.
- `Snap Grid` controls global grid snapping for ground fallback placement only.
- `Grid` controls visible grid lines only.
- When `Snap Grid` is off and no connection target is found, the preview and placed part use the ground hit position.
- When `Snap Grid` is on and no connection target is found, the preview and placed part snap to the global V2 grid.
- Support-edge placement and wall-run continuation are not forced back onto the global grid.
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

Open `/v2` to test the V2 prototype.

Use the in-app browser, Browser plugin, or Chrome for placement testing. The current preview was verified at:

```text
http://127.0.0.1:3002/v2
```

## Validate

```bash
npm run build
npx tsc --noEmit
```
