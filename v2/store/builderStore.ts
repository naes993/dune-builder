import { create } from 'zustand';
import { PartId, PartInstance, PlacementCandidate } from '../types';
import { PARTS } from '../registry/parts';
import { nearestAllowedRotation } from '../engine/anchors';

interface BuilderState {
  instances: PartInstance[];
  activePartId: PartId;
  debugVisuals: boolean;
  rotationY: number;
  preview: PlacementCandidate | null;
  setActivePartId: (partId: PartId) => void;
  rotateActivePart: () => void;
  setPreview: (preview: PlacementCandidate | null) => void;
  toggleDebugVisuals: () => void;
  placePreview: () => void;
  clear: () => void;
}

export const useV2BuilderStore = create<BuilderState>((set, get) => ({
  instances: [],
  activePartId: 'foundation.harkonnen.level3.square',
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
  clear: () => set({ instances: [], preview: null }),
}));
