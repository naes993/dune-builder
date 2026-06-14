import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, ThreeEvent, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { PARTS } from '../registry/parts';
import { solvePlacement } from '../engine/snapSolver';
import { getWorldEdgeAnchors } from '../engine/anchors';
import { getWorldFootprint } from '../engine/occupancy';
import {
  BUILD_MODES,
  BuildMode,
  MENU_TABS,
  MenuTab,
  getDefaultPartCategory,
  getEffectiveCategoryMap,
  getTabParts,
  useV2BuilderStore,
} from '../store/builderStore';
import { PartId, PartInstance, PlacementCandidate, Transform2D } from '../types';
import { V2_BUILD } from '../version';
import { PartMesh } from './PartMesh';

const AnchorLines = ({ instance }: { instance: PartInstance }) => {
  const part = PARTS[instance.partId];
  const anchors = getWorldEdgeAnchors(part, instance.transform, instance.id);

  return (
    <group>
      {anchors.map((anchor) => (
        <line key={`${instance.id}-${anchor.id}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[
                new Float32Array([
                  anchor.startWorld[0], anchor.startWorld[1] + 0.08, anchor.startWorld[2],
                  anchor.endWorld[0], anchor.endWorld[1] + 0.08, anchor.endWorld[2],
                ]),
                3,
              ]}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#facc15" />
        </line>
      ))}
    </group>
  );
};

const FootprintOutline = ({
  instance,
  color = '#22c55e',
}: {
  instance: PartInstance;
  color?: string;
}) => {
  const part = PARTS[instance.partId];
  const points = getWorldFootprint(part, instance.transform);
  const outlineY = instance.transform.position[1] + 0.12;

  return (
    <lineLoop>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array(points.flatMap(([x, z]) => [x, outlineY, z])),
            3,
          ]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} />
    </lineLoop>
  );
};

const DebugEdgeLine = ({
  start,
  end,
  color,
  yOffset = 0.22,
}: {
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  yOffset?: number;
}) => {
  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[
            new Float32Array([
              start[0], start[1] + yOffset, start[2],
              end[0], end[1] + yOffset, end[2],
            ]),
            3,
          ]}
        />
      </bufferGeometry>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  );
};

const PreviewEdgeDiagnosticsLines = ({
  activePartId,
  instances,
  preview,
}: {
  activePartId: PartId;
  instances: PartInstance[];
  preview: PlacementCandidate;
}) => {
  const activePart = PARTS[activePartId];
  const binding = preview.binding;
  if (activePart.occupancyLayer !== 'wall-edge' || !binding) return null;

  const wallEdge = getWorldEdgeAnchors(activePart, preview.transform, 'preview').find(
    (anchor) => anchor.id === binding.sourceAnchorId
  );

  if (!wallEdge) return null;

  if (binding.placementMode === 'support-edge') {
    const targetInstance = instances.find((instance) => instance.id === binding.targetInstanceId);
    if (!targetInstance) return null;

    const targetPart = PARTS[targetInstance.partId];
    const targetEdge = getWorldEdgeAnchors(targetPart, targetInstance.transform, targetInstance.id).find(
      (anchor) => anchor.id === binding.targetAnchorId
    );

    if (!targetEdge) return null;

    return (
      <>
        <DebugEdgeLine start={targetEdge.startWorld} end={targetEdge.endWorld} color="#38bdf8" yOffset={0.34} />
        <DebugEdgeLine start={wallEdge.startWorld} end={wallEdge.endWorld} color="#f97316" yOffset={0.46} />
      </>
    );
  }

  return (
    <DebugEdgeLine start={wallEdge.startWorld} end={wallEdge.endWorld} color="#f97316" yOffset={0.46} />
  );
};

// Facing indicator for wall/door ghost previews: an arrow pointing outward
// from the outer (_Ext) face plus a faint orange tint over the inner (_Int)
// face, mirroring the game's orange banding. The outer face is local +Z
// (measured from the GLB _Ext/_Int primitives via scripts/inspect-facing.mjs);
// flipped facings are 180° rotations, so rendering in part-local space tracks R.
const FACING_COLOR = '#f97316';

const FacingIndicator = ({
  partId,
  transform,
}: {
  partId: PartId;
  transform: Transform2D;
}) => {
  const part = PARTS[partId];
  if (part.category !== 'wall' && part.category !== 'wall-door') return null;

  const halfWidth = Math.max(...part.footprint.points.map(([x]) => Math.abs(x)));
  const halfDepth = Math.max(...part.footprint.points.map(([, z]) => Math.abs(z)));
  const arrowY = part.height * 0.5;
  const shaftLength = 1.1;
  const headLength = 0.55;
  const shaftStart = halfDepth + 0.2;

  return (
    <group
      position={[transform.position[0], transform.position[1], transform.position[2]]}
      rotation={[0, transform.rotationY, 0]}
    >
      <mesh
        raycast={() => null}
        position={[0, arrowY, shaftStart + shaftLength / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <cylinderGeometry args={[0.07, 0.07, shaftLength, 8]} />
        <meshBasicMaterial color={FACING_COLOR} depthTest={false} transparent opacity={0.9} />
      </mesh>
      <mesh
        raycast={() => null}
        position={[0, arrowY, shaftStart + shaftLength + headLength / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <coneGeometry args={[0.24, headLength, 12]} />
        <meshBasicMaterial color={FACING_COLOR} depthTest={false} transparent opacity={0.9} />
      </mesh>
      <mesh
        raycast={() => null}
        position={[0, part.height / 2, -(halfDepth + 0.04)]}
        rotation={[0, Math.PI, 0]}
      >
        <planeGeometry args={[halfWidth * 2 * 0.96, part.height * 0.96]} />
        <meshBasicMaterial
          color={FACING_COLOR}
          transparent
          opacity={0.16}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};

const WallEndpointMarkers = ({ instance }: { instance: PartInstance }) => {
  const part = PARTS[instance.partId];
  if (part.occupancyLayer !== 'wall-edge') return null;

  const anchors = getWorldEdgeAnchors(part, instance.transform, instance.id);

  return (
    <>
      {anchors.flatMap((anchor) => [
        <mesh key={`${instance.id}-${anchor.id}-start`} position={[anchor.startWorld[0], anchor.startWorld[1] + 0.28, anchor.startWorld[2]]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>,
        <mesh key={`${instance.id}-${anchor.id}-end`} position={[anchor.endWorld[0], anchor.endWorld[1] + 0.28, anchor.endWorld[2]]}>
          <sphereGeometry args={[0.13, 12, 12]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>,
      ])}
    </>
  );
};

const formatSnapChannel = (channel?: string) => {
  if (channel === 'foundation-structure') return 'Structural';
  if (channel === 'floor-support') return 'Floor';
  if (channel === 'wall-support') return 'Wall';
  return undefined;
};

const SceneContents = () => {
  const {
    activePartId,
    buildMode,
    copyPiece,
    debugVisuals,
    demolishInstance,
    hoveredInstanceId,
    instances,
    placePreview,
    preview,
    replaceInstance,
    rotationY,
    setHoveredInstance,
    setPreview,
  } = useV2BuilderStore();
  const groundRef = useRef<THREE.Mesh>(null);
  const lastCursorRef = useRef<[number, number, number]>([0, 0, 0]);

  const updatePreview = (point: THREE.Vector3) => {
    lastCursorRef.current = [point.x, point.y, point.z];
    setPreview(
      solvePlacement({
        cursor: lastCursorRef.current,
        activePartId,
        rotationY,
        instances,
      })
    );
  };

  const handleGroundPointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoveredInstance(null);
    updatePreview(event.point);
  };

  const handleGroundClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    if (buildMode === 'build') placePreview();
  };

  const handleInstancePointerMove = (instanceId: string) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHoveredInstance(instanceId);
    updatePreview(event.point);
  };

  const handleInstanceClick = (instanceId: string) => (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 5) return;
    event.stopPropagation();
    if (buildMode === 'build') placePreview();
    if (buildMode === 'demolish') demolishInstance(instanceId);
    if (buildMode === 'replace') replaceInstance(instanceId);
  };

  const handleInstancePointerDown = (instanceId: string) => (event: ThreeEvent<PointerEvent>) => {
    // Middle mouse copies the piece, like the game.
    if (event.button !== 1) return;
    event.stopPropagation();
    copyPiece(instanceId);
  };

  const highlightFor = (instanceId: string) => {
    if (hoveredInstanceId !== instanceId) return undefined;
    if (buildMode === 'demolish') return '#ef4444';
    if (buildMode === 'replace') return '#38bdf8';
    return undefined;
  };

  useEffect(() => {
    setPreview(
      solvePlacement({
        cursor: lastCursorRef.current,
        activePartId,
        rotationY,
        instances,
      })
    );
  }, [activePartId, instances, rotationY, setPreview]);

  useFrame(() => {
    if (!preview && groundRef.current) {
      setPreview(
        solvePlacement({
          cursor: [0, 0, 0],
          activePartId,
          rotationY,
          instances,
        })
      );
    }
  });

  return (
    <group>
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        onPointerMove={handleGroundPointerMove}
        onClick={handleGroundClick}
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#d2b076" roughness={0.95} />
      </mesh>
      {/* Part GLBs load inside a Suspense boundary so a first-time load suspends
          only the meshes — never the ground plane above, which owns the pointer
          handlers that drive the placement cursor. (GLBs are also preloaded in
          PartMesh, so this is a safety net rather than the common path.) */}
      <Suspense fallback={null}>
      {/* Placed parts are pointer targets too, so the cursor tracks the surface
          under the mouse instead of the ground hidden behind elevated parts. */}
      {instances.map((instance) => (
        <group
          key={instance.id}
          onPointerMove={handleInstancePointerMove(instance.id)}
          onClick={handleInstanceClick(instance.id)}
          onPointerDown={handleInstancePointerDown(instance.id)}
        >
          <PartMesh
            partId={instance.partId}
            transform={instance.transform}
            debugVisuals={debugVisuals}
            highlightColor={highlightFor(instance.id)}
          />
          {debugVisuals && (
            <>
              <AnchorLines instance={instance} />
              <FootprintOutline instance={instance} />
              <WallEndpointMarkers instance={instance} />
            </>
          )}
        </group>
      ))}
      {preview && buildMode === 'build' && (
        <>
          <PartMesh
            partId={activePartId}
            transform={preview.transform}
            debugVisuals={debugVisuals}
            ghost
            valid={preview.isValid}
          />
          <FacingIndicator partId={activePartId} transform={preview.transform} />
          {debugVisuals && (
            <FootprintOutline
              instance={{ id: 'preview', partId: activePartId, transform: preview.transform }}
              color={preview.isValid ? '#59e38a' : '#f05252'}
            />
          )}
          {debugVisuals && (
            <PreviewEdgeDiagnosticsLines
              activePartId={activePartId}
              instances={instances}
              preview={preview}
            />
          )}
        </>
      )}
      </Suspense>
    </group>
  );
};

const PlacementDebugPanel = () => {
  const { activePartId, debugVisuals, preview } = useV2BuilderStore();
  const activePart = PARTS[activePartId];
  const binding = preview?.binding;

  if (!debugVisuals || !binding) return null;

  return (
    <div className="pointer-events-none absolute left-4 top-40 z-10 max-w-sm rounded-lg border border-sky-400/30 bg-black/75 p-3 text-[11px] leading-5 text-white shadow-xl backdrop-blur">
      <div className="mb-1 font-semibold uppercase tracking-wide text-sky-300">Placement Debug</div>
      <div>mode: {binding.placementMode}</div>
      <div>channel: {binding.snapChannel ?? 'none'}</div>
      {binding.placementMode === 'support-edge' && (
        <>
          <div>support instance: {binding.targetInstanceId}</div>
          <div>support edge: {binding.targetAnchorId}</div>
        </>
      )}
      {binding.placementMode === 'wall-run' && (
        <>
          <div>target wall: {binding.targetWallInstanceId}</div>
          <div>target endpoint: {binding.targetWallEndpointId}</div>
        </>
      )}
      <div>wall edge: {binding.sourceAnchorId ?? 'none'}</div>
      <div>source endpoint: {binding.sourceEndpointId ?? 'none'}</div>
      <div>key: {binding.occupancyKey ?? 'none'}</div>
      <div className={binding.targetOccupied ? 'text-red-300' : 'text-emerald-300'}>
        target status: {binding.targetOccupied ? 'occupied' : 'free'}
      </div>
      {activePart.occupancyLayer === 'wall-edge' && (
        <div className="mt-1 text-white/50">blue = support edge, orange = wall endpoint/preview segment</div>
      )}
    </div>
  );
};

const TAB_LABELS: Record<MenuTab, string> = {
  all: 'ALL',
  structural: 'STRUCTURAL',
  walls: 'WALLS',
  'wedge-walls': 'WEDGE WALLS',
  roofs: 'ROOFS',
  inclines: 'INCLINES',
  special: 'SPECIAL',
};

const MODE_LABELS: Record<BuildMode, string> = {
  build: 'Build',
  replace: 'Replace',
  customize: 'Customize',
  demolish: 'Demolish',
};

const partLabel = (partId: PartId) => PARTS[partId].name.replace(/^Harkonnen (Level 3 )?/, '');

const BuildModePanel = () => {
  const { buildMode } = useV2BuilderStore();

  return (
    <div className="pointer-events-none absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-lg border border-white/15 bg-black/70 p-3 text-right text-white shadow-xl backdrop-blur">
      {BUILD_MODES.map((mode) => (
        <div
          key={mode}
          className={`px-2 py-1 text-sm font-semibold ${
            buildMode === mode ? 'text-dune-gold' : 'text-white/45'
          }`}
        >
          {MODE_LABELS[mode]}
        </div>
      ))}
      <div className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-4 text-white/50">
        Right Click: change mode
        <br />
        Left Click: apply
      </div>
    </div>
  );
};

const SettingsPanel = () => {
  const { categoryOverrides, setCategoryOverride, settingsOpen, toggleSettings } = useV2BuilderStore();
  const [masterCopied, setMasterCopied] = useState(false);

  if (!settingsOpen) return null;

  const categories = MENU_TABS.filter((tab): tab is Exclude<MenuTab, 'all'> => tab !== 'all');

  const copyMasterJson = async () => {
    const json = JSON.stringify(getEffectiveCategoryMap(categoryOverrides), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setMasterCopied(true);
      setTimeout(() => setMasterCopied(false), 2500);
    } catch {
      // Clipboard unavailable (e.g. insecure context); show the JSON instead.
      window.prompt('Copy the master category JSON:', json);
    }
  };

  return (
    <div className="absolute right-4 top-4 z-20 max-h-[80vh] w-96 overflow-y-auto rounded-lg border border-white/15 bg-black/90 p-4 text-white shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-wide text-dune-gold">Admin · Part Registry</div>
        <button onClick={toggleSettings} className="rounded bg-white/10 px-2 py-1 text-xs hover:bg-white/20">
          Close
        </button>
      </div>
      <div className="mb-2 text-[11px] leading-4 text-white/55">
        Assign each piece to its in-game build-menu category. Changes save to this browser immediately and
        persist across sessions; an asterisk marks pieces moved from the shipped master organization.
      </div>
      <div className="mb-3 flex items-center gap-2">
        <button
          onClick={copyMasterJson}
          className="rounded bg-dune-gold/20 px-2 py-1 text-[11px] font-semibold text-dune-gold hover:bg-dune-gold/30"
        >
          {masterCopied ? 'Copied!' : 'Copy Master JSON'}
        </button>
        <span className="text-[10px] leading-3 text-white/40">
          Paste into v2/registry/categoryMaster.ts and deploy to make this the default for everyone.
        </span>
      </div>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-white/40">
            <th className="pb-1 font-semibold">Piece</th>
            <th className="pb-1 font-semibold">Category</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(PARTS).map((part) => (
            <tr key={part.id} className="border-t border-white/10">
              <td className="py-1.5 pr-2">
                <div className="font-semibold">
                  {partLabel(part.id)}
                  {categoryOverrides[part.id] ? ' *' : ''}
                </div>
                <div className="text-[10px] text-white/35">{part.id}</div>
              </td>
              <td className="py-1.5">
                <select
                  value={categoryOverrides[part.id] ?? getDefaultPartCategory(part.id)}
                  onChange={(event) =>
                    setCategoryOverride(part.id, event.target.value as Exclude<MenuTab, 'all'>)
                  }
                  className="w-full rounded bg-white/10 px-2 py-1 text-xs text-white"
                >
                  {categories.map((category) => (
                    <option key={category} value={category} className="bg-zinc-900">
                      {TAB_LABELS[category]}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Toolbar = () => {
  const {
    activePartId,
    activeTab,
    buildMode,
    categoryOverrides,
    clear,
    cycleActivePart,
    cycleTab,
    debugVisuals,
    instances,
    menuExpanded,
    preview,
    rotateActivePart,
    rotationY,
    setActivePartId,
    setActiveTab,
    toggleDebugVisuals,
    toggleMenuExpanded,
    toggleSettings,
  } = useV2BuilderStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key === 'r') rotateActivePart();
      if (key === 'q') cycleTab(-1);
      if (key === 'e') cycleTab(1);
      if (key === 'b') toggleMenuExpanded();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cycleTab, rotateActivePart, toggleMenuExpanded]);

  useEffect(() => {
    // Mouse wheel cycles pieces like the game; hold Shift to zoom the camera.
    const handleWheel = (event: WheelEvent) => {
      if (event.shiftKey) return;
      event.preventDefault();
      cycleActivePart(event.deltaY > 0 ? 1 : -1);
    };
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [cycleActivePart]);

  const tabParts = getTabParts(activeTab, categoryOverrides);

  if (!menuExpanded) {
    return (
      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4 pointer-events-none">
        <div className="pointer-events-auto rounded-lg border border-white/15 bg-black/75 px-4 py-2 text-xs text-white/70 shadow-2xl backdrop-blur">
          <span className="font-semibold text-dune-gold">{MODE_LABELS[buildMode]}</span>
          {' · '}
          {partLabel(activePartId)} · Press B for the build menu
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto flex max-w-[min(96vw,1280px)] flex-col items-center gap-2 rounded-lg border border-white/15 bg-black/75 px-3 py-3 text-white shadow-2xl backdrop-blur">
        <div className="flex flex-wrap items-center justify-center gap-1">
          <span className="mr-1 rounded bg-white/10 px-2 py-1 text-[10px] font-bold text-white/60">Q</span>
          {MENU_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`h-8 rounded px-3 text-xs font-bold tracking-wide transition ${
                activeTab === tab ? 'bg-dune-gold text-black' : 'bg-white/5 text-white/60 hover:bg-white/15'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
          <span className="ml-1 rounded bg-white/10 px-2 py-1 text-[10px] font-bold text-white/60">E</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {tabParts.length === 0 && (
            <div className="px-4 py-2 text-xs italic text-white/40">No pieces in this category yet</div>
          )}
          {tabParts.map((partId) => (
            <button
              key={partId}
              onClick={() => setActivePartId(partId)}
              className={`h-10 rounded-md px-4 text-sm font-semibold transition ${
                activePartId === partId ? 'bg-dune-gold text-black' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {partLabel(partId)}
            </button>
          ))}
          <button
            onClick={rotateActivePart}
            className="h-10 rounded-md bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
          >
            Rotate {Math.round((rotationY * 180) / Math.PI)} deg
          </button>
          <button
            onClick={clear}
            className="h-10 rounded-md bg-red-950/70 px-4 text-sm font-semibold text-red-100 hover:bg-red-900"
          >
            Clear
          </button>
          <label className="flex h-10 items-center gap-2 rounded-md bg-white/10 px-3 text-sm font-semibold text-white">
            <input
              type="checkbox"
              checked={debugVisuals}
              onChange={toggleDebugVisuals}
              className="h-4 w-4 accent-dune-gold"
            />
            Debug
          </label>
          <button
            onClick={toggleSettings}
            className="h-10 rounded-md bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
          >
            Admin
          </button>
          <div className="ml-2 min-w-44 text-xs text-white/70">
            <div>
              {instances.length} placed · <span className="text-dune-gold">{MODE_LABELS[buildMode]}</span>
            </div>
            <div className={preview?.isValid === false ? 'text-red-300' : 'text-emerald-300'}>
              {buildMode === 'demolish'
                ? 'Click a piece to demolish'
                : buildMode === 'replace'
                  ? 'Click a wall piece to swap it'
                  : buildMode === 'customize'
                    ? 'Customize is not implemented yet'
                    : preview?.isValid === false
                      ? preview.reasons[0]
                      : preview?.placementMode === 'wall-run'
                        ? 'Wall run'
                        : preview?.placementMode === 'support-edge'
                          ? `Support edge${formatSnapChannel(preview.binding?.snapChannel) ? `: ${formatSnapChannel(preview.binding?.snapChannel)}` : ''}`
                          : 'Free placement'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const BuilderCanvas = () => {
  const cycleBuildMode = useV2BuilderStore((state) => state.cycleBuildMode);
  const [shiftHeld, setShiftHeld] = useState(false);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => setShiftHeld(event.shiftKey);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('keyup', handleKey);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  return (
    <div
      className="relative h-screen w-full bg-black"
      onContextMenu={(event) => {
        event.preventDefault();
        cycleBuildMode();
      }}
    >
      <Canvas camera={{ position: [10, 12, 10], fov: 50 }}>
        <color attach="background" args={['#111827']} />
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 20, 10]} intensity={1.1} />
        <SceneContents />
        <OrbitControls
          makeDefault
          maxPolarAngle={Math.PI / 2 - 0.05}
          enableZoom={shiftHeld}
          mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.ROTATE }}
        />
      </Canvas>
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-sm rounded-lg border border-white/15 bg-black/70 p-4 text-white shadow-xl backdrop-blur">
        <div className="text-sm font-bold uppercase tracking-wide text-dune-gold">V2 Placement Engine</div>
        <div className="mt-2 text-xs leading-5 text-white/70">
          Real Harkonnen parts; the first placed piece establishes the build grid. Left Click applies the current
          mode, Right Click cycles modes, R rotates, Q/E switch categories, Mouse Wheel cycles pieces, Middle Click
          copies a piece, B toggles this menu. Middle-drag orbits, Left-drag pans, Shift+Wheel zooms.
        </div>
        <div className="mt-3 border-t border-white/10 pt-3 text-[11px] leading-4 text-white/55">
          <div className="font-semibold text-white/70">{V2_BUILD.id}</div>
          <div>{V2_BUILD.description}</div>
        </div>
      </div>
      <PlacementDebugPanel />
      <BuildModePanel />
      <SettingsPanel />
      <Toolbar />
    </div>
  );
};

export default BuilderCanvas;
