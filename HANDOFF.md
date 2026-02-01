# Handoff Notes (2026-01-22)

## Status
- Latest build label: `1.9.0-dev.27`
- Latest commits on `main`:
  - `35be861` Fix curved wall stacking
  - `b9de08b` Remove obsolete debug recording
- Curved wall stacking works now (verified by user).

## Key Changes (high level)
- Curved wall snapping now allows stacking on curved wall tops.
- Curved wall top sockets are `WALL_TOP` (registry), matching stack logic.
- Build label bumped for local refresh (`components/UI.tsx`).

## Files Touched in Latest Fix
- `utils/geometry.ts`
- `data/BuildingRegistry.ts`
- `components/UI.tsx`

## Notes
- `recorded/` is ignored by git; keep for local debugging only.
- Cloudways deployment: use built-in GitHub integration (user preference).

## Open Items
- None currently. If curved snapping regresses, review `getLocalSockets` and
  the curved-wall filtering in `utils/geometry.ts`.
