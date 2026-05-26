# Agent Notes

- Work on V2 unless explicitly asked otherwise.
- Keep V2 isolated under `v2/`.
- Do not make broad architecture changes without a focused prompt.
- Do not commit `.glb` files.
- Do not push unless explicitly asked.
- Keep game-provided assets local-only.
- Do not use GLB bounds, pivots, mesh centers, or `_COL` files as placement truth.
- Treat `_COL` files as reference-only.
- Code, documentation, and config changes can be committed; provided game assets cannot.
- Maintain `v2/version.ts` and `v2/CHANGELOG.md` when changing V2 behavior.
- Run `npm run build` and `npx tsc --noEmit` after code changes.
- Prefer small focused tasks and checkpoint commits.

