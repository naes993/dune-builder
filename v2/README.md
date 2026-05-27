# V2 Builder Prototype

Current V2 build: `v2-dev-0008`

Description: Foundation edge snapping uses explicit structural, floor, and wall channels.

## Checkpoint Summary

`v2-dev-0008` is a connection-first placement checkpoint with explicit foundation snap channels. Existing V2 connection targets are evaluated before any ground fallback placement:

1. Connection snap target if available.
2. Free ground placement when `snapToGrid` is `false`.
3. Grid-snapped ground placement when `snapToGrid` is `true`.

`Grid` and `Snap Grid` are separate controls. `Grid` only controls visible grid lines. `Snap Grid` only controls the global grid fallback used when no supported connection target is nearby.

Foundation edge relationships are separated by channel:

- `foundation-structure`: foundation parts snap flush side-to-side with other foundation parts.
- `floor-support`: floor parts snap to floor-compatible footprint edges, including the base edge of foundation parts.
- `wall-support`: wall parts snap to wall-compatible foundation side edges.

There is no top-surface snap system in this checkpoint. Existing top/floor behavior should be preserved if one is added elsewhere, but this pass does not add a vertical building system.

## Structure

- `v2/constants.ts`: V2-only constants, including `V2_UNIT_SIZE = 5.317`.
- `v2/version.ts`: Current V2 build label, date, and description.
- `v2/registry/parts.ts`: Data-driven part definitions, logical footprints, anchors, occupancy layers, and visual metadata.
- `v2/store/builderStore.ts`: Builder state for selected part, placed instances, preview, rotation, debug visuals, grid visibility, and optional grid snapping.
- `v2/engine/*`: Anchor transforms, snap solving, placement rules, and occupancy validation.
- `v2/engine/snapRelationships.ts`: Snap channel compatibility helpers.
- `v2/scene/*`: React Three Fiber scene, UI controls, debug helpers, placeholder meshes, and GLB visual wrappers.

## Implemented Features

- Square placement.
- Triangle placement.
- Edge alignment.
- Snap relationship channels for foundation structural, floor-support, and wall-support placement.
- Wall-edge slot occupancy for snapped wall and door parts.
- Wall-run continuation from existing wall endpoints.
- Invalid overlap preview.
- Real GLB visual wrappers for selected Harkonnen parts.
- Material-name mapping for `_Ext` and `_Int`.
- Optional Grid helper, off by default.
- Optional Snap Grid placement fallback, off by default.
- Separate Debug helper.
- Harkonnen asset audit and manifest.

## Placement Testing

Use the in-app browser, Browser plugin, or Chrome for interactive placement testing. For the current local preview, open:

```text
http://127.0.0.1:3002/v2
```

Expected smoke checks for `v2-dev-0008`:

- With `Snap Grid` off, first-piece placement on open ground should stay at the cursor location.
- With `Snap Grid` on, open-ground placement should snap to the global V2 grid.
- Foundation placement near a foundation edge should show the structural support-edge channel in Debug.
- Floor placement near a foundation edge should show the floor support-edge channel in Debug.
- Wall placement near a foundation edge should show the wall support-edge channel in Debug.
- Wall continuation near a wall endpoint should prefer the wall-run target.
- The `Grid` checkbox should only affect visible grid lines.
- Debug visuals should still work independently.

## Temporary Calibration Parts

- Real Floor.
- Real Foundation.
- Real Floor Wedge.
- Real Foundation Wedge.

These parts exist for scale and visual calibration. Their GLB files remain local-only and are not committed.

## Known Limitations

- Wedge/triangle geometry still needs calibration from the real wedge GLBs.
- Wall visual fit should be inspected after wedge/floor geometry stabilizes.
- There is no final Part Builder yet.
- There is no final V2 save/export system yet.
- There is no full roof, stair, or curve system yet.

## Next Recommended Task

Recalibrate triangle/wedge logical geometry from:

- `SM_Env_PB_Hark_Level3_FloorWedge.glb`
- `SM_Env_PB_Hark_Level3_FoundationWedge.glb`

Do this without using GLB bounds, pivots, mesh centers, or `_COL` files as placement truth.
