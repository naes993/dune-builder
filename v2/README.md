# V2 Builder Prototype

Current V2 build: `v2-dev-0027`

Description: Incline-to-incline snapping — stairs/ramps snap side-by-side into wide staircases and tile edge-to-edge into sloped roofs/ceilings. See `v2/CHANGELOG.md` for full history and `ROADMAP.md` for what's planned.

## Checkpoint Summary

A connection-first placement engine with vertical building. There is no world grid: the first placed piece establishes the build grid, exactly like the game. Placement priority is:

1. Connection snap target if available (wall-run, then support-edge).
2. Free ground placement at the cursor otherwise.

The buildable parts are the real Harkonnen Level 3 floor/foundation squares and wedges plus the wall/door batch. The generic placeholder square/triangle foundations are removed.

Logical vertical dimensions are calibrated from measured GLBs (`scripts/measure-core-parts.mjs`):

- Floor slab: 0.3735 thick, GLB pivot at the walking surface.
- Foundation block: 3.8968 tall, GLB pivot at the base.
- Wedge GLB pivots sit at the triangle centroid with the base toward +Z, matching the registry's equilateral anchors (side = `V2_UNIT_SIZE`) within visual overhang tolerance.

Edge relationships are separated by channel, and every edge declares which channels it exposes and its height:

- `foundation-structure`: foundation base edges, for flush side-to-side foundation adjacency on the ground.
- `floor-support`: exposed by foundation tops, floor walking surfaces, and wall tops. Floors snap so their walking surface stays flush with the support surface.
- `wall-support`: exposed by the same support surfaces. Walls stand on top of foundations, floors, and other walls.

Vertical building works through these elevation-aware anchors: floors snap flush with foundation tops, walls stand on supports, and second-story floors snap to wall tops. Wall heights follow the game's vertical module (standard = foundation height 3.8968; tall = 3 modules). Footprint occupancy is vertical-range aware, so stacked stories do not collide. Snap proximity is evaluated in XZ because the cursor lives on the ground plane.

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
- Wall-run continuation from existing wall endpoints **and foundation perimeter corners** (build walls outward off a foundation at ground or top level).
- Full wall family registered: straight styles 1–5, half wall, windows, all 12 wedge walls, tall corner, inclined tall, door assembly (28 of 92 audited GLBs).
- Walls reject placements that pass through a foundation's solid block; an invisible top-snap catcher makes "build on top" reliable.
- Invalid overlap preview.
- Material-name mapping for `_Ext` and `_Int`; facing indicator (outward arrow + inner-face tint) on wall/door ghosts.
- R rotates the preview, including snapped previews (rotation-preference tie-break in the solver); flips facing in place when snapped.
- All part GLBs preloaded behind a Suspense boundary, so first-time part selection never freezes the preview.
- Separate Debug helper (observe-only — never affects placement).
- Harkonnen asset audit and manifest; committed master category organization with Admin overrides.

## Controls (game parity)

- **Left Click** — apply the current build mode (place / replace / demolish).
- **Right Click** — cycle build mode: Build → Replace → Customize → Demolish.
- **R** — rotate the preview (flips wall/door facing when snapped).
- **Q / E** — previous / next category tab.
- **Mouse Wheel** — cycle pieces in the active tab; **Shift+Wheel** zooms the camera. (Admin "Reverse scroll wheel" swaps these two roles.)
- **Middle Click** — copy a hovered piece (makes it the active piece).
- **Middle-drag** — orbit camera; **Left-drag** — pan camera.
- **B** — collapse/expand the build menu.
- **Z / C** — reserved for building-set cycling once multiple sets exist.

## Placement Testing

Use the in-app browser, Browser plugin, or Chrome for interactive placement testing. For the current local preview, open:

```text
http://127.0.0.1:3000/
```

Expected smoke checks:

- First-piece placement on open ground stays at the cursor location (no grid rounding).
- Floor placement near a foundation edge previews elevated, walking surface flush with the foundation top.
- Floor placement near another floor edge continues at the same elevation.
- Wall placement near a foundation or floor stands on the support surface (wall base at the support top).
- A floor near a placed wall snaps to the wall top (second story).
- Foundation placement near a foundation edge snaps flush at ground level (structural channel).
- Wall continuation near a wall endpoint prefers the wall-run target and preserves elevation.
- Pressing R cycles the preview orientation; snapped previews keep the snap while honoring the nearest valid orientation.
- Debug visuals work independently.

## Known Limitations

- Targets stacked at the same XZ are disambiguated by cursor height plus the top-snap catcher; there is still no *explicit* story-selection control, and right at the foundation-top height the ground/top choice can be ambiguous.
- Foundations do not stack on foundations yet.
- The wedge-wall facing tint is still a rectangle (overshoots the sloped top).
- There is no final Part Builder yet.
- There is no final V2 save/export system yet.
- There is no full roof, stair, or curve system yet (GLBs audited, not registered).

## Next Recommended Task

Register the next part group (roofs or stairs/ramps), or add an explicit story-selection control for stacked snap targets and foundation-on-foundation stacking.
