# V2 Changelog

## v2-dev-0015 - 2026-06-11

Downward building and an Admin part-registry panel.

- Wall (and corner) base edges now expose `floor-support`, so floors snap flush with a wall's base plane — previously floors could only attach at wall tops.
- Walls and doors can hang **below** a support edge (e.g. under a floor overhang): the solver generates a downward variant for every `wall-support` snap, occupying its own edge slot (`...:down`) so a wall above and below the same edge can coexist.
- Cursor height now feeds candidate scoring (`VERTICAL_AFFINITY_WEIGHT`): point high to build up, point low to build down. This also softens the old stacked-targets ambiguity, since the cursor tracks the surface under the mouse.
- New Admin panel (toolbar button): lists every registered part with its build-menu category, editable via dropdown. Overrides persist in localStorage and re-filter the tabs immediately (e.g. the flat floor can be assigned to ROOFS like the game's Rooftop piece).
- Added `scripts/repro-floor-snap.ts` as a deterministic engine smoke test for the new snap behaviors.
- Known issue (hardware, parked): Shift+Wheel zoom works on MacBook trackpads but not on a Logitech M720; revisit with event logging.

## v2-dev-0014 - 2026-06-11

Game-parity build menu and controls, from Sean's in-game reference screenshots.

- Category tabs mirroring the game's subcategories: ALL, STRUCTURAL, WALLS, WEDGE WALLS, ROOFS, INCLINES, SPECIAL. Parts declare a `menuCategory`; empty tabs render with a "no pieces yet" note. Q/E cycle tabs.
- Build modes cycle with Right Click, in game order minus Repair/Move: Build → Replace → Customize → Demolish. Left Click applies the mode. A side panel shows the active mode like the game's HUD.
- Replace swaps a hovered wall-slot piece for the selected one (wall ↔ door on the same edge), keeping its transform and binding. Non-matching pieces are refused.
- Demolish removes the hovered piece (red highlight); Replace highlights blue. Customize is a stub for future color sets.
- Mouse Wheel cycles pieces within the active tab; Shift+Wheel zooms the camera. Middle Click copies a hovered piece (sets it active); Middle-drag orbits; Left-drag pans.
- B collapses/expands the build menu.
- Z/C (top-level category/set cycling) is reserved until multiple building sets exist.

## v2-dev-0013 - 2026-06-11

Walls and doors flip facing with R.

- Edge snapping previously produced exactly one orientation per support edge (source edge antiparallel to the target edge), so walls and doors were locked to one facing — the door's silver side always faced away from the floor.
- `calculateEdgeSnapTransform` now supports a flipped (parallel) alignment: same segment, part rotated 180°.
- The solver generates both facings for wall-edge parts; the rotation preference (R) chooses between them. Requested 0°/90° keeps the outward facing, 180°/270° flips it.
- Footprint parts (floors/foundations) still get only the outward alignment — the flipped one would overlap the support.

## v2-dev-0012 - 2026-06-11

Preview follows the mouse over placed parts.

- Placed part meshes are now pointer-event targets alongside the ground plane. Previously only the ground was raycast, so hovering over an elevated part computed the cursor from the ground point hidden behind it — previews drifted away from the mouse and picked wrong edges.
- The nearest surface under the mouse wins (event propagation stops at the closest hit), so hovering a foundation top selects edges local to where the mouse actually is.
- Clicking a placed part places the previewed piece, same as clicking the ground.
- No solver, registry, or snapping geometry changes.

## v2-dev-0011 - 2026-06-10

Vertical building system: support surfaces carry elevation.

- Edge anchors now declare per-edge snap channels (`channels`) and source eligibility (`source`), and anchors carry explicit heights.
- Foundations side-snap at the base via `foundation-structure`; their top edges (y = 3.8968) expose `floor-support` and `wall-support`.
- Floor anchors moved to the walking surface, so floors snap flush with whatever supports them: foundation tops, other floors, and wall tops.
- Walls stand on support surfaces (foundation/floor/wall tops) instead of beside foundation sides; the foundation-specific endpoint wall transform was removed.
- Wall top edges expose `floor-support` + `wall-support`: second-story floors and wall stacking work.
- Wall heights snapped to the game's vertical module: standard = foundation height (3.8968), tall = exactly 3 modules (11.69, matching the measured GLB at 11.644).
- Snap proximity and scoring now use XZ distance (the cursor lives on the ground plane; targets can be elevated).
- Wall-run continuation preserves elevation, and wall segment occupancy keys include height.
- Footprint occupancy conflicts now require overlapping vertical ranges, so stacked stories don't collide.
- Known limitation: targets stacked at the same XZ (e.g. a wall top directly above a foundation edge) are disambiguated by distance/rotation scoring only — no explicit story-selection control yet.
- Known limitation: foundations do not stack on foundations yet.

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
