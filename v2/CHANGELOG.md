# V2 Changelog

## v2-dev-0027 - 2026-06-14

Added: incline-to-incline snapping — wide staircases and sloped surfaces.

- New `incline-edge` snap channel (`v2/types.ts`). Incline anchors (`v2/registry/parts.ts`) now expose all four edges on this channel: the horizontal high/low edges (length = UNIT) and the two inclined side edges (length = hypotenuse). Differing edge lengths keep the two use cases from cross-matching.
- **Side-by-side:** an incline's side edge mates with another incline's side edge, placing them flush (e.g. two stairs → a double-wide staircase).
- **Sloped surfaces / climbing runs:** an incline's low edge mates with another's high edge (and vice-versa), so stairs/ramps tile edge-to-edge into a continuous slope — sloped roofs/ceilings and multi-tile climbs, as in the reference bases.
- Inclines now source on `['incline-edge', 'floor-support']` and target on `['floor-support', 'wall-support', 'incline-edge']`. The high edge keeps `floor-support`, so descending off a foundation/floor edge still works (verified: 55 foundation-edge snaps, no regression).
- Verified in-browser: side-by-side stairs sit flush; three ramps tile into one seamless slope; descend-from-foundation unaffected.

## v2-dev-0026 - 2026-06-14

Added: inclines (stairs & ramps) — first increment — and a public roadmap.

- New `incline` category in the **Inclines** tab: straight Stairs, Half Stairs, Ramp, Half Ramp (`incline.harkonnen.level3.*`). 32 of 92 audited GLBs now registered.
- Measured the GLBs (`scripts/measure-stairs-ramps.mjs` + a one-off climb probe): one-tile footprint, pivot at the base, low end toward +Z and high end toward −Z, rising ~one foundation height (half versions ~half). New `inclineVariant`/`inclineAnchors` in `v2/registry/parts.ts`.
- Snap model (v1): the incline's **high edge** is the connector — it mates with a foundation/floor top edge (`floor-support`) so the incline descends *outward* from a ledge to the ground, oriented correctly. The high edge also exposes support channels for the upper landing, and the low edge is a ground-level floor target. Verified in-browser: stairs and ramps snap to all four foundation top edges and descend to the ground.
- **Known limitations (tracked on the roadmap):** corner stair/ramp variants aren't registered yet; the snap currently connects the *top* edge only (no explicit bottom-up/two-end solve), so a half incline snapped to a full-height foundation top floats from mid-height until a matching lower level exists.
- New top-level `ROADMAP.md` (public): shipped / in-progress / planned features and known issues.

## v2-dev-0025 - 2026-06-14

Fixed: rotating a wall on a foundation corner produced "hugging" placements that buried the wall in the foundation.

- With the cursor on a foundation's bottom corner, pressing R cycled through four placements; two extended a wall outward off the edge (correct — "holding hands"), but two ran the wall back along the foundation's own edge at ground level, passing through its solid block (the "hug").
- **Root cause:** `getOccupancyConflicts` only compares parts on the *same* occupancy layer, so a wall (`wall-edge`) was never tested against a foundation (`foundation` layer). The hugging walls overlapped the foundation block but went undetected and previewed as valid.
- `v2/engine/occupancy.ts` adds `overlapsFoundationBody`: a wall/door is invalid when its footprint overlaps a foundation's footprint *and* their vertical ranges overlap. A wall straddling the foundation's top perimeter sits above the block (no vertical overlap) and stays valid; a wall buried in the block does not. `v2/engine/rules.ts` enforces it in `validatePlacement`.
- Effect: the hugging rotations are now invalid, so the solver picks the valid alternative instead. At a corner, R now cycles exactly the two outward extensions × two facings — flipping facing keeps the wall in place (e.g. the "arrow out" and "arrow in" states share one position). On-top placement and outward runs are unaffected (verified: 336 on-top snaps still valid, 0 false rejections, 0 hugging placements shown).

## v2-dev-0024 - 2026-06-14

Added: walls can continue off a foundation's edges to build outward (fortress walls).

