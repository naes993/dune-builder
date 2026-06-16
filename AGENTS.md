# Agent Notes

> **Read this first.** Tools that auto-load `AGENTS.md` (e.g. Codex) start here.
> - **Deploying / uploading the site?** Follow `HANDOFF.md` — it is the authoritative
>   deploy procedure.
> - **Current state & plans:** `CLAUDE.md` (architecture + conventions), `ROADMAP.md`
>   (shipped / planned / known issues), `v2/CHANGELOG.md` (per-build history).
> - Current checkpoint: `v2-dev-0035` on branch `v2-builder-engine-prototype`.
>   **Authoritative source for the current build is `v2/version.ts` and the _top_
>   entry of `v2/CHANGELOG.md`** — if this line ever disagrees, trust those. Do not
>   read an old changelog entry as the current version.

## CRITICAL — game assets are local-only

`public/assets/**/*.glb` (the 92 Harkonnen models) are **gitignored on purpose** and
must never be committed or pushed. A git-connected deploy therefore builds a site with
**no building models**. The only correct deploy is a **local** `npm run build` (which
copies the GLBs into `dist/`) uploaded directly — see `HANDOFF.md`. Verify before any
deploy: `ls dist/assets/parts/harkonnen/*.glb | wc -l` should be ~92, not 0.

## House rules

- Work on V2 unless explicitly asked otherwise; keep V2 isolated under `v2/`.
- Do not make broad architecture changes without a focused prompt.
- Do not commit `.glb` files; keep game-provided assets local-only. Code,
  documentation, and config changes can be committed; provided game assets cannot.
- Do not push unless explicitly asked (an explicit deploy/upload request counts).
- Do not use GLB bounds, pivots, mesh centers, or `_COL` files as placement truth;
  treat `_COL` files as reference-only. Placement truth lives in `v2/registry/parts.ts`
  and `v2/engine/`.
- Maintain `v2/version.ts` and `v2/CHANGELOG.md` when changing V2 behavior; keep
  `ROADMAP.md` in sync when shipping or planning roadmap items.
- Run `npm run build` and `npx tsc --noEmit` after code changes.
- Prefer small focused tasks and checkpoint commits.
