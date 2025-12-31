# Dune: Awakening Base Building Planner

A 3D base building planner for Funcom's "Dune: Awakening" game, built with Three.js, React Three Fiber, and TypeScript.

## Features

- **Foundation pieces**: Square, triangle, and curved corners for flexible base layouts
- **Walls**: Full walls, half walls, windows, and doorways
- **Roofs & Inclines**: Square/triangle roofs, stairs, and ramps
- **Smart snapping**: Socket-based system for precise piece placement
- **Save/Load**: Quick save to browser storage
- **Export/Import**: Share blueprints as JSON files

## Quick Start

```bash
npm install
npm run dev
```

## Controls

- **Left Click**: Place structure
- **Right Click**: Demolish structure
- **R**: Rotate preview (45° increments)
- **Middle Mouse Drag**: Orbit camera
- **Right Mouse Drag**: Pan camera

## Building System

The building system uses tessellating geometric shapes based on squares and 60° triangles, allowing for structures ranging from simple rectangular bases to complex rounded, pyramidal, or organic shapes.

## License

MIT