- A foundation is "four walls with a floor on top," so its perimeter corners now act as wall-run anchors, just like real walls. Previously wall-run continuation (`getWallEndpointTargets`) only considered wall-edge parts, so you could only stack walls *onto* a foundation's top — never run a wall *off* it.
- `v2/engine/snapSolver.ts`: `getWallEndpointTargets` now includes foundation perimeter edges. Both the base corners (y≈0) and top corners (y≈foundation height) qualify, so a run can leave the foundation at ground level or along the top.
- Wall-run scoring gained a vertical-affinity term (matching support-edge): with stacked endpoints at the same XZ corner, cursor height picks the level — point low to run the wall off the base, point high to run it off the top.
- Unchanged: walls still stand on a foundation's top edges mid-span (support-edge), wall-to-wall runs chain as before, and foundation-to-foundation adjacency is unaffected (wall-run only applies while placing a wall). Verified in-browser: a wall continues east off a foundation's SE corner at ground level, on-top placement still works mid-edge, and runs chain into a perimeter.

## v2-dev-0023 - 2026-06-14

Fixed: walls would not stand on top of a foundation (couldn't build a tower).

- **Root cause:** for any `wall-support` snap, the solver generated both an upward variant (piece on top of the edge) and a downward one (piece hanging below it). A foundation is a tall solid block, so from a normal camera angle the cursor ray mostly hits its **sides** — a low point — and the solver's cursor-height affinity then chose the *downward* variant, wrapping a wall down the foundation's face at ground level instead of standing it on top.
- The downward "hang below" variant is only meaningful under a **floor** (an overhang/façade with open space beneath). A foundation or wall top has solid structure below it, so a downward wall there just clips the side. `v2/engine/snapSolver.ts` now restricts the downward variant to floor target edges (`targetPart.category === 'floor'`).
- Result: hovering a foundation snaps walls onto its top edges (towers work), wall-on-wall stacking is unchanged (still uses the top-snap catcher from v2-dev-0021), and floor overhangs keep their hang-below option. Verified across cursor sweeps: foundation hovers now produce only on-top snaps (y≈3.9, was y=0), wall-top stacking still reaches y≈7.8, and floor edges still offer both on-top and hang-below placements.

## v2-dev-0022 - 2026-06-14

Added: Admin option to reverse the scroll wheel's roles.

- **What:** a "Reverse scroll wheel" checkbox in the Admin panel (under a new **Controls** section). Default behavior is unchanged — the bare wheel cycles pieces and Shift+Wheel zooms. When enabled, the roles swap: the bare wheel zooms the camera and Shift+Wheel cycles pieces.
- The preference persists per-browser in `localStorage` (`v2.reverseScrollZoom`), mirroring how category overrides are stored.
- Implementation: `v2/store/builderStore.ts` holds `reverseScrollZoom` + `toggleReverseScrollZoom`; the wheel handler in `v2/scene/BuilderCanvas.tsx` cycles only when `event.shiftKey === reverseScrollZoom`, and `OrbitControls.enableZoom` is gated on the opposite gesture. The on-screen controls hint updates to match the active mode.

## v2-dev-0021 - 2026-06-14

Fixed: toggling Debug changed where pieces snapped; wall tops are now targetable without it.

- **Root cause:** the placement cursor is the point under the mouse, and the solver uses its height to choose between vertically-stacked snap targets ("point high to build up"). The debug overlays — anchor lines, footprint outlines, wall-endpoint spheres, and the per-part `BoxHelper` bounds — were **raycastable and rendered inside the instance pointer-handler groups**. With Debug on, the cursor ray hit a debug object at the wall *top* and reported a high point, snapping pieces onto the top; the ghost's `BoxHelper` (no handler) also shadowed real geometry and forced free-ground. With Debug off, none of that existed, so the cursor sailed past the thin wall top to the ground behind. Result: the same cursor produced different placements depending on Debug.
- Debug is now strictly observe-only: instance and preview overlays render through a `NonRaycastableGroup` (outside the pointer-handler groups, raycasting disabled on the whole subtree), and the `BoxHelper` in `PartMesh` has its `raycast` disabled at creation. Verified: across 672 cursor samples, Debug on vs off now produce **identical** placement results.
- **New `TopSnapCatcher`** (`v2/scene/BuilderCanvas.tsx`): an invisible, raycastable box sitting just above each wall's top edge, inside the instance pointer group. It gives "place on top of this wall" a real surface to hit, so wall tops are reliably targetable without the debug markers that previously enabled it by accident. Capped at one foundation-height tall; only added to `wall-edge` parts (foundations already expose a flat top face). Verified: wall-top snaps are now reachable identically with Debug on or off (207/207 sample hits).

## v2-dev-0020 - 2026-06-14

Fixed: newly-added parts (wedge walls) appeared to "snap wrong" until a click.

- **Root cause:** only the original 9 parts' GLBs were in `useGLTF.preload`. Selecting any other part (e.g. a wedge wall) triggered a first-time GLB load that *suspended* the ghost mesh. With no `<Suspense>` boundary around the scene, the whole interactive subtree — including the ground plane that owns the placement pointer handlers — froze for the duration of the load, leaving the ghost stuck at a stale/wrong snap. The preview only corrected when something forced a re-render/commit (e.g. toggling Debug), which is why a click "fixed" it but a hover did not, and why it never affected the preloaded straight wall.
- `v2/scene/PartMesh.tsx`: preload **every** GLB referenced by the registry (loop over `PARTS`), replacing the hardcoded 9-file list. New parts are now covered automatically.
- `v2/scene/BuilderCanvas.tsx`: wrapped placed instances + the ghost preview in a `<Suspense fallback={null}>` that excludes the ground plane, so any future first-time load suspends only the meshes and can never freeze cursor-driven preview updates again.
- Verified in-browser: a freshly-selected wedge now tracks the cursor live and its preview settles immediately with no input — previously it flipped ~100ms later when the GLB finished loading.

## v2-dev-0019 - 2026-06-12

19 new wall-family pieces wired into the registry (9 → 28 buildable parts).

- Straight wall styles 2-5 (`Wall_02`-`Wall_05`), Half Wall, Window Wall, and Window Wall (Glazed — Window + WindowGlass assembly, same pattern as the door) in the Walls tab.
- All 12 wedge walls (Bottom/Top × Left/Right × standard/half/tall) in the Wedge Walls tab. Bottom (sloped-top) pieces expose no flat top edge to build on; Top pieces keep the standard wall-top support edge.
- New `wallVariant` registry factory: variants share Wall_01's placement truth (wall slab footprint, base-center pivot, edge anchors); only GLB, height, and top-edge exposure differ. Decorative protrusions on Wall_02-04/Window stay visual-only.
- Half pieces use `V2_FOUNDATION_HEIGHT / 2`, tall pieces the existing 3-module tall height — pivots and heights confirmed against the GLBs via new `scripts/measure-wall-variants.mjs`.

## v2-dev-0018 - 2026-06-12

Part-category organization can be published to all users.

- New committed layer `v2/registry/categoryMaster.ts`: the master build-menu organization, shipped with the app. Category resolution is now local Admin edits (localStorage) > master > the part's `menuCategory` default in `parts.ts`.
- Admin panel gains a "Copy Master JSON" button that copies the full effective part → category mapping. Pasting it into `categoryMaster.ts` (or handing it to the agent) and deploying makes the arrangement the default for every user — the app is a static site with no backend, so the deploy is the distribution mechanism.
- Local Admin edits still save to the browser immediately and persist across sessions; the asterisk now marks divergence from the shipped master rather than from `parts.ts`.

## v2-dev-0017 - 2026-06-12

Facing indicator on wall/door ghost previews.

- Wall and door previews now show an orange arrow pointing outward from the outer (`_Ext`) face, plus a faint orange tint plane over the inner (`_Int`) face — mirroring the game's orange banding. No text labels by design.
- The indicator renders in part-local space, so it flips with the preview when R flips facing, and it tracks every placement mode (support-edge, wall-run, free ground).
- Preview-only: placed pieces never show the indicator. Corners are excluded (square footprint, no single facing).
- Outer face = part-local +Z, confirmed by measuring the `_Ext`/`_Int` primitive Z ranges in the wall/door GLBs (`scripts/inspect-facing.mjs`, new inspection tool).

## v2-dev-0016 - 2026-06-11

Floors attach on either side of wall edges.

- The solver now generates both edge alignments (outward and flipped) for every part, not just walls/doors. Floors previously could only attach to one side of a wall's top/bottom edge — the "silver side" refused floors.
- The cursor's XZ side picks which alignment wins; occupancy validation rejects flipped placements that would overlap their own support (e.g. floor onto its supporting foundation cell), so footprint parts behave as before everywhere else.
- New capability fallout: inner ceilings — a floor can snap to a wall top extending inward over the room.
- Extended `scripts/repro-floor-snap.ts` with lone-wall both-sides probes.

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
