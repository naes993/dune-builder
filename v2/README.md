# V2 Builder Prototype

Current V2 build: `v2-dev-0004`

Description: Ground grid helper is optional and off by default.

## Structure

- `v2/constants.ts`: V2-only constants, including `V2_UNIT_SIZE = 5.317`.
- `v2/version.ts`: Current V2 build label, date, and description.
- `v2/registry/parts.ts`: Data-driven part definitions, logical footprints, anchors, occupancy layers, and visual metadata.
- `v2/store/builderStore.ts`: Builder state for selected part, placed instances, preview, rotation, debug visuals, and grid visibility.
- `v2/engine/*`: Anchor transforms, snap solving, placement rules, and occupancy validation.
- `v2/scene/*`: React Three Fiber scene, UI controls, debug helpers, placeholder meshes, and GLB visual wrappers.

## Implemented Features

- Square placement.
- Triangle placement.
- Edge alignment.
- Invalid overlap preview.
- Real GLB visual wrappers for selected Harkonnen parts.
- Material-name mapping for `_Ext` and `_Int`.
- Optional Grid helper, off by default.
- Separate Debug helper.
- Harkonnen asset audit and manifest.

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

