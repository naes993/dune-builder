# V2 Builder Prototype

Current V2 build: `v2-dev-0010`

Description: Connection-first only — world grid removed, real Harkonnen parts promoted, R rotates snapped previews.

## Checkpoint Summary

`v2-dev-0010` is a connection-first placement checkpoint. There is no world grid: the first placed piece establishes the build grid, exactly like the game. Placement priority is:

1. Connection snap target if available (wall-run, then support-edge).
2. Free ground placement at the cursor otherwise.

The buildable parts are the real Harkonnen Level 3 floor/foundation squares and wedges plus the wall/door batch. The generic placeholder square/triangle foundations are removed.

Logical vertical dimensions are calibrated from measured GLBs (`scripts/measure-core-parts.mjs`):

- Floor slab: 0.3735 thick, GLB pivot at the walking surface.
- Foundation block: 3.8968 tall, GLB pivot at the base.
- Wedge GLB pivots sit at the triangle centroid with the base toward +Z, matching the registry's equilateral anchors (side = `V2_UNIT_SIZE`) within visual overhang tolerance.

Foundation edge relationships are separated by channel:

- `foundation-structure`: foundation parts snap flush side-to-side with other foundation parts.
- `floor-support`: floor parts snap to floor-compatible footprint edges, including the base edge of foundation parts.
- `wall-support`: wall parts snap to wall-compatible edges on floors and foundations.

Floor, foundation, and wall parts also have separate snap profiles. Floors can expose wall-compatible sides without inheriting foundation-specific wall behavior.

There is no top-surface/vertical snap system yet: floors and foundations both sit at ground level, so floor tops do not yet align with foundation tops. That is the next major engine milestone.

## Structure

- `v2/constants.ts`: V2-only constants (`V2_UNIT_SIZE = 5.317`, measured floor/foundation heights).
- `v2/version.ts`: Current V2 build label, date, and description.
- `v2/registry/parts.ts`: Data-driven part definitions, logical footprints, anchors, occupancy layers, and visual metadata.
- `v2/store/builderStore.ts`: Builder state for selected part, placed instances, preview, rotation, and debug visuals.
- `v2/engine/*`: Anchor transforms, snap solving, placement rules, and occupancy validation.
- `v2/engine/snapRelationships.ts`: Snap channel compatibility helpers.
- `v2/scene/*`: React Three Fiber scene, UI controls, debug helpers, and GLB visual wrappers.

## Implemented Features

- Square and wedge placement using real Harkonnen GLBs.
- Edge alignment (connection-first, no world grid).
- Snap profiles and relationship channels for floor, foundation, and wall placement.
- Wall-edge slot occupancy for snapped wall and door parts.
- Wall-run continuation from existing wall endpoints.
- Invalid overlap preview.
- Material-name mapping for `_Ext` and `_Int`.
- R rotates the preview, including snapped previews (rotation-preference tie-break in the solver).
- Separate Debug helper.
- Harkonnen asset audit and manifest.

## Placement Testing

Use the in-app browser, Browser plugin, or Chrome for interactive placement testing. For the current local preview, open:

```text
http://127.0.0.1:3000/v2
```

Expected smoke checks for `v2-dev-0010`:

- First-piece placement on open ground stays at the cursor location (no grid rounding).
- Floor placement near a floor or foundation edge shows the floor support-edge channel in Debug.
- Wall placement near any floor side shows the wall support-edge channel and uses full-edge wall alignment.
- Wall placement near a foundation side shows the wall support-edge channel and uses the foundation-specific endpoint behavior.
- Foundation placement near a foundation edge shows the structural support-edge channel in Debug.
- Wall continuation near a wall endpoint prefers the wall-run target.
- Pressing R cycles the preview orientation; snapped previews keep the snap while honoring the nearest valid orientation.
- Debug visuals work independently.

## Known Limitations

- No vertical/top-surface building system: floor tops do not yet align with foundation tops, and walls stand at ground level beside foundations instead of on top of them.
- There is no final Part Builder yet.
- There is no final V2 save/export system yet.
- There is no full roof, stair, or curve system yet.

## Next Recommended Task

Add the vertical building system: floors snapping flush with foundation tops, walls standing on foundation/floor tops, and second-story support. Calibrate against in-game screenshots (foundation top = 3.8968, wall module ≈ 3.88).
