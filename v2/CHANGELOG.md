# V2 Changelog

## v2-dev-0004 - 2026-05-26

Ground grid helper is optional and off by default.

- Added V2 store `showGrid`, defaulting to `false`.
- Added a separate `Grid` toolbar checkbox for the aligned ground grid helper.
- Kept `Debug` independent from `Grid`; debug footprints, anchors, and GLB bounds do not require the ground grid.
- No placement, snapping, occupancy, wall transform, or GLB transform behavior was intentionally changed.

## v2-dev-0003 - 2026-05-26

Visual grid aligned to V2 canonical unit.

- Replaced the hard-coded `gridHelper` spacing with a V2-only grid derived from `V2_UNIT_SIZE`.
- Visible grid lines now represent cell boundaries at `V2_UNIT_SIZE` intervals.
- Placement points remain cell centers, offset by half a V2 unit from the visible boundary lines.
- No placement, snapping, occupancy, wall transform, or GLB transform behavior was intentionally changed.

## v2-dev-0002 - 2026-05-26

Canonical square unit calibrated to real Harkonnen floor tile.

- Added V2-only `V2_UNIT_SIZE = 5.317` in `v2/constants.ts`.
- Updated V2 square foundation logical footprint, anchors, placeholder visual, and grid spacing to use `V2_UNIT_SIZE`.
- Updated real floor and real foundation calibration square parts to share the same `V2_UNIT_SIZE` logical footprint.
- Kept real floor/foundation GLB visual scale at `[1, 1, 1]`.
- Kept Harkonnen wall/door GLB visual scale and offsets unchanged.
- Triangle/wedge logic now scales with `V2_UNIT_SIZE` only to keep current V2 behavior consistent; wedge geometry still needs recalibration from `SM_Env_PB_Hark_Level3_FloorWedge.glb`.

## v2-dev-0001 - 2026-05-26

Stable checkpoint before calibrating V2 scale from real Harkonnen floor/foundation assets.

- Added temporary real Harkonnen floor/foundation calibration visual wrappers:
  - `calibration.harkonnen.level3.floor.square`
  - `calibration.harkonnen.level3.foundation.square`
  - `calibration.harkonnen.level3.floor.wedge`
  - `calibration.harkonnen.level3.foundation.wedge`
- Calibration parts intentionally keep current placeholder logical footprints and anchors so real GLB visual bounds can be compared against current V2 placement truth.
- Square foundation placement works.
- Triangle foundation placement works.
- Foundation edge snapping works.
- Invalid overlap preview works.
- Harkonnen GLB visual wrappers render as visual-only skins.
- Harkonnen `_Ext` / `_Int` material-name overrides are in place.
- First controlled Harkonnen wall/door batch is registered:
  - `wall.harkonnen.level3.straight`
  - `wall.harkonnen.level3.corner.tall`
  - `wall.harkonnen.level3.inclined.tall`
  - `wall.harkonnen.level3.door`
- `_COL` assets remain reference-only and are not selectable build parts.

Scale calibration note: current placeholder foundations still use the original temporary logical size. Do not treat wall overhang against those placeholders as proof that wall meshes are wrong.
