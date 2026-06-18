# Handoff: Deploy the V2 Base Builder

Audience: any model/agent (Codex etc.) picking this up to publish the V2 builder.
State as of 2026-06-18, checkpoint `v2-dev-0040`, branch `v2-builder-engine-prototype`.
(Authoritative current build: `v2/version.ts` + the top of `v2/CHANGELOG.md`.)

> If you are an agent reading `AGENTS.md`, this file (`HANDOFF.md`) is the deploy
> procedure; `CLAUDE.md` + `ROADMAP.md` describe current state and plans.

## What this is

A connection-first 3D base building planner (Vite + React Three Fiber + TypeScript). The
app entry is `/index.tsx` at the repo root (no `src/` folder); the V2 engine lives under
`v2/`. Read `CLAUDE.md` and `AGENTS.md` before changing anything; `v2/CHANGELOG.md` has
the full history.

## CRITICAL: game assets are local-only

`public/assets/**/*.glb` (92 Harkonnen GLB files) are **gitignored on purpose** — they
were provided by the game developer and must never be committed or pushed to any repo,
public or private. Consequences:

- **A git-connected Cloudflare Pages build will produce a site with NO building pieces.**
  The build "succeeds" but every part is missing its model.
- The only correct deploys are (a) a locally built `dist/` uploaded directly, or
  (b) code from git + assets served from external storage (Cloudflare R2).

`npm run build` copies `public/` into `dist/`, so a **local** build contains the GLBs.

## Deployment plan (decided with Sean)

1. **New Cloudflare Pages project, separate from v1.** Do NOT touch the existing
   `dune-builder.pages.dev` project — live v1 users depend on it.
2. **Method: direct upload.**
   ```bash
   npm install
   npx tsc --noEmit          # must pass
   npm run build             # dist/ now includes the GLBs from public/
   ~/.npm-global/bin/netlify --version 2>/dev/null  # (Netlify creds exist but we're using Cloudflare)
   npx wrangler pages project create <NEW_NAME>     # once
   npx wrangler pages deploy dist --project-name <NEW_NAME>
   ```
   Wrangler will prompt for Cloudflare auth on first use (`npx wrangler login`).
3. **Later upgrade (optional, not now):** create a GitHub repo for the code, connect it
   to Cloudflare Pages, and move the GLBs to a Cloudflare R2 bucket; introduce an env
   var (e.g. `VITE_ASSET_BASE`) used as the prefix for `/assets/parts/...` URLs in
   `v2/registry/parts.ts` / `v2/scene/PartMesh.tsx`. Until that exists, git-connected
   builds are broken by design — don't wire them up.

## Repo/branch state — read before pushing anything

- All current work is on `v2-builder-engine-prototype`. `main` is months stale
  (pre-V2-promotion) and tracks `origin/main`.
- `.github/workflows/deploy.yml` deploys **GitHub Pages from `main` on push**. That
  deployment has no GLBs either. If you push `main`, you may publish a stale/broken
  site. Either leave `main` alone, or if Sean asks to consolidate: merge the prototype
  branch into `main` AND delete/disable the workflow in the same change.
- A rename of the project is planned (game-agnostic branding). If you create a new
  GitHub repo, prefer the new name and import this branch's history.

## Validation before any deploy

```bash
npx tsc --noEmit && npm run build
ls dist/assets/parts/harkonnen/*.glb | wc -l   # must be ~92, NOT zero
```

Smoke test the built site (`npx vite preview` or the deployed URL): place a Foundation,
snap a Floor to a foundation edge (it must sit flush with the foundation TOP), stand a
Wall on it (R flips its facing), and from the Inclines tab snap a Stairs/Ramp to a
foundation edge so it descends to the ground. Controls reference is in `v2/README.md`.

## House rules (from AGENTS.md)

- Never commit `.glb` files. Run `npx tsc --noEmit` + `npm run build` after changes.
- Update `v2/version.ts` + `v2/CHANGELOG.md` for any behavior change.
- Small focused commits; do not push unless Sean asks.
