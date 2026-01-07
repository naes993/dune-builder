import React, { useState, useRef } from 'react';
import { GameScene } from './components/Scene';
import UI, { Instructions, DebugRecorderUI } from './components/UI';
import { BuildingType, BuildingData, SavedBlueprint } from './types';
import { useDebugRecorder } from './hooks/useDebugRecorder';

const BLUEPRINT_VERSION = 1;

export default function App() {
  const [activeType, setActiveType] = useState<BuildingType>(BuildingType.SQUARE_FOUNDATION);
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [showWireframe, setShowWireframe] = useState(false);
  const [showSocketDebug, setShowSocketDebug] = useState(false);
  const [is2DMode, setIs2DMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debug recorder
  const debugRecorder = useDebugRecorder();

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
          buildings={buildings}
          setBuildings={setBuildings}
          activeType={activeType}
          showWireframe={showWireframe}
          showSocketDebug={showSocketDebug}
          is2DMode={is2DMode}
          debugRecorder={debugRecorder}
        />
      </div>

      {/* UI Overlay Layer - pointer-events-none allows clicks to pass through to canvas */}
      <div className="absolute inset-0 z-10 pointer-events-none">
         <Instructions />
         <DebugRecorderUI debugRecorder={debugRecorder} />
         <UI
           activeType={activeType}
           setActiveType={setActiveType}
           onClear={() => setBuildings([])}
           onSave={handleSave}
           onLoad={handleLoad}
           onExport={handleExport}
           onImport={handleImport}
           showWireframe={showWireframe}
           setShowWireframe={setShowWireframe}
           showSocketDebug={showSocketDebug}
           setShowSocketDebug={setShowSocketDebug}
           is2DMode={is2DMode}
           setIs2DMode={setIs2DMode}
           debugRecorder={debugRecorder}
         />
      </div>
    </div>
  );
}