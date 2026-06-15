import { create } from 'zustand';
import { MenuCategory, PartId, PartInstance, PlacementCandidate } from '../types';
import { PARTS } from '../registry/parts';
import { CATEGORY_MASTER } from '../registry/categoryMaster';
import { nearestAllowedRotation } from '../engine/anchors';

export type BuildMode = 'build' | 'replace' | 'customize' | 'demolish';
// Right click cycles through these, like the game (Repair/Move intentionally omitted).
export const BUILD_MODES: BuildMode[] = ['build', 'replace', 'customize', 'demolish'];

export type MenuTab = 'all' | MenuCategory;
export const MENU_TABS: MenuTab[] = ['structural', 'walls', 'wedge-walls', 'roofs', 'inclines', 'special', 'all'];

export type CategoryOverrides = Partial<Record<PartId, MenuCategory>>;

// Ground-plane appearance. All variants are baked once into a single canvas
// texture (no image assets, no shadows) — constant cost regardless of build size.
export type GroundStyle = 'flat' | 'gradient' | 'gradient-focused' | 'grain';
export const GROUND_STYLES: GroundStyle[] = ['flat', 'gradient', 'gradient-focused', 'grain'];

const OVERRIDES_STORAGE_KEY = 'v2.categoryOverrides';
const REVERSE_SCROLL_ZOOM_STORAGE_KEY = 'v2.reverseScrollZoom';
const GROUND_STYLE_STORAGE_KEY = 'v2.groundStyle';

const loadCategoryOverrides = (): CategoryOverrides => {
  try {
    return JSON.parse(window.localStorage.getItem(OVERRIDES_STORAGE_KEY) ?? '{}');
  } catch {
    return {};
  }
};

const loadReverseScrollZoom = (): boolean => {
  // Default ON: the bare wheel zooms the camera (Shift+Wheel cycles pieces).
  // Only an explicit opt-out persisted as 'false' restores the classic mapping.
  try {
    return window.localStorage.getItem(REVERSE_SCROLL_ZOOM_STORAGE_KEY) !== 'false';
  } catch {
    return true;
  }
};

const loadGroundStyle = (): GroundStyle => {
  try {
    const stored = window.localStorage.getItem(GROUND_STYLE_STORAGE_KEY);
    return GROUND_STYLES.includes(stored as GroundStyle) ? (stored as GroundStyle) : 'gradient';
  } catch {
    return 'gradient';
  }
};

/**
 * Category resolution order: local Admin edits (localStorage) > committed
 * master organization (`categoryMaster.ts`, ships to everyone) > the part's
 * own default in `parts.ts`.
 */
export const getDefaultPartCategory = (partId: PartId): MenuCategory => {
  return CATEGORY_MASTER[partId] ?? PARTS[partId].menuCategory;
};

export const getPartCategory = (partId: PartId, overrides: CategoryOverrides): MenuCategory => {
  return overrides[partId] ?? getDefaultPartCategory(partId);
};

/** Full effective part → category mapping, for the Admin panel's master export. */
export const getEffectiveCategoryMap = (overrides: CategoryOverrides): Record<PartId, MenuCategory> => {
  return Object.fromEntries(
    Object.values(PARTS).map((part) => [part.id, getPartCategory(part.id, overrides)])
  ) as Record<PartId, MenuCategory>;
};

export const getTabParts = (tab: MenuTab, overrides: CategoryOverrides): PartId[] => {
  return Object.values(PARTS)
    .filter((part) => tab === 'all' || getPartCategory(part.id, overrides) === tab)
    .map((part) => part.id);
};

interface BuilderState {
  instances: PartInstance[];
  activePartId: PartId;
  activeTab: MenuTab;
  buildMode: BuildMode;
  menuExpanded: boolean;
  settingsOpen: boolean;
  reverseScrollZoom: boolean;
  groundStyle: GroundStyle;
  categoryOverrides: CategoryOverrides;
  hoveredInstanceId: string | null;
  debugVisuals: boolean;
  /** Debug + Admin controls are hidden until the secret button combo is entered. */
  controlsUnlocked: boolean;
  rotationY: number;
  preview: PlacementCandidate | null;
  setActivePartId: (partId: PartId) => void;
  setActiveTab: (tab: MenuTab) => void;
  toggleSettings: () => void;
  toggleReverseScrollZoom: () => void;
  setGroundStyle: (style: GroundStyle) => void;
  setCategoryOverride: (partId: PartId, category: MenuCategory | null) => void;
  cycleTab: (direction: 1 | -1) => void;
  cycleActivePart: (direction: 1 | -1) => void;
  cycleBuildMode: () => void;
  toggleMenuExpanded: () => void;
  setHoveredInstance: (instanceId: string | null) => void;
  rotateActivePart: () => void;
  setPreview: (preview: PlacementCandidate | null) => void;
  toggleDebugVisuals: () => void;
  unlockControls: () => void;
  placePreview: () => void;
  demolishInstance: (instanceId: string) => void;
  replaceInstance: (instanceId: string) => void;
  copyPiece: (instanceId: string) => void;
  clear: () => void;
}

