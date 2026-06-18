import React, { useEffect, useRef, useState } from 'react';
import { GameScene } from './components/Scene';
import UI, { Instructions, DebugRecorderUI } from './components/UI';
import { BuildingType, BuildingData, SavedBlueprint } from './types';
import { useDebugRecorder } from './hooks/useDebugRecorder';
import { useGameStore } from './store/gameStore';

const BLUEPRINT_VERSION = 1;
const V2_URL = 'https://arx-studio.pages.dev/';

export default function App() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showV2Notice, setShowV2Notice] = useState(true);

  // Debug recorder
  const debugRecorder = useDebugRecorder();

  // Store access
  const {
    buildings,
    setBuildings,
    activeType,
    setActiveType,
    showWireframe,
    toggleWireframe,
    showSocketDebug,
    toggleSocketDebug,
    is2DMode,
    toggle2DMode,
    isDevMode,
    toggleDevMode,
    autoHeight,
    activeBuildingSet,
    setActiveBuildingSet,
    controlScheme,
    toggleControlScheme,
  } = useGameStore();

  const [heightToast, setHeightToast] = useState<string | null>(null);
  const didMountRef = useRef(false);
  const heightToastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isDevMode && debugRecorder.isRecording) {
      debugRecorder.stopRecording();
    }
  }, [isDevMode, debugRecorder.isRecording, debugRecorder.stopRecording]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    if (heightToastTimeoutRef.current) {
      window.clearTimeout(heightToastTimeoutRef.current);
    }
    setHeightToast(autoHeight ? 'Height: Auto' : 'Height: Manual');
    heightToastTimeoutRef.current = window.setTimeout(() => {
      setHeightToast(null);
      heightToastTimeoutRef.current = null;
    }, 1200);
    return () => {
      if (heightToastTimeoutRef.current) {
        window.clearTimeout(heightToastTimeoutRef.current);
      }
    };
  }, [autoHeight]);

  // Quick save to localStorage
  const handleSave = () => {
    if (buildings.length === 0) {
      alert('No buildings to save.');
      return;
    }
    try {
      const blueprint: SavedBlueprint = {
        version: BLUEPRINT_VERSION,
        name: 'Quick Save',
        createdAt: Date.now(),
        lastModified: Date.now(),
        buildings,
      };
      localStorage.setItem('dune-blueprint', JSON.stringify(blueprint));
      alert('Blueprint saved to local storage.');
    } catch (e) {
      console.error('Failed to save data', e);
      alert('Failed to save blueprint (quota exceeded?).');
    }
  };

  // Quick load from localStorage
  const handleLoad = () => {
    const savedData = localStorage.getItem('dune-blueprint');
    // Fallback to old format for backwards compatibility
    const legacyData = localStorage.getItem('dune-buildings');

    if (savedData) {
      try {
        const parsed: SavedBlueprint = JSON.parse(savedData);
        if (parsed.buildings && Array.isArray(parsed.buildings)) {
          setBuildings(parsed.buildings);
          alert(`Blueprint loaded (${parsed.buildings.length} pieces).`);
        }
      } catch (e) {
        console.error('Failed to parse saved data', e);
        alert('Failed to load save data.');
      }
    } else if (legacyData) {
      try {
        const parsed = JSON.parse(legacyData);
        if (Array.isArray(parsed)) {
          setBuildings(parsed);
          alert(`Legacy blueprint loaded (${parsed.length} pieces).`);
        }
      } catch (e) {
        console.error('Failed to parse legacy data', e);
        alert('Failed to load save data.');
      }
    } else {
      alert('No saved blueprint found.');
    }
  };

  // Export blueprint to JSON file
  const handleExport = () => {
    if (buildings.length === 0) {
      alert('No buildings to export.');
      return;
    }

    const name = prompt('Enter blueprint name:', 'My Blueprint') || 'My Blueprint';
    const blueprint: SavedBlueprint = {
      version: BLUEPRINT_VERSION,
      name,
      createdAt: Date.now(),
      lastModified: Date.now(),
      buildings,
    };

    const json = JSON.stringify(blueprint, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.dune.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import blueprint from JSON file
  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        // Handle both new format and legacy array format
        let buildingsToLoad: BuildingData[];
        if (parsed.buildings && Array.isArray(parsed.buildings)) {
          buildingsToLoad = parsed.buildings;
        } else if (Array.isArray(parsed)) {
          buildingsToLoad = parsed;
        } else {
          throw new Error('Invalid blueprint format');
        }

        // Validate building data
        const isValid = buildingsToLoad.every(
          (b: BuildingData) => b.id && b.type && b.position && b.rotation
        );
        if (!isValid) {
          throw new Error('Invalid building data in blueprint');
        }

        setBuildings(buildingsToLoad);
        const name = parsed.name || file.name;
        alert(`Imported "${name}" (${buildingsToLoad.length} pieces).`);
      } catch (err) {
        console.error('Failed to import blueprint', err);
        alert('Failed to import blueprint. Invalid file format.');
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be imported again
    e.target.value = '';
  };

  return (
    <div
      className="relative w-full h-screen bg-black selection:bg-dune-gold selection:text-black"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.dune.json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* 3D Canvas Layer */}
      <div className="absolute inset-0 z-0">
        <GameScene
          debugRecorder={isDevMode ? debugRecorder : undefined}
        />
      </div>

      {/* UI Overlay Layer - pointer-events-none allows clicks to pass through to canvas */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <Instructions
          controlScheme={controlScheme}
          isDevMode={isDevMode}
          toggleDevMode={toggleDevMode}
          heightToast={heightToast}
        />
        {isDevMode && <DebugRecorderUI debugRecorder={debugRecorder} />}
        <UI
          activeType={activeType}
          setActiveType={setActiveType}
          onClear={() => setBuildings([])}
          onSave={handleSave}
          onLoad={handleLoad}
          onExport={handleExport}
          onImport={handleImport}
          showWireframe={showWireframe}
          setShowWireframe={(val) => toggleWireframe()}
          showSocketDebug={showSocketDebug}
          setShowSocketDebug={(val) => toggleSocketDebug()}
          is2DMode={is2DMode}
          setIs2DMode={(val) => toggle2DMode()}
          isDevMode={isDevMode}
          controlScheme={controlScheme}
          toggleControlScheme={toggleControlScheme}
          activeBuildingSet={activeBuildingSet}
          setActiveBuildingSet={setActiveBuildingSet}
        />
      </div>

      {showV2Notice && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 px-4 pointer-events-auto">
          <div className="w-full max-w-md rounded-xl border border-dune-gold/50 bg-dune-ui/95 p-6 text-white shadow-2xl">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-dune-gold">
              New Version Available
            </div>
            <h1 className="text-2xl font-bold leading-tight">Dune Builder V2 is live</h1>
            <p className="mt-3 text-sm leading-6 text-white/75">
              This is the original builder. A newer V2 planner is now available with the latest
              build system work and will continue receiving updates.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <a
                href={V2_URL}
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-dune-gold px-4 py-3 text-sm font-bold uppercase tracking-wider text-black transition hover:bg-dune-gold/90"
              >
                Open V2
              </a>
              <button
                type="button"
                onClick={() => setShowV2Notice(false)}
                className="inline-flex flex-1 items-center justify-center rounded-lg border border-white/20 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white/80 transition hover:bg-white/10 hover:text-white"
              >
                Continue V1
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
