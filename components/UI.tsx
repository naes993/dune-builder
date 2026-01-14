import React from 'react';
import { BuildingType } from '../types';
import { Square, Triangle, BrickWall, Scan, Tent, TrendingUp, Grid3X3, Save, FolderOpen, Circle, DoorOpen, Minus, Download, Upload, Bug, Video, VideoOff, FilmIcon, Compass } from 'lucide-react';

interface UIProps {
  activeType: BuildingType;
  setActiveType: (t: BuildingType) => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
  onImport: () => void;
  showWireframe: boolean;
  setShowWireframe: (b: boolean) => void;
  showSocketDebug: boolean;
  setShowSocketDebug: (b: boolean) => void;
  is2DMode: boolean;
  setIs2DMode: (b: boolean) => void;
  debugRecorder: {
    isRecording: boolean;
    frameCount: number;
    startRecording: () => void;
    stopRecording: () => void;
    downloadRecording: () => void;
    clearRecording: () => void;
  };
}

const UI = ({ activeType, setActiveType, onClear, onSave, onLoad, onExport, onImport, showWireframe, setShowWireframe, showSocketDebug, setShowSocketDebug, is2DMode, setIs2DMode, debugRecorder }: UIProps) => {
  const tools = [
    // Foundations
    { type: BuildingType.SQUARE_FOUNDATION, icon: Square, label: 'Square', category: 'foundation' },
    { type: BuildingType.TRIANGLE_FOUNDATION, icon: Triangle, label: 'Triangle', category: 'foundation' },
    { type: BuildingType.CURVED_FOUNDATION, icon: Circle, label: 'Curved', category: 'foundation' },
    // Walls
    { type: BuildingType.WALL, icon: BrickWall, label: 'Wall', category: 'wall' },
    { type: BuildingType.HALF_WALL, icon: Minus, label: 'Half Wall', category: 'wall' },
    { type: BuildingType.WINDOW_WALL, icon: Scan, label: 'Window', category: 'wall' },
    { type: BuildingType.DOORWAY, icon: DoorOpen, label: 'Doorway', category: 'wall' },
    // Roofs
    { type: BuildingType.SQUARE_ROOF, icon: Tent, label: 'Roof (Sq)', category: 'roof' },
    { type: BuildingType.TRIANGLE_ROOF, icon: Tent, label: 'Roof (Tri)', category: 'roof' },
    // Inclines
    { type: BuildingType.STAIRS, icon: TrendingUp, label: 'Stairs', category: 'incline' },
    { type: BuildingType.RAMP, icon: TrendingUp, label: 'Ramp', category: 'incline' },
  ];

  return (
    <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-dune-ui backdrop-blur-md p-4 rounded-xl border border-dune-gold/30 flex flex-wrap justify-center gap-2 text-white shadow-2xl pointer-events-auto max-w-[95vw]">
      {/* Foundations */}
      <div className="flex gap-2">
        {tools.filter(t => t.category === 'foundation').map((t) => (
          <button
            key={t.type}
            onClick={() => setActiveType(t.type)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-16 sm:w-20
              ${activeType === t.type
                ? 'bg-dune-gold text-black scale-105 font-bold shadow-[0_0_15px_rgba(212,160,86,0.5)]'
                : 'hover:bg-white/10 text-gray-300'
              }`}
          >
            <t.icon size={20} />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-center leading-tight">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px bg-white/20 mx-1"></div>

      {/* Walls */}
      <div className="flex gap-2">
        {tools.filter(t => t.category === 'wall').map((t) => (
          <button
            key={t.type}
            onClick={() => setActiveType(t.type)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-16 sm:w-20
              ${activeType === t.type
                ? 'bg-dune-gold text-black scale-105 font-bold shadow-[0_0_15px_rgba(212,160,86,0.5)]'
                : 'hover:bg-white/10 text-gray-300'
              }`}
          >
            <t.icon size={20} />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-center leading-tight">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px bg-white/20 mx-1"></div>

      {/* Roofs & Inclines */}
      <div className="flex gap-2">
        {tools.filter(t => t.category === 'roof' || t.category === 'incline').map((t) => (
          <button
            key={t.type}
            onClick={() => setActiveType(t.type)}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-16 sm:w-20
              ${activeType === t.type
                ? 'bg-dune-gold text-black scale-105 font-bold shadow-[0_0_15px_rgba(212,160,86,0.5)]'
                : 'hover:bg-white/10 text-gray-300'
              }`}
          >
            <t.icon size={20} />
            <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-center leading-tight">{t.label}</span>
          </button>
        ))}
      </div>

      <div className="w-px bg-white/20 mx-1"></div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 text-gray-300 transition-all w-16 sm:w-20"
          title="Quick Save to Browser"
        >
          <Save size={20} />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider">Save</span>
        </button>

        <button
          onClick={onLoad}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-white/10 text-gray-300 transition-all w-16 sm:w-20"
          title="Quick Load from Browser"
        >
          <FolderOpen size={20} />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider">Load</span>
        </button>

        <button
          onClick={onExport}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-green-900/50 text-green-300 transition-all w-16 sm:w-20"
          title="Export Blueprint to File"
        >
          <Download size={20} />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider">Export</span>
        </button>

        <button
          onClick={onImport}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-900/50 text-blue-300 transition-all w-16 sm:w-20"
          title="Import Blueprint from File"
        >
          <Upload size={20} />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider">Import</span>
        </button>

        <button
          onClick={() => setShowWireframe(!showWireframe)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-16 sm:w-20
               ${showWireframe ? 'bg-blue-500/50 text-white' : 'hover:bg-white/10 text-gray-300'}`}
        >
          <Grid3X3 size={20} />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider">View</span>
        </button>

        <button
          onClick={() => setShowSocketDebug(!showSocketDebug)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-16 sm:w-20
               ${showSocketDebug ? 'bg-purple-500/50 text-white' : 'hover:bg-white/10 text-gray-300'}`}
          title="Toggle Socket Debug View"
        >
          <Bug size={20} />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider">Sockets</span>
        </button>

        <button
          onClick={() => setIs2DMode(!is2DMode)}
          className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 w-16 sm:w-20
               ${is2DMode ? 'bg-green-500/50 text-white' : 'hover:bg-white/10 text-gray-300'}`}
          title="Toggle 2D Top-Down View"
        >
          <Compass size={20} />
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider">2D</span>
        </button>

        <button
          onClick={onClear}
          className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-red-900/50 text-red-300 transition-all w-16 sm:w-20"
        >
          <span className="text-lg font-bold">X</span>
          <span className="text-[9px] sm:text-[10px] uppercase tracking-wider">Clear</span>
        </button>
      </div>
    </div>
  );
};

// Build version - increment this with each deployment
export const BUILD_VERSION = 'v1.7.3';

export const Instructions = () => (
  <div className="absolute top-4 left-4 bg-dune-ui/80 p-4 rounded-lg text-white/80 font-mono text-sm border-l-2 border-dune-gold max-w-xs pointer-events-auto">
    <h3 className="text-dune-gold font-bold mb-2 uppercase">Protocol</h3>
    <ul className="space-y-1 list-disc pl-4">
      <li><strong className="text-white">Left Click</strong>: Place Structure</li>
      <li><strong className="text-white">Right Click</strong>: Demolish</li>
      <li><strong className="text-white">R</strong>: Rotate Preview</li>
      <li><strong className="text-white">Arrow Up/Down</strong>: Stack Height</li>
      <li><strong className="text-white">Drag</strong>: Orbit Camera</li>
    </ul>
    <div className="mt-3 pt-2 border-t border-white/20 text-[10px] text-white/50">
      Build: {BUILD_VERSION}
    </div>
  </div>
);

interface DebugRecorderUIProps {
  debugRecorder: {
    isRecording: boolean;
    frameCount: number;
    startRecording: () => void;
    stopRecording: () => void;
    downloadRecording: () => void;
    clearRecording: () => void;
  };
}

export const DebugRecorderUI = ({ debugRecorder }: DebugRecorderUIProps) => (
  <div className="absolute top-4 right-4 bg-dune-ui/80 p-4 rounded-lg text-white/80 font-mono text-sm border-r-2 border-red-500 max-w-xs pointer-events-auto">
    <h3 className="text-red-400 font-bold mb-2 uppercase flex items-center gap-2">
      <Video size={16} className={debugRecorder.isRecording ? 'animate-pulse text-red-500' : ''} />
      Debug Recorder
    </h3>

    <div className="space-y-2">
      <div className="text-xs text-white/60">
        {debugRecorder.isRecording ? (
          <span className="text-red-400 font-bold">● RECORDING</span>
        ) : (
          <span>Ready</span>
        )}
        <span className="ml-2">({debugRecorder.frameCount} frames)</span>
      </div>

      <div className="flex gap-2">
        {!debugRecorder.isRecording ? (
          <button
            onClick={debugRecorder.startRecording}
            className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-white text-xs font-bold uppercase transition-colors"
          >
            <Video size={14} className="inline mr-1" />
            Start
          </button>
        ) : (
          <button
            onClick={debugRecorder.stopRecording}
            className="flex-1 px-3 py-1.5 bg-gray-600 hover:bg-gray-700 rounded text-white text-xs font-bold uppercase transition-colors"
          >
            <VideoOff size={14} className="inline mr-1" />
            Stop
          </button>
        )}

        <button
          onClick={debugRecorder.downloadRecording}
          disabled={debugRecorder.frameCount === 0}
          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded text-white text-xs font-bold uppercase transition-colors"
        >
          <Download size={14} className="inline mr-1" />
          Save
        </button>
      </div>

      {debugRecorder.frameCount > 0 && (
        <button
          onClick={debugRecorder.clearRecording}
          className="w-full px-3 py-1 bg-gray-800 hover:bg-gray-900 rounded text-white/60 text-xs uppercase transition-colors"
        >
          Clear
        </button>
      )}

      <div className="mt-3 pt-2 border-t border-white/20 text-[10px] text-white/40">
        Records cursor, snaps, placements for debugging
      </div>
    </div>
  </div>
);

export default UI;