# Dune: Awakening Base Building Planner

## Project Overview

A Three.js/React-Three-Fiber based 3D base building planner for Funcom's "Dune: Awakening" game. Built with Vite + TypeScript.

## Quick Start

```bash
npm install
npm run dev
```

## Role & Expertise

You are an expert base building consultant for this project. You specialize in structural planning—foundations, floors, walls, roofs, and inclines—not decorative elements like lighting, furniture, or deco pieces.

## Building System Fundamentals

The building system uses tessellating geometric shapes based on squares and 60° triangles. This allows for structures ranging from simple rectangular bases to complex rounded, pyramidal, or organic shapes.

**Foundation vs. Floor:** Foundations are the structural grid pieces that establish the building footprint. Floors are the walkable surface layers that sit on top of foundations.

**Key Constants (see types.ts):**
- `UNIT_SIZE = 4` — Base grid unit
- `WALL_HEIGHT = 3` — Full wall height
- `HALF_WALL_HEIGHT = 1.5` — Half wall height
- `FOUNDATION_HEIGHT = 0.2` — Foundation thickness
- `TRIANGLE_APOTHEM` — Center to midpoint of triangle side (~1.15)
- `TRIANGLE_RADIUS` — Center to vertex of triangle (~2.31)
- `CURVE_RADIUS = 4` — Quarter circle radius

---

## Current Implementation

### Building Types (types.ts → BuildingType enum)

**Foundations:**
- SQUARE_FOUNDATION — Standard 4x4 grid unit
- TRIANGLE_FOUNDATION — 60° triangle for angled designs
- INNER_CURVED_CORNER — Convex quarter-circle (4 make a full circle)
- OUTER_CURVED_CORNER — Concave fill piece for squaring off curves

**Walls:**
- WALL — Full height solid wall
- HALF_WALL — Half height wall
- WINDOW_WALL — Wall with window opening
- DOORWAY — Wall with door opening

**Roofs:**
- SQUARE_ROOF — Angled roof for square foundations
- TRIANGLE_ROOF — Conical roof for triangle foundations

**Inclines:**
- STAIRS — 8-step staircase
- RAMP — Smooth inclined surface

### Socket System (utils/geometry.ts)

The snapping system uses typed sockets for smart piece connections:

**Socket Types:**
- `FOUNDATION_EDGE` — Side of foundation, connects to other foundations
- `FOUNDATION_TOP` — Top surface where walls attach
- `WALL_BOTTOM` — Bottom of wall, snaps to foundation tops
- `WALL_SIDE` — Side of wall, connects to adjacent walls
- `WALL_TOP` — Top of wall, roofs snap here
- `ROOF_EDGE` — Edge of roof pieces
- `INCLINE_BOTTOM` / `INCLINE_TOP` — Stairs/ramp connection points

**Compatibility Rules (SOCKET_COMPATIBILITY in types.ts):**
- Foundations snap edge-to-edge
- Walls snap to foundation tops or wall tops
- Roofs snap to wall tops or other roof edges

### File Structure

```
├── App.tsx              # Main app, state management, save/load
├── types.ts             # BuildingType enum, Socket interfaces, constants
├── components/
│   ├── Scene.tsx        # Three.js canvas, BuildingMesh, placement logic
│   └── UI.tsx           # Toolbar, controls, instructions overlay
└── utils/
    └── geometry.ts      # Socket definitions, snapping calculations
```

---

## Not Yet Implemented (Future Work)

### Foundations
- Columns & Pillars (Corner Column, Center Column)

### Walls
- Curved Wall — For curved foundation edges
- Curved Corner Wall
- Triangle Wall variants (Top Left/Right, Bottom Left/Right) — For angled sections
- Archway

### Roofs
- Corner Roof
- Dome Roof
- Angled Roof + Angled Roof Corner + Angled Roof Inwards Corner
- Curved roof pieces (inner/outer matching foundations)
- Inverted/Reversed roof variants

### Inclines
- Half Stairs
- Corner Stairs
- Corner Slopes
- Inverted variants

### Building Sets (Cosmetic Styles)
Different visual styles using the same shapes:
- **Dune Man** — Basic utilitarian (current default)
- **Atreides** — Regal, falcon motifs, wing-like balconies
- **Harkonnen** — Dark, chitinous, menacing, tall slanted walls
- **Observer** — Sleek, rounded aesthetic with unique columns
- **CHOAM** — Industrial/commercial with specialized passageways

---

## Curved Building System Logic

The curved pieces work as a complete system:

1. **Inner Curved Corners** create the circular shape (4 pieces = full circle room)
2. **Outer Curved Corners** fill the gaps to square off the footprint for grid alignment
3. **Curved Walls** (not yet implemented) would enclose the rounded space
4. **Curved Roof pieces** (not yet implemented) would cap with matching geometry

All curved pieces maintain the same grid spacing as standard squares/triangles.

---

## Controls

- **Left Click**: Place structure
- **Right Click**: Demolish structure
- **R**: Rotate preview (45° increments)
- **Middle Mouse Drag**: Orbit camera
- **Right Mouse Drag**: Pan camera

---

## Common Tasks

### Adding a New Building Type

1. Add to `BuildingType` enum in `types.ts`
2. Add socket definitions in `getLocalSockets()` in `geometry.ts`
3. Add geometry/mesh in `BuildingMesh` component in `Scene.tsx`
4. Add UI button in `tools` array in `UI.tsx`
5. Update offset calculations in `Scene.tsx` if needed

### Modifying Snapping Behavior

- Socket positions/normals: `getLocalSockets()` in `geometry.ts`
- Compatibility rules: `SOCKET_COMPATIBILITY` in `types.ts`
- Snap radius/grid: `calculateSnap()` in `geometry.ts`


## Deployment & Build Process

### Production Deployment

The app is deployed on **Cloudflare Pages** with automatic builds from the GitHub repository.

- **Live URL**: https://dune-builder.pages.dev/
- - **Deployment**: Automatic on push to `main` branch
  - - **Build command**: `npm run build`
    - - **Build output**: `dist/` directory
     
      - ### Important: No Import Maps
     
      - As of January 2026, this project migrated from browser-based import maps (aistudiocdn.com) to a standard Vite bundler setup.
     
      - **What this means:**
      - - All dependencies are now managed through npm (`package.json`)
        - - Imports in TypeScript files use standard npm package names (e.g., `@react-three/fiber`)
          - - Vite bundles everything during `npm run build`
            - - The built assets are deployed to Cloudflare Pages
              - - No manual CSS or import map configuration needed in `index.html`
               
                - ### Local Development
               
                - ```bash
                  npm install
                  npm run dev
                  ```

                  ### Production Build

                  ```bash
                  npm run build
                  # Output goes to dist/ directory
                  ```

                  The build process automatically:
                  - Compiles TypeScript to JavaScript
                  - - Bundles all React Three Fiber and Three.js dependencies
                    - - Processes and optimizes CSS (via Tailwind CDN in HTML)
                      - - Generates hashed filenames for cache busting
                        - - Creates a production-ready `dist/` directory
