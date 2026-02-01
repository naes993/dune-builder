import { create } from 'zustand';
import { BuildingData, BuildingType, BuildingSet } from '../types';

interface GameState {
    // State
    buildings: BuildingData[];
    activeType: BuildingType;
    showWireframe: boolean;
    showSocketDebug: boolean;
    is2DMode: boolean;
    isDevMode: boolean;
    interactionMode: 'build' | 'select';
    autoHeight: boolean;      // Auto-snap to socket height when snapping
    manualHeight: boolean;    // Allow arrow key height adjustment
    activeBuildingSet: BuildingSet;  // Current building style/color palette
    controlScheme: 'left-pan' | 'right-orbit';

    // Actions
    setBuildings: (buildings: BuildingData[] | ((prev: BuildingData[]) => BuildingData[])) => void;
    addBuilding: (building: BuildingData) => void;
    removeBuilding: (id: string) => void;
    setActiveType: (type: BuildingType) => void;
    toggleWireframe: () => void;
    toggleSocketDebug: () => void;
    toggle2DMode: () => void;
    setDevMode: (enabled: boolean) => void;
    toggleDevMode: () => void;
    setControlScheme: (scheme: 'left-pan' | 'right-orbit') => void;
    toggleControlScheme: () => void;
    toggleInteractionMode: () => void;
    toggleAutoHeight: () => void;
    toggleManualHeight: () => void;
    setActiveBuildingSet: (set: BuildingSet) => void;
}

const getInitialDevMode = () => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === '1' || params.get('dev') === 'true') return true;
    return localStorage.getItem('devMode') === 'true';
};

const getInitialControlScheme = () => {
    if (typeof window === 'undefined') return 'left-pan';
    const saved = localStorage.getItem('controlScheme');
    return saved === 'right-orbit' ? 'right-orbit' : 'left-pan';
};

export const useGameStore = create<GameState>((set, get) => ({
    // Initial State
    buildings: [],
    activeType: BuildingType.SQUARE_FOUNDATION,
    showWireframe: false,
    showSocketDebug: false,
    is2DMode: false,
    isDevMode: getInitialDevMode(),
    interactionMode: 'build',
    autoHeight: true,
    manualHeight: false,
    activeBuildingSet: BuildingSet.DUNE_MAN,
    controlScheme: getInitialControlScheme(),

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
    setDevMode: (enabled) => {
        set({ isDevMode: enabled });
        if (typeof window !== 'undefined') {
            localStorage.setItem('devMode', String(enabled));
        }
        if (!enabled) {
            set({ showSocketDebug: false, showWireframe: false, is2DMode: false });
        }
    },
    toggleDevMode: () => {
        const next = !get().isDevMode;
        set((state) => ({
            isDevMode: next,
            showSocketDebug: next ? state.showSocketDebug : false,
            showWireframe: next ? state.showWireframe : false,
            is2DMode: next ? state.is2DMode : false,
        }));
        if (typeof window !== 'undefined') {
            localStorage.setItem('devMode', String(next));
        }
    },
    setControlScheme: (scheme) => {
        set({ controlScheme: scheme });
        if (typeof window !== 'undefined') {
            localStorage.setItem('controlScheme', scheme);
        }
    },
    toggleControlScheme: () => {
        const next = get().controlScheme === 'left-pan' ? 'right-orbit' : 'left-pan';
        set({ controlScheme: next });
        if (typeof window !== 'undefined') {
            localStorage.setItem('controlScheme', next);
        }
    },
    toggleInteractionMode: () => set((state) => ({
        interactionMode: state.interactionMode === 'build' ? 'select' : 'build'
    })),
    toggleAutoHeight: () => set((state) => ({
        autoHeight: !state.autoHeight,
        manualHeight: state.autoHeight ? true : false  // Turn on manual when turning off auto
    })),
    toggleManualHeight: () => set((state) => ({
        manualHeight: !state.manualHeight,
        autoHeight: state.manualHeight ? true : false  // Turn on auto when turning off manual
    })),
    setActiveBuildingSet: (buildingSet) => set({ activeBuildingSet: buildingSet }),
}));

// Expose store for debugging in browser console
if (typeof window !== 'undefined') {
    (window as any).gameStore = useGameStore;
}
