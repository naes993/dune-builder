# V2 Changelog

## v2-dev-0010 - 2026-06-10

Connection-first only; real Harkonnen parts are the buildables.

- Removed global grid snapping entirely (store flag, solver fallback, `Snap Grid` checkbox). The first placed piece establishes the build grid; everything else snaps to existing pieces, matching the game.
- Removed the visible ground grid and `Grid` checkbox — there is no preset world grid.
- Removed the generic placeholder `foundation.square` / `foundation.triangle` parts.
- Promoted the calibration wrappers to real parts: `floor.harkonnen.level3.square`, `floor.harkonnen.level3.wedge`, `foundation.harkonnen.level3.square`, `foundation.harkonnen.level3.wedge`.
- Calibrated logical heights from measured GLBs (`scripts/measure-core-parts.mjs`): floors are 0.3735 thick with the GLB pivot at the walking surface; foundations are 3.8968 tall with the pivot at the base. Visual mesh offsets now match each family's pivot convention instead of assuming a shared 0.2 slab.
- Confirmed by measurement that the wedge GLB pivot is at the triangle centroid with the base toward +Z, matching the registry's equilateral triangle anchors (side = 5.317) within visual overhang tolerance — no wedge anchor recalibration needed.
- Pressing R now visibly rotates snapped previews: the solver prefers candidate orientations closest to the requested rotation (weighted tie-break), so R cycles valid orientations on the same support edge.
- No vertical/top-surface building system yet; floors and foundations still both sit at ground level, so floor tops do not yet align with foundation tops.

## v2-dev-0009 - 2026-05-26

Floor snapping is restored while foundation wall snapping remains profile-specific.

- Added V2 snap profiles for floor, foundation, and wall parts.
- Floor targets expose `floor-support` and `wall-support` without sharing foundation settings.
- Floor-to-floor and floor-to-foundation placement use full-edge `floor-support` snapping.
- Wall-to-floor placement uses full-edge `wall-support` snapping on all floor sides.
- Wall-to-foundation placement keeps the `v2-dev-0008` foundation-specific endpoint behavior.
- Foundation-to-foundation placement remains `foundation-structure`.
- No `V2_UNIT_SIZE`, GLB scale, visual offset, material, mesh transform, or wedge/triangle geometry values were changed.

## v2-dev-0008 - 2026-05-26

Foundation edge snapping uses explicit structural, floor, and wall channels.

- Added V2 snap channel metadata for source and target parts.
- Added a small snap relationship helper so generic edge candidates are filtered before scoring.
- Foundation parts use the `foundation-structure` channel for foundation-to-foundation side adjacency.
- Floor calibration parts use the `floor-support` channel for floor/foundation footprint-level snapping.
- Wall parts use the `wall-support` channel for foundation side snapping.
- Wall-support snaps attach wall endpoints to foundation side endpoints and project outward from the foundation face.
- Foundation target edges expose `foundation-structure`, `floor-support`, and `wall-support` channels.
- Debug output now shows the selected support-edge channel for the current preview.
- No `V2_UNIT_SIZE`, GLB scale, visual offset, material, mesh transform, or wedge/triangle geometry values were changed.
- No top-surface or vertical building system was added.

## v2-dev-0007 - 2026-05-26

Global grid snapping is optional; placement is connection-first.

- Added V2 store `snapToGrid`, defaulting to `false`.
- Added a separate `Snap Grid` toolbar checkbox for global V2 grid snapping.
- Kept the existing `Grid` checkbox scoped to visual grid display only.
- Placement now prioritizes connection targets before ground fallback.
- Ground fallback uses exact cursor placement when `snapToGrid` is off and global V2 grid centers when `snapToGrid` is on.
- Connection snap results are not forced back onto the global grid.
- Documented the checkpoint placement priority and in-app browser placement-testing path.
- No `V2_UNIT_SIZE`, GLB scale, visual offset, material, mesh transform, or wedge/triangle geometry values were changed.

## v2-dev-0006 - 2026-05-26

Wall placement supports support edges and wall-run continuation.

- Added wall endpoint targets for placed wall-like parts.
- Added wall-run placement mode so walls and doors can continue from existing wall endpoints.
- Wall-run previews align a selected source wall endpoint to the selected target wall endpoint.
- Added normalized wall segment occupancy keys in the format `wall-segment:{normalizedStart}:{normalizedEnd}`.
- Duplicate wall segments are invalid regardless of placement direction.
- Support-edge placement remains backed by `{supportInstanceId}:{supportEdgeId}` keys and also reserves the physical wall segment key.
- Added Debug wall placement diagnostics for mode, target edge or wall endpoint, occupancy key, occupancy status, endpoint markers, and preview segment lines.
- No `V2_UNIT_SIZE`, wall GLB scale, visual offset, material, mesh transform, Grid behavior, or wedge/triangle geometry values were changed.

## v2-dev-0005 - 2026-05-26

Wall-edge placement uses support edge slots with aligned wall transforms.

- Persisted snap bindings on placed V2 instances so wall-like parts reserve the exact support edge used for their preview transform.
- Added edge-slot occupancy keys in the format `{supportInstanceId}:{supportEdgeId}`.
- Snapped wall and door parts use edge-slot occupancy instead of broad rectangular footprint overlap as the main blocker.
- Adjacent wall-edge slots can be occupied so walls can meet at square and triangle corners.
- A second wall or door on the same support edge is invalid.
- Kept conservative footprint overlap behavior for unsnapped wall-edge placement.
- No `V2_UNIT_SIZE`, wall GLB scale, visual offset, material, mesh transform, Grid behavior, or wedge/triangle geometry values were changed.

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