export const useV2BuilderStore = create<BuilderState>((set, get) => ({
  instances: [],
  activePartId: 'foundation.harkonnen.level3.square',
  activeTab: 'structural',
  buildMode: 'build',
  menuExpanded: true,
  settingsOpen: false,
  reverseScrollZoom: loadReverseScrollZoom(),
  groundStyle: loadGroundStyle(),
  categoryOverrides: loadCategoryOverrides(),
  hoveredInstanceId: null,
  debugVisuals: false,
  controlsUnlocked: false,
  rotationY: 0,
  preview: null,
  setActivePartId: (partId) => {
    const part = PARTS[partId];
    set((state) => ({
      activePartId: partId,
      rotationY: nearestAllowedRotation(state.rotationY, part.allowedRotations),
      preview: null,
    }));
  },
  setActiveTab: (tab) => {
    set({ activeTab: tab });
    const tabParts = getTabParts(tab, get().categoryOverrides);
    if (tabParts.length > 0 && !tabParts.includes(get().activePartId)) {
      get().setActivePartId(tabParts[0]);
    }
  },
  toggleSettings: () => set((state) => ({ settingsOpen: !state.settingsOpen })),
  toggleReverseScrollZoom: () => {
    const next = !get().reverseScrollZoom;
    try {
      window.localStorage.setItem(REVERSE_SCROLL_ZOOM_STORAGE_KEY, String(next));
    } catch {
      // localStorage unavailable; setting stays session-only.
    }
    set({ reverseScrollZoom: next });
  },
  setGroundStyle: (style) => {
    try {
      window.localStorage.setItem(GROUND_STYLE_STORAGE_KEY, style);
    } catch {
      // localStorage unavailable; setting stays session-only.
    }
    set({ groundStyle: style });
  },
  setCategoryOverride: (partId, category) => {
    const overrides = { ...get().categoryOverrides };
    if (category === null || category === getDefaultPartCategory(partId)) {
      delete overrides[partId];
    } else {
      overrides[partId] = category;
    }
    try {
      window.localStorage.setItem(OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    } catch {
      // localStorage unavailable; overrides stay session-only.
    }
    set({ categoryOverrides: overrides });
  },
  cycleTab: (direction) => {
    const currentIndex = MENU_TABS.indexOf(get().activeTab);
    const nextIndex = (currentIndex + direction + MENU_TABS.length) % MENU_TABS.length;
    get().setActiveTab(MENU_TABS[nextIndex]);
  },
  cycleActivePart: (direction) => {
    const tabParts = getTabParts(get().activeTab, get().categoryOverrides);
    if (tabParts.length === 0) return;
    const currentIndex = tabParts.indexOf(get().activePartId);
    const nextIndex = currentIndex < 0 ? 0 : (currentIndex + direction + tabParts.length) % tabParts.length;
    get().setActivePartId(tabParts[nextIndex]);
  },
  cycleBuildMode: () => {
    const nextIndex = (BUILD_MODES.indexOf(get().buildMode) + 1) % BUILD_MODES.length;
    set({ buildMode: BUILD_MODES[nextIndex] });
  },
  toggleMenuExpanded: () => set((state) => ({ menuExpanded: !state.menuExpanded })),
  setHoveredInstance: (instanceId) => {
    if (get().hoveredInstanceId !== instanceId) set({ hoveredInstanceId: instanceId });
  },
  rotateActivePart: () => {
    const { activePartId, rotationY } = get();
    const part = PARTS[activePartId];
    const currentRotation = nearestAllowedRotation(rotationY, part.allowedRotations);
    const currentIndex = part.allowedRotations.findIndex((rotation) => Math.abs(currentRotation - rotation) < 0.001);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % part.allowedRotations.length : 0;
    set({ rotationY: part.allowedRotations[nextIndex] });
  },
  setPreview: (preview) => set({ preview }),
  toggleDebugVisuals: () => set((state) => ({ debugVisuals: !state.debugVisuals })),
  unlockControls: () => set({ controlsUnlocked: true }),
  placePreview: () => {
    const { activePartId, preview } = get();
    if (!preview?.isValid) return;

    set((state) => ({
      instances: [
        ...state.instances,
        {
          id: crypto.randomUUID(),
          partId: activePartId,
          transform: preview.transform,
          binding: preview.binding,
        },
      ],
    }));
  },
  demolishInstance: (instanceId) => {
    set((state) => ({
      instances: state.instances.filter((instance) => instance.id !== instanceId),
      hoveredInstanceId: state.hoveredInstanceId === instanceId ? null : state.hoveredInstanceId,
    }));
  },
  replaceInstance: (instanceId) => {
    const { activePartId, instances } = get();
    const instance = instances.find((entry) => entry.id === instanceId);
    if (!instance || instance.partId === activePartId) return;

    const existingPart = PARTS[instance.partId];
    const activePart = PARTS[activePartId];
    // Only matching slots swap, like the game (wall <-> door on the same edge).
    if (existingPart.occupancyLayer !== 'wall-edge' || activePart.occupancyLayer !== 'wall-edge') return;
    if (Math.abs(existingPart.height - activePart.height) > 0.001) return;

    set((state) => ({
      instances: state.instances.map((entry) =>
        entry.id === instanceId ? { ...entry, partId: activePartId } : entry
      ),
    }));
  },
  copyPiece: (instanceId) => {
    const instance = get().instances.find((entry) => entry.id === instanceId);
    if (!instance) return;
    get().setActivePartId(instance.partId);
  },
  clear: () => set({ instances: [], preview: null, hoveredInstanceId: null }),
}));
