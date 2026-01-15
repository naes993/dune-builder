import { create } from 'zustand';
import { BuildingData, BuildingType } from '../types';

interface GameState {
    // State
    buildings: BuildingData[];
    activeType: BuildingType;
    showWireframe: boolean;
    showSocketDebug: boolean;
    is2DMode: boolean;

    // Actions
    setBuildings: (buildings: BuildingData[] | ((prev: BuildingData[]) => BuildingData[])) => void;
    addBuilding: (building: BuildingData) => void;
    removeBuilding: (id: string) => void;
    setActiveType: (type: BuildingType) => void;
    toggleWireframe: () => void;
    toggleSocketDebug: () => void;
    toggle2DMode: () => void;
}

export const useGameStore = create<GameState>((set) => ({
    // Initial State
    buildings: [],
    activeType: BuildingType.SQUARE_FOUNDATION,
    showWireframe: false,
    showSocketDebug: false,
    is2DMode: false,

    // Actions
    setBuildings: (buildings) => set((state) => ({
        buildings: typeof buildings === 'function' ? buildings(state.buildings) : buildings
    })),

    addBuilding: (building) => set((state) => ({
        buildings: [...state.buildings, building]
    })),

    removeBuilding: (id) => set((state) => ({
        buildings: state.buildings.filter((b) => b.id !== id)
    })),

    setActiveType: (type) => set({ activeType: type }),
    toggleWireframe: () => set((state) => ({ showWireframe: !state.showWireframe })),
    toggleSocketDebug: () => set((state) => ({ showSocketDebug: !state.showSocketDebug })),
    toggle2DMode: () => set((state) => ({ is2DMode: !state.is2DMode })),
}));
