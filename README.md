# Dune Builder

This repository currently contains the original legacy builder and an isolated V2 builder prototype.

The V2 prototype is available at `/v2`. The current active development branch is `v2-builder-engine-prototype`, and the current safe checkpoint is `b2cbda9`.

## V2 Builder Prototype

V2 is being built as a data-driven placement engine:

- Logical footprints define occupied space.
- Edge anchors define alignment.
- Placement rules define allowed placement.
- Occupancy validation rejects overlaps.
- GLB files are visual wrappers only.

The V2 code is intentionally isolated under `v2/` so it can evolve without depending on the legacy builder implementation.

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

## Validate

```bash
npm run build
npx tsc --noEmit
```

