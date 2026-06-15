import { MenuCategory, PartId } from '../types';

/**
 * Master build-menu organization, shipped to every user of the builder.
 *
 * This is the committed source of truth for which tab each part appears in,
 * layered over the per-part `menuCategory` defaults in `parts.ts`. Local Admin
 * panel edits (localStorage) layer on top of THIS for experimentation only.
 *
 * To publish a new organization: open Admin · Part Registry, arrange the
 * categories, press "Copy Master JSON", and paste the result into this object
 * (or hand it to the agent to commit). The next deploy makes it the default
 * for everyone.
 */
export const CATEGORY_MASTER: Partial<Record<PartId, MenuCategory>> = {
  // The flat floor and flat rooftop sit side by side under ROOFS in-game.
  'floor.harkonnen.level3.square': 'roofs',
  'floor.harkonnen.level3.wedge': 'roofs',
};
