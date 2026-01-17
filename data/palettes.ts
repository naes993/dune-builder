import { BuildingSet, BuildingPalette } from '../types';

// Color palettes for each building set
export const PALETTES: Record<BuildingSet, BuildingPalette> = {
  [BuildingSet.DUNE_MAN]: {
    foundation: '#7c7c7c',       // Gray
    wallExterior: '#8a6e4b',     // Brown
    wallInterior: '#8a6e4b',     // Same brown (no inside/outside distinction)
    windowWall: '#5a4e3b',       // Darker brown
    windowGlass: '#87CEEB',      // Sky blue
    roof: '#5D4037',             // Dark brown
    roofTrim: '#4e3b2e',         // Very dark brown
    incline: '#6d5e4d',          // Medium brown
  },
  [BuildingSet.HARKONNEN]: {
    foundation: '#2a2a2a',       // Dark grey
    wallExterior: '#1a1a1a',     // Black
    wallInterior: '#8c8c8c',     // Silver/grey
    windowWall: '#0d0d0d',       // Near black
    windowGlass: '#4a5568',      // Dark blue-grey glass
    roof: '#1f1f1f',             // Very dark grey
    roofTrim: '#0a0a0a',         // Almost black
    incline: '#2d2d2d',          // Dark grey
  },
};
