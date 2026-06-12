import { create } from 'zustand';
import { MenuCategory, PartId, PartInstance, PlacementCandidate } from '../types';
import { PARTS } from '../registry/parts';
import { nearestAllowedRotation } from '../engine/anchors';

export type BuildMode = 'build' | 'replace' | 'customize' | 'demolish';
// Right click cycles through these, like the game (Repair/Move intentionally omitted).
export const BUILD_MODES: BuildMode[] = ['build', 'replace', 'customize', 'demolish'];

export type MenuTab = 'all' | MenuCategory;
export const MENU_TABS: MenuTab[] = ['all', 'structural', 'walls', 'wedge-walls', 'roofs', 'inclines', 'special'];

export const getTabParts = (tab: MenuTab): PartId[] => {
  return Object.values(PARTS)
    .filter((part) => tab === 'all' || part.menuCategory === tab)
    .map((part) => part.id);
};

interface BuilderState {
  instances: PartInstance[];
  activePartId: PartId;
  activeTab: MenuTab;
  buildMode: BuildMode;
  menuExpanded: boolean;
  hoveredInstanceId: string | null;
  debugVisuals: boolean;
  rotationY: number;
  preview: PlacementCandidate | null;
  setActivePartId: (partId: PartId) => void;
  setActiveTab: (tab: MenuTab) => void;
  cycleTab: (direction: 1 | -1) => void;
  cycleActivePart: (direction: 1 | -1) => void;
  cycleBuildMode: () => void;
  toggleMenuExpanded: () => void;
  setHoveredInstance: (instanceId: string | null) => void;
  rotateActivePart: () => void;
  setPreview: (preview: PlacementCandidate | null) => void;
  toggleDebugVisuals: () => void;
  placePreview: () => void;
  demolishInstance: (instanceId: string) => void;
  replaceInstance: (instanceId: string) => void;
  copyPiece: (instanceId: string) => void;
  clear: () => void;
}

export const useV2BuilderStore = create<BuilderState>((set, get) => ({
  instances: [],
  activePartId: 'foundation.harkonnen.level3.square',
  activeTab: 'all',
  buildMode: 'build',
  menuExpanded: true,
  hoveredInstanceId: null,
  debugVisuals: false,
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
    const tabParts = getTabParts(tab);
    if (tabParts.length > 0 && !tabParts.includes(get().activePartId)) {
      get().setActivePartId(tabParts[0]);
    }
  },
  cycleTab: (direction) => {
    const currentIndex = MENU_TABS.indexOf(get().activeTab);
    const nextIndex = (currentIndex + direction + MENU_TABS.length) % MENU_TABS.length;
    get().setActiveTab(MENU_TABS[nextIndex]);
  },
  cycleActivePart: (direction) => {
    const tabParts = getTabParts(get().activeTab);
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
